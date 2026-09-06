import { describe, expect, it } from "vitest";
import { buildSidebarTarget, sourceLineRange } from "./localAssistSidebarTarget";
import { beginSidebarTurn, createSidebarSession, settleSidebarTurn } from "./localAssistSidebarSession";
import { LocalAssistProposalStore, type LocalAssistProposal } from "./localAssistProposal";
import type { AppleAssistApplyEvent, AppleAssistProposalStatusEvent } from "../../types";

const document = { path: "/workspace/a.md", name: "a.md", sessionId: "a", contents: "first\r\nsecond\r\nthird" };
function payload(id = "r"): AppleAssistApplyEvent {
  const result = buildSidebarTarget({ document, scope: "lines", firstLine: "2", lastLine: "2", now: 0 });
  if (!result.ok) throw new Error("fixture target invalid");
  return { requestId: id, request: "短く", actionId: "shorten", conversationId: "c", target: result.target, requestedAtMs: 0 };
}
function status(phase: AppleAssistProposalStatusEvent["phase"], id = "r"): AppleAssistProposalStatusEvent {
  return { requestId: id, conversationId: "c", phase, request: "短く", message: "status", emittedAtMs: 0 };
}

describe("sidebar source target", () => {
  it("keeps the final CRLF outside a line replacement", () => {
    const target = payload().target!;
    expect(target.text).toBe("second");
    expect(document.contents.slice(0, target.start) + "new" + document.contents.slice(target.end)).toBe("first\r\nnew\r\nthird");
    const range = sourceLineRange(document.contents, 1, 2)!;
    expect(document.contents.slice(range.start, range.end)).toBe("first\r\nsecond");
  });
  it.each([["0", "2"], ["1", "99"], ["2", "1"], ["1.5", "2"], ["1e1", "1e1"], ["", "1"]])("rejects invalid range %s–%s", (firstLine, lastLine) => {
    expect(buildSidebarTarget({ document, scope: "lines", firstLine, lastLine })).toEqual({ ok: false, error: "invalidLines" });
  });
  it("requires the selected editor to match the selected page", () => {
    expect(buildSidebarTarget({ document, scope: "selection", selection: { text: "another page", from: 0, to: 1 } })).toEqual({ ok: false, error: "editorChanged" });
  });
  it("accepts 4000 code points without truncating 4001", () => {
    expect(buildSidebarTarget({ document: { ...document, contents: "🌸".repeat(4000) }, scope: "document" }).ok).toBe(true);
    expect(buildSidebarTarget({ document: { ...document, contents: "🌸".repeat(4001) }, scope: "document" })).toEqual({ ok: false, error: "tooLong" });
  });
  it("rejects absent selections, blank lines and split surrogate pairs", () => {
    expect(buildSidebarTarget({ document, scope: "selection" })).toEqual({ ok: false, error: "noSelection" });
    expect(buildSidebarTarget({ document: { ...document, contents: "\n " }, scope: "document" })).toEqual({ ok: false, error: "empty" });
    expect(buildSidebarTarget({ document: { ...document, contents: "🌸" }, scope: "selection", selection: { text: "🌸", from: 0, to: 1 } }).ok).toBe(false);
  });
});
describe("sidebar revision session", () => {
  it("ignores old and foreign terminal statuses", () => {
    const current = beginSidebarTurn(createSidebarSession(), payload());
    expect(settleSidebarTurn(current, status("completed", "old"))).toBe(current);
    expect(settleSidebarTurn(current, { ...status("completed"), conversationId: "other" })).toBe(current);
  });
  it("restores a failed request but does not add it to successful history", () => {
    const current = settleSidebarTurn(beginSidebarTurn(createSidebarSession(), payload()), status("failed"));
    expect(current.draft).toBe("短く"); expect(current.history).toEqual([]); expect(current.nextTurn).toBe(0);
  });
  it("keeps the next draft while cancelling and bounds history", () => {
    let current = beginSidebarTurn(createSidebarSession(), payload());
    current = settleSidebarTurn({ ...current, draft: "next" }, status("cancelled"));
    expect(current.draft).toBe("next");
    for (let i = 0; i < 30; i++) current = settleSidebarTurn(beginSidebarTurn(current, payload(String(i))), status("completed", String(i)));
    expect(current.turns).toHaveLength(20); expect(current.history).toHaveLength(4);
  });
  it.each(["conversation", "target"])("does not restore an unrelated %s proposal", (difference) => {
    const request = payload();
    const prior: LocalAssistProposal = { ...request, target: request.target!, conversationId: "c", actionId: "shorten", originalText: "second", candidateText: "new", turnIndex: 0 };
    const next = { ...prior, requestId: "new" };
    if (difference === "conversation") next.conversationId = "other";
    else { next.target = { ...prior.target, start: 0, end: 5, text: "first" }; next.originalText = "first"; }
    const store = new LocalAssistProposalStore(); store.record("a", prior);
    store.beginGeneration("a", next); store.settleGeneration("a", "new", true);
    expect(store.getLatest("a")).toBeNull();
  });
});
