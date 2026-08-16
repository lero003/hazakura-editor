import { act, fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppleAssistWindowApp } from "./AppleAssistWindowApp";
import {
  APPLE_ASSIST_APPLY_STATUS_EVENT,
  APPLE_ASSIST_PROPOSAL_STATUS_EVENT,
  MAIN_APPLE_ASSIST_TARGET_CHANGED_EVENT,
} from "../../types";
import {
  requestAppleAssistProposal,
} from "../../lib/tauri";

const eventListeners = new Map<string, (event: { payload: unknown }) => void>();

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (eventName: string, handler: (event: { payload: unknown }) => void) => {
    eventListeners.set(eventName, handler);
    return () => eventListeners.delete(eventName);
  }),
}));

vi.mock("../../lib/tauri", async () => {
  const actual = await vi.importActual<typeof import("../../lib/tauri")>(
    "../../lib/tauri",
  );
  return {
    ...actual,
    getMainAppleAssistTarget: vi.fn(async () => ({
      kind: "paragraph" as const,
      start: 0,
      end: 8,
      text: "original",
      label: "",
      activeDocumentPath: "/workspace/note.md",
      activeDocumentName: "note.md",
      activeDocumentSessionId: "session:note-1",
      capturedAtMs: 0,
    })),
    requestApplyAiEditTransaction: vi.fn(async () => undefined),
    requestAppleAssistProposal: vi.fn(async () => undefined),
    setAppleAssistWindowTheme: vi.fn(async () => undefined),
  };
});

