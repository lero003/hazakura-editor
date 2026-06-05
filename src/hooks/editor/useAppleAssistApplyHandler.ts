import { useEffect, useRef } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { buildLineDiff } from "../../features/diff/diff";
import {
  aiEditTransactionStore,
  applyAiEditTransaction,
  type AiEditTransaction,
} from "../../features/editor/aiEditTransactions";
import {
  APPLY_AI_EDIT_TRANSACTION_EVENT,
  type AppleAssistApplyEvent,
  type CompareViewState,
} from "../../types";

// v0.12+ Apple Local Assist Writing Companion (slice 4).
// `useAppleAssistApplyHandler` is the main window's
// listener for the `APPLY_AI_EDIT_TRANSACTION_EVENT` that
// the detached Apple Assist window fires on Apply. The
// hook runs the fixture transform, rewrites the active
// tab's unsaved buffer in place, marks the tab dirty, and
// records an `AiEditTransaction` in the session-local
// store so the escape hatch (slice 5) can render a
// "review / discard" affordance.
//
// The hook is intentionally side-effect-only: it does
// not own any state, and the only way it talks back to the
// user is via the store and (optionally) a status message
// passed through `setStatus`. Errors are surfaced through
// the store's `clear` path so the next render does not
// surface a stale pending review.

type ActiveTab = {
  id: string;
  name: string;
  path: string;
  contents: string;
};

type UseAppleAssistApplyHandlerOptions = {
  // The currently active tab in the main window, or `null`
  // when no tab is open. The handler early-outs when this
  // is null (the Apple Assist window would not be sending
  // an apply with no active tab on the main side).
  activeTab: ActiveTab | null;
  // Replaces the active tab's contents with the new
  // buffer. The orchestrator owns the tab state; this
  // callback is the only path through which the handler
  // mutates the buffer.
  setActiveTabContents: (next: string) => void;
  // Optional status surface for the main window. Called
  // on apply success / failure with a localized message
  // the orchestrator can pass through to its `setStatus`.
  setStatus?: (message: string) => void;
};

export function useAppleAssistApplyHandler({
  activeTab,
  setActiveTabContents,
  setStatus,
}: UseAppleAssistApplyHandlerOptions): void {
  // Refs let the listener read the latest active tab /
  // status setter without re-subscribing on every change.
  const activeTabRef = useRef<ActiveTab | null>(activeTab);
  activeTabRef.current = activeTab;
  const setActiveTabContentsRef = useRef(setActiveTabContents);
  setActiveTabContentsRef.current = setActiveTabContents;
  const setStatusRef = useRef(setStatus);
  setStatusRef.current = setStatus;

  useEffect(() => {
    let unlisten: UnlistenFn | null = null;
    let disposed = false;

    void listen<AppleAssistApplyEvent>(APPLY_AI_EDIT_TRANSACTION_EVENT, (event) => {
      if (disposed) return;
      const tab = activeTabRef.current;
      if (!tab) {
        setStatusRef.current?.("Apple Assist apply ignored: no active tab.");
        return;
      }
      const result = applyAiEditTransaction({
        tabId: tab.id,
        tabName: tab.name,
        tabPath: tab.path,
        request: event.payload.request,
        target: event.payload.target,
        buffer: tab.contents,
      });
      if (!result.ok) {
        setStatusRef.current?.(`Apple Assist apply failed: ${result.error}`);
        return;
      }

      // Precompute the line diff so the escape hatch can
      // render the comparison without recomputing it on
      // every render. `buildLineDiff` is the same helper
      // the manual candidate Review Desk uses. The diff
      // is keyed on the transaction's `id` so the case
      // lookup (`getCompareCaseByKey`) treats it as a
      // standalone case rather than colliding with any
      // existing compare slot.
      const lineDiff = buildLineDiff(
        result.transaction.before,
        result.transaction.after,
      );
      const diff: CompareViewState = {
        caseKey: result.transaction.id,
        ...lineDiff,
      };

      const stored: AiEditTransaction = {
        ...result.transaction,
        diff,
      };
      aiEditTransactionStore.record(stored);
      setActiveTabContentsRef.current(result.nextBuffer);
      setStatusRef.current?.(
        `Apple Assist applied: ${result.transaction.request} (${result.transaction.target.kind})`,
      );
    })
      .then((handle) => {
        if (disposed) {
          void handle();
          return;
        }
        unlisten = handle;
      })
      .catch((err) => {
        console.warn("Failed to listen for apply event", err);
      });

    return () => {
      disposed = true;
      if (unlisten) {
        void unlisten();
        unlisten = null;
      }
    };
  }, []);
}
