import { afterEach, describe, expect, it, vi } from "vitest";
import {
  APPLE_ASSIST_CONTEXT_POST_CHARS, APPLE_ASSIST_CONTEXT_PRE_CHARS,
  APPLE_ASSIST_SELECTION_CONTEXT_POST_CHARS, APPLE_ASSIST_SELECTION_CONTEXT_PRE_CHARS,
  buildSurroundingDocumentContext, getAppleAssistContextWindow, isSameAppleAssistTargetTab,
  sanitizeAppleAssistCandidateText, stripCandidatePreamble, readTargetTextForGeneration,
  applyReviewedLocalAssistProposal,
} from "./useAppleAssistApplyHandler";
import { aiEditTransactionStore } from "../../features/editor/aiEditTransactions";
import { localAssistProposalStore, type LocalAssistProposal } from "../../features/editor/localAssistProposal";
import type { AppleAssistTargetSnapshot } from "../../types";
import { APPLE_ASSIST_MAX_CONTEXT_CHARS } from "../../lib/tauri/appleAssist";

vi.mock("@tauri-apps/api/event", () => ({ emitTo: vi.fn(async () => {}) }));

function context(buffer: string, target: string, pre = 2000, post = 2000, max = 8000): string {
  const start = buffer.indexOf(target);
  return buildSurroundingDocumentContext(buffer, start, start + target.length, pre, post, max);
}
describe("buildSurroundingDocumentContext", () => {
  it("centers the slice on the target, not on the document head", () => {
    const target = "section-a\nsection-b\n";
    const buffer = "DOCUMENT-HEAD\n" + "head-pad\n".repeat(1000) + target + "tail-pad\n".repeat(400);
    const result = context(buffer, target);
    expect(result).toContain(target); expect(result).not.toContain("DOCUMENT-HEAD");
  });
  it("preserves heading and following lines around the target", () => {
    const buffer = "# Important Heading\nintro line\nTARGET line\nafter line\n";
    expect(context(buffer, "TARGET")).toBe(buffer);
  });
  it("snaps the pre boundary to the start of the target's line", () => {
    expect(context("aaa\nbbb\nccc\n", "bbb", 50, 50, 200)).toContain("bbb");
  });
  it("snaps forward to a line start when the target starts mid-line", () => {
    const buffer = "first line here\nsecond line starts here\nthird line\n";
    const target = "starts here\n";
    const result = context(buffer, target, 20, 20, 200);
    const index = result.indexOf(target);
    expect(index).toBeGreaterThan(0);
    expect(result.slice(0, index).endsWith("second line ")).toBe(true);
  });
  it("snaps the post boundary to the end of the target's line", () => {
    expect(context("first line here\nsecond line starts here\nthird line\n", "second", 20, 20, 200)).not.toContain("third");
  });
  it("returns no post slice when the target is at the end of the document", () => {
    expect(context("line one\nline two\nline three", "line three", 50, 50, 200).endsWith("line three")).toBe(true);
  });
  it("returns no pre slice when the target is at the start of the document", () => {
    expect(context("line one\nline two\nline three\n", "line one", 50, 50, 200).startsWith("line one")).toBe(true);
  });
  it("never shrinks or duplicates the target when the total exceeds the cap", () => {
    const result = context("a".repeat(3000) + "TARGET" + "b".repeat(3000), "TARGET", 2000, 2000, 2000);
    expect(result).toContain("TARGET"); expect(result.match(/TARGET/gu)).toHaveLength(1);
    expect(result.length).toBeLessThanOrEqual(2000);
  });
  it("never returns more characters than the context cap allows", () => {
    const result = context("a".repeat(5000) + "TARGET" + "b".repeat(5000), "TARGET");
    expect(result).toContain("TARGET"); expect(result.length).toBeLessThanOrEqual(APPLE_ASSIST_MAX_CONTEXT_CHARS);
  });
  it("applies the cap to the actual returned context", () => {
    const result = context("a".repeat(3000) + "TARGET" + "b".repeat(3000) + "\n", "TARGET", 2000, 2000, 2000);
    expect(result).toContain("TARGET"); expect(result.length).toBeLessThanOrEqual(2000);
  });
  it("snaps the returned slice boundaries to full lines when possible", () => {
    const buffer = ["prefix line that should be dropped", "kept heading", "kept intro", "TARGET line", "kept after", "suffix line that should be dropped"].join("\n");
    expect(context(buffer, "TARGET", 34, 32, 200)).toBe("kept heading\nkept intro\nTARGET line\nkept after\n");
  });
  it("clamps the pre window to the document start", () => {
    const buffer = "pre text here\nTARGET\npost";
    const result = buildSurroundingDocumentContext(buffer, 4, buffer.indexOf("TARGET") + 6, 5000, 5000, 10000);
    expect(result).toContain("pre"); expect(result).toContain("TARGET");
  });
  it("retains the entire target even when it alone exceeds the context budget", () => {
    expect(context("prefixTARGETsuffix", "TARGET", 20, 20, 3)).toBe("TARGET");
  });
});

