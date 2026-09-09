import { requestLocalAssistReview } from "../../lib/tauri/localAssistReview";
import { LOCAL_ASSIST_REVIEW_RESULT_EVENT } from "../../features/editor/localAssistReviewIdentity";
vi.mock("../../lib/tauri/localAssistReview", () => ({ requestLocalAssistReview: vi.fn(async () => undefined) }));
import { act, fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppleAssistWindowApp, getAppleAssistWindowCopy } from "./AppleAssistWindowApp";
import {
  APPLE_ASSIST_APPLY_STATUS_EVENT,
  APPLE_ASSIST_PROPOSAL_STATUS_EVENT,
  MAIN_APPLE_ASSIST_TARGET_CHANGED_EVENT,
  MENU_LANGUAGE_STORAGE_KEY,
} from "../../types";
import {
  requestAppleAssistProposal,
  cancelAppleAssistProposal,
  getMainAppleAssistTarget,
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
    cancelAppleAssistProposal: vi.fn(async () => undefined),
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
  localStorage.removeItem(MENU_LANGUAGE_STORAGE_KEY);
  vi.clearAllMocks();
  eventListeners.clear();
  delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
});

describe("AppleAssistWindowApp render", () => {
  it("shows a matching Japanese Apply failure and keeps the conversation and prior draft", async () => {
    localStorage.setItem(MENU_LANGUAGE_STORAGE_KEY, "ja");
    Object.defineProperty(window, "__TAURI_INTERNALS__", { configurable: true, value: {} });
    render(<AppleAssistWindowApp />);
    await act(async () => { await Promise.resolve(); });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "整えて" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "依頼する" })); });
    const first = vi.mocked(requestAppleAssistProposal).mock.calls.at(-1)![0];
    await act(async () => {
      eventListeners.get(APPLE_ASSIST_PROPOSAL_STATUS_EVENT)!({ payload: { ...first, phase: "completed", candidateText: "前の案", emittedAtMs: 0 } });
    });
    const failure = { ...first, documentSessionId: first.target?.activeDocumentSessionId, phase: "failed", message: "Hazakura Local Assist apply failed: target text no longer matches the active buffer", emittedAtMs: 1 };
    for (const conversationId of ["other-conversation", undefined]) {
      await act(async () => { eventListeners.get(APPLE_ASSIST_APPLY_STATUS_EVENT)!({ payload: { ...failure, conversationId } }); });
      expect(screen.queryByRole("alert")).toBeNull();
    }
    await act(async () => { eventListeners.get(APPLE_ASSIST_APPLY_STATUS_EVENT)!({ payload: failure }); });
    expect(screen.getByRole("alert").textContent).toBe(getAppleAssistWindowCopy("ja").targetStaleError);
    expect(screen.getByTestId("apple-assist-conversation-state")).toBeTruthy();
    expect(screen.getAllByTestId("apple-assist-feedback-entry").at(-1)?.getAttribute("data-feedback-kind")).toBe("failed");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "もう少し短く" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "依頼する" })); });
    expect(vi.mocked(requestAppleAssistProposal).mock.calls.at(-1)![0]).toMatchObject({ conversationId: first.conversationId, proposalText: "前の案" });
  });

  it("cancels target acquisition before submitting a request", async () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", { configurable: true, value: {} });
    render(<AppleAssistWindowApp />);
    await act(async () => { await Promise.resolve(); });
    let finish!: (value: null) => void;
    vi.mocked(getMainAppleAssistTarget).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "整えて" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Send request" })); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Cancel" })); });
    await act(async () => { finish(null); });
    expect(requestAppleAssistProposal).not.toHaveBeenCalled();
    expect(cancelAppleAssistProposal).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox").hasAttribute("disabled")).toBe(false);
  });

  it("orders cancellation after the request IPC has been forwarded", async () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", { configurable: true, value: {} });
    render(<AppleAssistWindowApp />);
    await act(async () => { await Promise.resolve(); });
    let forwarded!: () => void;
    vi.mocked(requestAppleAssistProposal).mockImplementationOnce(() => new Promise<void>((resolve) => { forwarded = resolve; }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "整えて" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Send request" })); });
    const requestId = vi.mocked(requestAppleAssistProposal).mock.calls.at(-1)![0].requestId;
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Cancel" })); });
    expect(cancelAppleAssistProposal).not.toHaveBeenCalled();
    await act(async () => { forwarded(); });
    expect(cancelAppleAssistProposal).toHaveBeenCalledWith(requestId);
  });

  it("routes the cancel button to main with the active request id", async () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", { configurable: true, value: {} });
    render(<AppleAssistWindowApp />);
    await act(async () => { await Promise.resolve(); });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "整えて" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Send request" })); });
    const payload = vi.mocked(requestAppleAssistProposal).mock.calls.at(-1)![0];
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Cancel" })); });
    expect(cancelAppleAssistProposal).toHaveBeenCalledWith(payload.requestId);
    expect(screen.getByRole("textbox").hasAttribute("disabled")).toBe(true);
  });

  it("does not repeat the Hazakura Local Assist title inside the window body", () => {
    render(<AppleAssistWindowApp />);

    expect(screen.getByTestId("apple-assist-shell")).toBeTruthy();
    expect(
      document.querySelector(".apple-assist-window-title"),
    ).toBeNull();
  });

  it("shows the target while keeping help and presets collapsed beside one conversation log", () => {
    const { container } = render(<AppleAssistWindowApp />);
    expect(screen.getByRole("log", { name: "Conversation" })).toBeTruthy();
    const details = [...container.querySelectorAll("details")];
    expect(details).toHaveLength(3);
    expect(details.filter((element) => element.open).map(element => element.className)).toEqual(["apple-assist-target-details"]);
    expect(screen.queryByTestId("apple-assist-stream-preview")).toBeNull();
    expect(screen.getByRole("textbox")).toBeTruthy();
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

    const log = screen.getByRole("log", { name: "Conversation" });
    expect(log.textContent).toContain("整えて");
    expect(log.contains(screen.getByRole("status"))).toBe(true);

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
    expect(screen.queryByRole("status")).toBeNull();
    expect(log.querySelector('[data-feedback-kind="proposal-ready"]')).toBeTruthy();
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

    for (const partialText of ["案\n\nHAZAKURA_TEXT_END", "案 HAZAKURA_CONTEXT_END", "<<<HAZAKURA_ORIGINAL_START\n案"]) {
      await act(async () => {
        proposalStatus?.({ payload: { phase: "partial", requestId, request: "整えて", message: "partial", partialText, emittedAtMs: 1 } });
      });
      expect(document.body.textContent).not.toMatch(/HAZAKURA_(TEXT|CONTEXT|ORIGINAL)_(START|END)/);
      expect(screen.queryByText("案")).toBeNull();
    }
    await act(async () => {
      proposalStatus?.({ payload: { phase: "partial", requestId, request: "整えて", message: "partial", partialText: "通常の途中案🌸", emittedAtMs: 2 } });
    });
    expect(screen.getByText("通常の途中案🌸")).toBeTruthy();

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

    const generated = vi.mocked(requestAppleAssistProposal).mock.calls.at(-1)![0];
    await act(async () => {
      eventListeners.get(APPLE_ASSIST_PROPOSAL_STATUS_EVENT)!({ payload: {
        ...generated, phase: "completed", candidateText: "proposal", emittedAtMs: 0,
      } });
    });
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
          requestId: generated.requestId,
          documentSessionId: generated.target?.activeDocumentSessionId,
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

it("reviews the current request and ignores delayed outcomes for older turns or sessions", async () => {
  Object.defineProperty(window, "__TAURI_INTERNALS__", { configurable: true, value: {} });
  render(<AppleAssistWindowApp />);
  await act(async () => { await Promise.resolve(); });
  const submit = async () => {
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "整えて" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Send request" })); });
    return vi.mocked(requestAppleAssistProposal).mock.calls.at(-1)![0];
  };
  const complete = async (request: Awaited<ReturnType<typeof submit>>) => {
    await act(async () => { eventListeners.get(APPLE_ASSIST_PROPOSAL_STATUS_EVENT)!({ payload: {
      ...request, phase: "completed", candidateText: "proposal", emittedAtMs: 0,
    } }); });
  };
  const first = await submit(); await complete(first);
  const second = await submit();
  expect(screen.getByRole("button", { name: "Review this proposal" }).hasAttribute("disabled")).toBe(true);
  await act(async () => { eventListeners.get(APPLE_ASSIST_APPLY_STATUS_EVENT)!({ payload: {
    ...first, documentSessionId: first.target?.activeDocumentSessionId, phase: "completed",
  } }); });
  expect(screen.getByTestId("apple-assist-conversation-state")).toBeTruthy();
  await complete(second);
  const identity = { requestId: second.requestId, conversationId: second.conversationId,
    documentSessionId: second.target?.activeDocumentSessionId };
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Review this proposal" })); });
  expect(requestLocalAssistReview).toHaveBeenLastCalledWith({ ...identity, navigationId: expect.any(String) });
  const navigationId = vi.mocked(requestLocalAssistReview).mock.calls.at(-1)![0].navigationId;
  await act(async () => { eventListeners.get(LOCAL_ASSIST_REVIEW_RESULT_EVENT)!({ payload: { ...identity, navigationId, requestId: first.requestId, accepted: true } }); });
  expect(screen.getByRole("button", { name: "Opening in main…" }).hasAttribute("disabled")).toBe(true);
  await act(async () => { eventListeners.get(LOCAL_ASSIST_REVIEW_RESULT_EVENT)!({ payload: { ...identity, navigationId, accepted: false } }); });
  expect(screen.getByText(/Could not open this proposal/)).toBeTruthy();
  for (const mismatch of [{ requestId: first.requestId }, { documentSessionId: "reopened-session" }, { documentSessionId: undefined }]) {
    await act(async () => { eventListeners.get(APPLE_ASSIST_APPLY_STATUS_EVENT)!({ payload: {
      ...identity, ...mismatch, phase: "discarded",
    } }); });
    expect(screen.getByTestId("apple-assist-conversation-state")).toBeTruthy();
  }
  await act(async () => { eventListeners.get(APPLE_ASSIST_APPLY_STATUS_EVENT)!({ payload: { ...identity, phase: "discarded" } }); });
  expect(screen.queryByTestId("apple-assist-conversation-state")).toBeNull();
  expect(screen.queryByRole("button", { name: "Review this proposal" })).toBeNull();
});

it("retains the prior review identity after cancellation finishes", async () => {
  Object.defineProperty(window, "__TAURI_INTERNALS__", { configurable: true, value: {} });
  render(<AppleAssistWindowApp />);
  await act(async () => { await Promise.resolve(); });
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "整えて" } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Send request" })); });
  const first = vi.mocked(requestAppleAssistProposal).mock.calls.at(-1)![0];
  await act(async () => { eventListeners.get(APPLE_ASSIST_PROPOSAL_STATUS_EVENT)!({ payload: {
    ...first, phase: "completed", candidateText: "prior proposal", emittedAtMs: 0,
  } }); });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Send request" })); });
  const second = vi.mocked(requestAppleAssistProposal).mock.calls.at(-1)![0];
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Cancel" })); });
  expect(screen.getByRole("button", { name: "Review this proposal" }).hasAttribute("disabled")).toBe(true);
  await act(async () => { eventListeners.get(APPLE_ASSIST_PROPOSAL_STATUS_EVENT)!({ payload: { ...second, phase: "cancelled", emittedAtMs: 1 } }); });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Review this proposal" })); });
  expect(requestLocalAssistReview).toHaveBeenLastCalledWith({ navigationId: expect.any(String), requestId: first.requestId,
    conversationId: first.conversationId, documentSessionId: first.target?.activeDocumentSessionId });
});

it.each(["old-result", "old-invoke-failure"])("isolates repeated navigation attempts from %s", async (late) => {
  vi.useFakeTimers();
  try {
    Object.defineProperty(window, "__TAURI_INTERNALS__", { configurable: true, value: {} });
    render(<AppleAssistWindowApp />);
    await act(async () => {});
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "整えて" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Send request" })); });
    const generation = vi.mocked(requestAppleAssistProposal).mock.calls.at(-1)![0];
    await act(async () => { eventListeners.get(APPLE_ASSIST_PROPOSAL_STATUS_EVENT)!({ payload: {
      ...generation, phase: "completed", candidateText: "proposal", emittedAtMs: 0,
    } }); });
    let fail!: (error: Error) => void;
    vi.mocked(requestLocalAssistReview).mockImplementationOnce(() => new Promise<void>((_resolve, reject) => { fail = reject; }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Review this proposal" })); });
    const first = vi.mocked(requestLocalAssistReview).mock.calls.at(-1)![0];
    await act(async () => { vi.advanceTimersByTime(5000); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Review this proposal" })); });
    const second = vi.mocked(requestLocalAssistReview).mock.calls.at(-1)![0];
    expect(second.navigationId).not.toBe(first.navigationId);
    await act(async () => {
      if (late === "old-result") eventListeners.get(LOCAL_ASSIST_REVIEW_RESULT_EVENT)!({ payload: { ...first, accepted: false } });
      else fail(new Error("late invoke failure"));
    });
    expect(screen.getByRole("button", { name: "Opening in main…" }).hasAttribute("disabled")).toBe(true);
    expect(screen.queryByText(/Could not open this proposal/)).toBeNull();
    await act(async () => { eventListeners.get(LOCAL_ASSIST_REVIEW_RESULT_EVENT)!({ payload: { ...second, accepted: true } }); });
    expect(screen.getByRole("button", { name: "Review this proposal" }).hasAttribute("disabled")).toBe(false);
  } finally { vi.useRealTimers(); }
});

it("invalidates navigation when a new conversation replaces the proposal", async () => {
  vi.useFakeTimers();
  try {
    Object.defineProperty(window, "__TAURI_INTERNALS__", { configurable: true, value: {} });
    render(<AppleAssistWindowApp />); await act(async () => {});
    const generate = async () => {
      fireEvent.change(screen.getByRole("textbox"), { target: { value: "整えて" } });
      await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Send request" })); });
      const request = vi.mocked(requestAppleAssistProposal).mock.calls.at(-1)![0];
      await act(async () => { eventListeners.get(APPLE_ASSIST_PROPOSAL_STATUS_EVENT)!({ payload: {
        ...request, phase: "completed", candidateText: "proposal", emittedAtMs: 0,
      } }); });
    };
    await generate();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Review this proposal" })); });
    const old = vi.mocked(requestLocalAssistReview).mock.calls.at(-1)![0];
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: getAppleAssistWindowCopy("en").newConversationButton })); });
    await generate();
    await act(async () => { vi.advanceTimersByTime(5000); eventListeners.get(LOCAL_ASSIST_REVIEW_RESULT_EVENT)!({ payload: { ...old, accepted: false } }); });
    expect(screen.getByRole("button", { name: "Review this proposal" }).hasAttribute("disabled")).toBe(false);
    expect(screen.queryByText(/Could not open this proposal/)).toBeNull();
  } finally { vi.useRealTimers(); }
});
