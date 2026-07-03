import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useRef,
} from "react";
import { buildLineDiff } from "../../features/diff/diff";
import { openTextFile } from "../../lib/tauri";
import { localizeCompareError } from "../../lib/utils";
import type {
  CompareAnchor,
  CompareCase,
  CompareViewState,
  DraftRecord,
  EditorTab,
  MenuLanguage,
  RightPaneMode,
} from "../../types";
import {
  compareColumnLabel,
  compareMissingSelectionMessage,
  compareSameFileMessage,
} from "../../lib/locale/review";

type UseCompareExecutionOptions = {
  activeTab: EditorTab | null;
  clearCompareSource: () => void;
  closeWorkspaceContextMenu: () => void;
  compareAnchor: CompareAnchor | null;
  compareTarget: CompareAnchor | null;
  getCurrentTabById: (tabId: string) => EditorTab | null;
  menuLanguage: MenuLanguage;
  setCompareCaseEntry: (entry: CompareCase) => void;
  setCompareSource: (file: CompareAnchor) => void;
  setCompareView: Dispatch<SetStateAction<CompareViewState | null>>;
  setGlobalError: Dispatch<SetStateAction<string | null>>;
  setRightPaneMode: Dispatch<SetStateAction<RightPaneMode>>;
  setSidePaneOpen: Dispatch<SetStateAction<boolean>>;
  setStatus: Dispatch<SetStateAction<string>>;
};

export type ChangeReviewSnapshot = {
  compareCase: Extract<CompareCase, { kind: "changes" }>;
  compareView: CompareViewState;
};

export async function buildTabAgainstDiskChangeReview(
  tab: EditorTab,
  menuLanguage: MenuLanguage,
  getCurrentTabById: (tabId: string) => EditorTab | null = () => tab,
): Promise<ChangeReviewSnapshot | null> {
  const diskDocument = await openTextFile(tab.path);
  const latestTab = getCurrentTabById(tab.id);
  if (!latestTab || latestTab.path !== tab.path) {
    return null;
  }
  const diff = buildLineDiff(diskDocument.contents, latestTab.contents);
  const diskLabel = compareColumnLabel(menuLanguage, "disk");
  const editorLabel = compareColumnLabel(menuLanguage, "editor");
  const caseKey = crypto.randomUUID();
  const compareCase: CompareCase = {
    kind: "changes",
    key: caseKey,
    scope: "buffer-vs-disk",
    documentPath: latestTab.path,
    documentLabel: latestTab.name,
    leftColumnLabel: diskLabel,
    rightColumnLabel: editorLabel,
  };

  return {
    compareCase,
    compareView: {
      caseKey,
      ...diff,
    },
  };
}

