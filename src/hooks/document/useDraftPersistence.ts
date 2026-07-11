import { useEffect, useRef } from "react";
import {
  draftRecordFromTab,
  upsertDraftRecord,
  writeStoredDrafts,
} from "../../lib/storage";
import { tabsEligibleForDraftPersistence } from "../../features/document/pathlessDraftRecovery";
import type { DraftRecord, EditorTab } from "../../types";

type RefValue<T> = {
  current: T;
};

type UseDraftPersistenceOptions = {
  discardingWindowCloseRef: RefValue<boolean>;
  pendingDrafts: DraftRecord[];
  restoreComplete: boolean;
  tabs: EditorTab[];
};

const DRAFT_PERSIST_DEBOUNCE_MS = 400;

export function useDraftPersistence({
  discardingWindowCloseRef,
  pendingDrafts,
  restoreComplete,
  tabs,
}: UseDraftPersistenceOptions) {
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!restoreComplete) {
      return;
    }

    if (discardingWindowCloseRef.current) {
      return;
    }

    const persist = () => {
      if (discardingWindowCloseRef.current) {
        return;
      }

      const dirtyDrafts = tabsEligibleForDraftPersistence(tabs).map(
        draftRecordFromTab,
      );

      // Pending candidates first, then live dirty tabs so later upserts win.
      writeStoredDrafts(
        [...pendingDrafts, ...dirtyDrafts].reduce<DraftRecord[]>(
          (records, draft) => upsertDraftRecord(records, draft),
          [],
        ),
      );
    };

    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(persist, DRAFT_PERSIST_DEBOUNCE_MS);

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [discardingWindowCloseRef, pendingDrafts, restoreComplete, tabs]);
}
