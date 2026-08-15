import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { emitTo, listen } from "@tauri-apps/api/event";
import { generateAppleAssistCandidateStreaming } from "../../lib/tauri/appleAssist";
import {
  APPLE_ASSIST_MAX_CONVERSATION_TURN_CHARS,
  APPLE_ASSIST_MAX_CONVERSATION_TURNS,
  buildAppleAssistRevisionContext,
  useAppleAssistProposalHandler,
} from "./useAppleAssistProposalHandler";
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
  APPLE_ASSIST_MAX_SELECTED_CHARS: 4000,
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
    activeDocumentSessionId: "session:note-1",
    capturedAtMs: 0,
  };
}

describe("useAppleAssistProposalHandler", () => {
  const originalRAF = window.requestAnimationFrame;

  beforeEach(() => {
    proposalListeners.length = 0;
    vi.mocked(listen).mockClear();
    vi.mocked(emitTo).mockClear();
    vi.mocked(generateAppleAssistCandidateStreaming).mockClear();
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

  it("pins the original target and feeds the current proposal into a follow-up turn", async () => {
    const contents = "original text";
    const target = targetSnapshot(contents, contents);

    renderHook(() =>
      useAppleAssistProposalHandler({
        activeTab: {
          id: "/workspace/note.md",
          sessionId: "session:note-1",
          name: "note.md",
          path: "/workspace/note.md",
          contents,
        },
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    const firstPayload: AppleAssistApplyEvent = {
      requestId: "conversation-1-turn-0",
      actionId: "rewrite_natural",
      request: "読みやすくしてください",
      target,
      requestedAtMs: 0,
      conversationId: "conversation-1",
      conversationTurnIndex: 0,
      conversationOriginalText: contents,
      revisionHistory: [],
    };
    proposalListeners[0]?.({ payload: firstPayload } as never);
    for (let i = 0; i < 8; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    expect(generateAppleAssistCandidateStreaming).toHaveBeenCalledTimes(1);
    expect(vi.mocked(generateAppleAssistCandidateStreaming).mock.calls[0]?.[0]).toMatchObject({
      selectedText: contents,
    });

    const secondPayload: AppleAssistApplyEvent = {
      requestId: "conversation-1-turn-1",
      actionId: "rewrite_natural",
      request: "もう少し短くしてください",
      target,
      requestedAtMs: 1,
      conversationId: "conversation-1",
      conversationTurnIndex: 1,
      conversationOriginalText: contents,
      proposalText: "proposal v1",
      revisionHistory: [firstPayload.request],
    };
    proposalListeners[0]?.({ payload: secondPayload } as never);
    for (let i = 0; i < 8; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const secondCall = vi.mocked(generateAppleAssistCandidateStreaming).mock.calls[1]?.[0];
    expect(secondCall).toMatchObject({ selectedText: "proposal v1" });
    expect(secondCall?.documentContext).toContain("Pinned original:");
    expect(secondCall?.documentContext).toContain(contents);
    expect(secondCall?.documentContext).toContain(firstPayload.request);

    const completed = vi
      .mocked(emitTo)
      .mock.calls.map(([, eventName, eventPayload]) =>
        eventName === APPLE_ASSIST_PROPOSAL_STATUS_EVENT
          ? (eventPayload as Record<string, unknown>)
          : null,
      )
      .filter((event): event is Record<string, unknown> => event !== null)
      .filter((event) => event.phase === "completed");
    expect(completed.at(-1)).toMatchObject({
      conversationId: "conversation-1",
      conversationTurnIndex: 1,
      originalText: contents,
    });
  });

  it("rejects a target from a different editor session before generation", async () => {
    const contents = "original text";
    const target = targetSnapshot(contents, contents);

    renderHook(() =>
      useAppleAssistProposalHandler({
        activeTab: {
          id: "/workspace/note.md",
          sessionId: "session:note-2",
          name: "note.md",
          path: "/workspace/note.md",
          contents,
        },
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    proposalListeners[0]?.({
      payload: {
        requestId: "stale-session",
        actionId: "rewrite_natural",
        request: "整えて",
        target,
        requestedAtMs: 0,
        conversationId: "conversation-stale",
        conversationTurnIndex: 0,
        conversationOriginalText: contents,
      },
    } as never);
    for (let i = 0; i < 4; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    expect(generateAppleAssistCandidateStreaming).not.toHaveBeenCalled();
    const statuses = vi
      .mocked(emitTo)
      .mock.calls.filter(([, eventName]) => eventName === APPLE_ASSIST_PROPOSAL_STATUS_EVENT)
      .map(([, , payload]) => payload as Record<string, unknown>);
    expect(statuses.at(-1)).toMatchObject({
      phase: "failed",
      conversationId: "conversation-stale",
    });
    expect(statuses.at(-1)?.message).toMatch(/stale/i);
  });

  it("bounds the revision packet to recent requests and the context window", () => {
    const requests = Array.from(
      { length: APPLE_ASSIST_MAX_CONVERSATION_TURNS + 2 },
      (_, index) => `request-${index}-${"x".repeat(APPLE_ASSIST_MAX_CONVERSATION_TURN_CHARS + 20)}`,
    );
    const packet = buildAppleAssistRevisionContext(
      "original",
      "nearby context",
      requests,
    );

    expect(packet.length).toBeLessThanOrEqual(8000);
    expect(packet).not.toContain("request-0-");
    expect(packet).not.toContain("request-1-");
    expect(packet).toContain(`request-${requests.length - 1}-`);
    expect(packet).toContain("Pinned original:");
  });
});
