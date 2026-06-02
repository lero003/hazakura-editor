import {
  type Dispatch,
  type SetStateAction,
  useCallback,
} from "react";
import { openTextFile } from "../../lib/tauri";
import { createEditorTab } from "../../features/editor/editorTabs";
import { removeStoredDraft } from "../../lib/storage";
import type { DraftRecord, EditorTab } from "../../types";

type UseRecoveryActionsOptions = {
  focusEditorSoon: () => void;
  setActiveTabId: Dispatch<SetStateAction<string | null>>;
  setPendingDrafts: Dispatch<SetStateAction<DraftRecord[]>>;
  setStatus: Dispatch<SetStateAction<string>>;
  setTabs: Dispatch<SetStateAction<EditorTab[]>>;
  tabs: EditorTab[];
};

export function useRecoveryActions({
  focusEditorSoon,
  setActiveTabId,
  setPendingDrafts,
  setStatus,
  setTabs,
  tabs,
}: UseRecoveryActionsOptions) {
  const reopenTabFromDisk = useCallback(
    async (tabId: string) => {
      const tab = tabs.find((candidate) => candidate.id === tabId);

      if (!tab) {
        return;
      }

      setStatus("Reopening from disk...");

      try {
        const file = await openTextFile(tab.path);
        const reopenedTab = createEditorTab(file);

        setTabs((currentTabs) =>
          currentTabs.map((candidate) =>
            candidate.id === tabId ? reopenedTab : candidate,
          ),
        );
        setActiveTabId(reopenedTab.id);
        setStatus("Reopened from disk");
      } catch (err) {
        setTabs((currentTabs) =>
          currentTabs.map((candidate) =>
            candidate.id === tabId
              ? {
                  ...candidate,
                  error: `Reopen failed: ${String(err)}`,
                  saveStatus: "conflict",
                }
              : candidate,
          ),
        );
        setStatus("Reopen failed");
      }
    },
    [setActiveTabId, setStatus, setTabs, tabs],
  );

  const keepEditingAfterConflict = useCallback(
    (tabId: string) => {
      setTabs((currentTabs) =>
        currentTabs.map((tab) =>
          tab.id === tabId
            ? {
                ...tab,
                ignoredExternalFingerprint:
                  tab.externalFingerprint ?? tab.ignoredExternalFingerprint,
                saveStatus: "idle",
                error: null,
              }
            : tab,
        ),
      );
      setStatus("Keeping local edits");
    },
    [setStatus, setTabs],
  );

  const clearSaveError = useCallback(
    (tabId: string) => {
      setTabs((currentTabs) =>
        currentTabs.map((tab) =>
          tab.id === tabId ? { ...tab, saveStatus: "idle", error: null } : tab,
        ),
      );
      setStatus("Keeping local edits");
    },
    [setStatus, setTabs],
  );

  const restoreDraft = useCallback(
    (draft: DraftRecord) => {
      setTabs((currentTabs) =>
        currentTabs.map((tab) =>
          tab.path === draft.path
            ? {
                ...tab,
                contents: draft.contents,
                line_ending: draft.line_ending,
                saveStatus: "idle",
                error: null,
              }
            : tab,
        ),
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
