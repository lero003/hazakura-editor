import { requestLocalAssistReview } from "../../lib/tauri/localAssistReview";
import { LOCAL_ASSIST_REVIEW_RESULT_EVENT } from "../../features/editor/localAssistReviewIdentity";
vi.mock("../../lib/tauri/localAssistReview", () => ({ requestLocalAssistReview: vi.fn(async () => undefined) }));
import { useAppleAssistAvailability } from "../../hooks/agent/useAppleAssistAvailability";
import { act, fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppleAssistWindowApp, getAppleAssistWindowCopy } from "./AppleAssistWindowApp";
import { listen } from "@tauri-apps/api/event";
import {
  CORE_AI_MODEL_STATE_CHANGED_EVENT,
  listCoreAiModels,
  selectLocalAssistModel,
  unavailableCoreAiModelCatalog,
} from "../../lib/tauri/coreAiModels";
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
  probeAppleAssistAvailability,
} from "../../lib/tauri";

const eventListeners = new Map<string, (event: { payload: unknown }) => void>();
let delayRegistration = false;
const pendingRegistrations: Array<() => void> = [];

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (eventName: string, handler: (event: { payload: unknown }) => void) => {
    if (delayRegistration) await new Promise<void>((resolve) => pendingRegistrations.push(resolve));
    eventListeners.set(eventName, handler);
    return () => { if (eventListeners.get(eventName) === handler) eventListeners.delete(eventName); };
  }),
}));

vi.mock("../../lib/tauri", async () => {
  const actual = await vi.importActual<typeof import("../../lib/tauri")>(
    "../../lib/tauri",
  );
  return {
    ...actual,
    probeAppleAssistAvailability: vi.fn(async () => ({ kind: "available" as const })),
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
  useAppleAssistAvailability: vi.fn(() => ({
    availability: { kind: "available" },
    available: true,
    probed: true,
  })),
}));

vi.mock("../../lib/tauri/coreAiModels", async () => {
  const actual = await vi.importActual<typeof import("../../lib/tauri/coreAiModels")>("../../lib/tauri/coreAiModels");
  return {
    ...actual,
    listCoreAiModels: vi.fn(async () => actual.unavailableCoreAiModelCatalog()),
    selectLocalAssistModel: vi.fn(),
  };
});

afterEach(() => {
  cleanup();
  delayRegistration = false;
  pendingRegistrations.splice(0).forEach((resolve) => resolve());
  localStorage.removeItem(MENU_LANGUAGE_STORAGE_KEY);
  document.documentElement.lang = "en";
  vi.mocked(useAppleAssistAvailability).mockReturnValue({ availability: { kind: "available" }, available: true, probed: true });
  vi.clearAllMocks();
  vi.mocked(listCoreAiModels).mockResolvedValue(unavailableCoreAiModelCatalog());
  vi.mocked(selectLocalAssistModel).mockReset();
  eventListeners.clear();
  delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
});