describe("getAppleAssistContextWindow", () => {
  it("uses a tighter context window for explicit selections", () => {
    expect(getAppleAssistContextWindow("selection")).toEqual({ preChars: APPLE_ASSIST_SELECTION_CONTEXT_PRE_CHARS, postChars: APPLE_ASSIST_SELECTION_CONTEXT_POST_CHARS });
    expect(APPLE_ASSIST_SELECTION_CONTEXT_PRE_CHARS).toBeLessThan(APPLE_ASSIST_CONTEXT_PRE_CHARS);
    expect(APPLE_ASSIST_SELECTION_CONTEXT_POST_CHARS).toBeLessThan(APPLE_ASSIST_CONTEXT_POST_CHARS);
  });
  it("keeps the broader context window for inferred targets", () => {
    for (const kind of ["paragraph", "block", "section", "document"] as const) {
      expect(getAppleAssistContextWindow(kind)).toEqual({ preChars: APPLE_ASSIST_CONTEXT_PRE_CHARS, postChars: APPLE_ASSIST_CONTEXT_POST_CHARS });
    }
  });
});

describe("sanitizeAppleAssistCandidateText", () => {
  it.each([
    ["<<<HAZAKURA_TEXT_START\nTranslated body\nHAZAKURA_TEXT_END>>>", "Translated body"],
    ["<<<HAZAKURA_CONTEXT_START\nReference context\nHAZAKURA_CONTEXT_END>>>", "Reference context"],
    ["<<<HAZAKURA_ORIGINAL_START>>>\nOriginal pinned body\n<<<HAZAKURA_ORIGINAL_END>>>", "Original pinned body"],
    ["<<<HAZAKURA_ORIGINAL_START", ""],
    ["# Heading\n\n- item\n", "# Heading\n\n- item\n"],
    ["修正後の文章は以下の通りです。\n\n本文です。\n", "本文です。"],
    ["修正後：本文です。", "本文です。"],
    ["Here is the revised text:\n\nRevised body.", "Revised body."],
    ["修正後の利用規約は、8月1日から適用されます。", "修正後の利用規約は、8月1日から適用されます。"],
    ["Translation memory is enabled.", "Translation memory is enabled."],
  ])("preserves the established cleanup contract: %s", (input, expected) => {
    expect(sanitizeAppleAssistCandidateText(input)).toBe(expected);
  });
});

describe("stripCandidatePreamble", () => {
  it.each([
    ["# Heading\n\n- item\n", "# Heading\n\n- item\n"],
    ["修正後の文章は以下の通りです。\n本文", "本文"],
    ["修正後：\n本文", "本文"],
    ["修正後：新しい本文", "新しい本文"],
    ["Translation: New text", "New text"],
    ["Translation - New text", "New text"],
    ["修正後の利用規約は、8月1日から適用されます。", "修正後の利用規約は、8月1日から適用されます。"],
    ["翻訳後のファイルを開いてください。", "翻訳後のファイルを開いてください。"],
    ["Translation memory is enabled.", "Translation memory is enabled."],
    ["Translation-based workflows are useful.", "Translation-based workflows are useful."],
  ])("strips only a recognized lead-in: %s", (input, expected) => {
    expect(stripCandidatePreamble(input)).toBe(expected);
  });
});

