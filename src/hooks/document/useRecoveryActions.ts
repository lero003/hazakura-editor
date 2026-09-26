import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useLayoutEffect,
  useRef,
} from "react";
import { flushSync } from "react-dom";
import { hasSameDocumentIoBaseline } from "../../features/editor/documentIoBaseline";
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
  tabsEligibleForDraftPersistence,
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
  const reopenRequests = useRef(new Map<string, symbol>());
  useLayoutEffect(() => () => { reopenRequests.current.clear(); }, []);

  const reopenTabFromDisk = useCallback(
    async (tabId: string, encoding?: TextEncoding) => {
      const tab = tabsRef.current.find((candidate) => candidate.id === tabId);
      if (!tab?.path || tab.saveStatus === "saving") return;

      if (encoding && isDirty(tab)) {
        setStatus("文字コードを指定して開き直す前に、未保存の編集を別名で保存してください");
        return;
      }
      const request = Symbol();
      reopenRequests.current.set(tab.sessionId, request);
      const isLatestRequest = () => reopenRequests.current.get(tab.sessionId) === request;
      const isCurrent = (candidate: EditorTab) =>
        isLatestRequest() && hasSameDocumentIoBaseline(candidate, tab) &&
        candidate.contents === tab.contents && candidate.encoding === tab.encoding &&
        candidate.line_ending === tab.line_ending;
      const commit = (update: (candidate: EditorTab) => EditorTab): boolean => {
        let applied = false;
        flushSync(() => setTabs((currentTabs) => currentTabs.map((candidate) => {
          if (!isCurrent(candidate)) return candidate;
          applied = true;
          return update(candidate);
        })));
        return applied;
      };
      setStatus("Reopening from disk...");

      try {
        const file = encoding ? await openTextFile(tab.path, encoding) : await openTextFile(tab.path);
        if (!isLatestRequest()) return;
        const reopenedTab = createEditorTab(file);
        if (!commit(() => reopenedTab)) {
          setStatus("Reopen skipped; document changed");
          return;
        }
        setActiveTabId(reopenedTab.id);
        setStatus("Reopened from disk");
      } catch (err) {
        if (!isLatestRequest()) return;
        if (!commit((candidate) => ({
          ...candidate,
          error: `Reopen failed: ${String(err)}`,
          saveStatus: "conflict",
        }))) {
          setStatus("Reopen skipped; document changed");
          return;
        }
        setStatus("Reopen failed");
      } finally {
        if (isLatestRequest()) reopenRequests.current.delete(tab.sessionId);
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
        const persisted = tabsEligibleForDraftPersistence([restored]).length === 0 || isPathlessDraftOversized(restoredDraft)
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
