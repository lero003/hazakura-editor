import { useEffect, useRef } from "react";
import { emitTo, listen, type UnlistenFn } from "@tauri-apps/api/event";
import { buildLineDiff } from "../../features/diff/diff";
import {
  aiEditTransactionStore,
  applyAiEditTransaction,
  type AiEditTransaction,
} from "../../features/editor/aiEditTransactions";
import {
  APPLE_ASSIST_MAX_CONTEXT_CHARS,
  generateAppleAssistCandidate,
  type AppleAssistOperation,
} from "../../lib/tauri/appleAssist";
import {
  APPLY_AI_EDIT_TRANSACTION_EVENT,
  APPLE_ASSIST_APPLY_STATUS_EVENT,
  type AppleAssistApplyEvent,
  type AppleAssistApplyStatusEvent,
  type AppleAssistTargetSnapshot,
  type CompareViewState,
} from "../../types";

// Per-request window for the surrounding document context
// that Apple Local Assist sees. `preChars` is taken before
// `start`, `postChars` after `end`, both snap to a line
// boundary inside `buildSurroundingDocumentContext` to keep
// the model from seeing a half-cut Markdown block. The
// total length is capped at `APPLE_ASSIST_MAX_CONTEXT_CHARS`
// (8000 chars). Together they mean the model sees the
// target plus the most relevant adjacent text instead of
// a fixed 8000-char slice of the document head, which was
// the previous behavior and produced off-target rewrites
// for selections in the second half of a document.
export const APPLE_ASSIST_CONTEXT_PRE_CHARS = 2000;
export const APPLE_ASSIST_CONTEXT_POST_CHARS = 2000;

// v0.12+ Apple Local Assist Writing Companion (slice 4).
// `useAppleAssistApplyHandler` is the main window's
// listener for the `APPLY_AI_EDIT_TRANSACTION_EVENT` that
// the detached Apple Assist window fires on Apply. The
// hook requests a bounded Apple Assist candidate, rewrites the active
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
      void applyAppleAssistRequest(event.payload);
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

  async function applyAppleAssistRequest(payload: AppleAssistApplyEvent): Promise<void> {
    const tab = activeTabRef.current;
    if (!tab) {
      const message = "Apple Local Assist apply ignored: no active tab.";
      setStatusRef.current?.(message);
      void emitAppleAssistApplyStatus("failed", message, payload.request);
      return;
    }

    const target = payload.target;
    const targetCheck = readTargetTextForGeneration(target, tab);
    if (!targetCheck.ok) {
      const message = `Apple Local Assist apply failed: ${targetCheck.error}`;
      setStatusRef.current?.(message);
      void emitAppleAssistApplyStatus("failed", message, payload.request);
      return;
    }
    // After the `ok: true` check, `targetCheck.target` is
    // the validated, non-null snapshot. Re-bind it under a
    // narrower name so the rest of the function can use
    // `target.start` / `target.end` without further null
    // checks.
    const targetSnapshot = targetCheck.target;

    try {
      const startMessage = "Apple Local Assist is generating a change...";
      setStatusRef.current?.(startMessage);
      void emitAppleAssistApplyStatus("started", startMessage, payload.request);
      const response = await generateAppleAssistCandidate({
        operation: inferAppleAssistOperation(payload.request),
        selectedText: targetCheck.before,
        documentContext: buildSurroundingDocumentContext(
          tab.contents,
          targetSnapshot.start,
          targetSnapshot.end,
          APPLE_ASSIST_CONTEXT_PRE_CHARS,
          APPLE_ASSIST_CONTEXT_POST_CHARS,
          APPLE_ASSIST_MAX_CONTEXT_CHARS,
        ),
        instruction: payload.request,
      });

      const latestTab = activeTabRef.current;
      if (!latestTab) {
        const message = "Apple Local Assist apply ignored: no active tab.";
        setStatusRef.current?.(message);
        void emitAppleAssistApplyStatus("failed", message, payload.request);
        return;
      }
      const result = applyAiEditTransaction({
        tabId: latestTab.id,
        tabName: latestTab.name,
        tabPath: latestTab.path,
        request: payload.request,
        target: payload.target,
        buffer: latestTab.contents,
        afterText: response.candidateText,
      });
      if (!result.ok) {
        const message = `Apple Local Assist apply failed: ${result.error}`;
        setStatusRef.current?.(message);
        void emitAppleAssistApplyStatus("failed", message, payload.request);
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
      const successMessage = `Apple Local Assist applied: ${result.transaction.request} (${result.transaction.target.kind})`;
      setStatusRef.current?.(successMessage);
      void emitAppleAssistApplyStatus("completed", successMessage, payload.request);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const errorMessage = `Apple Local Assist generation failed: ${message}`;
      setStatusRef.current?.(errorMessage);
      void emitAppleAssistApplyStatus("failed", errorMessage, payload.request);
    }
  }
}

async function emitAppleAssistApplyStatus(
  phase: AppleAssistApplyStatusEvent["phase"],
  message: string,
  request: string,
): Promise<void> {
  try {
    await emitTo("apple-assist", APPLE_ASSIST_APPLY_STATUS_EVENT, {
      phase,
      message,
      request,
      emittedAtMs: Date.now(),
    } satisfies AppleAssistApplyStatusEvent);
  } catch (err) {
    console.warn("Failed to emit Apple Local Assist apply status", err);
  }
}

function inferAppleAssistOperation(request: string): AppleAssistOperation {
  const lower = request.toLowerCase();
  if (request.includes("校正") || lower.includes("proof")) {
    return "proofread";
  }
  if (request.includes("要約") || lower.includes("summar")) {
    return "summarize";
  }
  return "rephrase";
}

