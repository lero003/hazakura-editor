import {
  type Dispatch,
  type SetStateAction,
  useCallback,
} from "react";
import { revealPathInFileManager, type WorkspaceTreeEntry } from "../../lib/tauri";
import { isComparableTextFile } from "../../features/diff/diff";
import { writeTextToClipboard } from "../../lib/clipboard";
import type {
  CompareAnchor,
  CompareViewState,
  MenuLanguage,
  RightPaneMode,
} from "../../types";
import { isJapaneseMenuLanguage } from "../../types";
import { isKanaStyle } from "../../lib/locale/_helpers";

type UseCompareSetupActionsOptions = {
  closeWorkspaceContextMenu: () => void;
  compareAnchor: CompareAnchor | null;
  menuLanguage: MenuLanguage;
  setCompareAnchor: Dispatch<SetStateAction<CompareAnchor | null>>;
  setCompareTarget: Dispatch<SetStateAction<CompareAnchor | null>>;
  setCompareView: Dispatch<SetStateAction<CompareViewState | null>>;
  setGlobalError: Dispatch<SetStateAction<string | null>>;
  setRightPaneMode: Dispatch<SetStateAction<RightPaneMode>>;
  setStatus: Dispatch<SetStateAction<string>>;
};

export function useCompareSetupActions({
  closeWorkspaceContextMenu,
  compareAnchor,
  menuLanguage,
  setCompareAnchor,
  setCompareTarget,
  setCompareView,
  setGlobalError,
  setRightPaneMode,
  setStatus,
}: UseCompareSetupActionsOptions) {
  const setCompareSource = useCallback(
    (file: CompareAnchor) => {
      setCompareAnchor(file);
      setCompareView(null);
      setCompareTarget((currentTarget) =>
        currentTarget?.path === file.path ? null : currentTarget,
      );
      closeWorkspaceContextMenu();
      setGlobalError(null);
      setRightPaneMode("compare");
      setStatus(compareSourceSetMessage(menuLanguage, file.name));
    },
    [
      closeWorkspaceContextMenu,
      menuLanguage,
      setCompareAnchor,
      setCompareTarget,
      setCompareView,
      setGlobalError,
      setRightPaneMode,
      setStatus,
    ],
  );

  const setCompareTargetFile = useCallback(
    (file: CompareAnchor) => {
      setCompareTarget(file);
      setCompareView(null);
      closeWorkspaceContextMenu();
      setGlobalError(null);
      setRightPaneMode("compare");
      setStatus(compareTargetSetMessage(menuLanguage, file.name));
    },
    [
      closeWorkspaceContextMenu,
      menuLanguage,
      setCompareTarget,
      setCompareView,
      setGlobalError,
      setRightPaneMode,
      setStatus,
    ],
  );

  const selectWorkspaceCompareFile = useCallback(
    (entry: WorkspaceTreeEntry) => {
      if (!isComparableTextFile(entry.name)) {
        closeWorkspaceContextMenu();
        setStatus(nonComparableFileMessage(menuLanguage));
        return;
      }

      const file = { path: entry.path, name: entry.name };

      if (!compareAnchor || compareAnchor.path === entry.path) {
        setCompareSource(file);
        return;
      }

      setCompareTargetFile(file);
    },
    [
      closeWorkspaceContextMenu,
      compareAnchor,
      menuLanguage,
      setCompareSource,
      setCompareTargetFile,
      setStatus,
    ],
  );

  const clearCompareSource = useCallback(() => {
    setCompareAnchor(null);
    closeWorkspaceContextMenu();
    setStatus(compareSourceClearedMessage(menuLanguage));
  }, [closeWorkspaceContextMenu, menuLanguage, setCompareAnchor, setStatus]);

  const clearCompareTarget = useCallback(() => {
    setCompareTarget(null);
    closeWorkspaceContextMenu();
    setStatus(compareTargetClearedMessage(menuLanguage));
  }, [closeWorkspaceContextMenu, menuLanguage, setCompareTarget, setStatus]);

  const copyWorkspaceFullPath = useCallback(
    async (file: CompareAnchor) => {
      closeWorkspaceContextMenu();
      setGlobalError(null);

      try {
        await writeTextToClipboard(file.path);
        setStatus(copiedFullPathMessage(menuLanguage, file.name));
      } catch (err) {
        const errText = String(err);
        setGlobalError(copyPathFailedDetailMessage(menuLanguage, errText));
        setStatus(copyPathFailedMessage(menuLanguage));
      }
    },
    [closeWorkspaceContextMenu, menuLanguage, setGlobalError, setStatus],
  );

  const revealWorkspacePath = useCallback(
    async (file: CompareAnchor) => {
      closeWorkspaceContextMenu();
      setGlobalError(null);

      try {
        await revealPathInFileManager(file.path);
        setStatus(shownInFinderMessage(menuLanguage, file.name));
      } catch (err) {
        const errText = String(err);
        setGlobalError(showInFinderFailedDetailMessage(menuLanguage, errText));
        setStatus(showInFinderFailedMessage(menuLanguage));
      }
    },
    [closeWorkspaceContextMenu, menuLanguage, setGlobalError, setStatus],
  );

  const closeCompareView = useCallback((options?: { returnToEditor?: boolean }) => {
    setCompareView(null);
    if (options?.returnToEditor) {
      setRightPaneMode("preview");
    }
    setStatus("Compare closed");
  }, [setCompareView, setRightPaneMode, setStatus]);

  return {
    clearCompareSource,
    clearCompareTarget,
    closeCompareView,
    copyWorkspaceFullPath,
    revealWorkspacePath,
    selectWorkspaceCompareFile,
    setCompareSource,
    setCompareTargetFile,
  };
}

