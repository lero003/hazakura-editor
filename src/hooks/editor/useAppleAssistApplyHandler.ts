import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { emitTo, listen, type UnlistenFn } from "@tauri-apps/api/event";
import { buildLineDiff } from "../../features/diff/diff";
import {
  aiEditTransactionStore,
  applyAiEditTransaction,
  type AiEditTransaction,
} from "../../features/editor/aiEditTransactions";
import {
  APPLE_ASSIST_MAX_CONTEXT_CHARS,
  generateAppleAssistCandidateStreaming,
  type AppleAssistOperation,
} from "../../lib/tauri/appleAssist";
import {
  APPLY_AI_EDIT_TRANSACTION_EVENT,
  APPLE_ASSIST_APPLY_STATUS_EVENT,
  type AppleAssistApplyEvent,
  type AppleAssistApplyStatusEvent,
  type AppleAssistGenerationLock,
  type AppleAssistTargetSnapshot,
  type CompareViewState,
} from "../../types";
import {
  getLocalAssistAction,
  isLocalAssistActionId,
  type LocalAssistActionId,
} from "../../lib/appleAssist/instruction";

// Per-request window for the surrounding document context
// that Hazakura Local Assist sees. `preChars` is taken before
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
export const APPLE_ASSIST_SELECTION_CONTEXT_PRE_CHARS = 500;
export const APPLE_ASSIST_SELECTION_CONTEXT_POST_CHARS = 500;

export function getAppleAssistContextWindow(
  kind: AppleAssistTargetSnapshot["kind"],
): { preChars: number; postChars: number } {
  if (kind === "selection") {
    return {
      preChars: APPLE_ASSIST_SELECTION_CONTEXT_PRE_CHARS,
      postChars: APPLE_ASSIST_SELECTION_CONTEXT_POST_CHARS,
    };
  }
  return {
    preChars: APPLE_ASSIST_CONTEXT_PRE_CHARS,
    postChars: APPLE_ASSIST_CONTEXT_POST_CHARS,
  };
}

// v0.12+ Hazakura Local Assist Writing Companion (slice 4).
// `useAppleAssistApplyHandler` is the main window's
// listener for the `APPLY_AI_EDIT_TRANSACTION_EVENT` that
// the detached Hazakura Local Assist window fires on Apply. The
// hook requests a bounded Hazakura Local Assist candidate, rewrites the active
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
  // is null (the Hazakura Local Assist window would not be sending
  // an apply with no active tab on the main side).
  activeTab: ActiveTab | null;
  // Replaces the active tab's contents with the new
  // buffer. The orchestrator owns the tab state; this
  // callback is the only path through which the handler
  // mutates the buffer. The `tabId` is passed explicitly so
  // the write always targets the validated tab even if the
  // orchestrator's render-time `activeTab` closure is stale.
  setActiveTabContents: (next: string, tabId: string) => void;
  // Optional status surface for the main window. Called
  // on apply success / failure with a localized message
  // the orchestrator can pass through to its `setStatus`.
  setStatus?: (message: string) => void;
  setGenerationLock?: Dispatch<SetStateAction<AppleAssistGenerationLock | null>>;
};

