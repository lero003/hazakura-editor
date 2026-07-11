import { useEffect, useRef } from "react";
import {
  draftRecordFromTab,
  upsertDraftRecord,
  writeStoredDrafts,
} from "../../lib/storage";
import {
  isPathlessDraftOversized,
  tabsEligibleForDraftPersistence,
} from "../../features/document/pathlessDraftRecovery";
import type { DraftRecord, EditorTab } from "../../types";

type RefValue<T> = {
  current: T;
};

type UseDraftPersistenceOptions = {
  discardingWindowCloseRef: RefValue<boolean>;
  pendingDrafts: DraftRecord[];
  restoreComplete: boolean;
  tabs: EditorTab[];
  /** Surface recovery-store failures without blocking typing. */
  onRecoveryStoreFailure?: (message: string) => void;
};

const DRAFT_PERSIST_DEBOUNCE_MS = 400;

export function useDraftPersistence({
  discardingWindowCloseRef,
  pendingDrafts,
  restoreComplete,
  tabs,
  onRecoveryStoreFailure,
}: UseDraftPersistenceOptions) {
  const timerRef = useRef<number | null>(null);
  const lastFailureRef = useRef<string | null>(null);
  const onFailureRef = useRef(onRecoveryStoreFailure);
  onFailureRef.current = onRecoveryStoreFailure;

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

      const oversized = dirtyDrafts.find(isPathlessDraftOversized);
      if (oversized) {
        const message =
          "Pathless draft recovery skipped: content exceeds the recovery size limit. Editing continues; Save As to keep the file.";
        if (lastFailureRef.current !== message) {
          lastFailureRef.current = message;
          onFailureRef.current?.(message);
        }
        // Still persist other (path / smaller) drafts without the oversized one.
      }

      const writableDirty = dirtyDrafts.filter(
        (draft) => !isPathlessDraftOversized(draft),
      );

      const result = writeStoredDrafts(
        [...pendingDrafts, ...writableDirty].reduce<DraftRecord[]>(
          (records, draft) => upsertDraftRecord(records, draft),
          [],
        ),
      );

      if (!result.ok) {
        if (lastFailureRef.current !== result.message) {
          lastFailureRef.current = result.message;
          onFailureRef.current?.(result.message);
        }
        return;
      }

      lastFailureRef.current = null;
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