function compareSourceSetMessage(
  menuLanguage: MenuLanguage,
  fileName: string,
): string {
  if (isKanaStyle(menuLanguage)) {
    return `くらべもとに せってい: ${fileName}`;
  }
  if (isJapaneseMenuLanguage(menuLanguage)) {
    return `比較元に設定: ${fileName}`;
  }
  return `Compare source set: ${fileName}`;
}

function compareTargetSetMessage(
  menuLanguage: MenuLanguage,
  fileName: string,
): string {
  if (isKanaStyle(menuLanguage)) {
    return `くらべさきに せってい: ${fileName}`;
  }
  if (isJapaneseMenuLanguage(menuLanguage)) {
    return `比較先に設定: ${fileName}`;
  }
  return `Compare target set: ${fileName}`;
}

function nonComparableFileMessage(menuLanguage: MenuLanguage): string {
  if (isKanaStyle(menuLanguage)) {
    return "この ふみは Diff くらべできる もじふみ では ありません。";
  }
  if (isJapaneseMenuLanguage(menuLanguage)) {
    return "このファイルは Diff 比較できるテキスト形式ではありません。";
  }
  return "This file is not a comparable text document.";
}

function compareSourceClearedMessage(menuLanguage: MenuLanguage): string {
  if (isKanaStyle(menuLanguage)) {
    return "くらべもとを とくしました";
  }
  if (isJapaneseMenuLanguage(menuLanguage)) {
    return "比較元を解除しました";
  }
  return "Compare source cleared";
}

function compareTargetClearedMessage(menuLanguage: MenuLanguage): string {
  if (isKanaStyle(menuLanguage)) {
    return "くらべさきを とくしました";
  }
  if (isJapaneseMenuLanguage(menuLanguage)) {
    return "比較先を解除しました";
  }
  return "Compare target cleared";
}

function copiedFullPathMessage(
  menuLanguage: MenuLanguage,
  fileName: string,
): string {
  if (isKanaStyle(menuLanguage)) {
    return `ふるぱすを こぴー: ${fileName}`;
  }
  if (isJapaneseMenuLanguage(menuLanguage)) {
    return `フルパスをコピー: ${fileName}`;
  }
  return `Copied full path: ${fileName}`;
}

function copyPathFailedMessage(menuLanguage: MenuLanguage): string {
  if (isKanaStyle(menuLanguage)) {
    return "ぱすの こぴーに しっぱいしました";
  }
  if (isJapaneseMenuLanguage(menuLanguage)) {
    return "パスのコピーに失敗しました";
  }
  return "Copy path failed";
}

function copyPathFailedDetailMessage(
  menuLanguage: MenuLanguage,
  detail: string,
): string {
  if (isKanaStyle(menuLanguage)) {
    return `ぱすの こぴーに しっぱいしました: ${detail}`;
  }
  if (isJapaneseMenuLanguage(menuLanguage)) {
    return `パスのコピーに失敗しました: ${detail}`;
  }
  return `Copy path failed: ${detail}`;
}

function shownInFinderMessage(
  menuLanguage: MenuLanguage,
  fileName: string,
): string {
  if (isKanaStyle(menuLanguage)) {
    return `ファインダーで ひょうじ: ${fileName}`;
  }
  if (isJapaneseMenuLanguage(menuLanguage)) {
    return `Finderで表示: ${fileName}`;
  }
  return `Shown in Finder: ${fileName}`;
}

function showInFinderFailedMessage(menuLanguage: MenuLanguage): string {
  if (isKanaStyle(menuLanguage)) {
    return "ファインダーで ひょうじ できませんでした";
  }
  if (isJapaneseMenuLanguage(menuLanguage)) {
    return "Finderで表示できませんでした";
  }
  return "Show in Finder failed";
}

function showInFinderFailedDetailMessage(
  menuLanguage: MenuLanguage,
  detail: string,
): string {
  if (isKanaStyle(menuLanguage)) {
    return `ファインダーで ひょうじ できませんでした: ${detail}`;
  }
  if (isJapaneseMenuLanguage(menuLanguage)) {
    return `Finderで表示できませんでした: ${detail}`;
  }
  return `Show in Finder failed: ${detail}`;
}