const activeTab = { id: "tab-1", sessionId: "session:tab-1", path: "/workspace/note.md", name: "note.md", contents: "hello world" };
function makeProposal(contents = activeTab.contents, candidateText = "整えた本文"): LocalAssistProposal {
  const target: AppleAssistTargetSnapshot = { kind: "paragraph", start: 0, end: contents.length, text: contents, label: "",
    activeDocumentPath: activeTab.path, activeDocumentName: activeTab.name, activeDocumentSessionId: activeTab.sessionId, capturedAtMs: 0 };
  const proposal: LocalAssistProposal = { requestId: "req-1", request: "整えて", actionId: "rewrite_natural", originalText: contents, candidateText,
    target, conversationId: "conv-1", turnIndex: 0 };
  localAssistProposalStore.record(activeTab.sessionId, proposal);
  return proposal;
}
function seedOldReview(): void {
  const proposal = makeProposal();
  aiEditTransactionStore.record({ id: "previous-transaction", tabId: activeTab.sessionId, tabName: activeTab.name, tabPath: activeTab.path,
    request: "前の依頼", target: proposal.target, before: activeTab.contents, after: "前の案", beforeBuffer: activeTab.contents,
    afterBuffer: "前の案", appliedAtMs: 0, diff: null });
}
afterEach(() => { aiEditTransactionStore.clear(activeTab.sessionId); localAssistProposalStore.clear(activeTab.sessionId); vi.restoreAllMocks(); });

describe("isSameAppleAssistTargetTab", () => {
  it("requires id, path and open session identity, but not identical contents", () => {
    expect(isSameAppleAssistTargetTab(activeTab, { ...activeTab, contents: "changed" })).toBe(true);
    expect(isSameAppleAssistTargetTab(activeTab, { ...activeTab, id: "tab-2" })).toBe(false);
    expect(isSameAppleAssistTargetTab(activeTab, { ...activeTab, path: "/other.md" })).toBe(false);
    expect(isSameAppleAssistTargetTab(activeTab, { ...activeTab, sessionId: "reopened" })).toBe(false);
  });
});

