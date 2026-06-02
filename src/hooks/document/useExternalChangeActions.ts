import {
  type Dispatch,
  type SetStateAction,
  useCallback,
} from "react";
import { getFileMetadata, openTextFile } from "../../tauri";
import { createEditorTab, isDirty } from "../../editorTabs";
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
  const checkTabForExternalChange = useCallback(
    async (tabId: string) => {
      const tab = tabsRef.current.find((candidate) => candidate.id === tabId);

      if (!tab) {
        return;
      }

      try {
        const metadata = await getFileMetadata(tab.path);

        if (metadata.fingerprint === tab.fingerprint) {
          setTabs((currentTabs) =>
            currentTabs.map((candidate) =>
              candidate.id === tabId
                ? {
                    ...candidate,
                    ignoredExternalFingerprint: null,
                    externalFingerprint: null,
                  }
                : candidate,
            ),
          );
          return;
        }

        if (metadata.fingerprint === tab.ignoredExternalFingerprint) {
          return;
        }

        if (
          tab.saveStatus === "conflict" &&
          metadata.fingerprint === tab.externalFingerprint
        ) {
          return;
        }

        if (!isDirty(tab)) {
          const file = await openTextFile(tab.path);
          const refreshedTab = createEditorTab(file);
          const latestTab = tabsRef.current.find(
            (candidate) => candidate.id === tabId,
          );

          if (!latestTab) {
            return;
          }

          if (isDirty(latestTab)) {
            setTabs((currentTabs) =>
              currentTabs.map((candidate) =>
                candidate.id === tabId
                  ? {
                      ...candidate,
                      externalFingerprint: refreshedTab.fingerprint,
                      saveStatus: "conflict",
                      error: EXTERNAL_CHANGE_CONFLICT_MESSAGE,
                    }
                  : candidate,
              ),
            );
            setStatus("External change detected");
            return;
          }

          setTabs((currentTabs) =>
            currentTabs.map((candidate) =>
              candidate.id === tabId && !isDirty(candidate)
                ? refreshedTab
                : candidate,
            ),
          );
          setStatus("External change refreshed");
          return;
        }

        setTabs((currentTabs) =>
          currentTabs.map((candidate) =>
            candidate.id === tabId
              ? {
                  ...candidate,
                  externalFingerprint: metadata.fingerprint,
                  saveStatus: "conflict",
                  error: EXTERNAL_CHANGE_CONFLICT_MESSAGE,
                }
              : candidate,
          ),
        );
        setStatus("External change detected");
      } catch (err) {
        setTabs((currentTabs) =>
          currentTabs.map((candidate) =>
            candidate.id === tabId
              ? {
                  ...candidate,
                  saveStatus: "error",
                  error: `Metadata check failed: ${String(err)}`,
                }
              : candidate,
          ),
        );
        setStatus("Metadata check failed");
      }
    },
    [setStatus, setTabs, tabsRef],
  );

  return {
    checkTabForExternalChange,
  };
}
