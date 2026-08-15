import { act, fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppleAssistWindowApp } from "./AppleAssistWindowApp";
import { APPLE_ASSIST_PROPOSAL_STATUS_EVENT } from "../../types";
import { requestAppleAssistProposal } from "../../lib/tauri";

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
    getMainAppleAssistTarget: vi.fn(async () => null),
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
  });
});
