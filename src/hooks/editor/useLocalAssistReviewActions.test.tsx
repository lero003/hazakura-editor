import { act, cleanup, renderHook } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createUntitledEditorTab, isDirty } from "../../features/editor/editorTabs";
import { localAssistProposalStore, type LocalAssistProposal } from "../../features/editor/localAssistProposal";
import { useLocalAssistReviewActions } from "./useLocalAssistReviewActions";

vi.mock("@tauri-apps/api/event", () => ({ emitTo: vi.fn(async () => {}) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

function setup({ locked = false, contents = "original" } = {}) {
  const tab = { ...createUntitledEditorTab(), contents, lastSavedContents: "original" };
  const setActiveTabId = vi.fn();
  const setStatus = vi.fn();
  const proposal: LocalAssistProposal = {
    requestId: `review-${tab.sessionId}`, request: "整えて", actionId: "rewrite_natural",
    originalText: "original", candidateText: "revised", conversationId: null, turnIndex: 0,
    target: {
      kind: "paragraph", start: 0, end: 8, text: "original", label: "",
      activeDocumentName: tab.name, activeDocumentPath: tab.path,
      activeDocumentSessionId: tab.sessionId, capturedAtMs: 0,
    },
  };
  const hook = renderHook(() => {
    const [tabs, setTabs] = useState([tab]);
    const actions = useLocalAssistReviewActions({
      activeTab: tabs[0] ?? null, tabs, setTabs, setActiveTabId, setStatus,
      rejectIfAppleAssistLocksTab: () => locked,
    });
    return { ...actions, tabs, setTabs };
  });
  return { ...hook, tab, proposal, setActiveTabId, setStatus };
}

describe("useLocalAssistReviewActions", () => {
  it("retains an unapplied proposal and the buffer while generation is locked", async () => {
    const { result, tab, proposal } = setup({ locked: true });
    localAssistProposalStore.record(tab.sessionId, proposal);
    try {
      expect((await result.current.applyLocalAssistProposal(proposal)).ok).toBe(false);
      await result.current.discardLocalAssistProposal(proposal);
      expect(localAssistProposalStore.getLatest(tab.sessionId)).toBe(proposal);
      expect(result.current.tabs[0].contents).toBe("original");
    } finally {
      localAssistProposalStore.clear(tab.sessionId);
    }
  });

  it("discards an unapplied proposal without changing or saving the source", async () => {
    const { result, tab, proposal } = setup();
    localAssistProposalStore.record(tab.sessionId, proposal);
    await act(async () => result.current.discardLocalAssistProposal(proposal));
    expect(localAssistProposalStore.getLatest(tab.sessionId)).toBeNull();
    expect(result.current.tabs[0]).toEqual(tab);
  });

  it("keeps hand edits until discard is confirmed, and cancel preserves them", () => {
    const { result, tab } = setup({ contents: "revised and edited" });
    act(() => result.current.discardAppleAssistEdit(tab.sessionId, "original", "revised"));
    expect(result.current.pendingAssistDiscard).not.toBeNull();
    expect(result.current.tabs[0].contents).toBe("revised and edited");
    act(() => result.current.cancelDiscardAppleAssistEdit());
    expect(result.current.pendingAssistDiscard).toBeNull();
    expect(isDirty(result.current.tabs[0])).toBe(true);

    act(() => result.current.discardAppleAssistEdit(tab.sessionId, "original", "revised"));
    act(() => result.current.confirmPendingAssistDiscard());
    expect(result.current.tabs[0].contents).toBe("original");
    expect(result.current.tabs[0].lastSavedContents).toBe("original");
    expect(result.current.pendingAssistDiscard).toBeNull();
  });

  it("does not restore an old session into a replacement tab", () => {
    const { result, tab, setActiveTabId } = setup({ contents: "revised and edited" });
    act(() => result.current.discardAppleAssistEdit(tab.sessionId, "original", "revised"));
    const replacement = { ...tab, sessionId: "replacement-session", contents: "new session" };
    act(() => result.current.setTabs([replacement]));
    act(() => result.current.confirmPendingAssistDiscard());
    expect(result.current.tabs[0]).toEqual(replacement);
    expect(setActiveTabId).not.toHaveBeenCalled();
  });
});
