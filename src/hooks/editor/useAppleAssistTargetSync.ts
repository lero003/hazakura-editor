import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import type {
  EditorPaneHandle,
  EditorSelectionInfo,
} from "../../components/editor/EditorPane";
import { setMainAppleAssistTarget } from "../../lib/tauri";
import type { AppleAssistTargetSnapshot } from "../../types";
import { inferAppleAssistTarget } from "../../features/editor/aiEditTarget";

// v0.12+ Apple Local Assist Writing Companion (slice 3+).
// `useAppleAssistTargetSync` keeps the Rust-side
// `MainAppleAssistTargetCache` fresh on every selection /
// cursor change in the main window's editor. The detached
// Apple Assist window reads the cache via
// `getMainAppleAssistTarget` and listens for
// `MAIN_APPLE_ASSIST_TARGET_CHANGED_EVENT` for live updates.
//
// The hook is intentionally thin:
//   1. Track the latest inferred target in a ref so we only
//      emit when it actually changes (kind / start / end /
//      text / label / active document).
//   2. On every selection change, read the document text and
//      selection range from the editor handle, infer the
//      target, and compare against the last snapshot. On
//      change, push to Rust and let the event fan out.
//
// The hook does NOT throttle: selection / cursor changes
// are already debounced by CodeMirror (the user has to
// stop moving the cursor for a tick) and the
// `inferAppleAssistTarget` call is O(document-line-count).
// For very large documents a rAF debounce would be the
// next step, but the current call site (one editor surface)
// is comfortably below the threshold.

type ActiveTab = {
  id: string;
  name: string;
  path: string;
};

type UseAppleAssistTargetSyncOptions = {
  editorPaneRef: RefObject<EditorPaneHandle | null>;
  activeTab: ActiveTab | null;
  selectionInfo: EditorSelectionInfo | null;
};

const EMPTY_SNAPSHOT: AppleAssistTargetSnapshot = {
  kind: "document",
  start: 0,
  end: 0,
  text: "",
  label: "",
  activeDocumentPath: null,
  activeDocumentName: null,
  capturedAtMs: 0,
};

function snapshotKey(snapshot: AppleAssistTargetSnapshot): string {
  // The key intentionally ignores `capturedAtMs` so a
  // re-capture with identical target does not re-emit.
  return [
    snapshot.kind,
    snapshot.start,
    snapshot.end,
    snapshot.text,
    snapshot.label,
    snapshot.activeDocumentPath ?? "",
    snapshot.activeDocumentName ?? "",
  ].join("");
}

export function useAppleAssistTargetSync({
  editorPaneRef,
  activeTab,
  selectionInfo,
}: UseAppleAssistTargetSyncOptions): void {
  const lastKeyRef = useRef<string>("");
  // Use a ref so the effect can read the current activeTab
  // without re-subscribing on every document switch.
  const activeTabRef = useRef<ActiveTab | null>(activeTab);
  activeTabRef.current = activeTab;

  useEffect(() => {
    const handle = editorPaneRef.current;
    if (!handle) {
      // No editor mounted — clear the cache so the Apple
      // Assist window does not show a stale target.
      const empty: AppleAssistTargetSnapshot = {
        ...EMPTY_SNAPSHOT,
        capturedAtMs: Date.now(),
      };
      const key = snapshotKey(empty);
      if (key !== lastKeyRef.current) {
        lastKeyRef.current = key;
        void setMainAppleAssistTarget(empty);
      }
      return;
    }

    const doc = handle.getActiveDocument();
    const tab = activeTabRef.current;
    if (!doc) {
      return;
    }

    const target = inferAppleAssistTarget({
      text: doc.text,
      from: doc.from,
      to: doc.to,
    });
    const snapshot: AppleAssistTargetSnapshot = {
      kind: target.kind,
      start: target.start,
      end: target.end,
      text: target.text,
      label: target.label,
      activeDocumentPath: tab?.path ?? null,
      activeDocumentName: tab?.name ?? null,
      capturedAtMs: Date.now(),
    };
    const key = snapshotKey(snapshot);
    if (key === lastKeyRef.current) {
      return;
    }
    lastKeyRef.current = key;
    void setMainAppleAssistTarget(snapshot);
    // The hook intentionally depends on `selectionInfo` (a
    // state that changes on every cursor / selection move)
    // rather than a version counter, so the consumer does
    // not have to track one.
  }, [editorPaneRef, selectionInfo]);
}
