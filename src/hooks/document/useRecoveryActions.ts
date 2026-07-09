import {
  type Dispatch,
  type SetStateAction,
  useCallback,
} from "react";
import { openTextFile } from "../../lib/tauri";
import {
  createEditorTab,
  updateTabsById,
  updateTabsByPath,
} from "../../features/editor/editorTabs";
import { removeStoredDraft } from "../../lib/storage";
import type { DraftRecord, EditorTab } from "../../types";

type UseRecoveryActionsOptions = {
  focusEditorSoon: () => void;
  setActiveTabId: Dispatch<SetStateAction<string | null>>;
  setPendingDrafts: Dispatch<SetStateAction<DraftRecord[]>>;
  setStatus: Dispatch<SetStateAction<string>>;
  setTabs: Dispatch<SetStateAction<EditorTab[]>>;
  tabs: EditorTab[];
  tabsRef: { current: EditorTab[] };
};

export function useRecoveryActions({
  focusEditorSoon,
  setActiveTabId,
  setPendingDrafts,
  setStatus,
  setTabs,
  tabsRef,
}: UseRecoveryActionsOptions) {
  const reopenTabFromDisk = useCallback(
    async (tabId: string) => {
      const tab = tabsRef.current.find((candidate) => candidate.id === tabId);

      if (!tab) {
        return;
      }

      setStatus("Reopening from disk...");

      try {
        const file = await openTextFile(tab.path);
        const latestTab = tabsRef.current.find(
          (candidate) => candidate.id === tabId,
        );
        if (!latestTab || latestTab.path !== tab.path) {
          setStatus("Reopen skipped; document changed");
          return;
        }
        const reopenedTab = createEditorTab(file);

        setTabs((currentTabs) =>
          updateTabsById(currentTabs, tabId, () => reopenedTab),
        );
        setActiveTabId(reopenedTab.id);
        setStatus("Reopened from disk");
      } catch (err) {
        const latestTab = tabsRef.current.find(
          (candidate) => candidate.id === tabId,
        );
        if (!latestTab || latestTab.path !== tab.path) {
          setStatus("Reopen skipped; document changed");
          return;
        }
        setTabs((currentTabs) =>
          updateTabsById(currentTabs, tabId, (candidate) => ({
            ...candidate,
            error: `Reopen failed: ${String(err)}`,
            saveStatus: "conflict",
          })),
        );
        setStatus("Reopen failed");
      }
    },
    [setActiveTabId, setStatus, setTabs, tabsRef],
  );

  const keepEditingAfterConflict = useCallback(
    (tabId: string) => {
      setTabs((currentTabs) =>
        updateTabsById(currentTabs, tabId, (tab) => ({
          ...tab,
          ignoredExternalFingerprint:
            tab.externalFingerprint ?? tab.ignoredExternalFingerprint,
          saveStatus: "idle",
          error: null,
        })),
      );
      setStatus("Keeping local edits");
    },
    [setStatus, setTabs],
  );

  const clearSaveError = useCallback(
    (tabId: string) => {
      setTabs((currentTabs) =>
        updateTabsById(currentTabs, tabId, (tab) => ({
          ...tab,
          saveStatus: "idle",
          error: null,
        })),
      );
      setStatus("Keeping local edits");
    },
    [setStatus, setTabs],
  );

  const restoreDraft = useCallback(
    (draft: DraftRecord) => {
      setTabs((currentTabs) =>
        updateTabsByPath(currentTabs, draft.path, (tab) => ({
          ...tab,
          contents: draft.contents,
          line_ending: draft.line_ending,
          saveStatus: "idle",
          error: null,
        })),
      );
      setPendingDrafts((currentDrafts) =>
        currentDrafts.filter((candidate) => candidate.path !== draft.path),
      );
      setStatus("Draft restored");
      focusEditorSoon();
    },
    [focusEditorSoon, setPendingDrafts, setStatus, setTabs],
  );

  const discardDraft = useCallback(
    (draftPath: string) => {
      setPendingDrafts((currentDrafts) =>
        currentDrafts.filter((candidate) => candidate.path !== draftPath),
      );
      removeStoredDraft(draftPath);
      setStatus("Draft discarded");
    },
    [setPendingDrafts, setStatus],
  );

  return {
    clearSaveError,
    discardDraft,
    keepEditingAfterConflict,
    reopenTabFromDisk,
    restoreDraft,
  };
}
