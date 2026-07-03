import type { ChangeReviewSnapshot, EditorTab } from "../../types";

export type { ChangeReviewSnapshot };

// Stale detection for the change-review right pane. When the right
// column is the live editor buffer (`buffer-vs-disk`,
// `backup-vs-buffer`), the diff can go stale if the buffer changes by
// another path (a second Local Assist apply, an auto-backup restore,
// an external edit) after the diff was captured. Fixed-snapshot
// scopes (`draft-vs-disk`, `ai-edit-vs-buffer`) compare against an
// immutable source and are intentionally excluded.
//
// The model mirrors the existing `getStaleAppleAssistResultReason`
// stale gate in `useAppleAssistCandidate.ts`: a null current tab is
// stale, a tab switch is stale, and a buffer change is stale.

export type ChangeReviewStaleReason =
  | "tab-closed"
  | "tab-switched"
  | "buffer-edited";

// Scopes whose right column is the live buffer and therefore eligible
// for stale detection. Draft and AI-edit scopes compare against a
// fixed snapshot, so the captured diff never goes stale.
const STALE_AWARE_SCOPES = new Set([
  "buffer-vs-disk",
  "backup-vs-buffer",
]);

export function isStaleAwareScope(scope: string): boolean {
  return STALE_AWARE_SCOPES.has(scope);
}

export function captureChangeReviewSnapshot(
  tab: EditorTab,
): ChangeReviewSnapshot {
  return {
    tabId: tab.id,
    sessionId: tab.sessionId,
    contents: tab.contents,
    lineEnding: tab.line_ending,
    encoding: tab.encoding,
    dirty:
      tab.contents !== tab.lastSavedContents ||
      tab.line_ending !== tab.lastSavedLineEnding ||
      tab.encoding !== tab.lastSavedEncoding,
  };
}

export function getChangeReviewStaleReason(
  snapshot: ChangeReviewSnapshot,
  currentTab: EditorTab | null,
): ChangeReviewStaleReason | null {
  // A null current tab means the document was closed; the captured
  // diff no longer reflects anything the user can act on.
  if (!currentTab) {
    return "tab-closed";
  }

  // The tab the diff was captured against must still be the active
  // tab. We compare on both the path-stable id and the edit-session
  // id so a Save As (path change) or a tab switch is detected.
  if (
    currentTab.id !== snapshot.tabId ||
    currentTab.sessionId !== snapshot.sessionId
  ) {
    return "tab-switched";
  }

  // Same tab, but the buffer changed after capture. The diff is now
  // a historical snapshot rather than the current state.
  if (
    currentTab.contents !== snapshot.contents ||
    currentTab.line_ending !== snapshot.lineEnding ||
    currentTab.encoding !== snapshot.encoding
  ) {
    return "buffer-edited";
  }

  return null;
}
