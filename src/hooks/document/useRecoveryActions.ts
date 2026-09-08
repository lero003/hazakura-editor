import {
  type Dispatch,
  type SetStateAction,
  useCallback,
} from "react";
import { openTextFile } from "../../lib/tauri";
import {
  createEditorTab,
  isDirty,
  createUntitledEditorTab,
  updateTabsById,
  updateTabsByPath,
} from "../../features/editor/editorTabs";
import {
  draftStorageKey,
  isPathlessDraft,
  isPathlessDraftOversized,
} from "../../features/document/pathlessDraftRecovery";
import {
  draftRecordFromTab,
  readStoredDrafts,
  upsertDraftRecord,
  writeStoredDrafts,
  removeStoredDraft,
  removeStoredDraftRecord,
} from "../../lib/storage";
import type { DraftRecord, EditorTab, TextEncoding } from "../../types";

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
    async (tabId: string, encoding?: TextEncoding) => {
      const tab = tabsRef.current.find((candidate) => candidate.id === tabId);

      if (!tab) {
        return;
      }

      if (encoding && (!tab.path || isDirty(tab))) {
        setStatus("文字コードを指定して開き直す前に、未保存の編集を別名で保存してください");
        return;
      }
      setStatus("Reopening from disk...");

      try {
        const file = encoding ? await openTextFile(tab.path, encoding) : await openTextFile(tab.path);
        const latestTab = tabsRef.current.find(
          (candidate) => candidate.id === tabId,
        );
        if (!latestTab || latestTab.sessionId !== tab.sessionId || latestTab.path !== tab.path || latestTab.contents !== tab.contents || latestTab.encoding !== tab.encoding || latestTab.line_ending !== tab.line_ending) {
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
        if (!latestTab || latestTab.sessionId !== tab.sessionId || latestTab.path !== tab.path || latestTab.contents !== tab.contents || latestTab.encoding !== tab.encoding || latestTab.line_ending !== tab.line_ending) {
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
      const target = tabsRef.current.find(tab => tab.path === draft.path);
      if (draft.detached || isPathlessDraft(draft) || !target || target.fingerprint !== draft.savedFingerprint || isDirty(target)) {
        // Always open a fresh pathless tab. Never apply into an existing
        // path-backed or pathless buffer — recoveryId must not collide
        // with process-local session counters after relaunch.
        const created = createUntitledEditorTab();
        const restored: EditorTab = {
          ...created,
          // New UUID on the open tab; stored candidate is discarded below.
          name: draft.name ?? draft.path.split(/[\\/]/).pop() ?? created.name,
          contents: draft.contents,
          line_ending: draft.line_ending,
        };
        setTabs((currentTabs) => [...currentTabs, restored]);
        setActiveTabId(restored.id);
        const restoredDraft = draftRecordFromTab(restored);
        const persisted = !isDirty(restored) || isPathlessDraftOversized(restoredDraft)
          ? { ok: false }
          : writeStoredDrafts(upsertDraftRecord(readStoredDrafts(), restoredDraft));
        if (!persisted.ok) {
          setStatus("下書きを取り出しました。復旧記録は元のまま残しています。別名で保存してください。");
          focusEditorSoon();
          return;
        }
        setPendingDrafts((currentDrafts) =>
          currentDrafts.filter(
            (candidate) => draftStorageKey(candidate) !== draftStorageKey(draft),
          ),
        );
        const cleanup = removeStoredDraftRecord(draft);
        setStatus(
          cleanup.ok
            ? "Draft restored"
            : "Draft restored; recovery cleanup unavailable",
        );
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
      const cleanup = removeStoredDraftRecord(draft);
      setStatus(
        cleanup.ok
          ? "Draft restored"
          : "Draft restored; recovery cleanup unavailable",
      );
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
          if (!candidate.detached && candidate.path.length > 0 && candidate.path === draftPathOrKey) {
            return false;
          }
          return true;
        }),
      );
      const cleanup = removeStoredDraft(draftPathOrKey);
      setStatus(
        cleanup.ok
          ? "Draft discarded"
          : "Draft discarded; recovery cleanup unavailable",
      );
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
