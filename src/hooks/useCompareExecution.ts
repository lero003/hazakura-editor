import {
  type Dispatch,
  type SetStateAction,
  useCallback,
} from "react";
import { buildLineDiff } from "../diff";
import { openTextFile } from "../tauri";
import { localizeCompareError } from "../utils";
import type {
  CompareAnchor,
  CompareViewState,
  DraftRecord,
  EditorTab,
  MenuLanguage,
  RightPaneMode,
} from "../types";

type UseCompareExecutionOptions = {
  activeTab: EditorTab | null;
  clearCompareSource: () => void;
  closeWorkspaceContextMenu: () => void;
  compareAnchor: CompareAnchor | null;
  compareTarget: CompareAnchor | null;
  menuLanguage: MenuLanguage;
  setCompareSource: (file: CompareAnchor) => void;
  setCompareView: Dispatch<SetStateAction<CompareViewState | null>>;
  setGlobalError: Dispatch<SetStateAction<string | null>>;
  setRightPaneMode: Dispatch<SetStateAction<RightPaneMode>>;
  setStatus: Dispatch<SetStateAction<string>>;
};

export function useCompareExecution({
  activeTab,
  clearCompareSource,
  closeWorkspaceContextMenu,
  compareAnchor,
  compareTarget,
  menuLanguage,
  setCompareSource,
  setCompareView,
  setGlobalError,
  setRightPaneMode,
  setStatus,
}: UseCompareExecutionOptions) {
  const reviewTabAgainstDisk = useCallback(
    async (tab: EditorTab) => {
      setGlobalError(null);
      setStatus("Reviewing changes...");

      try {
        const diskDocument = await openTextFile(tab.path);
        const diff = buildLineDiff(diskDocument.contents, tab.contents);
        const diskLabel = menuLanguage === "ja" ? "ディスク" : "Disk";
        const editorLabel = menuLanguage === "ja" ? "エディタ" : "Editor";

        setCompareView({
          kind: "changes",
          leftPath: tab.path,
          leftName: `${tab.name} (${diskLabel})`,
          leftColumnLabel: diskLabel,
          rightPath: tab.path,
          rightName: `${tab.name} (${editorLabel})`,
          rightColumnLabel: editorLabel,
          ...diff,
        });
        setStatus("Change review ready");
      } catch (err) {
        const message = String(err);
        setGlobalError(
          menuLanguage === "ja" ? localizeCompareError(message) : message,
        );
        setStatus("Change review failed");
      }
    },
    [menuLanguage, setCompareView, setGlobalError, setStatus],
  );

  const reviewDraftAgainstDisk = useCallback(
    async (tab: EditorTab, draft: DraftRecord) => {
      setGlobalError(null);
      setStatus("Reviewing changes...");

      try {
        const diskDocument = await openTextFile(tab.path);
        const diff = buildLineDiff(diskDocument.contents, draft.contents);
        const diskLabel = menuLanguage === "ja" ? "ディスク" : "Disk";
        const draftLabel = menuLanguage === "ja" ? "下書き" : "Draft";

        setCompareView({
          kind: "changes",
          leftPath: tab.path,
          leftName: `${tab.name} (${diskLabel})`,
          leftColumnLabel: diskLabel,
          rightPath: tab.path,
          rightName: `${tab.name} (${draftLabel})`,
          rightColumnLabel: draftLabel,
          ...diff,
        });
        setStatus("Change review ready");
      } catch (err) {
        const message = String(err);
        setGlobalError(
          menuLanguage === "ja" ? localizeCompareError(message) : message,
        );
        setStatus("Change review failed");
      }
    },
    [menuLanguage, setCompareView, setGlobalError, setStatus],
  );

  const requestReviewTabAgainstDisk = useCallback(
    (tab: EditorTab) => {
      void reviewTabAgainstDisk(tab);
    },
    [reviewTabAgainstDisk],
  );

  const requestReviewDraftAgainstDisk = useCallback(
    (tab: EditorTab, draft: DraftRecord) => {
      void reviewDraftAgainstDisk(tab, draft);
    },
    [reviewDraftAgainstDisk],
  );

  const compareWorkspaceFiles = useCallback(
    async (rightFile: CompareAnchor) => {
      const canCompareWithActiveTab =
        activeTab !== null && activeTab.path !== rightFile.path;

      if (!canCompareWithActiveTab && !compareAnchor) {
        setCompareSource(rightFile);
        return;
      }

      if (!canCompareWithActiveTab && compareAnchor?.path === rightFile.path) {
        clearCompareSource();
        return;
      }

      closeWorkspaceContextMenu();
      setGlobalError(null);
      setStatus("Comparing files...");

      try {
        const rightDocument = await openTextFile(rightFile.path);
        const centerLabel = menuLanguage === "ja" ? "中央" : "Center";
        const rightLabel = menuLanguage === "ja" ? "右" : "Right";
        const source =
          compareAnchor && compareAnchor.path !== rightFile.path
            ? {
                ...(await openTextFile(compareAnchor.path)),
                name: compareAnchor.name,
                path: compareAnchor.path,
                leftColumnLabel:
                  menuLanguage === "ja" ? "比較元" : "Source",
                rightColumnLabel:
                  menuLanguage === "ja" ? "比較先" : "Target",
              }
            : activeTab && activeTab.path !== rightFile.path
            ? {
                contents: activeTab.contents,
                name: activeTab.name,
                path: activeTab.path,
                leftColumnLabel: centerLabel,
                rightColumnLabel: rightLabel,
              }
            : {
                ...(await openTextFile(compareAnchor?.path ?? rightFile.path)),
                name: compareAnchor?.name ?? rightFile.name,
                path: compareAnchor?.path ?? rightFile.path,
                leftColumnLabel:
                  menuLanguage === "ja" ? "比較元" : "Source",
                rightColumnLabel:
                  menuLanguage === "ja" ? "比較先" : "Target",
              };
        const diff = buildLineDiff(source.contents, rightDocument.contents);

        setCompareView({
          kind: "file",
          leftPath: source.path,
          leftName: source.name,
          leftColumnLabel: source.leftColumnLabel,
          rightPath: rightFile.path,
          rightName: rightFile.name,
          rightColumnLabel: source.rightColumnLabel,
          ...diff,
        });
        setRightPaneMode("compare");
        setStatus("Compare ready");
      } catch (err) {
        const message = String(err);
        setGlobalError(
          menuLanguage === "ja" ? localizeCompareError(message) : message,
        );
        setStatus("Compare failed");
      }
    },
    [
      activeTab,
      clearCompareSource,
      closeWorkspaceContextMenu,
      compareAnchor,
      menuLanguage,
      setCompareSource,
      setCompareView,
      setGlobalError,
      setRightPaneMode,
      setStatus,
    ],
  );

  const runSelectedFileCompare = useCallback(() => {
    if (!compareAnchor || !compareTarget) {
      setGlobalError(
        menuLanguage === "ja"
          ? "比較元と比較先の2つのテキストファイルを選んでください。"
          : "Choose both a source and target text file before comparing.",
      );
      setStatus("Compare failed");
      return;
    }

    if (compareAnchor.path === compareTarget.path) {
      setGlobalError(
        menuLanguage === "ja"
          ? "比較元と比較先には別のファイルを選んでください。"
          : "Choose different files for the source and target.",
      );
      setStatus("Compare failed");
      return;
    }

    void compareWorkspaceFiles(compareTarget);
  }, [
    compareAnchor,
    compareTarget,
    compareWorkspaceFiles,
    menuLanguage,
    setGlobalError,
    setStatus,
  ]);

  return {
    compareWorkspaceFiles,
    requestReviewDraftAgainstDisk,
    requestReviewTabAgainstDisk,
    runSelectedFileCompare,
  };
}
