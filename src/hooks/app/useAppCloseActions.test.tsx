import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createUntitledEditorTab } from "../../features/editor/editorTabs";
import { useAppCloseActions } from "./useAppCloseActions";

const mocks = vi.hoisted(() => ({
  exitApp: vi.fn(async () => {}),
  persist: vi.fn(),
  listen: vi.fn(async (_event: string, _callback: () => void) => () => {}),
}));
vi.mock("../../lib/tauri/window", () => ({ exitApp: mocks.exitApp }));
vi.mock("@tauri-apps/api/event", () => ({ listen: mocks.listen }));
vi.mock("../workspace/useWorkspaceStatePersistence", async (load) => ({
  ...(await load<typeof import("../workspace/useWorkspaceStatePersistence")>()),
  persistWorkspaceStateSnapshot: mocks.persist,
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

function setup(overrides: Partial<Parameters<typeof useAppCloseActions>[0]> = {}) {
  const tab = createUntitledEditorTab();
  const options = {
    activeTab: tab,
    activeTabId: tab.id,
    appExitInProgressRef: { current: false },
    cancelPendingAppClose: vi.fn(),
    dirtyTabCount: 0,
    requestAppCloseConfirmation: vi.fn(),
    restoreComplete: true,
    stopActiveAppleAssistGeneration: vi.fn(async () => {}),
    tabsRef: { current: [tab] },
    workspaceRootPath: null,
    ...overrides,
  } satisfies Parameters<typeof useAppCloseActions>[0];
  return { ...renderHook(() => useAppCloseActions(options)), options };
}

function pendingStop() {
  let finish!: () => void;
  const promise = new Promise<void>((resolve) => { finish = resolve; });
  return { finish, stop: vi.fn(() => promise) };
}

describe("useAppCloseActions", () => {
  it("waits for Assist shutdown before persisting and quitting from the menu", async () => {
    const pending = pendingStop();
    const { result } = setup({ stopActiveAppleAssistGeneration: pending.stop });
    act(() => { void result.current.requestAppQuit(); });
    expect(pending.stop).toHaveBeenCalledOnce();
    expect(mocks.persist).not.toHaveBeenCalled();
    expect(mocks.exitApp).not.toHaveBeenCalled();
    await act(async () => pending.finish());
    expect(mocks.persist).toHaveBeenCalledOnce();
    expect(mocks.exitApp).toHaveBeenCalledOnce();
    expect(mocks.persist.mock.invocationCallOrder[0]).toBeLessThan(mocks.exitApp.mock.invocationCallOrder[0]);
  });

  it.each(["menu", "OS"])("asks for confirmation if editing resumes during %s shutdown", async (route) => {
    const pending = pendingStop();
    const { result, options } = setup({ stopActiveAppleAssistGeneration: pending.stop });
    act(() => {
      if (route === "menu") void result.current.requestAppQuit();
      else mocks.listen.mock.calls[0][1]();
    });
    options.tabsRef.current = [{ ...options.tabsRef.current[0], contents: "new draft" }];
    await act(async () => pending.finish());
    expect(mocks.exitApp).not.toHaveBeenCalled();
    expect(options.requestAppCloseConfirmation).toHaveBeenCalledOnce();
    expect(options.appExitInProgressRef.current).toBe(true);
  });

  it("opens the dirty confirmation and resets the exit destination on cancel", () => {
    const { result, options } = setup({ dirtyTabCount: 1 });
    act(() => { void result.current.requestAppQuit(); });
    expect(options.requestAppCloseConfirmation).toHaveBeenCalledOnce();
    expect(options.appExitInProgressRef.current).toBe(true);
    expect(options.stopActiveAppleAssistGeneration).not.toHaveBeenCalled();
    act(() => result.current.cancelPendingAppCloseAndExitFlag());
    expect(options.appExitInProgressRef.current).toBe(false);
    expect(options.cancelPendingAppClose).toHaveBeenCalledOnce();
    expect(mocks.exitApp).not.toHaveBeenCalled();
  });

  it("flushes the latest tabs after shutdown without exiting on the window-close path", async () => {
    const pending = pendingStop();
    const { result, options } = setup({ stopActiveAppleAssistGeneration: pending.stop });
    act(() => { void result.current.onBeforeWindowCloseWithAssistShutdown(); });
    const latest = { ...options.tabsRef.current[0], path: "/workspace/saved.md" };
    options.tabsRef.current = [latest];
    await act(async () => pending.finish());
    expect(mocks.persist).toHaveBeenCalledWith({ activeTab: latest, tabs: [latest], workspaceRootPath: null });
    expect(mocks.exitApp).not.toHaveBeenCalled();
  });

  it("does not overwrite a session before an empty restore has completed", async () => {
    const { result } = setup({ restoreComplete: false, tabsRef: { current: [] }, activeTab: null });
    await act(async () => { await result.current.requestAppQuit(); });
    expect(mocks.persist).not.toHaveBeenCalled();
    expect(mocks.exitApp).toHaveBeenCalledOnce();
  });
});
