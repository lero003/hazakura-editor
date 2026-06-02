import { useEffect, type Dispatch, type SetStateAction } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { isTauriRuntime } from "../../lib/tauri";
import {
  APP_MENU_ACTION_EVENT,
  MENU_OPEN_AGENT_WINDOW,
  type EditorSettings,
  type PreferencesDialogMode,
  type RecentEntry,
  type ThemePreference,
} from "../../types";

export type AppMenuActionHandlers = {
  createNewFile: () => void | Promise<unknown>;
  exportHtml: () => void | Promise<unknown>;
  exportPdf: () => void | Promise<unknown>;
  openAgentWindow: () => void | Promise<unknown>;
  openFile: () => void | Promise<unknown>;
  openWorkspace: () => void | Promise<unknown>;
  openWorkspacePath: (path: string) => void | Promise<unknown>;
  requestWindowClose: () => void | Promise<unknown>;
  saveActiveTab: () => void | Promise<unknown>;
  saveActiveTabAs: () => void | Promise<unknown>;
  toggleReviewDesk: () => void | Promise<unknown>;
};

type RefValue<T> = {
  current: T;
};

type UseAppMenuActionListenerOptions = {
  actionsRef: RefValue<AppMenuActionHandlers>;
  onOpenRecentFile: (path: string) => void | Promise<unknown>;
  recentFilesRef: RefValue<RecentEntry[]>;
  recentFoldersRef: RefValue<RecentEntry[]>;
  setEditorSettings: Dispatch<SetStateAction<EditorSettings>>;
  setPreferencesDialogMode: Dispatch<
    SetStateAction<PreferencesDialogMode | null>
  >;
  setPreviewVisible: Dispatch<SetStateAction<boolean>>;
  setThemePreference: Dispatch<SetStateAction<ThemePreference>>;
};

export function useAppMenuActionListener({
  actionsRef,
  onOpenRecentFile,
  recentFilesRef,
  recentFoldersRef,
  setEditorSettings,
  setPreferencesDialogMode,
  setPreviewVisible,
  setThemePreference,
}: UseAppMenuActionListenerOptions) {
  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    let disposed = false;
    let unlisten: UnlistenFn | null = null;

    void listen<string>(APP_MENU_ACTION_EVENT, (event) => {
      const actions = actionsRef.current;
      const action = event.payload;

      if (action.startsWith("recent-file-")) {
        const index = Number(action.slice("recent-file-".length));
        const recentFile = recentFilesRef.current[index];

        if (recentFile) {
          void onOpenRecentFile(recentFile.path);
        }

        return;
      }

      if (action.startsWith("recent-folder-")) {
        const index = Number(action.slice("recent-folder-".length));
        const recentFolder = recentFoldersRef.current[index];

        if (recentFolder) {
          void actions.openWorkspacePath(recentFolder.path);
        }

        return;
      }

      switch (action) {
        case "new-file":
          void actions.createNewFile();
          break;
        case "open-file":
          void actions.openFile();
          break;
        case "open-folder":
          void actions.openWorkspace();
          break;
        case "save":
          void actions.saveActiveTab();
          break;
        case "save-as":
          void actions.saveActiveTabAs();
          break;
        case "close-window":
          void actions.requestWindowClose();
          break;
        case "export-html":
          void actions.exportHtml();
          break;
        case "export-pdf":
          void actions.exportPdf();
          break;
        case "toggle-preview":
          setPreviewVisible((current) => !current);
          break;
        case "toggle-review-desk":
          void actions.toggleReviewDesk();
          break;
        case "toggle-wrap":
          setEditorSettings((current) => ({
            ...current,
            wrapLines: !current.wrapLines,
          }));
          break;
        case "toggle-invisibles":
          setEditorSettings((current) => ({
            ...current,
            showInvisibles: !current.showInvisibles,
          }));
          break;
        case "toggle-spellcheck":
          setEditorSettings((current) => ({
            ...current,
            spellcheckEnabled: !current.spellcheckEnabled,
          }));
          break;
        case "theme-light":
          setThemePreference("light");
          break;
        case "theme-dark":
          setThemePreference("dark");
          break;
        case "theme-sakura":
          setThemePreference("sakura");
          break;
        case "theme-yakou":
          setThemePreference("yakou");
          break;
        case "theme-shokou":
          setThemePreference("shokou");
          break;
        case "theme-kouyou":
          setThemePreference("kouyou");
          break;
        case "preferences":
          setPreferencesDialogMode("settings");
          break;
        case "agent-workbench":
          setPreferencesDialogMode("agent");
          break;
        case MENU_OPEN_AGENT_WINDOW:
          void actions.openAgentWindow();
          break;
      }
    })
      .then((cleanup) => {
        if (disposed) {
          cleanup();
          return;
        }

        unlisten = cleanup;
      })
      .catch((err) => {
        console.warn("Failed to listen for app menu actions", err);
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [
    actionsRef,
    onOpenRecentFile,
    recentFilesRef,
    recentFoldersRef,
    setEditorSettings,
    setPreferencesDialogMode,
    setPreviewVisible,
    setThemePreference,
  ]);
}
