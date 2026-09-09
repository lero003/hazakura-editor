import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { EditorPaneHandle } from "../../components/editor/EditorPane";
import type { EditorTab, MenuLanguage } from "../../types";
import { captureChangeReviewSnapshot } from "../../features/diff/changeReviewStale";
import { isBackupReviewCurrent, type BackupRestoreRequest } from "../../features/diff/backupReview";
import { backupReviewCopy } from "../../lib/locale/backupReview";
type Options = {
  activeTab: EditorTab | null; workspaceRootPath: string | null; menuLanguage: MenuLanguage;
  imageVisible: boolean; editorPaneRef: RefObject<EditorPaneHandle | null>;
  readBackup: (context: { workspaceRoot: string; filePath: string }, name: string) => Promise<string>;
  closePicker: () => void; leaveLMode: () => void;
  review: (tab: EditorTab, name: string, contents: string) => void;
  closeComparison: () => void; setStatus: (text: string) => void;
  rejectIfLocked: (tab: EditorTab) => boolean;
};
export function useBackupReviewActions(options: Options) {
  const current = useRef(options); current.current = options;
  const readSequence = useRef(0);
  useEffect(() => () => { readSequence.current++; }, []);
  const select = useCallback(async (entry: { name: string; path: string }) => {
    const start = current.current;
    const tab = start.activeTab;
    if (!tab || !start.workspaceRootPath) return;
    const sequence = ++readSequence.current;
    const claim = { documentPath: tab.path, backupContents: "", capturedSnapshot: captureChangeReviewSnapshot(tab) };
    start.closePicker();
    try {
      const contents = await start.readBackup({ workspaceRoot: start.workspaceRootPath, filePath: tab.path }, entry.name);
      if (sequence !== readSequence.current) return;
      const now = current.current;
      if (now.workspaceRootPath !== start.workspaceRootPath || now.imageVisible ||
          !isBackupReviewCurrent(claim, now.activeTab) ||
          now.editorPaneRef.current?.getActiveDocument()?.text !== claim.capturedSnapshot.contents) {
        now.setStatus(backupReviewCopy(now.menuLanguage).stale); return;
      }
      now.leaveLMode();
      now.review(now.activeTab!, entry.name, contents);
    } catch {
      if (sequence === readSequence.current) current.current.setStatus(backupReviewCopy(current.current.menuLanguage).failed);
    }
  }, []);
  const apply = useCallback((request: BackupRestoreRequest) => {
    const now = current.current;
    const copy = backupReviewCopy(now.menuLanguage);
    const tab = now.activeTab;
    if (now.imageVisible || !isBackupReviewCurrent(request, tab) ||
        now.editorPaneRef.current?.getActiveDocument()?.text !== request.capturedSnapshot?.contents) {
      now.setStatus(copy.stale); return;
    }
    if (now.rejectIfLocked(tab!)) return;
    // Synchronous CodeMirror transaction: also refuses read-only / composition.
    // No queued React path replacement, no second write, and no disk save.
    if (!now.editorPaneRef.current?.replaceDocumentContents(request.backupContents)) {
      now.setStatus(copy.unavailable); return;
    }
    now.closeComparison();
    now.setStatus(copy.applied);
  }, []);
  return { select, apply };
}
