// `useEditorTabsPathRekey` returns a small set of helpers that
// rewrite all editor-related state when a file's path changes
// (rename, move, or the bulk rekey in a future cross-directory
// move). Editor state has `id === path` and `name === fileName(path)`
// invariants everywhere — tabs, drafts, recents, compare anchors —
// so a path change has to fan out to every store that references
// the old path; doing it once here keeps the rename and move code
// paths from drifting.
//
// Descendant rekey (renaming a folder while one of its descendants
// is open as a tab) is intentionally out of scope for the v0.9
// slice: rename of a file is single-entry, and move of a folder
// is not exposed yet. When folder move is added, this helper
// grows a `prefixRemap` mode that walks every store.
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
} from "react";
import { fileNameFromPath } from "../../lib/utils";
import type {
  CompareAnchor,
  CompareViewState,
  DraftRecord,
  EditorTab,
  RecentEntry,
} from "../../types";

type UseEditorTabsPathRekeyOptions = {
  setActiveTabId: Dispatch<SetStateAction<string | null>>;
  setCompareAnchor: Dispatch<SetStateAction<CompareAnchor | null>>;
  setCompareTarget: Dispatch<SetStateAction<CompareAnchor | null>>;
  setCompareView: Dispatch<SetStateAction<CompareViewState | null>>;
  setPendingDrafts: Dispatch<SetStateAction<DraftRecord[]>>;
  setRecentFiles: Dispatch<SetStateAction<RecentEntry[]>>;
  setTabs: Dispatch<SetStateAction<EditorTab[]>>;
};

export function useEditorTabsPathRekey({
  setActiveTabId,
  setCompareAnchor,
  setCompareTarget,
  setCompareView,
  setPendingDrafts,
  setRecentFiles,
  setTabs,
}: UseEditorTabsPathRekeyOptions) {
  const rekeyPath = useCallback(
    (oldPath: string, newPath: string) => {
      const newName = fileNameFromPath(newPath);

      setTabs((currentTabs) =>
        currentTabs.map((tab) =>
          tab.id === oldPath
            ? {
                ...tab,
                id: newPath,
                path: newPath,
                name: newName,
              }
            : tab,
        ),
      );

      setActiveTabId((current) =>
        current === oldPath ? newPath : current,
      );

      setPendingDrafts((currentDrafts) =>
        currentDrafts.map((draft) =>
          draft.path === oldPath ? { ...draft, path: newPath } : draft,
        ),
      );

      setRecentFiles((currentEntries) =>
        currentEntries.map((entry) =>
          entry.path === oldPath
            ? { ...entry, path: newPath, label: newName }
            : entry,
        ),
      );

      setCompareAnchor((current) =>
        current && current.path === oldPath
          ? { ...current, path: newPath, name: newName }
          : current,
      );
      setCompareTarget((current) =>
        current && current.path === oldPath
          ? { ...current, path: newPath, name: newName }
          : current,
      );
      // The compare view is keyed by `caseKey` which embeds both
      // paths; rewriting the view state would require rebuilding
      // the caseKey, which is more invasive than the v0.9 slice
      // warrants. The user can re-run the compare. Clear the
      // current view if it references the old path; the
      // diffSurface toggle stays in the side pane state.
      setCompareView((current) => {
        if (!current) return current;
        if (!caseKeyMentionsPath(current.caseKey, oldPath)) return current;
        return null;
      });
    },
    [
      setActiveTabId,
      setCompareAnchor,
      setCompareTarget,
      setCompareView,
      setPendingDrafts,
      setRecentFiles,
      setTabs,
    ],
  );

  return { rekeyPath };
}

// Best-effort: matches a path as a substring inside a caseKey.
// False positives are acceptable (worst case: the view is closed
// for an unrelated compare case) because the view is rebuilt on
// the next compare action.
function caseKeyMentionsPath(caseKey: string, path: string): boolean {
  return caseKey.includes(path);
}
