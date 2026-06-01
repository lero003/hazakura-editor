import {
  type Dispatch,
  type SetStateAction,
  useCallback,
} from "react";
import { revealPathInFileManager, type WorkspaceTreeEntry } from "../tauri";
import { isComparableTextFile } from "../diff";
import { writeTextToClipboard } from "../clipboard";
import type {
  CompareAnchor,
  CompareViewState,
  MenuLanguage,
  RightPaneMode,
} from "../types";

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
      setStatus(
        menuLanguage === "ja"
          ? `比較元に設定: ${file.name}`
          : `Compare source set: ${file.name}`,
      );
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
      setStatus(
        menuLanguage === "ja"
          ? `比較先に設定: ${file.name}`
          : `Compare target set: ${file.name}`,
      );
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
        setStatus(
          menuLanguage === "ja"
            ? "このファイルは Diff 比較できるテキスト形式ではありません。"
            : "This file is not a comparable text document.",
        );
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
    setStatus(
      menuLanguage === "ja" ? "比較元を解除しました" : "Compare source cleared",
    );
  }, [closeWorkspaceContextMenu, menuLanguage, setCompareAnchor, setStatus]);

  const clearCompareTarget = useCallback(() => {
    setCompareTarget(null);
    closeWorkspaceContextMenu();
    setStatus(
      menuLanguage === "ja" ? "比較先を解除しました" : "Compare target cleared",
    );
  }, [closeWorkspaceContextMenu, menuLanguage, setCompareTarget, setStatus]);

  const copyWorkspaceFullPath = useCallback(
    async (file: CompareAnchor) => {
      closeWorkspaceContextMenu();
      setGlobalError(null);

      try {
        await writeTextToClipboard(file.path);
        setStatus(
          menuLanguage === "ja"
            ? `フルパスをコピー: ${file.name}`
            : `Copied full path: ${file.name}`,
        );
      } catch (err) {
        setGlobalError(
          menuLanguage === "ja"
            ? `パスのコピーに失敗しました: ${String(err)}`
            : `Copy path failed: ${String(err)}`,
        );
        setStatus(
          menuLanguage === "ja" ? "パスのコピーに失敗しました" : "Copy path failed",
        );
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
        setStatus(
          menuLanguage === "ja"
            ? `Finderで表示: ${file.name}`
            : `Shown in Finder: ${file.name}`,
        );
      } catch (err) {
        setGlobalError(
          menuLanguage === "ja"
            ? `Finderで表示できませんでした: ${String(err)}`
            : `Show in Finder failed: ${String(err)}`,
        );
        setStatus(
          menuLanguage === "ja"
            ? "Finderで表示できませんでした"
            : "Show in Finder failed",
        );
      }
    },
    [closeWorkspaceContextMenu, menuLanguage, setGlobalError, setStatus],
  );

  const closeCompareView = useCallback(() => {
    setCompareView(null);
    setStatus("Compare closed");
  }, [setCompareView, setStatus]);

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