export function useAppleAssistApplyHandler({
  activeTab,
  setActiveTabContents,
  setStatus,
  setGenerationLock,
}: UseAppleAssistApplyHandlerOptions): void {
  // Refs let the listener read the latest active tab /
  // status setter without re-subscribing on every change.
  const activeTabRef = useRef<ActiveTab | null>(activeTab);
  activeTabRef.current = activeTab;
  const setActiveTabContentsRef = useRef(setActiveTabContents);
  setActiveTabContentsRef.current = setActiveTabContents;
  const setStatusRef = useRef(setStatus);
  setStatusRef.current = setStatus;
  const setGenerationLockRef = useRef(setGenerationLock);
  setGenerationLockRef.current = setGenerationLock;

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
      const message = "Hazakura Local Assist apply ignored: no active tab.";
      setStatusRef.current?.(message);
      void emitAppleAssistApplyStatus("failed", message, payload);
      return;
    }

    const target = payload.target;
    const targetCheck = readTargetTextForGeneration(target, tab);
    if (!targetCheck.ok) {
      const message = `Hazakura Local Assist apply failed: ${targetCheck.error}`;
      setStatusRef.current?.(message);
      void emitAppleAssistApplyStatus("failed", message, payload);
      return;
    }
    // After the `ok: true` check, `targetCheck.target` is
    // the validated, non-null snapshot. Re-bind it under a
    // narrower name so the rest of the function can use
    // `target.start` / `target.end` without further null
    // checks.
    const targetSnapshot = targetCheck.target;

    try {
      const startMessage = "Hazakura Local Assist is generating a change...";
      setStatusRef.current?.(startMessage);
      setGenerationLockRef.current?.({
        requestId: payload.requestId,
        tabId: tab.id,
        tabPath: tab.path,
        request: payload.request,
      });
      await emitAppleAssistApplyStatus("started", startMessage, payload);
      await yieldBeforeAppleAssistGeneration();
      const contextWindow = getAppleAssistContextWindow(targetSnapshot.kind);
      const actionId = resolveApplyActionId(payload);
      const action = getLocalAssistAction(actionId);
      const response = await generateAppleAssistCandidateStreaming({
        operation: action.operation,
        actionId,
        selectedText: targetCheck.before,
        documentContext: buildSurroundingDocumentContext(
          tab.contents,
          targetSnapshot.start,
          targetSnapshot.end,
          contextWindow.preChars,
          contextWindow.postChars,
          APPLE_ASSIST_MAX_CONTEXT_CHARS,
        ),
        additionalRequest: payload.additionalRequest,
      }, payload.requestId, payload.request);

      const latestTab = activeTabRef.current;
      if (!latestTab) {
        const message = "Hazakura Local Assist apply ignored: no active tab.";
        setStatusRef.current?.(message);
        void emitAppleAssistApplyStatus("failed", message, payload);
        clearGenerationLock(payload.requestId);
        return;
      }
      if (!isSameAppleAssistTargetTab(tab, latestTab)) {
        const message =
          "Hazakura Local Assist apply ignored: the active document changed during generation.";
        setStatusRef.current?.(message);
        void emitAppleAssistApplyStatus("failed", message, payload);
        clearGenerationLock(payload.requestId);
        return;
      }
      const result = applyAiEditTransaction({
        tabId: latestTab.id,
        tabName: latestTab.name,
        tabPath: latestTab.path,
        request: payload.request,
        target: payload.target,
        buffer: latestTab.contents,
        afterText: sanitizeAppleAssistCandidateText(response.candidateText),
      });
      if (!result.ok) {
        const message = `Hazakura Local Assist apply failed: ${result.error}`;
        setStatusRef.current?.(message);
        void emitAppleAssistApplyStatus("failed", message, payload);
        clearGenerationLock(payload.requestId);
        return;
      }

      // Precompute the line diff so the escape hatch can
      // render the comparison without recomputing it on
      // every render. The diff is keyed on the transaction's
      // `id` so the case lookup (`getCompareCaseByKey`) treats
      // it as a standalone case rather than colliding with any
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
      setActiveTabContentsRef.current(result.nextBuffer, latestTab.id);
      const successMessage = `Hazakura Local Assist applied: ${result.transaction.request} (${result.transaction.target.kind})`;
      setStatusRef.current?.(successMessage);
      void emitAppleAssistApplyStatus("completed", successMessage, payload, {
        shouldApplyToDocument: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const errorMessage = `Hazakura Local Assist generation failed: ${message}`;
      setStatusRef.current?.(errorMessage);
      void emitAppleAssistApplyStatus("failed", errorMessage, payload);
    } finally {
      clearGenerationLock(payload.requestId);
    }
  }

  function clearGenerationLock(requestId: string): void {
    setGenerationLockRef.current?.((current) =>
      current?.requestId === requestId ? null : current,
    );
  }
}

export function sanitizeAppleAssistCandidateText(candidateText: string): string {
  const trimmed = candidateText.trim();
  const boundaryPatterns = [
    /<<<HAZAKURA_TEXT_START\s*\n([\s\S]*?)\n?HAZAKURA_TEXT_END>>>/,
    /<<<HAZAKURA_CONTEXT_START\s*\n([\s\S]*?)\n?HAZAKURA_CONTEXT_END>>>/,
  ];

  for (const pattern of boundaryPatterns) {
    const match = trimmed.match(pattern);
    const inner = match?.[1]?.trim();
    if (inner) {
      return inner;
    }
  }

  return candidateText;
}

async function emitAppleAssistApplyStatus(
  phase: AppleAssistApplyStatusEvent["phase"],
  message: string,
  payload: AppleAssistApplyEvent,
  options: Pick<
    AppleAssistApplyStatusEvent,
    "partialText" | "shouldApplyToDocument"
  > = {},
): Promise<void> {
  try {
    await emitTo("apple-assist", APPLE_ASSIST_APPLY_STATUS_EVENT, {
      phase,
      message,
      requestId: payload.requestId,
      request: payload.request,
      ...options,
      emittedAtMs: Date.now(),
    } satisfies AppleAssistApplyStatusEvent);
  } catch (err) {
    console.warn("Failed to emit Hazakura Local Assist apply status", err);
  }
}

export function isSameAppleAssistTargetTab(
  initial: ActiveTab,
  latest: ActiveTab,
): boolean {
  return initial.id === latest.id && initial.path === latest.path;
}

export async function yieldBeforeAppleAssistGeneration(): Promise<void> {
  await new Promise<void>((resolve) => {
    if (typeof window !== "undefined" && "requestAnimationFrame" in window) {
      window.requestAnimationFrame(() => resolve());
      return;
    }
    setTimeout(resolve, 0);
  });
}