function readTargetTextForGeneration(
  target: AppleAssistTargetSnapshot | null,
  tab: ActiveTab,
): { ok: true; target: AppleAssistTargetSnapshot; before: string } | { ok: false; error: string } {
  if (!target) {
    return {
      ok: false,
      error: "No Apple Local Assist target snapshot was supplied with the request.",
    };
  }
  if (target.start < 0 || target.end < target.start) {
    return { ok: false, error: "Apple Local Assist target range is invalid." };
  }
  if (target.end > tab.contents.length) {
    return {
      ok: false,
      error: "Apple Local Assist target range is out of bounds for the active buffer.",
    };
  }
  if (target.activeDocumentPath !== tab.path) {
    return { ok: false, error: "Apple Local Assist target is stale for the active document." };
  }
  const before = tab.contents.slice(target.start, target.end);
  if (before !== target.text) {
    return {
      ok: false,
      error: "Apple Local Assist target text no longer matches the active buffer.",
    };
  }
  return { ok: true, target, before };
}

// Build the bounded document context that Apple Local
// Assist sees for one request. The earlier behavior took
// the first `maxChars` of the document, so a selection in
// the second half of a long document received a context
// that did not include the section the user was actually
// editing — the model would then produce off-target
// rewrites because the visible "document" was a
// disconnected prefix.
//
// This helper instead centers the context on the target:
//   - pre slice: up to `preChars` characters before
//     `start`, with the slice's END boundary (which would
//     otherwise be `start`) shrunk to the start of the
//     line containing `start`. This keeps the model from
//     seeing a half-cut Markdown block on the pre side
//     (a code fence without its closing fence, a heading
//     without its body) WITHOUT erasing the lines between
//     the naive `preStart` and the target's line — those
//     are exactly the lines the model needs to see for a
//     context-aware rewrite.
//   - target: the user's selected text (returned as part
//     of the slice, not the caller's responsibility here).
//   - post slice: up to `postChars` characters after
//     `end`, with the slice's START boundary (which would
//     otherwise be `end`) extended to the end of the line
//     containing `end`. Same rationale: the lines between
//     the target's line and the naive `postEnd` must stay
//     in the context.
//
// An earlier version of this helper instead snapped the
// pre START forward to the target's line start and the
// post END back to the target's line end, which erased
// the lines the model actually needs. The current shape
// preserves them.
//
// The total length is capped at `maxChars`. When the
// snapped slice would exceed the cap, the helper shrinks
// the pre slice first, then the post slice. The target
// itself is never shrunk — the model always sees the
// full user selection.
//
// Snaps only move the boundaries CLOSER to the target,
// never further away, so the helper never returns more
// characters than the caller asked for in either
// direction. The cap is the upper bound; preChars /
// postChars are the per-direction upper bounds.
export function buildSurroundingDocumentContext(
  buffer: string,
  start: number,
  end: number,
  preChars: number,
  postChars: number,
  maxChars: number,
): string {
  // Naive pre / post slices. Clamp to the document bounds
  // so the helper is safe against out-of-range target
  // ranges (the caller has already validated, but defense
  // in depth is cheap here).
  let preStart = Math.max(0, start - preChars);
  let postEnd = Math.min(buffer.length, end + postChars);

  // Snap the pre slice's END boundary (which would
  // otherwise be `start`) forward to the start of the
  // line containing `start`. The pre slice's START stays
  // at the naive `preStart`, so any heading or paragraph
  // that fits inside the pre window is preserved. Only
  // the end moves to a line boundary, so the model never
  // sees a half-cut line.
  //
  // The snap only fires when the target's line start is
  // still inside the pre window — when the preChars
  // window is short enough that `startLineStart` is
  // before `preStart` (e.g. a target whose line starts
  // before the naive preChars window), the snap would
  // push `preEnd` past `preStart` and produce a negative
  // pre slice. Skipping the snap in that case keeps the
  // pre slice non-empty and respects the caller's
  // preChars budget.
  const startLineStart = buffer.lastIndexOf("\n", start - 1) + 1;
  let preEnd = start;
  if (preEnd > startLineStart && startLineStart >= preStart) {
    preEnd = startLineStart;
  }

  // Snap the post slice's START boundary (which would
  // otherwise be `end`) forward to the end of the line
  // containing `end`. The post slice's END stays at the
  // naive `postEnd`, so any paragraph that fits inside
  // the post window is preserved. Only the start moves
  // to a line boundary, mirroring the pre-side snap.
  //
  // The snap only fires when the line end actually fits
  // inside the post window — when the line end is past
  // the naive `postEnd` (e.g. the file has no trailing
  // newline and the postChars window is short), the
  // snap would push `postStart` past `postEnd` and
  // produce a negative post slice. Skipping the snap in
  // that case keeps the post slice non-empty and
  // respects the caller's postChars budget.
  const endLineEnd = (() => {
    const idx = buffer.indexOf("\n", end);
    return idx === -1 ? buffer.length : idx + 1;
  })();
  let postStart = end;
  if (postStart < endLineEnd && endLineEnd <= postEnd) {
    postStart = endLineEnd;
  }

  // Cap the total length. The pre slice shrinks first
  // (it is closer to the snap boundary and the target
  // itself is sacred), then the post slice.
  const preLength = preEnd - preStart;
  const postLength = postEnd - postStart;
  const targetLength = end - start;
  const total = preLength + targetLength + postLength;
  if (total > maxChars) {
    const over = total - maxChars;
    const preShrink = Math.min(preLength, over);
    preStart += preShrink;
    const remaining = over - preShrink;
    if (remaining > 0) {
      const postShrink = Math.min(postLength, remaining);
      postEnd -= postShrink;
    }
  }

  return buffer.slice(preStart, postEnd);
}
