import { describe, expect, it, vi } from "vitest";
import { LocalAssistProposalStore, type LocalAssistProposal } from "./localAssistProposal";
import { canBuildProposalLineDiff, countProposalCharacters, isProposalCurrentForDocument } from "./proposalReview";

function proposal(requestId = "one", candidateText = "新しい文章"): LocalAssistProposal {
  return { requestId, request: "整えて", actionId: "rewrite_natural", originalText: "元の文章", candidateText,
    conversationId: "conversation", turnIndex: 0,
    target: { kind: "selection", start: 0, end: 4, text: "元の文章", label: "選択範囲",
      activeDocumentPath: "/workspace/note.md", activeDocumentName: "note.md",
      activeDocumentSessionId: "session", capturedAtMs: 0 } };
}
const document = { path: "/workspace/note.md", sessionId: "session", contents: "元の文章" };

describe("proposal ownership and transitions", () => {
  it("publishes only the newest generation, even when the old one finishes last", () => {
    const store = new LocalAssistProposalStore();
    expect(store.beginGeneration("session", proposal("one"))).toBe(true);
    expect(store.beginGeneration("session", proposal("two"))).toBe(true);
    expect(store.completeGeneration("session", proposal("two"))).toBe(true);
    expect(store.completeGeneration("session", proposal("one"))).toBe(false);
    expect(store.getLatest("session")?.requestId).toBe("two");
  });
  it("ignores a duplicated generation event", () => {
    const store = new LocalAssistProposalStore();
    expect(store.beginGeneration("session", proposal())).toBe(true);
    expect(store.beginGeneration("session", proposal())).toBe(false);
    expect(store.completeGeneration("session", proposal())).toBe(true);
    expect(store.beginGeneration("session", proposal())).toBe(false);
  });
  it("restores the last completed draft, not an intervening streaming placeholder", () => {
    const store = new LocalAssistProposalStore();
    const previous = proposal("previous");
    store.record("session", previous);
    store.beginGeneration("session", proposal("one"));
    store.beginGeneration("session", proposal("two"));
    expect(store.settleGeneration("session", "one", true)).toBe(false);
    expect(store.ownsGeneration("session", "two")).toBe(true);
    expect(store.settleGeneration("session", "two", true)).toBe(true);
    expect(store.getLatest("session")).toBe(previous);
  });
  it("does not restore a stale target after cancellation/failure", () => {
    const store = new LocalAssistProposalStore();
    store.record("session", proposal("previous"));
    store.beginGeneration("session", proposal("one"));
    store.settleGeneration("session", "one", true, () => false);
    expect(store.getLatest("session")).toBeNull();
  });
  it("cannot revive a cleared session from a late completion", () => {
    const store = new LocalAssistProposalStore();
    store.beginGeneration("session", proposal());
    store.clear("session");
    expect(store.completeGeneration("session", proposal())).toBe(false);
  });
  it("claims the exact completed draft once and preserves it after write failure", () => {
    const store = new LocalAssistProposalStore();
    const current = proposal();
    store.record("session", current);
    expect(store.claimApply("session", { ...current })).toBe(false);
    expect(store.claimApply("session", current)).toBe(true);
    expect(store.claimApply("session", current)).toBe(false);
    expect(store.beginGeneration("session", proposal("new"))).toBe(false);
    store.finishApply("session", current, false);
    expect(store.getLatest("session")).toBe(current);
    expect(store.claimApply("session", current)).toBe(true);
    store.finishApply("session", current, true);
    expect(store.getLatest("session")).toBeNull();
    expect(store.claimApply("session", current)).toBe(false);
  });
  it("never consumes a replacement draft or a different session", () => {
    const store = new LocalAssistProposalStore();
    const current = proposal();
    const replacement = proposal("replacement");
    store.record("session", current);
    store.record("other", proposal("other"));
    expect(store.claimApply("session", current)).toBe(true);
    store.record("session", replacement);
    store.finishApply("session", current, true);
    expect(store.getLatest("session")).toBe(replacement);
    expect(store.getLatest("other")?.requestId).toBe("other");
  });
  it("isolates a failing subscriber and unsubscribes cleanly", () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const store = new LocalAssistProposalStore();
      const observed = vi.fn();
      store.subscribe(() => { throw new Error("view failure"); });
      const unsubscribe = store.subscribe(observed);
      expect(() => store.record("session", proposal())).not.toThrow();
      expect(observed).toHaveBeenCalledTimes(1);
      unsubscribe();
      store.clear("session");
      expect(observed).toHaveBeenCalledTimes(1);
    } finally { warning.mockRestore(); }
  });
});

describe("review limits and target identity", () => {
  it("keeps the pinned selection instead of consulting a new caret position", () => {
    expect(isProposalCurrentForDocument(proposal(), document)).toBe(true);
    expect(isProposalCurrentForDocument(proposal(), { ...document, contents: "別の文章" })).toBe(false);
    expect(isProposalCurrentForDocument(proposal(), { ...document, sessionId: "reopened" })).toBe(false);
    expect(isProposalCurrentForDocument(proposal(), { ...document, path: "/other.md" })).toBe(false);
    expect(isProposalCurrentForDocument({ ...proposal(), streaming: true }, document)).toBe(false);
  });
  it("rejects malformed ranges rather than coercing them to zero", () => {
    for (const start of [NaN, Infinity, -1, .5]) {
      const current = proposal();
      expect(isProposalCurrentForDocument({ ...current, target: { ...current.target, start } }, document)).toBe(false);
    }
  });
  it("counts code points and bounds expensive line diffs", () => {
    expect(countProposalCharacters("桜🌸a")).toBe(3);
    expect(canBuildProposalLineDiff("前", "後")).toBe(true);
    expect(canBuildProposalLineDiff("x".repeat(20_000), "y")).toBe(false);
    expect(canBuildProposalLineDiff("x\n".repeat(600), "y")).toBe(false);
  });
});
