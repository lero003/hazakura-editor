import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AppleAssistWindowApp } from "./AppleAssistWindowApp";
import { useAppleAssistProposalHandler } from "../../hooks/editor/useAppleAssistProposalHandler";
import { isLocalAssistBusy } from "../../lib/appleAssist/sidebarBridge";
import { localAssistProposalStore } from "../../features/editor/localAssistProposal";
import { APPLE_ASSIST_PROPOSAL_STATUS_EVENT, CANCEL_AI_EDIT_PROPOSAL_EVENT, REQUEST_AI_EDIT_PROPOSAL_EVENT } from "../../types";

const h = vi.hoisted(() => ({
  listeners: new Map<string, (event: { payload: any }) => void>(),
  generate: vi.fn(), stop: vi.fn(), emit: vi.fn(), request: vi.fn(),
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (name: string, callback: (event: { payload: any }) => void) => {
    h.listeners.set(name, callback); return () => h.listeners.delete(name);
  }),
  emitTo: vi.fn(async (_window: string, name: string, payload: unknown) => {
    h.emit(name, payload);
    h.listeners.get(name)?.({ payload });
  }),
}));
vi.mock("../../lib/tauri/appleAssist", async () => ({
  ...await vi.importActual<typeof import("../../lib/tauri/appleAssist")>("../../lib/tauri/appleAssist"),
  prepareAppleAssistGeneration: vi.fn(async () => undefined),
  finishAppleAssistGeneration: vi.fn(async () => undefined),
  generateAppleAssistCandidateStreaming: (...args: unknown[]) => h.generate(...args),
  stopAppleAssistGeneration: (...args: unknown[]) => h.stop(...args),
}));
vi.mock("../../lib/tauri", async () => ({
  ...await vi.importActual<typeof import("../../lib/tauri")>("../../lib/tauri"),
  getMainAppleAssistTarget: vi.fn(async () => ({ kind: "paragraph", start: 0, end: 8, text: "original", label: "",
    activeDocumentPath: "/workspace/note.md", activeDocumentName: "note.md", activeDocumentSessionId: "cancel-integration", capturedAtMs: 0 })),
  setAppleAssistWindowTheme: vi.fn(async () => undefined),
  requestAppleAssistProposal: vi.fn(async (payload) => { h.request(payload); h.listeners.get(REQUEST_AI_EDIT_PROPOSAL_EVENT)?.({ payload }); }),
  cancelAppleAssistProposal: vi.fn(async (requestId) => { h.listeners.get(CANCEL_AI_EDIT_PROPOSAL_EVENT)?.({ payload: requestId }); }),
}));
vi.mock("../../hooks/agent/useAppleAssistAvailability", () => ({
  useAppleAssistAvailability: () => ({ availability: { kind: "available" }, available: true, probed: true }),
}));
function Main() {
  useAppleAssistProposalHandler({ activeTab: { id: "tab", sessionId: "cancel-integration", path: "/workspace/note.md", name: "note.md", contents: "original" } });
  return null;
}
afterEach(() => {
  cleanup(); h.listeners.clear(); vi.clearAllMocks();
  localAssistProposalStore.clear("cancel-integration");
  delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
});

it.each(["generation-first", "stop-first"])("keeps both windows locked until generation and stop settle (%s)", async (order) => {
  Object.defineProperty(window, "__TAURI_INTERNALS__", { configurable: true, value: {} });
  let finishGeneration!: (value: { candidateText: string }) => void;
  let finishStop!: (value: boolean) => void;
  h.generate.mockReturnValueOnce(new Promise((resolve) => { finishGeneration = resolve; }));
  h.stop.mockReturnValueOnce(new Promise((resolve) => { finishStop = resolve; }));
  render(<><Main /><AppleAssistWindowApp /></>);
  await act(async () => { await Promise.resolve(); });
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "整えて" } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Send request" })); });
  await waitFor(() => expect(h.generate).toHaveBeenCalledTimes(1));
  const payload = h.request.mock.calls[0][0];
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Stop generating" })); });
  expect(h.emit.mock.calls.some(([, event]) => event.phase === "cancelling")).toBe(true);
  expect(screen.getByRole("textbox").hasAttribute("disabled")).toBe(true);
  expect(screen.getByRole("button", { name: "Sending..." }).hasAttribute("disabled")).toBe(true);
  expect(h.stop).toHaveBeenCalledWith(payload.requestId);
  await act(async () => {
    h.listeners.get(APPLE_ASSIST_PROPOSAL_STATUS_EVENT)!({ payload: { ...payload, phase: "partial", partialText: "LATE PARTIAL" } });
    if (order === "generation-first") finishGeneration({ candidateText: "LATE FINAL" });
    else finishStop(true);
  });
  expect(screen.queryByText("LATE PARTIAL")).toBeNull();
  expect(isLocalAssistBusy()).toBe(true);
  expect(screen.getByRole("textbox").hasAttribute("disabled")).toBe(true);
  expect(h.emit.mock.calls.some(([, event]) => event.phase === "cancelled")).toBe(false);
  await act(async () => {
    if (order === "generation-first") finishStop(true);
    else finishGeneration({ candidateText: "LATE FINAL" });
  });
  await waitFor(() => expect(isLocalAssistBusy()).toBe(false));
  expect(h.emit.mock.calls.at(-1)?.[1].phase).toBe("cancelled");
  expect(screen.getByRole("textbox").hasAttribute("disabled")).toBe(false);
  expect(screen.getByRole("button", { name: "Send request" }).hasAttribute("disabled")).toBe(false);
  expect(localAssistProposalStore.getLatest("cancel-integration")).toBeNull();
  h.generate.mockResolvedValueOnce({ candidateText: "NEW" });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Send request" })); });
  await waitFor(() => expect(localAssistProposalStore.getLatest("cancel-integration")?.candidateText).toBe("NEW"));
  await waitFor(() => expect(isLocalAssistBusy()).toBe(false));
});
