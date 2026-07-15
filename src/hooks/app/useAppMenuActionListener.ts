import { useEffect, type Dispatch, type SetStateAction } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { isTauriRuntime } from "../../lib/tauri";
import { isExternalCliAssistSurfaceAllowed } from "../../lib/distributionLane";
import {
  APP_MENU_ACTION_EVENT,
  MENU_ABOUT_HELP,
  MENU_EXPORT_EPUB_BETA,
  MENU_LOCAL_DATA_DISCLOSURE,
  MENU_IMPORT_PDF_IMAGE,
  MENU_OKF_SCAFFOLD_BOOK_LIKE,
  MENU_OKF_SCAFFOLD_MINIMAL,
  MENU_OPEN_REFERENCE,
  MENU_OPEN_AGENT_WINDOW,
  MENU_OPEN_APPLE_ASSIST_WINDOW,
  MENU_OPEN_SOURCE_ACKNOWLEDGEMENTS,
  MENU_OPEN_SUPPORT_DIAGNOSTICS,
  MENU_PRIVACY_POLICY,
  MENU_QUIT_APP,
  type EditorSettings,
  type PreferencesDialogMode,
  type RecentEntry,
  type ThemePreference,
} from "../../types";

export type AppMenuActionHandlers = {
  createNewFile: () => void | Promise<unknown>;
  createOkfScaffold: (templateId: "minimal" | "book-like") => void | Promise<unknown>;
  importSourceAsMarkdownDraft: () => void | Promise<unknown>;
  exportEpubBeta: () => void | Promise<unknown>;
  exportHtml: () => void | Promise<unknown>;
  exportPdf: () => void | Promise<unknown>;
  openAgentWindow: () => void | Promise<unknown>;
  openAppleAssistWindow: () => void | Promise<unknown>;
  openFile: () => void | Promise<unknown>;
  openReferenceFile: () => void | Promise<unknown>;
  openWorkspace: () => void | Promise<unknown>;
  openWorkspacePath: (path: string) => void | Promise<unknown>;
  requestAppQuit: () => void | Promise<unknown>;
  requestWindowClose: () => void | Promise<unknown>;
  saveActiveTab: () => void | Promise<unknown>;
  saveActiveTabAs: () => void | Promise<unknown>;
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
  /** Markdown-only L Mode gate; preferred over flipping settings directly. */
  onToggleLMode?: () => void;
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
  onToggleLMode,
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
      const externalCliAllowed = isExternalCliAssistSurfaceAllowed();

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
        case MENU_OKF_SCAFFOLD_MINIMAL:
        case "okf-scaffold-minimal":
          void actions.createOkfScaffold("minimal");
          break;
        case MENU_OKF_SCAFFOLD_BOOK_LIKE:
        case "okf-scaffold-book-like":
          void actions.createOkfScaffold("book-like");
          break;
        case "open-file":
          void actions.openFile();
          break;
        case MENU_IMPORT_PDF_IMAGE:
        case "import-pdf-image":
          void actions.importSourceAsMarkdownDraft();
          break;
        case MENU_OPEN_REFERENCE:
          void actions.openReferenceFile();
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
        case MENU_QUIT_APP:
          void actions.requestAppQuit();
          break;
        case "export-html":
          void actions.exportHtml();
          break;
        case MENU_EXPORT_EPUB_BETA:
          void actions.exportEpubBeta();
          break;
        case "export-pdf":
          void actions.exportPdf();
          break;
        case "toggle-preview":
          setPreviewVisible((current) => !current);
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
        case "toggle-l-mode":
          if (onToggleLMode) {
            onToggleLMode();
          } else {
            setEditorSettings((current) => ({
              ...current,
              lModeEnabled: !current.lModeEnabled,
            }));
          }
          break;
        case "theme-light":
          setThemePreference("light");
          break;
        case "theme-dark":
          setThemePreference("dark");
          break;
        case "theme-edohigan":
          setThemePreference("edohigan");
          break;
        case "theme-yakou":
          setThemePreference("yakou");
          break;
        case "theme-shokou":
          setThemePreference("shokou");
          break;
        case "theme-crt":
          setThemePreference("crt");
          break;
        case "theme-shinkai":
          setThemePreference("shinkai");
          break;
        case "preferences":
          setPreferencesDialogMode("settings");
          break;
        case "agent-workbench":
          setPreferencesDialogMode("agent");
          break;
        case MENU_LOCAL_DATA_DISCLOSURE:
          setPreferencesDialogMode("privacy");
          break;
        case MENU_OPEN_SUPPORT_DIAGNOSTICS:
          setPreferencesDialogMode("diagnostics");
          break;
        case MENU_PRIVACY_POLICY:
          setPreferencesDialogMode("privacy-policy");
          break;
        case MENU_OPEN_SOURCE_ACKNOWLEDGEMENTS:
          setPreferencesDialogMode("open-source-acknowledgements");
          break;
        case MENU_ABOUT_HELP:
          setPreferencesDialogMode("about");
          break;
        case MENU_OPEN_AGENT_WINDOW:
          if (externalCliAllowed) {
            void actions.openAgentWindow();
          }
          break;
        case MENU_OPEN_APPLE_ASSIST_WINDOW:
          void actions.openAppleAssistWindow();
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
    onToggleLMode,
    recentFilesRef,
    recentFoldersRef,
    setEditorSettings,
    setPreferencesDialogMode,
    setPreviewVisible,
    setThemePreference,
  ]);
}
