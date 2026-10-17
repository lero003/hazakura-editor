import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
} from "react";
import { closePdfReference } from "../../lib/tauri";
import { localizeCompareError } from "../../lib/utils";
import { revealReferenceTextDiff } from "../../features/referenceCompare/revealReferenceTextDiff";
import type { EditorTab, MenuLanguage, RightPaneMode } from "../../types";
import type { useAppShellFoundation } from "../app/useAppShellFoundation";
import { useImportPageFollow } from "./useImportPageFollow";
import { useReferenceCompareActions } from "./useReferenceCompareActions";
import { useReferenceExternalChange } from "./useReferenceExternalChange";

type Foundation = ReturnType<typeof useAppShellFoundation>;

export type UseReferenceCompareSurfaceOptions = {
  activeTab: EditorTab | null;
  clearReferenceCompare: Foundation["clearReferenceCompare"];
  markReferenceExternalChange: Foundation["markReferenceExternalChange"];
  menuLanguage: MenuLanguage;
  referenceCompare: Foundation["referenceCompare"];
  referenceRetainedStatus: string;
  requestReviewTabAgainstDisk: (tab: EditorTab) => void;
  selectionLine: number;
  setCompareCaseEntry: Foundation["setCompareCaseEntry"];
  setCompareView: Foundation["setCompareView"];
  setGlobalError: Dispatch<SetStateAction<string | null>>;
  setPdfPageIndex: Foundation["setPdfPageIndex"];
  setReferenceDocument: Foundation["setReferenceDocument"];
  setReferenceFollowMode: Foundation["setReferenceFollowMode"];
  setReferencePaneVisible: Foundation["setReferencePaneVisible"];
  setRightPaneMode: Dispatch<SetStateAction<RightPaneMode>>;
  setSidePaneOpen: Dispatch<SetStateAction<boolean>>;
  setSidePaneOpenFromUserAction: (open: boolean) => void;
  setStatus: Dispatch<SetStateAction<string>>;
  workspaceRootPath: string | null;
};

/**
 * Reference Compare surface of the app shell: the read-only reference column's
 * actions, page-follow / external-change wiring, the text-reference Diff hand-off
 * and the PDF helper cleanup on unmount.
 *
 * Extracted from `useAppShellController` without behaviour changes. The
 * controller keeps the pane-toggle exclusivity wiring (`switchFromReference`,
 * preview surface) and the Import Assist pairing ref.
 */
export function useReferenceCompareSurface({
  activeTab,
  clearReferenceCompare,
  markReferenceExternalChange,
  menuLanguage,
  referenceCompare,
  referenceRetainedStatus,
  requestReviewTabAgainstDisk,
  selectionLine,
  setCompareCaseEntry,
  setCompareView,
  setGlobalError,
  setPdfPageIndex,
  setReferenceDocument,
  setReferenceFollowMode,
  setReferencePaneVisible,
  setRightPaneMode,
  setSidePaneOpen,
  setSidePaneOpenFromUserAction,
  setStatus,
  workspaceRootPath,
}: UseReferenceCompareSurfaceOptions) {
  const {
    closeReferenceCompare,
    openReferenceFile,
    openTextPathAsReference,
    pairImportAssistReference,
    pauseReferenceFollow,
    referenceCopy,
    reloadReferenceFromDisk,
    resumeReferenceFollow,
  } = useReferenceCompareActions({
    activeTab,
    clearReferenceCompare,
    menuLanguage,
    referenceCompare,
    requestReviewTabAgainstDisk,
    setGlobalError,
    setReferenceDocument,
    setReferenceFollowMode,
    setStatus,
    workspaceRootPath,
  });

  const toggleReferencePane = useCallback(() => {
    if (!referenceCompare) {
      void openReferenceFile();
      return;
    }
    setReferencePaneVisible((current) => {
      const next = !current;
      if (!next) {
        setStatus(referenceRetainedStatus);
      }
      return next;
    });
    setSidePaneOpen(false);
  }, [
    openReferenceFile,
    referenceCompare,
    setReferencePaneVisible,
    setSidePaneOpen,
    setStatus,
    referenceRetainedStatus,
  ]);

  useImportPageFollow({
    activeContents: activeTab?.contents ?? "",
    activeTab,
    cursorLine: selectionLine,
    referenceCompare,
    setPdfPageIndex,
    setReferenceFollowMode,
  });

  useReferenceExternalChange({
    referenceCompare,
    onExternalChange: () => {
      markReferenceExternalChange(true);
      setStatus("Reference file changed on disk");
    },
  });

  /**
   * Text reference → existing Diff workbench (left = reference snapshot,
   * right = editor buffer). Hides the Reference column so Diff can show;
   * the loaded session stays retained.
   */
  const showReferenceTextDiff = useCallback(() => {
    const reference = referenceCompare?.reference;
    if (!reference || !activeTab) {
      return;
    }
    setGlobalError(null);
    try {
      const snapshot = revealReferenceTextDiff({
        activeTab,
        menuLanguage,
        reference,
      });
      if (!snapshot) {
        return;
      }
      setCompareCaseEntry(snapshot.compareCase);
      setCompareView(snapshot.compareView);
      setRightPaneMode("compare");
      setSidePaneOpenFromUserAction(true);
      setStatus("Compare ready");
    } catch (err) {
      const message = String(err);
      setGlobalError(
        menuLanguage !== "en"
          ? localizeCompareError(message, menuLanguage)
          : message,
      );
      setStatus("Compare failed");
    }
  }, [
    activeTab,
    menuLanguage,
    referenceCompare,
    setCompareCaseEntry,
    setCompareView,
    setGlobalError,
    setRightPaneMode,
    setSidePaneOpenFromUserAction,
    setStatus,
  ]);

  const handlePdfPageIndexChange = useCallback(
    (page: number, source: "user" | "system") => {
      setPdfPageIndex(page);
      if (source === "user") {
        pauseReferenceFollow();
      }
    },
    [pauseReferenceFollow, setPdfPageIndex],
  );

  // R4 reliability: release the PDF helper handle if the shell unmounts
  // without an explicit close (app quit / route teardown).
  const referenceCompareRef = useRef(referenceCompare);
  referenceCompareRef.current = referenceCompare;
  useEffect(() => {
    return () => {
      const current = referenceCompareRef.current;
      if (current?.reference.kind === "pdf") {
        void closePdfReference(current.reference.referenceId).catch(() => {
          // Best-effort cleanup on unmount.
        });
      }
    };
  }, []);

  return {
    closeReferenceCompare,
    handlePdfPageIndexChange,
    openReferenceFile,
    openTextPathAsReference,
    pairImportAssistReference,
    referenceCopy,
    reloadReferenceFromDisk,
    resumeReferenceFollow,
    showReferenceTextDiff,
    toggleReferencePane,
  };
}
