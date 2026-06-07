// `useEditorTabsPathRekey` returns a small set of helpers that
// rewrite all editor-related state when a file's path changes
// (rename, move, or the bulk rekey in a future cross-directory
// move). Editor state has `id === path` and `name === fileName(path)`
// invariants everywhere — tabs, drafts, recents, compare anchors —
// so a path change has to fan out to every store that references
// the old path; doing it once here keeps the rename and move code
// paths from drifting.
//
// `rekeyPath` handles single-entry path swaps (file rename, file
// move). `rekeyPathPrefix` walks every store and remaps any path
// that lives under `oldPrefix` to its counterpart under
// `newPrefix`, so renaming or moving a folder keeps the
// descendants' tabs / drafts / recents / compare anchors
// consistent instead of pointing them at the old folder.
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
} from "react";
import { fileNameFromPath } from "../../lib/utils";
import type {
  CompareAnchor,
  CompareCase,
  CompareViewState,
  DraftRecord,
  EditorTab,
  RecentEntry,
} from "../../types";

type UseEditorTabsPathRekeyOptions = {
  getCompareCaseByKey: (caseKey: string) => CompareCase | undefined;
  setActiveTabId: Dispatch<SetStateAction<string | null>>;
  setCompareAnchor: Dispatch<SetStateAction<CompareAnchor | null>>;
  setCompareTarget: Dispatch<SetStateAction<CompareAnchor | null>>;
  setCompareView: Dispatch<SetStateAction<CompareViewState | null>>;
  setPendingDrafts: Dispatch<SetStateAction<DraftRecord[]>>;
  setRecentFiles: Dispatch<SetStateAction<RecentEntry[]>>;
  setTabs: Dispatch<SetStateAction<EditorTab[]>>;
};

export function useEditorTabsPathRekey({
  getCompareCaseByKey,
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
      // The visible compare view was computed from the old path,
      // and modern case keys may be UUIDs. Resolve the registered
      // CompareCase first, then fall back to older string-shaped
      // keys so stale diffs disappear after rename / move.
      setCompareView((current) => {
        if (!current) return current;
        const compareCase = getCompareCaseByKey(current.caseKey);
        const mentionsPath = compareCase
          ? compareCaseMentionsPath(compareCase, oldPath)
          : caseKeyMentionsPath(current.caseKey, oldPath);
        if (!mentionsPath) return current;
        return null;
      });
    },
    [
      getCompareCaseByKey,
      setActiveTabId,
      setCompareAnchor,
      setCompareTarget,
      setCompareView,
      setPendingDrafts,
      setRecentFiles,
      setTabs,
    ],
  );

  const rekeyPathPrefix = useCallback(
    (oldPrefix: string, newPrefix: string) => {
      // Match `<oldPrefix>/<rest>`. Anchoring on the trailing
      // slash avoids accidentally rewriting sibling paths that
      // happen to share a prefix string but not a folder
      // boundary (e.g. `notes-old` when the prefix is `notes`).
      const oldPrefixWithSlash = `${oldPrefix}/`;
      const remap = (path: string) =>
        path.startsWith(oldPrefixWithSlash)
          ? newPrefix + path.slice(oldPrefix.length)
          : path;
      const remappedName = (path: string) => fileNameFromPath(path);

      setTabs((currentTabs) =>
        currentTabs.map((tab) => {
          if (!tab.id.startsWith(oldPrefixWithSlash)) {
            return tab;
          }
          const newPath = remap(tab.path);
          return {
            ...tab,
            id: newPath,
            path: newPath,
            name: remappedName(newPath),
          };
        }),
      );

      setActiveTabId((current) =>
        current && current.startsWith(oldPrefixWithSlash)
          ? remap(current)
          : current,
      );

      setPendingDrafts((currentDrafts) =>
        currentDrafts.map((draft) => {
          if (!draft.path.startsWith(oldPrefixWithSlash)) {
            return draft;
          }
          return { ...draft, path: remap(draft.path) };
        }),
      );

      setRecentFiles((currentEntries) =>
        currentEntries.map((entry) => {
          if (!entry.path.startsWith(oldPrefixWithSlash)) {
            return entry;
          }
          const newPath = remap(entry.path);
          return { ...entry, path: newPath, label: remappedName(newPath) };
        }),
      );

      setCompareAnchor((current) => {
        if (!current || !current.path.startsWith(oldPrefixWithSlash)) {
          return current;
        }
        const newPath = remap(current.path);
        return { ...current, path: newPath, name: remappedName(newPath) };
      });
      setCompareTarget((current) => {
        if (!current || !current.path.startsWith(oldPrefixWithSlash)) {
          return current;
        }
        const newPath = remap(current.path);
        return { ...current, path: newPath, name: remappedName(newPath) };
      });
      setCompareView((current) => {
        if (!current) return current;
        const compareCase = getCompareCaseByKey(current.caseKey);
        const mentionsPath = compareCase
          ? compareCaseMentionsPathPrefix(compareCase, oldPrefix)
          : caseKeyMentionsPath(current.caseKey, oldPrefix);
        if (!mentionsPath) return current;
        return null;
      });
    },
    [
      getCompareCaseByKey,
      setActiveTabId,
      setCompareAnchor,
      setCompareTarget,
      setCompareView,
      setPendingDrafts,
      setRecentFiles,
      setTabs,
    ],
  );

  return { rekeyPath, rekeyPathPrefix };
}

// Best-effort: matches a path as a substring inside a caseKey.
// False positives are acceptable (worst case: the view is closed
// for an unrelated compare case) because the view is rebuilt on
// the next compare action.
function caseKeyMentionsPath(caseKey: string, path: string): boolean {
  return caseKey.includes(path);
}

function compareCaseMentionsPath(
  compareCase: CompareCase,
  path: string,
): boolean {
  switch (compareCase.kind) {
    case "file":
      return (
        compareCase.leftPath === path ||
        compareCase.rightPath === path ||
        compareCase.anchor.path === path ||
        compareCase.target.path === path
      );
    case "changes":
    case "candidate":
      return compareCase.documentPath === path;
  }
}

function compareCaseMentionsPathPrefix(
  compareCase: CompareCase,
  prefix: string,
): boolean {
  const matchesPrefix = (path: string) => path.startsWith(`${prefix}/`);
  switch (compareCase.kind) {
    case "file":
      return (
        matchesPrefix(compareCase.leftPath) ||
        matchesPrefix(compareCase.rightPath) ||
        matchesPrefix(compareCase.anchor.path) ||
        matchesPrefix(compareCase.target.path)
      );
    case "changes":
    case "candidate":
      return matchesPrefix(compareCase.documentPath);
  }
}
