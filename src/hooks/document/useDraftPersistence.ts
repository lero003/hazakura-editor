import { useEffect } from "react";
import {
  draftRecordFromTab,
  upsertDraftRecord,
  writeStoredDrafts,
} from "../../lib/storage";
import type { DraftRecord, EditorTab } from "../../types";
import { isDirty } from "../../features/editor/editorTabs";

type RefValue<T> = {
  current: T;
};

type UseDraftPersistenceOptions = {
  discardingWindowCloseRef: RefValue<boolean>;
  pendingDrafts: DraftRecord[];
  restoreComplete: boolean;
  tabs: EditorTab[];
};

export function useDraftPersistence({
  discardingWindowCloseRef,
  pendingDrafts,
  restoreComplete,
  tabs,
}: UseDraftPersistenceOptions) {
  useEffect(() => {
    if (!restoreComplete) {
      return;
    }

    if (discardingWindowCloseRef.current) {
      return;
    }

    const dirtyDrafts = tabs
      .filter((tab) => tab.path.length > 0 && isDirty(tab))
      .map(draftRecordFromTab);

    writeStoredDrafts(
      [...pendingDrafts, ...dirtyDrafts].reduce<DraftRecord[]>(
        (records, draft) => upsertDraftRecord(records, draft),
        [],
      ),
    );
  }, [discardingWindowCloseRef, pendingDrafts, restoreComplete, tabs]);
}
