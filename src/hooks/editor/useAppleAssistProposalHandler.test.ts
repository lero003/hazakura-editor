import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { emitTo, listen } from "@tauri-apps/api/event";
import { useAppleAssistProposalHandler } from "./useAppleAssistProposalHandler";
import {
  APPLE_ASSIST_PROPOSAL_STATUS_EVENT,
  REQUEST_AI_EDIT_PROPOSAL_EVENT,
  type AppleAssistApplyEvent,
  type AppleAssistTargetSnapshot,
} from "../../types";

type ProposalListener = Parameters<typeof listen<AppleAssistApplyEvent>>[1];
const proposalListeners: ProposalListener[] = [];

vi.mock("@tauri-apps/api/event", () => ({
  emitTo: vi.fn(async () => undefined),
  listen: vi.fn(async (_eventName: string, handler: ProposalListener) => {
    proposalListeners.push(handler);
    return () => undefined;
  }),
}));

vi.mock("../../lib/tauri/appleAssist", () => ({
  APPLE_ASSIST_MAX_CONTEXT_CHARS: 8000,
  generateAppleAssistCandidateStreaming: vi.fn(async () => ({
    candidateText: "proposal text",
  })),
}));

function targetSnapshot(text: string, contents: string): AppleAssistTargetSnapshot {
  const start = contents.indexOf(text);
  return {
    kind: "paragraph",
    start,
    end: start + text.length,
    text,
    label: "",
    activeDocumentPath: "/workspace/note.md",
    activeDocumentName: "note.md",
    capturedAtMs: 0,
  };
}

describe("useAppleAssistProposalHandler", () => {
  const originalRAF = window.requestAnimationFrame;

  beforeEach(() => {
    proposalListeners.length = 0;
    vi.mocked(listen).mockClear();
    vi.mocked(emitTo).mockClear();
    window.requestAnimationFrame = ((callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(0), 0)) as typeof window.requestAnimationFrame;
  });

  afterEach(() => {
    window.requestAnimationFrame = originalRAF;
  });

  it("streams an unapplied proposal without receiving or mutating a buffer setter", async () => {
    const contents = "original text";
    const target = targetSnapshot(contents, contents);
    const status = vi.fn();

    renderHook(() =>
      useAppleAssistProposalHandler({
        activeTab: {
          id: "/workspace/note.md",
          sessionId: "session:note-1",
          name: "note.md",
          path: "/workspace/note.md",
          contents,
        },
        setStatus: status,
      }),
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(proposalListeners).toHaveLength(1);

    const payload: AppleAssistApplyEvent = {
      requestId: "proposal-1",
      actionId: "proofread_only",
      request: "校正してください",
      target,
      requestedAtMs: 0,
    };
    proposalListeners[0]?.({ payload } as never);
    for (let i = 0; i < 8; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const proposalStatuses = vi
      .mocked(emitTo)
      .mock.calls.filter(([windowLabel, eventName]) =>
        windowLabel === "apple-assist" && eventName === APPLE_ASSIST_PROPOSAL_STATUS_EVENT,
      )
      .map(([, , eventPayload]) => eventPayload as Record<string, unknown>);

    expect(proposalStatuses.map((event) => event.phase)).toEqual([
      "started",
      "completed",
    ]);
    expect(proposalStatuses.at(-1)).toMatchObject({
      originalText: contents,
      candidateText: "proposal text",
      requestId: "proposal-1",
    });
    expect(status).toHaveBeenLastCalledWith(
      "Hazakura Local Assist created an unapplied proposal for Diff review.",
    );
    // The only document value in this handler is the validated snapshot;
    // no setter or transaction path is available to mutate the editor.
    expect(contents).toBe("original text");
    expect(REQUEST_AI_EDIT_PROPOSAL_EVENT).toBe("hazakura-note://request-ai-edit-proposal");
  });
});
