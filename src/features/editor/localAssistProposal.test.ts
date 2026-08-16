import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  localAssistProposalStore,
  type LocalAssistProposal,
} from "./localAssistProposal";
import { useLocalAssistProposal } from "../../hooks/editor/useLocalAssistProposal";
import type { AppleAssistTargetSnapshot } from "../../types";

function target(text: string): AppleAssistTargetSnapshot {
  return {
    kind: "paragraph",
    start: 0,
    end: text.length,
    text,
    label: "",
    activeDocumentPath: "/workspace/note.md",
    activeDocumentName: "note.md",
    activeDocumentSessionId: "session:note-1",
    capturedAtMs: 0,
  };
}

function proposal(candidateText: string): LocalAssistProposal {
  return {
    requestId: "req-1",
    request: "整えて",
    actionId: "rewrite_natural",
    originalText: "original",
    candidateText,
    target: target("original"),
    conversationId: "conv-1",
    turnIndex: 0,
  };
}

describe("localAssistProposalStore", () => {
  it("records and clears the latest proposal per tab without cross-tab leaks", () => {
    localAssistProposalStore.record("session:a", proposal("candidate-a"));
    localAssistProposalStore.record("session:b", proposal("candidate-b"));

    expect(localAssistProposalStore.getLatest("session:a")?.candidateText).toBe(
      "candidate-a",
    );
    expect(localAssistProposalStore.getLatest("session:b")?.candidateText).toBe(
      "candidate-b",
    );
    expect(localAssistProposalStore.getLatest("session:missing")).toBeNull();

    localAssistProposalStore.clear("session:a");
    expect(localAssistProposalStore.getLatest("session:a")).toBeNull();
    expect(localAssistProposalStore.getLatest("session:b")?.candidateText).toBe(
      "candidate-b",
    );
  });

  it("notifies subscribers on record and clear", () => {
    const listener = vi.fn();
    const unsubscribe = localAssistProposalStore.subscribe(listener);
    localAssistProposalStore.record("session:c", proposal("candidate-c"));
    expect(listener).toHaveBeenCalledTimes(1);

    localAssistProposalStore.clear("session:c");
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    localAssistProposalStore.record("session:c", proposal("candidate-c2"));
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe("useLocalAssistProposal", () => {
  it("reflects the store's latest proposal and clears it", () => {
    localAssistProposalStore.clear("session:hook");

    const { result } = renderHook(() => useLocalAssistProposal("session:hook"));
    expect(result.current.proposal).toBeNull();

    act(() => {
      localAssistProposalStore.record("session:hook", proposal("candidate"));
    });
    expect(result.current.proposal?.candidateText).toBe("candidate");

    act(() => {
      result.current.clearProposal();
    });
    expect(result.current.proposal).toBeNull();
  });
});