describe("AppleAssistWindowApp render", () => {
  it("refreshes the picker and availability when another window changes the model", async () => {
    const actualHook = await vi.importActual<typeof import("../../hooks/agent/useAppleAssistAvailability")>("../../hooks/agent/useAppleAssistAvailability");
    vi.mocked(useAppleAssistAvailability).mockImplementation(actualHook.useAppleAssistAvailability);
    const initial = unavailableCoreAiModelCatalog();
    initial.models.push({ id: "apple:core-ai:e4b", displayName: "Gemma 4 E4B", kind: "core_ai", status: "ready", selected: false });
    vi.mocked(listCoreAiModels).mockResolvedValueOnce(initial);
    vi.mocked(probeAppleAssistAvailability).mockResolvedValueOnce({ kind: "available", modelId: initial.selectedModelId });
    Object.defineProperty(window, "__TAURI_INTERNALS__", { configurable: true, value: {} });
    render(<AppleAssistWindowApp />);
    await act(async () => { await Promise.resolve(); });

    vi.mocked(probeAppleAssistAvailability).mockResolvedValueOnce({ kind: "available", modelId: "apple:core-ai:e4b" });
    await act(async () => {
      eventListeners.get(CORE_AI_MODEL_STATE_CHANGED_EVENT)?.({ payload: {
        ...initial,
        selectedModelId: "apple:core-ai:e4b",
        models: initial.models.map((model) => ({ ...model, selected: model.id === "apple:core-ai:e4b" })),
      } });
      await Promise.resolve();
    });

    expect(screen.getByRole("button", { name: "Choose model: Gemma 4 E4B" })).toBeTruthy();
    expect(vi.mocked(probeAppleAssistAvailability)).toHaveBeenCalledTimes(2);
  });

  it("gates duplicate model actions and sending from selection until the new probe completes", async () => {
    const actualHook = await vi.importActual<typeof import("../../hooks/agent/useAppleAssistAvailability")>("../../hooks/agent/useAppleAssistAvailability");
    vi.mocked(useAppleAssistAvailability).mockImplementation(actualHook.useAppleAssistAvailability);
    const catalog = unavailableCoreAiModelCatalog();
    catalog.models.push({ id: "apple:core-ai:ready", displayName: "Ready model", kind: "core_ai", status: "ready", selected: false });
    vi.mocked(listCoreAiModels).mockResolvedValueOnce(catalog);
    vi.mocked(probeAppleAssistAvailability).mockResolvedValueOnce({ kind: "available", modelId: catalog.selectedModelId });
    Object.defineProperty(window, "__TAURI_INTERNALS__", { configurable: true, value: {} });
    render(<AppleAssistWindowApp />);
    await act(async () => { await Promise.resolve(); });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Keep input" } });
    let finishSelection!: (value: typeof catalog) => void;
    vi.mocked(selectLocalAssistModel).mockImplementationOnce(() => new Promise((resolve) => { finishSelection = resolve; }));
    fireEvent.click(screen.getByRole("button", { name: "Choose model: Apple Intelligence" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Ready model" }));
    expect(screen.getByText("Switching model…")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Choose model:/ }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Send request" }).hasAttribute("disabled")).toBe(true);
    let finishProbe!: (value: { kind: "available"; modelId: string }) => void;
    vi.mocked(probeAppleAssistAvailability).mockImplementationOnce(() => new Promise((resolve) => { finishProbe = resolve; }));
    await act(async () => { finishSelection({ ...catalog, selectedModelId: "apple:core-ai:ready" }); });
    expect(screen.getByText("Checking availability…")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send request" }).hasAttribute("disabled")).toBe(true);
    await act(async () => { finishProbe({ kind: "available", modelId: "apple:core-ai:ready" }); });
    expect(screen.getByRole("button", { name: "Choose model: Ready model" }).hasAttribute("disabled")).toBe(false);
    expect(screen.getByRole("button", { name: "Send request" }).hasAttribute("disabled")).toBe(false);
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Keep input");
  });

  it("does not let a late model-selection response replace a newer catalog event", async () => {
    const initial = unavailableCoreAiModelCatalog();
    initial.models.push({
      id: "apple:core-ai:ready", displayName: "Ready model",
      kind: "core_ai", status: "ready", selected: false,
    });
    vi.mocked(listCoreAiModels).mockResolvedValueOnce(initial);
    Object.defineProperty(window, "__TAURI_INTERNALS__", { configurable: true, value: {} });
    let finishSelection!: (value: typeof initial) => void;
    vi.mocked(selectLocalAssistModel).mockImplementationOnce(
      () => new Promise((resolve) => { finishSelection = resolve; }),
    );
    render(<AppleAssistWindowApp />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    fireEvent.click(screen.getByRole("button", { name: "Choose model: Apple Intelligence" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Ready model" }));
    await act(async () => {
      eventListeners.get(CORE_AI_MODEL_STATE_CHANGED_EVENT)?.({ payload: initial });
      finishSelection({
        ...initial,
        selectedModelId: "apple:core-ai:ready",
        models: initial.models.map((model) => ({
          ...model, selected: model.id === "apple:core-ai:ready",
        })),
      });
      await Promise.resolve();
    });

    expect(screen.getByRole("button", { name: "Choose model: Apple Intelligence" })).toBeTruthy();
  });

  it("rechecks availability without losing the conversation or typed request", async () => {
    const actualHook = await vi.importActual<typeof import("../../hooks/agent/useAppleAssistAvailability")>("../../hooks/agent/useAppleAssistAvailability");
    vi.mocked(useAppleAssistAvailability).mockImplementation(actualHook.useAppleAssistAvailability);
    vi.mocked(probeAppleAssistAvailability).mockResolvedValueOnce({ kind: "available" });
    Object.defineProperty(window, "__TAURI_INTERNALS__", { configurable: true, value: {} });
    render(<AppleAssistWindowApp />);
    await act(async () => { await Promise.resolve(); });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Keep this request" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Send request" })); });
    const request = vi.mocked(requestAppleAssistProposal).mock.calls.at(-1)![0];
    await act(async () => { eventListeners.get(APPLE_ASSIST_PROPOSAL_STATUS_EVENT)!({ payload: { ...request, phase: "completed", candidateText: "Retained draft", emittedAtMs: 1 } }); });
    let resolveProbe!: (value: { kind: "unavailable"; reason: string }) => void;
    vi.mocked(probeAppleAssistAvailability).mockImplementationOnce(() => new Promise((resolve) => { resolveProbe = resolve; }));
    fireEvent.click(screen.getByRole("button", { name: "Check again" }));
    expect(screen.getByRole("button", { name: "Check again" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Send request" }).hasAttribute("disabled")).toBe(true);
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Keep this request");
    expect(screen.getByTestId("apple-assist-conversation-state")).toBeTruthy();
    await act(async () => { resolveProbe({ kind: "unavailable", reason: "temporary failure" }); });
    vi.mocked(probeAppleAssistAvailability).mockResolvedValueOnce({ kind: "available" });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Check again" })); });
    expect(screen.getByRole("button", { name: "Send request" }).hasAttribute("disabled")).toBe(false);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Send request" })); });
    expect(vi.mocked(requestAppleAssistProposal).mock.calls.at(-1)![0].proposalText).toBe("Retained draft");
  });

  it.each(["completed", "failed", "cancelled"] as const)(
    "retains the proposal subscription across a language change before %s", async (phase) => {
      Object.defineProperty(window, "__TAURI_INTERNALS__", { configurable: true, value: {} });
      render(<AppleAssistWindowApp />);
      await act(async () => { await Promise.resolve(); });
      fireEvent.change(screen.getByRole("textbox"), { target: { value: "Please edit" } });
      await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Send request" })); });
      const request = vi.mocked(requestAppleAssistProposal).mock.calls.at(-1)![0];
      const calls = vi.mocked(listen).mock.calls.length;
      delayRegistration = true;
      act(() => { window.dispatchEvent(new StorageEvent("storage", { key: MENU_LANGUAGE_STORAGE_KEY, newValue: "ja" })); });
      await act(async () => {
        eventListeners.get(APPLE_ASSIST_PROPOSAL_STATUS_EVENT)?.({ payload: {
          ...request, phase, candidateText: phase === "completed" ? "Edited draft" : undefined,
          message: "test outcome", emittedAtMs: 1,
        } });
      });
      expect(screen.queryByRole("button", { name: "生成を停止" })).toBeNull();
      expect(screen.getByRole("textbox").hasAttribute("disabled")).toBe(false);
      expect(vi.mocked(listen).mock.calls.length).toBe(calls);
      if (phase === "completed") {
        await act(async () => { fireEvent.click(screen.getByRole("button", { name: "依頼する" })); });
        expect(vi.mocked(requestAppleAssistProposal).mock.calls.at(-1)![0].proposalText).toBe("Edited draft");
      }
    },
  );

  it.each(["completed", "discarded", "failed"] as const)(
    "retains Apply outcomes across language changes: %s", async (phase) => {
      Object.defineProperty(window, "__TAURI_INTERNALS__", { configurable: true, value: {} });
      render(<AppleAssistWindowApp />);
      await act(async () => { await Promise.resolve(); });
      fireEvent.change(screen.getByRole("textbox"), { target: { value: "Please edit" } });
      await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Send request" })); });
      const request = vi.mocked(requestAppleAssistProposal).mock.calls.at(-1)![0];
      await act(async () => { eventListeners.get(APPLE_ASSIST_PROPOSAL_STATUS_EVENT)!({ payload: { ...request, phase: "completed", candidateText: "Draft", emittedAtMs: 1 } }); });
      const calls = vi.mocked(listen).mock.calls.length;
      delayRegistration = true;
      act(() => { window.dispatchEvent(new StorageEvent("storage", { key: MENU_LANGUAGE_STORAGE_KEY, newValue: "ja" })); });
      await act(async () => {
        eventListeners.get(APPLE_ASSIST_APPLY_STATUS_EVENT)?.({ payload: {
          ...request, documentSessionId: request.target?.activeDocumentSessionId,
          phase, message: "target text no longer matches the active buffer", emittedAtMs: 2,
        } });
      });
      expect(vi.mocked(listen).mock.calls.length).toBe(calls);
      if (phase === "failed") {
        expect(screen.getByRole("alert").textContent).toBe(getAppleAssistWindowCopy("ja").targetStaleError);
        expect(screen.getByTestId("apple-assist-conversation-state")).toBeTruthy();
      } else {
        expect(screen.queryByTestId("apple-assist-conversation-state")).toBeNull();
      }
    },
  );

  it("shows the native Core AI test backend instead of the default catalog selection", async () => {
    vi.mocked(useAppleAssistAvailability).mockReturnValue({
      availability: { kind: "available", modelId: "apple:core-ai:qwen3-0.6b-test" },
      available: true, probed: true,
    });
    render(<AppleAssistWindowApp />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole("button", { name: "Choose model: Core AI · Qwen3 0.6B (test)" })).toBeTruthy();
  });

  it("syncs the detached window document language from storage", () => {
    localStorage.setItem(MENU_LANGUAGE_STORAGE_KEY, "ja");

    render(<AppleAssistWindowApp />);

    expect(document.documentElement.lang).toBe("ja");

    act(() => {
      window.dispatchEvent(new StorageEvent("storage", {
        key: MENU_LANGUAGE_STORAGE_KEY,
        newValue: "en",
      }));
    });
    expect(document.documentElement.lang).toBe("en");

    act(() => {
      window.dispatchEvent(new StorageEvent("storage", {
        key: MENU_LANGUAGE_STORAGE_KEY,
        newValue: "kana",
      }));
    });
    expect(document.documentElement.lang).toBe("ja");
  });

  it.each(["ja", "en"] as const)(
    "keeps the %s UI language out of the assist input and the generated draft",
    async (uiLanguage) => {
      localStorage.setItem(MENU_LANGUAGE_STORAGE_KEY, uiLanguage);
      Object.defineProperty(window, "__TAURI_INTERNALS__", { configurable: true, value: {} });
      render(<AppleAssistWindowApp />);
      await act(async () => { await Promise.resolve(); });

      // 入力と途中の案は UI 文言ではないので、UI 言語に関わらずルートの `lang` を
      // 継承させず「言語不明」を持つ。
      const input = document.getElementById(
        "apple-assist-rough-request",
      ) as HTMLTextAreaElement;
      expect(input.getAttribute("lang")).toBe("");
      expect(document.documentElement.lang).toBe(uiLanguage);

      fireEvent.change(input, { target: { value: "English draft request" } });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", {
          name: uiLanguage === "ja" ? "依頼する" : "Send request",
        }));
      });
      const requestId = vi.mocked(requestAppleAssistProposal).mock.calls.at(-1)?.[0]
        ?.requestId;

      await act(async () => {
        eventListeners.get(APPLE_ASSIST_PROPOSAL_STATUS_EVENT)?.({
          payload: {
            phase: "partial",
            requestId,
            request: "English draft request",
            message: "partial",
            partialText: "Draft in progress",
            emittedAtMs: 0,
          },
        });
      });

      expect(
        screen.getByTestId("apple-assist-stream-preview-body").getAttribute("lang"),
      ).toBe("");
      expect(document.documentElement.lang).toBe(uiLanguage);
    },
  );

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
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Stop generating" })); });
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
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Stop generating" })); });
    expect(cancelAppleAssistProposal).not.toHaveBeenCalled();
    await act(async () => { forwarded(); });
    expect(cancelAppleAssistProposal).toHaveBeenCalledWith(requestId);
  });

  it("switches the same send button to stop and back without losing the request", async () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", { configurable: true, value: {} });
    render(<AppleAssistWindowApp />);
    await act(async () => { await Promise.resolve(); });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "整えて" } });
    const action = screen.getByRole("button", { name: "Send request" });
    await act(async () => { fireEvent.click(action); });
    const payload = vi.mocked(requestAppleAssistProposal).mock.calls.at(-1)![0];
    expect(screen.getByRole("button", { name: "Stop generating" })).toBe(action);
    expect(screen.queryByRole("button", { name: "Sending..." })).toBeNull();
    await act(async () => { fireEvent.click(action); });
    expect(cancelAppleAssistProposal).toHaveBeenCalledWith(payload.requestId);
    expect(screen.getByRole("button", { name: "Stopping…" })).toBe(action);
    expect(action.hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("textbox").hasAttribute("disabled")).toBe(true);
    await act(async () => {
      eventListeners.get(APPLE_ASSIST_PROPOSAL_STATUS_EVENT)!({
        payload: { ...payload, phase: "cancelled", emittedAtMs: 0 },
      });
    });
    expect(screen.getByRole("button", { name: "Send request" })).toBe(action);
    expect(action.hasAttribute("disabled")).toBe(false);
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("整えて");
  });

  it("does not repeat the Hazakura Local Assist title inside the window body", () => {
    render(<AppleAssistWindowApp />);

    expect(screen.getByTestId("apple-assist-shell")).toBeTruthy();
    expect(
      document.querySelector(".apple-assist-window-title"),
    ).toBeNull();
  });

  it("keeps target details compact and presets accessible without sending", async () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", { configurable: true, value: {} });
    const { container } = render(<AppleAssistWindowApp />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole("log", { name: "Conversation" })).toBeTruthy();
    const details = [...container.querySelectorAll("details")];
    expect(details).toHaveLength(2);
    expect(details.every((element) => !element.open)).toBe(true);
    const summary = container.querySelector(".apple-assist-target-details summary")!;
    expect(summary.textContent).toContain("note.md");
    expect(summary.textContent).toContain("Paragraph · 8 chars");
    const preset = getAppleAssistWindowCopy("en").presets[0];
    fireEvent.click(screen.getByRole("button", { name: preset.label }));
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(preset.requestText);
    expect(screen.getByRole("button", { name: preset.label }).getAttribute("aria-pressed")).toBe("true");
    expect(requestAppleAssistProposal).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Custom request" } });
    expect(screen.getByRole("button", { name: preset.label }).getAttribute("aria-pressed")).toBe("false");
  });

  it("lets users confirm the System model without sending or changing their request", async () => {
    render(<AppleAssistWindowApp />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Keep my draft request" } });
    fireEvent.click(screen.getByRole("button", { name: "Choose model: Apple Intelligence" }));
    expect(screen.getAllByRole("menuitemradio")).toHaveLength(1);
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Apple Intelligence" }));
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Keep my draft request");
    expect(requestAppleAssistProposal).not.toHaveBeenCalled();
  });

  it("shows one actionable availability note beside the disabled composer", async () => {
    vi.mocked(useAppleAssistAvailability).mockReturnValue({ availability: { kind: "disabled" }, available: false, probed: true });
    render(<AppleAssistWindowApp />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole("status").textContent).toContain("Assist Settings");
    expect(screen.getByRole("textbox").getAttribute("aria-describedby")).toBe("apple-assist-availability");
    expect(screen.getByRole("textbox").hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("log").textContent).toBe("");
    expect(screen.getByRole("button", { name: "Send request" }).hasAttribute("disabled")).toBe(true);
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
    // 対象枠には種別と文字数だけでなく、実際の文の抜粋も出す（モック06の指示2）。
    expect(
      screen.getByTestId("apple-assist-target").querySelector(".apple-assist-window-target-excerpt")?.textContent,
    ).toBeTruthy();

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
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Stop generating" })); });
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
