import {
  type Dispatch,
  type SetStateAction,
  useCallback,
} from "react";
import { openTextFile } from "../../lib/tauri";
import {
  createEditorTab,
  createUntitledEditorTab,
  updateTabsById,
  updateTabsByPath,
} from "../../features/editor/editorTabs";
import {
  draftMatchesTab,
  draftStorageKey,
  isPathlessDraft,
} from "../../features/document/pathlessDraftRecovery";
import {
  removeStoredDraft,
  removeStoredDraftRecord,
} from "../../lib/storage";
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
      if (isPathlessDraft(draft)) {
        const existing = tabsRef.current.find((tab) =>
          draftMatchesTab(draft, tab),
        );
        if (existing) {
          setTabs((currentTabs) =>
            updateTabsById(currentTabs, existing.id, (tab) => ({
              ...tab,
              contents: draft.contents,
              line_ending: draft.line_ending,
              name: draft.name ?? tab.name,
              saveStatus: "idle",
              error: null,
            })),
          );
          setActiveTabId(existing.id);
        } else {
          const created = createUntitledEditorTab();
          const restored: EditorTab = {
            ...created,
            name: draft.name ?? created.name,
            contents: draft.contents,
            line_ending: draft.line_ending,
          };
          setTabs((currentTabs) => [...currentTabs, restored]);
          setActiveTabId(restored.id);
        }
        setPendingDrafts((currentDrafts) =>
          currentDrafts.filter(
            (candidate) => draftStorageKey(candidate) !== draftStorageKey(draft),
          ),
        );
        removeStoredDraftRecord(draft);
        setStatus("Draft restored");
        focusEditorSoon();
        return;
      }

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
        currentDrafts.filter(
          (candidate) => draftStorageKey(candidate) !== draftStorageKey(draft),
        ),
      );
      removeStoredDraftRecord(draft);
      setStatus("Draft restored");
      focusEditorSoon();
    },
    [
      focusEditorSoon,
      setActiveTabId,
      setPendingDrafts,
      setStatus,
      setTabs,
      tabsRef,
    ],
  );

  const discardDraft = useCallback(
    (draftPathOrKey: string) => {
      setPendingDrafts((currentDrafts) =>
        currentDrafts.filter((candidate) => {
          if (draftStorageKey(candidate) === draftPathOrKey) {
            return false;
          }
          if (candidate.path.length > 0 && candidate.path === draftPathOrKey) {
            return false;
          }
          return true;
        }),
      );
      removeStoredDraft(draftPathOrKey);
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
