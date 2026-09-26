import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useLayoutEffect,
  useRef,
} from "react";
import { flushSync } from "react-dom";
import { getFileMetadata, openTextFile } from "../../lib/tauri";
import { hasSameDocumentIoBaseline } from "../../features/editor/documentIoBaseline";
import { createEditorTab, isDirty } from "../../features/editor/editorTabs";
import {
  EXTERNAL_CHANGE_CONFLICT_MESSAGE,
  type EditorTab,
} from "../../types";

type LatestValueRef<T> = {
  current: T;
};

type UseExternalChangeActionsOptions = {
  setStatus: Dispatch<SetStateAction<string>>;
  setTabs: Dispatch<SetStateAction<EditorTab[]>>;
  tabsRef: LatestValueRef<EditorTab[]>;
};

export function useExternalChangeActions({
  setStatus,
  setTabs,
  tabsRef,
}: UseExternalChangeActionsOptions) {
  const requests = useRef(new Map<string, symbol>());
  useLayoutEffect(() => () => { requests.current.clear(); }, []);

  const checkTabForExternalChange = useCallback(
    async (tabId: string) => {
      const tab = tabsRef.current.find((candidate) => candidate.id === tabId);
      // Pathless drafts have no disk metadata. Saving owns the disk baseline
      // until its response has been committed.
      if (!tab?.path || tab.saveStatus === "saving") return;

      const request = Symbol();
      requests.current.set(tab.sessionId, request);
      const isCurrent = (candidate: EditorTab) =>
        requests.current.get(tab.sessionId) === request &&
        hasSameDocumentIoBaseline(candidate, tab);
      const currentTab = () => tabsRef.current.find(isCurrent);
      const commit = (update: (candidate: EditorTab) => EditorTab): boolean => {
        let applied = false;
        // Recheck inside the state updater as well: queued typing/save/close
        // updates may not yet be visible through tabsRef.
        flushSync(() => setTabs((currentTabs) => currentTabs.map((candidate) => {
          if (!isCurrent(candidate)) return candidate;
          applied = true;
          return update(candidate);
        })));
        return applied;
      };
      const markConflict = (fingerprint: string) => {
        if (commit((candidate) => ({
          ...candidate,
          externalFingerprint: fingerprint,
          saveStatus: "conflict",
          error: EXTERNAL_CHANGE_CONFLICT_MESSAGE,
        }))) setStatus("External change detected");
      };

      try {
        const metadata = await getFileMetadata(tab.path);
        const latest = currentTab();
        if (!latest) return;

        if (metadata.fingerprint === latest.fingerprint) {
          commit((candidate) => ({
            ...candidate,
            ignoredExternalFingerprint: null,
            externalFingerprint: null,
          }));
          return;
        }
        if (metadata.fingerprint === latest.ignoredExternalFingerprint ||
          (latest.saveStatus === "conflict" && metadata.fingerprint === latest.externalFingerprint)) return;

        if (isDirty(latest)) {
          markConflict(metadata.fingerprint);
          return;
        }

        const file = await openTextFile(tab.path);
        if (!currentTab()) return;
        const refreshedTab = createEditorTab(file);
        let dirty = false;
        const applied = commit((candidate) => {
          dirty = isDirty(candidate);
          return dirty ? {
            ...candidate,
            externalFingerprint: refreshedTab.fingerprint,
            saveStatus: "conflict",
            error: EXTERNAL_CHANGE_CONFLICT_MESSAGE,
          } : refreshedTab;
        });
        if (applied) setStatus(dirty ? "External change detected" : "External change refreshed");
      } catch (err) {
        if (!currentTab()) return;
        if (commit((candidate) => ({
          ...candidate,
          saveStatus: "error",
          error: `Metadata check failed: ${String(err)}`,
        }))) setStatus("Metadata check failed");
      } finally {
        if (requests.current.get(tab.sessionId) === request) requests.current.delete(tab.sessionId);
      }
    },
    [setStatus, setTabs, tabsRef],
  );

  return { checkTabForExternalChange };
}
