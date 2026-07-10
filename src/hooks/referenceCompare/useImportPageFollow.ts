import { useEffect } from "react";
import {
  hasImportPageMarkers,
  pageIndexAtLine,
} from "../../features/referenceCompare/importPageMarkers";
import type { ReferenceCompareState } from "../../features/referenceCompare/types";
import type { EditorTab } from "../../types";

type UseImportPageFollowOptions = {
  activeContents: string;
  activeTab: EditorTab | null;
  cursorLine: number;
  referenceCompare: ReferenceCompareState | null;
  setPdfPageIndex: (page: number) => void;
  setReferenceFollowMode: (
    mode: ReferenceCompareState["followMode"],
  ) => void;
};

/**
 * R3: When follow is active and the active editor is the linked import draft,
 * move the PDF reference page to the section under the cursor.
 */
export function useImportPageFollow({
  activeContents,
  activeTab,
  cursorLine,
  referenceCompare,
  setPdfPageIndex,
  setReferenceFollowMode,
}: UseImportPageFollowOptions) {
  useEffect(() => {
    if (!referenceCompare) return;
    if (referenceCompare.origin !== "import-assist") return;
    if (referenceCompare.followMode !== "following") return;
    if (referenceCompare.reference.kind !== "pdf") return;
    if (!referenceCompare.linkedEditorSessionId) return;
    if (activeTab?.sessionId !== referenceCompare.linkedEditorSessionId) {
      return;
    }

    if (!hasImportPageMarkers(activeContents)) {
      // Markers deleted: keep the reference open but stop claiming follow.
      setReferenceFollowMode("off");
      return;
    }

    const page = pageIndexAtLine(activeContents, cursorLine);
    if (page == null) return;

    const maxPage = Math.max(0, referenceCompare.reference.pageCount - 1);
    setPdfPageIndex(Math.min(Math.max(0, page), maxPage));
  }, [
    activeContents,
    activeTab?.sessionId,
    cursorLine,
    referenceCompare,
    setPdfPageIndex,
    setReferenceFollowMode,
  ]);
}
