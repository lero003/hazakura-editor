import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cancelAppleAssistProposal } from "../../lib/tauri/agent";
import { useAppleAssistProposalHandler } from "./useAppleAssistProposalHandler";
import { cancelSidebarProposal, isLocalAssistBusy } from "../../lib/appleAssist/sidebarBridge";
import { localAssistProposalStore } from "../../features/editor/localAssistProposal";
import type { ActiveTab } from "./useAppleAssistApplyHandler";
import type { AppleAssistApplyEvent, AppleAssistProposalStatusEvent } from "../../types";

const harness = vi.hoisted(() => ({
  cancel: null as null | ((event: { payload: string }) => void),
  receive: null as null | ((event: { payload: AppleAssistApplyEvent }) => void),
  generate: vi.fn(), stop: vi.fn(), emit: vi.fn(), unlisten: vi.fn(),
}));
vi.mock("../../lib/tauri/_runtime", () => ({ isTauriRuntime: () => true }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async (command: string, args: { requestId: string }) => {
  if (command !== "cancel_apple_assist_proposal") throw new Error(`Unexpected command: ${command}`);
  harness.cancel!({ payload: args.requestId });
}) }));
vi.mock("@tauri-apps/api/event", () => ({
  emitTo: (...args: unknown[]) => harness.emit(...args),
  listen: vi.fn(async (_name: string, callback: typeof harness.receive) => { if (_name.endsWith("cancel-ai-edit-proposal")) harness.cancel = callback as unknown as typeof harness.cancel;
    else harness.receive = callback; return harness.unlisten; }),
}));
vi.mock("../../lib/tauri/appleAssist", () => ({
  APPLE_ASSIST_MAX_CONTEXT_CHARS: 8000, APPLE_ASSIST_MAX_SELECTED_CHARS: 4000,
  stopAppleAssistGeneration: (...args: unknown[]) => harness.stop(...args),
  generateAppleAssistCandidateStreaming: (...args: unknown[]) => harness.generate(...args),
}));
const tab: ActiveTab = { id: "tab", sessionId: "lifecycle", name: "note.md", path: "/workspace/note.md", contents: "before\nTARGET\nafter" };
function request(requestId = "one"): AppleAssistApplyEvent {
  return { requestId, request: "整えて", actionId: "rewrite_natural", requestedAtMs: 0, conversationId: "conversation", conversationOriginalText: "TARGET",
    target: { kind: "selection", start: 7, end: 13, text: "TARGET", label: "選択範囲", activeDocumentPath: tab.path,
      activeDocumentName: tab.name, activeDocumentSessionId: tab.sessionId, capturedAtMs: 0 } };
}
function deferred() {
  let resolve!: (value: { candidateText: unknown }) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<{ candidateText: unknown }>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
async function send(payload: AppleAssistApplyEvent): Promise<void> {
  await act(async () => { harness.receive!({ payload }); });
}
function phases(): AppleAssistProposalStatusEvent[] { return harness.emit.mock.calls.map((call) => call[2]); }
let restoreRaf: typeof window.requestAnimationFrame;
beforeEach(() => {
  harness.cancel = null; harness.receive = null; harness.generate.mockReset(); harness.emit.mockReset(); harness.unlisten.mockReset();
  harness.emit.mockResolvedValue(undefined);
  harness.stop.mockReset(); harness.stop.mockResolvedValue(true);
  localAssistProposalStore.clear(tab.sessionId);
  restoreRaf = window.requestAnimationFrame;
  window.requestAnimationFrame = (callback) => window.setTimeout(() => callback(0), 0);
});
afterEach(() => { cleanup(); localAssistProposalStore.clear(tab.sessionId); window.requestAnimationFrame = restoreRaf; });

describe("Local Assist asynchronous lifecycle", () => {
  it("cancels a detached request before native startup and preserves the previous proposal", async () => {
    harness.generate.mockResolvedValue({ candidateText: "previous" });
    const setStatus = vi.fn();
    renderHook(() => useAppleAssistProposalHandler({ activeTab: tab, setStatus }));
    await send(request("previous"));
    await waitFor(() => expect(localAssistProposalStore.getLatest(tab.sessionId)?.candidateText).toBe("previous"));
    let release!: FrameRequestCallback;
    window.requestAnimationFrame = (callback) => { release = callback; return 1; };
    await send({ ...request("cancel-before-start"), proposalText: "previous" });
    await waitFor(() => expect(release).toBeDefined());
    expect(harness.cancel).toBeTypeOf("function");
    await act(async () => { await cancelAppleAssistProposal("cancel-before-start"); });
    expect(localAssistProposalStore.getLatest(tab.sessionId)?.candidateText).toBe("previous");
    expect(setStatus).toHaveBeenLastCalledWith("Hazakura Local Assist generation cancelled by user.");
    expect(isLocalAssistBusy()).toBe(true);
    await act(async () => { release(0); });
    await waitFor(() => expect(isLocalAssistBusy()).toBe(false));
    expect(harness.generate).toHaveBeenCalledTimes(1);
    expect(harness.stop).not.toHaveBeenCalled();
  });
  it("keeps the lock until the pending native stop also settles", async () => {
    const generation = deferred();
    let finishStop!: (value: boolean) => void;
    harness.stop.mockReturnValue(new Promise<boolean>((resolve) => { finishStop = resolve; }));
    harness.generate.mockReturnValueOnce(generation.promise);
    renderHook(() => useAppleAssistProposalHandler({ activeTab: tab }));
    await send(request("stopping"));
    await waitFor(() => expect(harness.generate).toHaveBeenCalledTimes(1));
    await act(async () => { await cancelAppleAssistProposal("stopping"); });
    await act(async () => generation.resolve({ candidateText: "LATE" }));
    expect(isLocalAssistBusy()).toBe(true);
    await send(request("too-early"));
    expect(harness.generate).toHaveBeenCalledTimes(1);
    await act(async () => finishStop(true));
    await waitFor(() => expect(isLocalAssistBusy()).toBe(false));
    expect(localAssistProposalStore.getLatest(tab.sessionId)).toBeNull();
  });
  it("rejects late completion after detached cancel and ignores an old cancel during a new request", async () => {
    const old = deferred(); const fresh = deferred();
    harness.generate.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    renderHook(() => useAppleAssistProposalHandler({ activeTab: tab }));
    await send(request("old")); await waitFor(() => expect(harness.generate).toHaveBeenCalledTimes(1));
    expect(harness.cancel).toBeTypeOf("function");
    await act(async () => { await cancelAppleAssistProposal("old"); });
    expect(isLocalAssistBusy()).toBe(true);
    await send(request("overlap"));
    expect(harness.generate).toHaveBeenCalledTimes(1);
    await act(async () => old.resolve({ candidateText: "LATE" }));
    expect(localAssistProposalStore.getLatest(tab.sessionId)).toBeNull();
    await send(request("new")); await waitFor(() => expect(harness.generate).toHaveBeenCalledTimes(2));
    await act(async () => { await cancelAppleAssistProposal("old"); });
    expect(harness.stop).toHaveBeenCalledTimes(1);
    await act(async () => fresh.resolve({ candidateText: "NEW" }));
    expect(localAssistProposalStore.getLatest(tab.sessionId)?.candidateText).toBe("NEW");
    await act(async () => { await cancelAppleAssistProposal("new"); });
    expect(localAssistProposalStore.getLatest(tab.sessionId)?.candidateText).toBe("NEW");
    expect(harness.stop).toHaveBeenCalledTimes(1);
  });
  it.each(["案\n\nHAZAKURA_TEXT_END", "案\n<<<HAZAKURA_TEXT_END", "HAZAKURA_TEXT_START\n案"])("rejects residual delimiters and restores the previous draft (%#)", async (candidateText) => {
    harness.generate.mockResolvedValueOnce({ candidateText: "previous" }).mockResolvedValueOnce({ candidateText });
    renderHook(() => useAppleAssistProposalHandler({ activeTab: tab }));
    await send(request());
    await waitFor(() => expect(localAssistProposalStore.getLatest(tab.sessionId)?.candidateText).toBe("previous"));
    const previous = localAssistProposalStore.getLatest(tab.sessionId);
    await send({ ...request("two"), proposalText: "previous" });
    await waitFor(() => expect(phases().some((event) => event.requestId === "two" && event.phase === "failed")).toBe(true));
    expect(localAssistProposalStore.getLatest(tab.sessionId)).toBe(previous);
    expect(tab.contents).toBe("before\nTARGET\nafter");
  });
  it("rejects overlapping requests until the singleton native helper settles", async () => {
    const old = deferred();
    harness.generate.mockReturnValueOnce(old.promise).mockResolvedValueOnce({ candidateText: "LATEST" });
    renderHook(() => useAppleAssistProposalHandler({ activeTab: tab }));
    await send(request("old")); await waitFor(() => expect(harness.generate).toHaveBeenCalledTimes(1));
    await send(request("overlap"));
    expect(harness.generate).toHaveBeenCalledTimes(1);
    expect(phases().some((event) => event.requestId === "overlap" && event.phase === "failed")).toBe(true);
    await act(async () => old.resolve({ candidateText: "OLD" }));
    await waitFor(() => expect(isLocalAssistBusy()).toBe(false));
    await send(request("latest"));
    await waitFor(() => expect(localAssistProposalStore.getLatest(tab.sessionId)?.candidateText).toBe("LATEST"));
    expect(harness.generate).toHaveBeenCalledTimes(2);
  });
  it("retains the native lock while cancellation is settling and rejects late output", async () => {
    const pending = deferred(); harness.generate.mockReturnValue(pending.promise);
    let lock: import("../../types").AppleAssistGenerationLock | null = null;
    renderHook(() => useAppleAssistProposalHandler({ activeTab: tab,
      setGenerationLock: (next) => { lock = typeof next === "function" ? next(lock) : next; } }));
    await send(request()); await waitFor(() => expect(harness.generate).toHaveBeenCalledTimes(1));
    await act(async () => { await cancelSidebarProposal("one"); });
    expect(harness.stop).toHaveBeenCalledTimes(1);
    expect(lock).toMatchObject({ requestId: "one" });
    expect(isLocalAssistBusy()).toBe(true);
    await act(async () => pending.resolve({ candidateText: "LATE" }));
    expect(localAssistProposalStore.getLatest(tab.sessionId)).toBeNull();
    expect(lock).toBeNull();
    expect(isLocalAssistBusy()).toBe(false);
    expect(phases().some((event) => event.phase === "completed")).toBe(false);
  });
  it("starts only one native call for duplicate delivery", async () => {
    const pending = deferred(); harness.generate.mockReturnValue(pending.promise);
    renderHook(() => useAppleAssistProposalHandler({ activeTab: tab }));
    await send(request()); await send(request());
    await waitFor(() => expect(harness.generate).toHaveBeenCalledTimes(1));
    await act(async () => pending.resolve({ candidateText: "result" }));
  });
  it("invalidates a generation on switch-away, even when the user switches back", async () => {
    const pending = deferred(); harness.generate.mockReturnValue(pending.promise);
    const { rerender } = renderHook(({ activeTab }) => useAppleAssistProposalHandler({ activeTab }), { initialProps: { activeTab: tab } });
    await send(request()); await waitFor(() => expect(harness.generate).toHaveBeenCalledTimes(1));
    rerender({ activeTab: { ...tab, sessionId: "other", path: "/other.md" } });
    expect(harness.stop).toHaveBeenCalledTimes(1);
    expect(isLocalAssistBusy()).toBe(true);
    rerender({ activeTab: tab });
    await act(async () => pending.resolve({ candidateText: "late" }));
    expect(localAssistProposalStore.getLatest(tab.sessionId)).toBeNull();
    expect(phases().some((event) => event.phase === "completed")).toBe(false);
  });
  it("invalidates external edits outside the target while generating", async () => {
    const pending = deferred(); harness.generate.mockReturnValue(pending.promise);
    const { rerender } = renderHook(({ activeTab }) => useAppleAssistProposalHandler({ activeTab }), { initialProps: { activeTab: tab } });
    await send(request()); await waitFor(() => expect(harness.generate).toHaveBeenCalledTimes(1));
    rerender({ activeTab: { ...tab, contents: tab.contents + "\nexternal" } });
    await act(async () => pending.resolve({ candidateText: "late" }));
    expect(localAssistProposalStore.getLatest(tab.sessionId)).toBeNull();
  });
  it("ignores completion after unmount and unregisters the listener", async () => {
    const pending = deferred(); harness.generate.mockReturnValue(pending.promise);
    const { unmount } = renderHook(() => useAppleAssistProposalHandler({ activeTab: tab }));
    await send(request()); await waitFor(() => expect(harness.generate).toHaveBeenCalledTimes(1));
    unmount(); await act(async () => pending.resolve({ candidateText: "late" }));
    expect(localAssistProposalStore.getLatest(tab.sessionId)).toBeNull();
    expect(harness.unlisten).toHaveBeenCalledTimes(2);
    expect(phases().some((event) => event.phase === "completed")).toBe(false);
  });
  it.each(["", null, "<<<HAZAKURA_CONTEXT_START\nreference\nHAZAKURA_CONTEXT_END>>>", "x".repeat(64001)])("rejects empty, malformed, leaked or oversized output (%#)", async (candidateText) => {
    harness.generate.mockResolvedValue({ candidateText });
    renderHook(() => useAppleAssistProposalHandler({ activeTab: tab }));
    await send(request());
    await waitFor(() => expect(phases().some((event) => event.phase === "failed")).toBe(true));
    expect(localAssistProposalStore.getLatest(tab.sessionId)).toBeNull();
  });
  it("passes adjacent source once, and refines the current candidate with the pinned original", async () => {
    harness.generate.mockResolvedValue({ candidateText: "first candidate" });
    renderHook(() => useAppleAssistProposalHandler({ activeTab: tab }));
    await send(request());
    await waitFor(() => expect(localAssistProposalStore.getLatest(tab.sessionId)?.streaming).toBe(false));
    const firstPacket = harness.generate.mock.calls[0][0];
    expect(firstPacket.selectedText).toBe("TARGET");
    expect(firstPacket.documentContext).not.toContain("TARGET");
    expect(firstPacket.documentContext).toContain("before"); expect(firstPacket.documentContext).toContain("after");
    await send({ ...request("two"), proposalText: "first candidate", revisionHistory: ["整えて"], additionalRequest: "常体で", conversationTurnIndex: 1 });
    await waitFor(() => expect(harness.generate).toHaveBeenCalledTimes(2));
    const secondPacket = harness.generate.mock.calls[1][0];
    expect(secondPacket.selectedText).toBe("first candidate");
    expect(secondPacket.additionalRequest).toBe("常体で");
    expect(secondPacket.documentContext.match(/TARGET/gu)).toHaveLength(1);
  });
  it("keeps the previous completed proposal after cancelled refinement", async () => {
    harness.generate.mockResolvedValueOnce({ candidateText: "previous" }).mockRejectedValueOnce(new Error("cancelled by user"));
    renderHook(() => useAppleAssistProposalHandler({ activeTab: tab }));
    await send(request()); await waitFor(() => expect(localAssistProposalStore.getLatest(tab.sessionId)?.candidateText).toBe("previous"));
    await send({ ...request("two"), proposalText: "previous" });
    await waitFor(() => expect(phases().some((event) => event.phase === "cancelled")).toBe(true));
    expect(localAssistProposalStore.getLatest(tab.sessionId)?.candidateText).toBe("previous");
    expect(localAssistProposalStore.getLatest(tab.sessionId)?.streaming).toBe(false);
  });
  it.each(["文".repeat(4000), "🌸".repeat(4000), "か\u3099".repeat(2000)])("keeps a 4000-code-point candidate intact and allows refinement (%#)", async (candidateText) => {
    harness.generate.mockResolvedValueOnce({ candidateText }).mockResolvedValueOnce({ candidateText: "revised" });
    renderHook(() => useAppleAssistProposalHandler({ activeTab: tab }));
    await send(request());
    await waitFor(() => expect(localAssistProposalStore.getLatest(tab.sessionId)?.candidateText).toBe(candidateText));
    await send({ ...request("two"), proposalText: candidateText });
    await waitFor(() => expect(localAssistProposalStore.getLatest(tab.sessionId)?.candidateText).toBe("revised"));
    expect(harness.generate.mock.calls[1][0].selectedText).toBe(candidateText);
    expect(tab.contents).toBe("before\nTARGET\nafter");
  });
  it.each(["文".repeat(4001), "🌸".repeat(4001), "か\u3099".repeat(2000) + "文"])("rejects a 4001-code-point candidate without truncation or completion (%#)", async (candidateText) => {
    harness.generate.mockResolvedValue({ candidateText });
    renderHook(() => useAppleAssistProposalHandler({ activeTab: tab }));
    await send(request());
    await waitFor(() => expect(phases().some((event) => event.phase === "failed")).toBe(true));
    expect(phases().some((event) => event.phase === "completed")).toBe(false);
    expect(phases().at(-1)?.message).toContain("proposal exceeds the continuation limit");
    expect(localAssistProposalStore.getLatest(tab.sessionId)).toBeNull();
    expect(isLocalAssistBusy()).toBe(false);
    expect(tab.contents).toBe("before\nTARGET\nafter");
  });
  it("restores the previous complete draft after an over-limit refinement and can retry", async () => {
    harness.generate.mockResolvedValueOnce({ candidateText: "previous" })
      .mockResolvedValueOnce({ candidateText: "文".repeat(4001) })
      .mockResolvedValueOnce({ candidateText: "shorter" });
    renderHook(() => useAppleAssistProposalHandler({ activeTab: tab }));
    await send(request());
    await waitFor(() => expect(localAssistProposalStore.getLatest(tab.sessionId)?.candidateText).toBe("previous"));
    const previous = localAssistProposalStore.getLatest(tab.sessionId);
    await send({ ...request("two"), proposalText: "previous" });
    await waitFor(() => expect(phases().some((event) => event.requestId === "two" && event.phase === "failed")).toBe(true));
    expect(localAssistProposalStore.getLatest(tab.sessionId)).toBe(previous);
    await send({ ...request("three"), proposalText: "previous" });
    await waitFor(() => expect(localAssistProposalStore.getLatest(tab.sessionId)?.candidateText).toBe("shorter"));
  });

  it("pins the actual generation metadata and restores it with the prior draft", async () => {
    harness.generate.mockResolvedValueOnce({ candidateText: "previous", modelId: "apple:foundation-models:system-default", latencyMs: 123 })
      .mockRejectedValueOnce(new Error("cancelled by user"));
    renderHook(() => useAppleAssistProposalHandler({ activeTab: tab }));
    await send(request());
    await waitFor(() => expect(localAssistProposalStore.getLatest(tab.sessionId)?.streaming).toBe(false));
    expect(localAssistProposalStore.getLatest(tab.sessionId)?.generation).toEqual({ modelId: "apple:foundation-models:system-default", latencyMs: 123 });
    await send({ ...request("two"), proposalText: "previous" });
    await waitFor(() => expect(phases().some((event) => event.phase === "cancelled")).toBe(true));
    expect(localAssistProposalStore.getLatest(tab.sessionId)?.generation).toEqual({ modelId: "apple:foundation-models:system-default", latencyMs: 123 });
  });
  it.each([{}, { modelId: 123, latencyMs: -1 }])("keeps missing or malformed generation metadata unknown (%#)", async (metadata) => {
    harness.generate.mockResolvedValue({ candidateText: "draft", ...metadata });
    renderHook(() => useAppleAssistProposalHandler({ activeTab: tab }));
    await send(request());
    await waitFor(() => expect(localAssistProposalStore.getLatest(tab.sessionId)?.streaming).toBe(false));
    expect(localAssistProposalStore.getLatest(tab.sessionId)?.generation).toEqual({ modelId: null, latencyMs: null });
  });

});