vi.mock("../../hooks/agent/useAppleAssistAvailability", () => ({
  useAppleAssistAvailability: () => ({
    availability: { kind: "available" },
    available: true,
    probed: true,
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  eventListeners.clear();
  delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
});

describe("AppleAssistWindowApp render", () => {
  it("does not repeat the Hazakura Local Assist title inside the window body", () => {
    render(<AppleAssistWindowApp />);

    expect(screen.getByTestId("apple-assist-shell")).toBeTruthy();
    expect(
      document.querySelector(".apple-assist-window-title"),
    ).toBeNull();
  });

  it("keeps the detached window conversation-focused after a proposal completes", async () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {},
    });
    render(<AppleAssistWindowApp />);
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "整えて" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send request" }));
      await Promise.resolve();
    });
    const requestId = vi.mocked(requestAppleAssistProposal).mock.calls.at(-1)?.[0]
      ?.requestId;

    const proposalStatus = eventListeners.get(APPLE_ASSIST_PROPOSAL_STATUS_EVENT);
    await act(async () => {
      proposalStatus?.({
        payload: {
          phase: "completed",
          requestId,
          request: "整えて",
          message: "ready",
          originalText: "original",
          candidateText: "proposal",
          emittedAtMs: 0,
        },
      });
    });

    // v2.6 B2: the detached window is conversation-only. The inline Diff
    // review and Apply/Discard now live in the main window.
    expect(screen.queryByTestId("apple-assist-proposal-review")).toBeNull();
    expect(screen.queryByRole("table", { name: "Diff review" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Apply proposal|文書へ反映/ }),
    ).toBeNull();
    expect(screen.getByTestId("apple-assist-conversation-state")).toBeTruthy();
  });

  it("sanitizes partial prompt markers in the stream preview", async () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {},
    });
    render(<AppleAssistWindowApp />);
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "整えて" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send request" }));
      await Promise.resolve();
    });
    const requestId = vi.mocked(requestAppleAssistProposal).mock.calls.at(-1)?.[0]
      ?.requestId;

    const proposalStatus = eventListeners.get(APPLE_ASSIST_PROPOSAL_STATUS_EVENT);
    await act(async () => {
      proposalStatus?.({
        payload: {
          phase: "started",
          requestId,
          request: "整えて",
          message: "started",
          originalText: "original",
          emittedAtMs: 0,
        },
      });
      proposalStatus?.({
        payload: {
          phase: "partial",
          requestId,
          request: "整えて",
          message: "partial",
          partialText: "<<<HAZAKURA_TEXT_START",
          emittedAtMs: 0,
        },
      });
      proposalStatus?.({
        payload: {
          phase: "partial",
          requestId,
          request: "整えて",
          message: "original marker partial",
          partialText: "<<<HAZAKURA_ORIGINAL_START",
          emittedAtMs: 0,
        },
      });
    });

    expect(screen.queryByText("HAZAKURA_TEXT_START")).toBeNull();
    expect(screen.queryByText("HAZAKURA_ORIGINAL_START")).toBeNull();

    await act(async () => {
      proposalStatus?.({
        payload: {
          phase: "cancelled",
          requestId,
          request: "整えて",
          message: "cancelled by user",
          emittedAtMs: 0,
        },
      });
    });
    const feedbackEntries = screen.getAllByTestId("apple-assist-feedback-entry");
    expect(feedbackEntries.at(-1)?.getAttribute("data-feedback-kind")).toBe(
      "cancelled",
    );
    expect(feedbackEntries.at(-1)?.textContent).not.toMatch(/failed|失敗/i);
  });

  it("resets the conversation only when the apply status matches the active conversation", async () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {},
    });
    render(<AppleAssistWindowApp />);
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "整えて" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send request" }));
      await Promise.resolve();
    });
    const conversationId = vi
      .mocked(requestAppleAssistProposal)
      .mock.calls.at(-1)?.[0]?.conversationId;
    expect(conversationId).toBeTruthy();
    expect(screen.getByTestId("apple-assist-conversation-state")).toBeTruthy();

    const applyStatus = eventListeners.get(APPLE_ASSIST_APPLY_STATUS_EVENT);

    // A discard from an unrelated conversation must not reset this one.
    await act(async () => {
      applyStatus?.({
        payload: {
          phase: "discarded",
          requestId: "req-other",
          request: "整えて",
          message: "discarded",
          conversationId: "unrelated-conversation",
          emittedAtMs: 0,
        },
      });
    });
    expect(screen.getByTestId("apple-assist-conversation-state")).toBeTruthy();

    // A discard for THIS conversation resets it.
    await act(async () => {
      applyStatus?.({
        payload: {
          phase: "discarded",
          requestId: "req-discard",
          request: "整えて",
          message: "discarded",
          conversationId,
          emittedAtMs: 0,
        },
      });
    });
    expect(screen.queryByTestId("apple-assist-conversation-state")).toBeNull();
  });

  it("keeps follow-up requests on the pinned target and shows the conversation history", async () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {},
    });
    render(<AppleAssistWindowApp />);
    await act(async () => {
      await Promise.resolve();
    });

    const firstRequest = "最初の依頼";
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: firstRequest },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send request" }));
      await Promise.resolve();
    });

    const firstPayload = vi.mocked(requestAppleAssistProposal).mock.calls.at(-1)?.[0];
    expect(firstPayload).toMatchObject({
      conversationTurnIndex: 0,
      conversationOriginalText: "original",
      target: expect.objectContaining({
        text: "original",
        activeDocumentSessionId: "session:note-1",
      }),
    });
    expect(firstPayload?.conversationId).toBeTruthy();

    const proposalStatus = eventListeners.get(APPLE_ASSIST_PROPOSAL_STATUS_EVENT);
    const targetChanged = eventListeners.get(MAIN_APPLE_ASSIST_TARGET_CHANGED_EVENT);
    expect(proposalStatus).toBeDefined();
    expect(targetChanged).toBeDefined();
    await act(async () => {
      proposalStatus?.({
        payload: {
          phase: "started",
          requestId: firstPayload?.requestId,
          request: firstRequest,
          message: "started",
          originalText: "original",
          conversationId: firstPayload?.conversationId,
          conversationTurnIndex: 0,
          emittedAtMs: 0,
        },
      });
      proposalStatus?.({
        payload: {
          phase: "completed",
          requestId: firstPayload?.requestId,
          request: firstRequest,
          message: "ready",
          originalText: "original",
          candidateText: "proposal v1",
          conversationId: firstPayload?.conversationId,
          conversationTurnIndex: 0,
          emittedAtMs: 0,
        },
      });
    });

    expect(screen.getByTestId("apple-assist-conversation-state")).toBeTruthy();
    expect(screen.getByTestId("apple-assist-conversation-history").textContent).toContain(
      firstRequest,
    );

    await act(async () => {
      targetChanged?.({
        payload: {
          kind: "section",
          start: 0,
          end: 5,
          text: "other",
          label: "別の章",
          activeDocumentPath: "/workspace/other.md",
          activeDocumentName: "other.md",
          activeDocumentSessionId: "session:other-1",
          capturedAtMs: 1,
        },
      });
    });
    expect(screen.getByTestId("apple-assist-target").textContent).toContain(
      "Paragraph (8 chars)",
    );

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "もう少し短く" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send request" }));
      await Promise.resolve();
    });

    const secondPayload = vi.mocked(requestAppleAssistProposal).mock.calls.at(-1)?.[0];
    expect(secondPayload).toMatchObject({
      conversationId: firstPayload?.conversationId,
      conversationTurnIndex: 1,
      conversationOriginalText: "original",
      proposalText: "proposal v1",
      revisionHistory: [firstRequest],
      target: firstPayload?.target,
    });
    expect(screen.getByTestId("apple-assist-conversation-history").textContent).toContain(
      "もう少し短く",
    );

    await act(async () => {
      proposalStatus?.({
        payload: {
          phase: "completed",
          requestId: secondPayload?.requestId,
          request: "もう少し短く",
          message: "ready",
          originalText: "original",
          candidateText: "proposal v2",
          conversationId: firstPayload?.conversationId,
          conversationTurnIndex: 1,
          emittedAtMs: 1,
        },
      });
    });
    fireEvent.click(screen.getByRole("button", { name: "New conversation" }));
    expect(screen.queryByTestId("apple-assist-conversation-state")).toBeNull();
  });

  it("shows the raw growing draft while streaming, then clears it after completion", async () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {},
    });
    render(<AppleAssistWindowApp />);
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "整えて" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send request" }));
      await Promise.resolve();
    });
    const requestId = vi.mocked(requestAppleAssistProposal).mock.calls.at(-1)?.[0]
      ?.requestId;

    const proposalStatus = eventListeners.get(APPLE_ASSIST_PROPOSAL_STATUS_EVENT);
    await act(async () => {
      proposalStatus?.({
        payload: {
          phase: "started",
          requestId,
          request: "整えて",
          message: "started",
          originalText: "original",
          emittedAtMs: 0,
        },
      });
      proposalStatus?.({
        payload: {
          phase: "partial",
          requestId,
          request: "整えて",
          message: "partial",
          partialText: "生成中の途中",
          emittedAtMs: 0,
        },
      });
    });

    // While streaming, the growing draft is shown as raw readable text in the
    // conversation window.
    expect(
      screen.getByTestId("apple-assist-stream-preview-body").textContent,
    ).toBe("生成中の途中");
    expect(screen.queryByRole("table", { name: "Diff review" })).toBeNull();

    await act(async () => {
      proposalStatus?.({
        payload: {
          phase: "completed",
          requestId,
          request: "整えて",
          message: "ready",
          originalText: "original",
          candidateText: "完成した本文",
          emittedAtMs: 0,
        },
      });
    });

    // The stream preview clears; the completed Diff is owned by the main
    // window, so the conversation window never renders a diff table.
    expect(screen.queryByTestId("apple-assist-stream-preview-body")).toBeNull();
    expect(screen.queryByRole("table", { name: "Diff review" })).toBeNull();
  });
});
