import { act, fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppleAssistWindowApp } from "./AppleAssistWindowApp";
import {
  APPLE_ASSIST_PROPOSAL_STATUS_EVENT,
  MAIN_APPLE_ASSIST_TARGET_CHANGED_EVENT,
} from "../../types";
import {
  requestAppleAssistProposal,
  requestApplyAiEditTransaction,
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

  it("renders the generated proposal in Diff review and discards it without touching the editor", async () => {
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
    expect(requestId).toBeTruthy();

    const proposalStatus = eventListeners.get(APPLE_ASSIST_PROPOSAL_STATUS_EVENT);
    expect(proposalStatus).toBeDefined();
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
          phase: "completed",
          requestId,
          request: "整えて",
          message: "ready",
          target: {
            kind: "paragraph",
            start: 0,
            end: 8,
            text: "original",
            label: "",
            activeDocumentPath: "/workspace/note.md",
            activeDocumentName: "note.md",
            activeDocumentSessionId: "session:note-1",
            capturedAtMs: 0,
          },
          originalText: "original",
          candidateText: "proposal",
          emittedAtMs: 0,
        },
      });
    });

    expect(screen.getByTestId("apple-assist-proposal-review")).toBeTruthy();
    expect(screen.getByText("proposal")).toBeTruthy();
    const discard = screen.getByRole("button", {
      name: /Discard proposal|案を破棄/,
    });
    expect((discard as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(discard);
    expect(screen.getByText(/Send a request to show|依頼すると/)).toBeTruthy();
    expect(requestApplyAiEditTransaction).not.toHaveBeenCalled();
  });

  it("sanitizes partial prompt markers and keeps the completed proposal after cancel or failure", async () => {
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

    const proposalStatus = eventListeners.get(APPLE_ASSIST_PROPOSAL_STATUS_EVENT);
    expect(proposalStatus).toBeDefined();

    const sendRequest = async () => {
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Send request" }));
        await Promise.resolve();
      });
      const requestId = vi.mocked(requestAppleAssistProposal).mock.calls.at(-1)?.[0]
        ?.requestId;
      expect(requestId).toBeTruthy();
      return requestId as string;
    };

    const firstRequestId = await sendRequest();
    await act(async () => {
      proposalStatus?.({
        payload: {
          phase: "started",
          requestId: firstRequestId,
          request: "整えて",
          message: "started",
          originalText: "original",
          emittedAtMs: 0,
        },
      });
      proposalStatus?.({
        payload: {
          phase: "completed",
          requestId: firstRequestId,
          request: "整えて",
          message: "ready",
          originalText: "original",
          candidateText: "proposal",
          emittedAtMs: 0,
        },
      });
    });
    expect(screen.getByText("proposal")).toBeTruthy();

    const cancelledRequestId = await sendRequest();
    await act(async () => {
      proposalStatus?.({
        payload: {
          phase: "started",
          requestId: cancelledRequestId,
          request: "整えて",
          message: "started",
          originalText: "original",
          emittedAtMs: 0,
        },
      });
      proposalStatus?.({
        payload: {
          phase: "partial",
          requestId: cancelledRequestId,
          request: "整えて",
          message: "partial",
          partialText: "<<<HAZAKURA_TEXT_START",
          emittedAtMs: 0,
        },
      });
    });
    expect(screen.getByText("proposal")).toBeTruthy();
    expect(screen.queryByText("HAZAKURA_TEXT_START")).toBeNull();
    await act(async () => {
      proposalStatus?.({
        payload: {
          phase: "cancelled",
          requestId: cancelledRequestId,
          request: "整えて",
          message: "cancelled by user",
          emittedAtMs: 0,
        },
      });
    });
    expect(screen.getByText("proposal")).toBeTruthy();

    const failedRequestId = await sendRequest();
    await act(async () => {
      proposalStatus?.({
        payload: {
          phase: "started",
          requestId: failedRequestId,
          request: "整えて",
          message: "started",
          originalText: "original",
          emittedAtMs: 0,
        },
      });
      proposalStatus?.({
        payload: {
          phase: "failed",
          requestId: failedRequestId,
          request: "整えて",
          message: "failed",
          emittedAtMs: 0,
        },
      });
    });
    expect(screen.getByText("proposal")).toBeTruthy();
    expect(requestApplyAiEditTransaction).not.toHaveBeenCalled();
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
});
