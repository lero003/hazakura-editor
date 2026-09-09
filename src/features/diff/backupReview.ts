import type { ChangeReviewSnapshot, EditorTab } from "../../types";
import { getChangeReviewStaleReason } from "./changeReviewStale";
export type BackupRestoreRequest = {
  documentPath: string;
  backupContents: string;
  capturedSnapshot: ChangeReviewSnapshot | undefined;
};
/** Missing snapshots fail closed; a path match alone is never a restore claim. */
export function isBackupReviewCurrent(request: BackupRestoreRequest, tab: EditorTab | null): boolean {
  return !!request.capturedSnapshot && !!tab && tab.path === request.documentPath &&
    getChangeReviewStaleReason(request.capturedSnapshot, tab) === null;
}
