import {
  type Dispatch,
  type SetStateAction,
  useCallback,
} from "react";
import {
  createSecurityScopedBookmark,
  createTextFile,
  openTextFile,
  pickMarkdownFile,
  pickNewMarkdownFilePath,
} from "../../lib/tauri";
import { createEditorTab } from "../../features/editor/editorTabs";
import {
  readStoredDrafts,
  upsertDraftRecord,
  writePersistedFileBookmark,
} from "../../lib/storage";
import { isComparableTextFile } from "../../features/diff/diff";
import { resolveLocalMarkdownLinkTarget } from "../../features/editor/markdownLinks";
import {
  isSupportedImageFile,
  suggestedNewFilePath,
} from "../../lib/utils";
import type {
  CompareViewState,
  DraftRecord,
  EditorTab,
  MenuLanguage,
} from "../../types";
import { isJapaneseMenuLanguage } from "../../types";
import { isKanaStyle } from "../../lib/locale/_helpers";

type UseFileOpeningOptions = {
  activeTab: EditorTab | null;
  clearImagePreview: () => void;
  menuLanguage: MenuLanguage;
  openImagePreview: (path: string) => Promise<unknown>;
  refreshWorkspaceTree: () => Promise<void>;
  rememberRecentFile: (path: string) => void;
  setActiveTabId: Dispatch<SetStateAction<string | null>>;
  setCompareView: Dispatch<SetStateAction<CompareViewState | null>>;
  setGlobalError: Dispatch<SetStateAction<string | null>>;
  setPendingDrafts: Dispatch<SetStateAction<DraftRecord[]>>;
  setStatus: Dispatch<SetStateAction<string>>;
  setTabs: Dispatch<SetStateAction<EditorTab[]>>;
  tabs: EditorTab[];
  workspaceRootPath: string | null;
};

