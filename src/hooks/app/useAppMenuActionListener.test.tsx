import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { listen } from "@tauri-apps/api/event";
import { useAppMenuActionListener } from "./useAppMenuActionListener";
import { APP_MENU_ACTION_EVENT } from "../../types";

type MenuListener = Parameters<typeof listen<string>>[1];

const menuListeners: MenuListener[] = [];

vi.mock("../../lib/tauri", () => ({
  isTauriRuntime: () => true,
}));

vi.mock("../../lib/distributionLane", () => ({
  isExternalCliAssistSurfaceAllowed: () => true,
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (eventName: string, handler: MenuListener) => {
    expect(eventName).toBe(APP_MENU_ACTION_EVENT);
    menuListeners.push(handler);
    return () => {};
  }),
}));

function setup() {
  const actions = {
    createNewFile: vi.fn(),
    exportEpubBeta: vi.fn(),
    exportHtml: vi.fn(),
    exportPdf: vi.fn(),
    openAgentWindow: vi.fn(),
    openAppleAssistWindow: vi.fn(),
    openFile: vi.fn(),
    openWorkspace: vi.fn(),
    openWorkspacePath: vi.fn(),
    requestAppQuit: vi.fn(),
    requestWindowClose: vi.fn(),
    saveActiveTab: vi.fn(),
    saveActiveTabAs: vi.fn(),
  };
  const setThemePreference = vi.fn();

  renderHook(() =>
    useAppMenuActionListener({
      actionsRef: { current: actions },
      onOpenRecentFile: vi.fn(),
      recentFilesRef: { current: [] },
      recentFoldersRef: { current: [] },
      setEditorSettings: vi.fn(),
      setPreferencesDialogMode: vi.fn(),
      setPreviewVisible: vi.fn(),
      setThemePreference,
    }),
  );

  return { actions, setThemePreference };
}

describe("useAppMenuActionListener", () => {
  afterEach(() => {
    menuListeners.length = 0;
    vi.mocked(listen).mockClear();
  });

  it("routes the custom quit menu action through the app quit confirmation flow", () => {
    const { actions } = setup();

    void menuListeners[0]?.({ payload: "quit-app" } as never);

    expect(actions.requestAppQuit).toHaveBeenCalledTimes(1);
    expect(actions.requestWindowClose).not.toHaveBeenCalled();
  });

  it("routes the EPUB beta export menu action", () => {
    const { actions } = setup();

    void menuListeners[0]?.({ payload: "export-epub-beta" } as never);

    expect(actions.exportEpubBeta).toHaveBeenCalledTimes(1);
    expect(actions.exportHtml).not.toHaveBeenCalled();
    expect(actions.exportPdf).not.toHaveBeenCalled();
  });

  it("routes the CRT theme menu action to setThemePreference", () => {
    const { setThemePreference } = setup();

    void menuListeners[0]?.({ payload: "theme-crt" } as never);

    expect(setThemePreference).toHaveBeenCalledWith("crt");
  });
});