export function useCompareExecution({
  activeTab,
  clearCompareSource,
  closeWorkspaceContextMenu,
  compareAnchor,
  compareTarget,
  getCurrentTabById,
  menuLanguage,
  setCompareCaseEntry,
  setCompareSource,
  setCompareView,
  setGlobalError,
  setRightPaneMode,
  setSidePaneOpen,
  setStatus,
}: UseCompareExecutionOptions) {
  const fileCompareRequestSeqRef = useRef(0);

  const reviewTabAgainstDisk = useCallback(
    async (tab: EditorTab) => {
      setGlobalError(null);
      setStatus("Reviewing changes...");

      try {
        const snapshot = await buildTabAgainstDiskChangeReview(
          tab,
          menuLanguage,
          getCurrentTabById,
        );
        if (!snapshot) {
          setStatus("Change review skipped; document changed");
          return;
        }

        setCompareCaseEntry(snapshot.compareCase);
        setCompareView(snapshot.compareView);
        setRightPaneMode("compare");
        setSidePaneOpen(true);
        setStatus("Change review ready");
      } catch (err) {
        const message = String(err);
        setGlobalError(
          menuLanguage !== "en" ? localizeCompareError(message, menuLanguage) : message,
        );
        setStatus("Change review failed");
      }
    },
    [
      getCurrentTabById,
      menuLanguage,
      setCompareCaseEntry,
      setCompareView,
      setGlobalError,
      setRightPaneMode,
      setSidePaneOpen,
      setStatus,
    ],
  );

  const prepareReviewTabAgainstDisk = useCallback(
    async (tab: EditorTab): Promise<ChangeReviewSnapshot | null> => {
      setGlobalError(null);

      try {
        return await buildTabAgainstDiskChangeReview(
          tab,
          menuLanguage,
          getCurrentTabById,
        );
      } catch (err) {
        const message = String(err);
        setGlobalError(
          menuLanguage !== "en" ? localizeCompareError(message, menuLanguage) : message,
        );
        return null;
      }
    },
    [getCurrentTabById, menuLanguage, setGlobalError],
  );

  const reviewDraftAgainstDisk = useCallback(
    async (tab: EditorTab, draft: DraftRecord) => {
      setGlobalError(null);
      setStatus("Reviewing changes...");

      try {
        const diskDocument = await openTextFile(tab.path);
        const diff = buildLineDiff(diskDocument.contents, draft.contents);
        const diskLabel = compareColumnLabel(menuLanguage, "disk");
        const draftLabel = compareColumnLabel(menuLanguage, "draft");
        const caseKey = crypto.randomUUID();
        const compareCase: CompareCase = {
          kind: "changes",
          key: caseKey,
          scope: "draft-vs-disk",
          documentPath: tab.path,
          documentLabel: tab.name,
          leftColumnLabel: diskLabel,
          rightColumnLabel: draftLabel,
        };

        setCompareCaseEntry(compareCase);
        setCompareView({
          caseKey,
          ...diff,
        });
        setRightPaneMode("compare");
        setSidePaneOpen(true);
        setStatus("Change review ready");
      } catch (err) {
        const message = String(err);
        setGlobalError(
          menuLanguage !== "en" ? localizeCompareError(message, menuLanguage) : message,
        );
        setStatus("Change review failed");
      }
    },
    [
      menuLanguage,
      setCompareCaseEntry,
      setCompareView,
      setGlobalError,
      setRightPaneMode,
      setSidePaneOpen,
      setStatus,
    ],
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

  const reviewBackupAgainstBuffer = useCallback(
    async (
      tab: EditorTab,
      backupName: string,
      backupContents: string,
    ) => {
      setGlobalError(null);
      setStatus("Reviewing backup...");

      try {
        // The backup snapshot is the left column ("what the
        // backup says") and the live editor buffer is the right
        // column ("what you have now"). With this orientation the
        // added / removed counts in the diff header read as the
        // size of the change the user is about to apply.
        const diff = buildLineDiff(backupContents, tab.contents);
        const backupLabel = compareColumnLabel(menuLanguage, "backup");
        const bufferLabel = compareColumnLabel(menuLanguage, "buffer");
        const caseKey = crypto.randomUUID();
        const compareCase: CompareCase = {
          kind: "changes",
          key: caseKey,
          scope: "backup-vs-buffer",
          documentPath: tab.path,
          documentLabel: tab.name,
          leftColumnLabel: backupLabel,
          rightColumnLabel: bufferLabel,
          backupApplyAction: { backupName, backupContents },
        };

        setCompareCaseEntry(compareCase);
        setCompareView({
          caseKey,
          ...diff,
        });
        setRightPaneMode("compare");
        setSidePaneOpen(true);
        setStatus("Backup review ready");
      } catch (err) {
        const message = String(err);
        setGlobalError(
          menuLanguage !== "en" ? localizeCompareError(message, menuLanguage) : message,
        );
        setStatus("Backup review failed");
      }
    },
    [
      menuLanguage,
      setCompareCaseEntry,
      setCompareView,
      setGlobalError,
      setRightPaneMode,
      setSidePaneOpen,
      setStatus,
    ],
  );

  const requestReviewBackupAgainstBuffer = useCallback(
    (tab: EditorTab, backupName: string, backupContents: string) => {
      void reviewBackupAgainstBuffer(tab, backupName, backupContents);
    },
    [reviewBackupAgainstBuffer],
  );

  const compareWorkspaceFiles = useCallback(
    async (rightFile: CompareAnchor) => {
      const requestSeq = fileCompareRequestSeqRef.current + 1;
      fileCompareRequestSeqRef.current = requestSeq;
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
        const centerLabel = compareColumnLabel(menuLanguage, "center");
        const rightLabel = compareColumnLabel(menuLanguage, "right");
        const sourceLabel = compareColumnLabel(menuLanguage, "source");
        const targetLabel = compareColumnLabel(menuLanguage, "target");
        const source =
          compareAnchor && compareAnchor.path !== rightFile.path
            ? {
                ...(await openTextFile(compareAnchor.path)),
                name: compareAnchor.name,
                path: compareAnchor.path,
                leftColumnLabel: sourceLabel,
                rightColumnLabel: targetLabel,
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
                leftColumnLabel: sourceLabel,
                rightColumnLabel: targetLabel,
              };
        const diff = buildLineDiff(source.contents, rightDocument.contents);
        const caseKey = crypto.randomUUID();
        const compareCase: CompareCase = {
          kind: "file",
          key: caseKey,
          leftPath: source.path,
          rightPath: rightFile.path,
          anchor: {
            path: source.path,
            name: source.name,
            label: source.leftColumnLabel,
          },
          target: {
            path: rightFile.path,
            name: rightFile.name,
            label: source.rightColumnLabel,
          },
        };
        if (requestSeq !== fileCompareRequestSeqRef.current) {
          return;
        }

        setCompareCaseEntry(compareCase);
        setCompareView({
          caseKey,
          ...diff,
        });
        setRightPaneMode("compare");
        setStatus("Compare ready");
      } catch (err) {
        if (requestSeq !== fileCompareRequestSeqRef.current) {
          return;
        }
        const message = String(err);
        setGlobalError(
          menuLanguage !== "en" ? localizeCompareError(message, menuLanguage) : message,
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
      setCompareCaseEntry,
      setCompareSource,
      setCompareView,
      setGlobalError,
      setRightPaneMode,
      setStatus,
    ],
  );

  const runSelectedFileCompare = useCallback(() => {
    if (!compareAnchor || !compareTarget) {
      setGlobalError(compareMissingSelectionMessage(menuLanguage));
      setStatus("Compare failed");
      return;
    }

    if (compareAnchor.path === compareTarget.path) {
      setGlobalError(compareSameFileMessage(menuLanguage));
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
    prepareReviewTabAgainstDisk,
    requestReviewBackupAgainstBuffer,
    requestReviewDraftAgainstDisk,
    requestReviewTabAgainstDisk,
    runSelectedFileCompare,
  };
}