export function useFileOpening({
  activeTab,
  clearImagePreview,
  menuLanguage,
  openImagePreview,
  refreshWorkspaceTree,
  rememberRecentFile,
  setActiveTabId,
  setCompareView,
  setGlobalError,
  setPendingDrafts,
  setStatus,
  setTabs,
  tabs,
  workspaceRootPath,
}: UseFileOpeningOptions) {
  const openFilePath = useCallback(
    async (path: string, options: { persistFileBookmark?: boolean } = {}) => {
      setGlobalError(null);

      const existingTab = tabs.find((tab) => tab.path === path);
      if (existingTab) {
        setActiveTabId(existingTab.id);
        clearImagePreview();
        setCompareView(null);
        rememberRecentFile(path);
        setStatus("Tab focused");
        return true;
      }

      setStatus("Opening file...");

      try {
        const file = await openTextFile(path);
        const nextTab = createEditorTab(file);
        if (options.persistFileBookmark) {
          const bookmark = await createSecurityScopedBookmark(path).catch(
            () => null,
          );
          writePersistedFileBookmark(path, bookmark);
        }
        const draft = readStoredDrafts().find(
          (candidate) =>
            candidate.path === path &&
            candidate.savedFingerprint === file.fingerprint &&
            candidate.contents !== nextTab.contents,
        );

        setTabs((currentTabs) =>
          currentTabs.some((tab) => tab.path === path)
            ? currentTabs
            : [...currentTabs, nextTab],
        );
        if (draft) {
          setPendingDrafts((currentDrafts) =>
            upsertDraftRecord(currentDrafts, draft),
          );
        }
        setActiveTabId(path);
        clearImagePreview();
        setCompareView(null);
        rememberRecentFile(path);
        setStatus(
          draft
            ? "Opened with recoverable draft"
            : file.large_file_warning
            ? "Opened with large-file warning"
            : "Opened safely",
        );
        return true;
      } catch (err) {
        setGlobalError(String(err));
        setStatus("Open failed");
        return false;
      }
    },
    [
      clearImagePreview,
      rememberRecentFile,
      setActiveTabId,
      setCompareView,
      setGlobalError,
      setPendingDrafts,
      setStatus,
      setTabs,
      tabs,
    ],
  );

  const openExternalFilePaths = useCallback(
    async (paths: string[]) => {
      for (const path of Array.from(new Set(paths)).filter(Boolean)) {
        if (isSupportedImageFile(path)) {
          await openImagePreview(path);
        } else {
          await openFilePath(path, { persistFileBookmark: true });
        }
      }
    },
    [openFilePath, openImagePreview],
  );

  const openWorkspaceFile = useCallback(
    async (path: string) => {
      if (isSupportedImageFile(path)) {
        await openImagePreview(path);
        return;
      }

      await openFilePath(path);
    },
    [openFilePath, openImagePreview],
  );

  const openPreviewMarkdownLink = useCallback(
    async (href: string) => {
      const targetPath =
        activeTab && workspaceRootPath
          ? resolveLocalMarkdownLinkTarget(
              href,
              activeTab.path,
              workspaceRootPath,
            )
          : null;

      if (!targetPath) {
        setStatus(workspaceRelativeLinkOnlyMessage(menuLanguage));
        return;
      }

      if (!isComparableTextFile(targetPath)) {
        setStatus(unsupportedLinkedFileMessage(menuLanguage));
        return;
      }

      const opened = await openFilePath(targetPath);

      if (opened) {
        setStatus(linkedFileOpenedMessage(menuLanguage));
      }
    },
    [activeTab, menuLanguage, openFilePath, setStatus, workspaceRootPath],
  );

  const createNewFile = useCallback(async () => {
    setGlobalError(null);
    setStatus("Choosing new file path...");

    try {
      const path = await pickNewMarkdownFilePath(
        suggestedNewFilePath(workspaceRootPath),
      );

      if (!path) {
        setStatus("New file cancelled");
        return;
      }

      const existingTab = tabs.find((tab) => tab.path === path);

      if (existingTab) {
        setActiveTabId(existingTab.id);
        clearImagePreview();
        setCompareView(null);
        rememberRecentFile(path);
        setStatus("Tab focused");
        return;
      }

      setStatus("Creating file...");

      const file = await createTextFile(path, workspaceRootPath);
      const nextTab = createEditorTab(file);

      setTabs((currentTabs) =>
        currentTabs.some((tab) => tab.path === path)
          ? currentTabs
          : [...currentTabs, nextTab],
      );
      setActiveTabId(path);
      clearImagePreview();
      setCompareView(null);
      rememberRecentFile(path);

      if (workspaceRootPath) {
        try {
          await refreshWorkspaceTree();
        } catch (err) {
          setGlobalError(String(err));
          setStatus("New file created; folder refresh failed");
          return;
        }
      }

      setStatus("New file created");
    } catch (err) {
      setGlobalError(String(err));
      setStatus("New file failed");
    }
  }, [
    clearImagePreview,
    refreshWorkspaceTree,
    rememberRecentFile,
    setActiveTabId,
    setCompareView,
    setGlobalError,
    setStatus,
    setTabs,
    tabs,
    workspaceRootPath,
  ]);

  const openFile = useCallback(async () => {
    setGlobalError(null);
    setStatus("Choosing file...");

    try {
      const path = await pickMarkdownFile();

      if (!path) {
        setStatus("Open cancelled");
        return;
      }

      await openFilePath(path, { persistFileBookmark: true });
    } catch (err) {
      setGlobalError(String(err));
      setStatus("Open failed");
    }
  }, [openFilePath, setGlobalError, setStatus]);

  return {
    createNewFile,
    openExternalFilePaths,
    openFile,
    openFilePath,
    openPreviewMarkdownLink,
    openWorkspaceFile,
  };
}

function workspaceRelativeLinkOnlyMessage(menuLanguage: MenuLanguage): string {
  if (isKanaStyle(menuLanguage)) {
    return "workspace ないの そうたい もじりんくだけ ひらけます";
  }
  if (isJapaneseMenuLanguage(menuLanguage)) {
    return "workspace 内の相対テキストリンクだけ開けます";
  }
  return "Only relative workspace text links can be opened";
}

function unsupportedLinkedFileMessage(menuLanguage: MenuLanguage): string {
  if (isKanaStyle(menuLanguage)) {
    return "りんくさきは たいおう もじふみ では ありません";
  }
  if (isJapaneseMenuLanguage(menuLanguage)) {
    return "リンク先は対応テキストファイルではありません";
  }
  return "Linked file is not a supported text file";
}

function linkedFileOpenedMessage(menuLanguage: MenuLanguage): string {
  if (isKanaStyle(menuLanguage)) {
    return "りんくさき ふみを ひらきました";
  }
  if (isJapaneseMenuLanguage(menuLanguage)) {
    return "リンク先ファイルを開きました";
  }
  return "Linked file opened";
}