describe("applyReviewedLocalAssistProposal", () => {
  it("writes the reviewed proposal once and clears any older review state", async () => {
    seedOldReview(); const proposal = makeProposal(); const write = vi.fn();
    expect(await applyReviewedLocalAssistProposal({ proposal, activeTab, setActiveTabContents: write })).toEqual({ ok: true });
    expect(write).toHaveBeenCalledTimes(1); expect(write).toHaveBeenCalledWith("整えた本文", activeTab.sessionId);
    expect(aiEditTransactionStore.getLatest(activeTab.sessionId)).toBeNull();
    expect(localAssistProposalStore.getLatest(activeTab.sessionId)).toBeNull();
  });
  it("rejects a proposal whose pinned original no longer matches the buffer", async () => {
    const write = vi.fn(); const proposal = { ...makeProposal(), originalText: "stale original" };
    const result = await applyReviewedLocalAssistProposal({ proposal, activeTab, setActiveTabContents: write });
    expect(result.ok).toBe(false); if (!result.ok) expect(result.error).toContain("pinned original");
    expect(write).not.toHaveBeenCalled(); expect(aiEditTransactionStore.getLatest(activeTab.sessionId)).toBeNull();
  });
  it("rejects a proposal from a stale editor session before writing", async () => {
    const write = vi.fn();
    const result = await applyReviewedLocalAssistProposal({ proposal: makeProposal(), activeTab: { ...activeTab, sessionId: "session:new" }, setActiveTabContents: write });
    expect(result.ok).toBe(false); if (!result.ok) expect(result.error).toContain("session");
    expect(write).not.toHaveBeenCalled();
  });
  it("rejects repeated apply even if Undo has restored the original document", async () => {
    const proposal = makeProposal(); const write = vi.fn();
    const input = { proposal, activeTab, setActiveTabContents: write };
    expect((await applyReviewedLocalAssistProposal(input)).ok).toBe(true);
    expect((await applyReviewedLocalAssistProposal(input)).ok).toBe(false);
    expect(write).toHaveBeenCalledTimes(1);
  });
  it("preserves the proposal and old review on a failed buffer write, then allows retry", async () => {
    seedOldReview(); const previous = aiEditTransactionStore.getLatest(activeTab.sessionId);
    const proposal = makeProposal();
    const write = vi.fn().mockImplementationOnce(() => { throw new Error("write failed"); });
    expect((await applyReviewedLocalAssistProposal({ proposal, activeTab, setActiveTabContents: write })).ok).toBe(false);
    expect(localAssistProposalStore.getLatest(activeTab.sessionId)).toBe(proposal);
    expect(aiEditTransactionStore.getLatest(activeTab.sessionId)).toBe(previous);
    expect((await applyReviewedLocalAssistProposal({ proposal, activeTab, setActiveTabContents: write })).ok).toBe(true);
  });
  it("does not silently clean the text after the user reviews it", async () => {
    const proposal = makeProposal(activeTab.contents, "修正後：実際の本文"); const write = vi.fn();
    expect((await applyReviewedLocalAssistProposal({ proposal, activeTab, setActiveTabContents: write })).ok).toBe(false);
    expect(write).not.toHaveBeenCalled(); expect(localAssistProposalStore.getLatest(activeTab.sessionId)).toBe(proposal);
  });
  it("rejects a replaced or streaming proposal", async () => {
    const old = makeProposal(); const latest = { ...old, requestId: "new", streaming: true };
    localAssistProposalStore.record(activeTab.sessionId, latest); const write = vi.fn();
    for (const proposal of [old, latest]) expect((await applyReviewedLocalAssistProposal({ proposal, activeTab, setActiveTabContents: write })).ok).toBe(false);
    expect(write).not.toHaveBeenCalled();
  });
  it("rejects no-op changes and permits a later valid proposal", async () => {
    const proposal = makeProposal(activeTab.contents, activeTab.contents); const write = vi.fn();
    expect((await applyReviewedLocalAssistProposal({ proposal, activeTab, setActiveTabContents: write })).ok).toBe(false);
    expect(localAssistProposalStore.getLatest(activeTab.sessionId)).toBe(proposal);
    expect((await applyReviewedLocalAssistProposal({ proposal: makeProposal(), activeTab, setActiveTabContents: write })).ok).toBe(true);
  });
  it("keeps Markdown indentation, hard-break spaces and final newline exactly", async () => {
    const text = "    code\n本文  \n\n"; const write = vi.fn();
    expect((await applyReviewedLocalAssistProposal({ proposal: makeProposal(activeTab.contents, text), activeTab, setActiveTabContents: write })).ok).toBe(true);
    expect(write).toHaveBeenCalledWith(text, activeTab.sessionId);
  });
  it("does not report a status-notification failure as an application failure", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const proposal = makeProposal(); const write = vi.fn();
    expect((await applyReviewedLocalAssistProposal({ proposal, activeTab, setActiveTabContents: write, setStatus: () => { throw new Error("UI observer"); } })).ok).toBe(true);
    expect(write).toHaveBeenCalledTimes(1); expect(localAssistProposalStore.getLatest(activeTab.sessionId)).toBeNull();
  });
  it("fails closed for non-integral and non-finite IPC ranges", () => {
    const proposal = makeProposal();
    for (const start of [NaN, Infinity, .5, -1]) expect(readTargetTextForGeneration({ ...proposal.target, start }, activeTab).ok).toBe(false);
  });
});