function resolveApplyActionId(payload: AppleAssistApplyEvent): LocalAssistActionId {
  if (isLocalAssistActionId(payload.actionId)) {
    return payload.actionId;
  }
  const lower = payload.request.toLowerCase();
  if (payload.request.includes("校正") || lower.includes("proof")) {
    return "proofread_only";
  }
  if (payload.request.includes("要約") || lower.includes("summar")) {
    return "summarize";
  }
  return "rewrite_natural";
}

function readTargetTextForGeneration(
  target: AppleAssistTargetSnapshot | null,
  tab: ActiveTab,
): { ok: true; target: AppleAssistTargetSnapshot; before: string } | { ok: false; error: string } {
  if (!target) {
    return {
      ok: false,
      error: "No Hazakura Local Assist target snapshot was supplied with the request.",
    };
  }
  if (target.start < 0 || target.end < target.start) {
    return { ok: false, error: "Hazakura Local Assist target range is invalid." };
  }
  if (target.end > tab.contents.length) {
    return {
      ok: false,
      error: "Hazakura Local Assist target range is out of bounds for the active buffer.",
    };
  }
  if (target.activeDocumentPath !== tab.path) {
    return { ok: false, error: "Hazakura Local Assist target is stale for the active document." };
  }
  const before = tab.contents.slice(target.start, target.end);
  if (before !== target.text) {
    return {
      ok: false,
      error: "Hazakura Local Assist target text no longer matches the active buffer.",
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
// This helper instead centers the context on the target.
// The returned text is one contiguous slice:
//   - start: up to `preChars` characters before `start`,
//     snapped forward to the next line boundary when that
//     boundary still leaves the target in the slice.
//   - target: the user's selected text.
//   - end: up to `postChars` characters after `end`,
//     snapped backward to the previous line boundary when
//     that boundary still leaves the target in the slice.
//
// The snap applies to the actual returned slice boundaries.
// That matters: a previous repair computed separate pre /
// post snapped boundaries for length accounting, but still
// returned `buffer.slice(preStart, postEnd)`, so the returned
// context could begin or end mid-line and the cap check could
// disagree with the returned text.
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
  const targetStart = clampNumber(start, 0, buffer.length);
  const targetEnd = clampNumber(Math.max(end, targetStart), 0, buffer.length);

  // Naive pre / post slices. Clamp to the document bounds
  // so the helper is safe against out-of-range target
  // ranges (the caller has already validated, but defense
  // in depth is cheap here).
  let preStart = snapStartToLineBoundary(
    buffer,
    Math.max(0, targetStart - preChars),
    targetStart,
  );
  let postEnd = snapEndToLineBoundary(
    buffer,
    Math.min(buffer.length, targetEnd + postChars),
    targetEnd,
  );

  // Cap the total length. The pre slice shrinks first
  // (the target itself is sacred), then the post slice.
  // Prefer line boundaries after shrinking; if long lines
  // leave the result over cap, fall back to a hard trim of
  // pre / post context while still preserving the target.
  const targetLength = targetEnd - targetStart;
  if (targetLength >= maxChars) {
    return buffer.slice(targetStart, targetEnd);
  }

  if (postEnd - preStart > maxChars) {
    const over = postEnd - preStart - maxChars;
    const preShrink = Math.min(targetStart - preStart, over);
    preStart = snapStartToLineBoundary(buffer, preStart + preShrink, targetStart);

    const remaining = postEnd - preStart - maxChars;
    if (remaining > 0) {
      const postShrink = Math.min(postEnd - targetEnd, remaining);
      postEnd = snapEndToLineBoundary(buffer, postEnd - postShrink, targetEnd);
    }
  }

  if (postEnd - preStart > maxChars) {
    const over = postEnd - preStart - maxChars;
    const preShrink = Math.min(targetStart - preStart, over);
    preStart += preShrink;

    const remaining = postEnd - preStart - maxChars;
    if (remaining > 0) {
      const postShrink = Math.min(postEnd - targetEnd, remaining);
      postEnd -= postShrink;
    }
  }

  return buffer.slice(preStart, postEnd);
}

function clampNumber(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function snapStartToLineBoundary(
  buffer: string,
  boundary: number,
  targetStart: number,
): number {
  if (boundary <= 0 || buffer[boundary - 1] === "\n") {
    return boundary;
  }
  const nextNewline = buffer.indexOf("\n", boundary);
  if (nextNewline === -1 || nextNewline + 1 > targetStart) {
    return boundary;
  }
  return nextNewline + 1;
}

function snapEndToLineBoundary(
  buffer: string,
  boundary: number,
  targetEnd: number,
): number {
  if (boundary >= buffer.length || buffer[boundary - 1] === "\n") {
    return boundary;
  }
  const previousNewline = buffer.lastIndexOf("\n", boundary - 1);
  if (previousNewline === -1 || previousNewline + 1 < targetEnd) {
    return boundary;
  }
  return previousNewline + 1;
}
