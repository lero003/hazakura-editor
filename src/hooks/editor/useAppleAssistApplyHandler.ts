import { emitTo } from "@tauri-apps/api/event";
import { buildLineDiff } from "../../features/diff/diff";
import {
  aiEditTransactionStore,
  applyAiEditTransaction,
  type AiEditTransaction,
} from "../../features/editor/aiEditTransactions";
import type { LocalAssistProposal } from "../../features/editor/localAssistProposal";
import {
  APPLE_ASSIST_APPLY_STATUS_EVENT,
  type AppleAssistApplyEvent,
  type AppleAssistApplyStatusEvent,
  type AppleAssistTargetSnapshot,
  type CompareViewState,
} from "../../types";
import {
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

export type ActiveTab = {
  id: string;
  sessionId: string;
  name: string;
  path: string;
  contents: string;
};

export type ApplyReviewedProposalInput = {
  proposal: LocalAssistProposal;
  activeTab: ActiveTab;
  setActiveTabContents: (next: string, sessionId: string) => void;
  setStatus?: (message: string) => void;
};

export type ApplyReviewedProposalResult =
  | { ok: true }
  | { ok: false; error: string };

// v2.6 B2: the main window owns the unapplied-proposal review surface, so the
// explicit "文書へ反映" action now happens in the main window instead of the
// detached conversation window. `applyReviewedLocalAssistProposal` is the
// single apply path: it revalidates the pinned target against the live tab,
// rewrites the unsaved buffer through `applyAiEditTransaction`, and records one
// `AiEditTransaction` for the existing Review Bar. It never calls the model
// and never mutates the buffer unless the reviewed proposal still matches.
export async function applyReviewedLocalAssistProposal(
  input: ApplyReviewedProposalInput,
): Promise<ApplyReviewedProposalResult> {
  const { proposal, activeTab, setActiveTabContents, setStatus } = input;

  const targetCheck = readTargetTextForGeneration(proposal.target, activeTab);
  if (!targetCheck.ok) {
    return {
      ok: false,
      error: `Hazakura Local Assist apply failed: ${targetCheck.error}`,
    };
  }
  if (proposal.originalText !== targetCheck.before) {
    return {
      ok: false,
      error:
        "Hazakura Local Assist apply rejected: the pinned original no longer matches the active document.",
    };
  }

  const candidateText = sanitizeAppleAssistCandidateText(proposal.candidateText);
  if (candidateText.trim().length === 0) {
    return {
      ok: false,
      error: "Hazakura Local Assist apply rejected: the reviewed proposal is empty.",
    };
  }

  try {
    const result = applyAiEditTransaction({
      tabId: activeTab.sessionId,
      tabName: activeTab.name,
      tabPath: activeTab.path,
      request: proposal.request,
      target: targetCheck.target,
      buffer: activeTab.contents,
      afterText: candidateText,
    });
    if (!result.ok) {
      return {
        ok: false,
        error: `Hazakura Local Assist apply failed: ${result.error}`,
      };
    }

    // Precompute the line diff so the Review Bar escape hatch can render it
    // without recomputing on every render. The diff is keyed on the
    // transaction id so `getCompareCaseByKey` treats it as a standalone case.
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
    // Second arg is sessionId (Q-STR-3); path/id would miss after Save As.
    setActiveTabContents(result.nextBuffer, activeTab.sessionId);
    const successMessage = `Hazakura Local Assist applied: ${result.transaction.request} (${result.transaction.target.kind})`;
    setStatus?.(successMessage);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: `Hazakura Local Assist apply failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// v2.6 B2: report the apply result to the detached conversation window so it
// can reset its conversation state after the main window applies or discards.
export async function emitLocalAssistApplyStatus(
  phase: AppleAssistApplyStatusEvent["phase"],
  message: string,
  requestId: string,
  request: string,
  options: Pick<AppleAssistApplyStatusEvent, "shouldApplyToDocument"> = {},
): Promise<void> {
  try {
    await emitTo("apple-assist", APPLE_ASSIST_APPLY_STATUS_EVENT, {
      phase,
      message,
      requestId,
      request,
      ...options,
      emittedAtMs: Date.now(),
    } satisfies AppleAssistApplyStatusEvent);
  } catch (err) {
    console.warn("Failed to emit Hazakura Local Assist apply status", err);
  }
}

export function sanitizeAppleAssistCandidateText(candidateText: string): string {
  const trimmed = candidateText.trim();
  const boundaryPatterns = [
    /<<<HAZAKURA_TEXT_START(?:>>>)?\s*\n([\s\S]*?)\n?(?:<<<)?HAZAKURA_TEXT_END>>>/,
    /<<<HAZAKURA_CONTEXT_START(?:>>>)?\s*\n([\s\S]*?)\n?(?:<<<)?HAZAKURA_CONTEXT_END>>>/,
    /<<<HAZAKURA_ORIGINAL_START(?:>>>)?\s*\n([\s\S]*?)\n?(?:<<<)?HAZAKURA_ORIGINAL_END>>>/,
  ];

  for (const pattern of boundaryPatterns) {
    const match = trimmed.match(pattern);
    if (match) {
      return stripCandidatePreamble(match[1]?.trim() ?? "");
    }
  }

  const withoutBoundaryStart = trimmed
    .replace(/^<<<HAZAKURA_(TEXT|CONTEXT|ORIGINAL)_START(?:>>>)?\s*/u, "")
    .replace(/\s*(?:<<<)?HAZAKURA_(TEXT|CONTEXT|ORIGINAL)_END>>>$/u, "")
    .trim();
  if (
    !withoutBoundaryStart ||
    /^<<<HAZAKURA_(TEXT|CONTEXT|ORIGINAL)_START(?:>>>)?$/u.test(trimmed)
  ) {
    return "";
  }
  const cleaned = withoutBoundaryStart === trimmed ? candidateText : withoutBoundaryStart;
  return stripCandidatePreamble(cleaned);
}

// Conservative candidate preamble strip. Small on-device models sometimes
// answer with a conversational lead-in ("修正後の文章は以下の通りです。",
// "Here is the revised text:") before the actual revised text. The candidate
// applied to the editor must be only the revised text, so strip a recognized
// standalone lead-in line or a recognized inline prefix. The allowlists are
// intentionally narrow so legitimate document content is not stripped.
const CANDIDATE_LEADIN_SENTENCES: ReadonlyArray<string> = [
  "修正後の文章は以下の通りです",
  "修正後の文章は以下のとおりです",
  "修正した文章は以下の通りです",
  "校正後の文章は以下の通りです",
  "翻訳後の文章は以下の通りです",
  "以下は修正後の文章です",
  "以下が修正後の文章です",
  "以下、修正後の文章です",
  "以下は修正した文章です",
  "以下は校正後の文章です",
  "Here is the revised text",
  "Here is the corrected text",
  "Here's the revised text",
  "The revised text is",
  "The corrected text is",
  "The revised version is",
];

// Inline labels are stripped only when a clear separator follows the label:
// a colon (":" / "：") may follow directly, while a dash-family separator
// ("-" / "–" / "—" / "－") must be surrounded by whitespace so compound
// words like "Translation-based" are not eaten. A bare prefix match would
// otherwise strip ordinary content such as "修正後の利用規約" or
// "Translation memory".
const CANDIDATE_INLINE_PREFIXES: ReadonlyArray<string> = [
  "修正後",
  "改善後",
  "校正後",
  "翻訳後",
  "完成した本文",
  "完成した文章",
  "修正した本文",
  "修正した文章",
  "Revised text",
  "Corrected text",
  "Revised version",
  "Translation",
  "Translated text",
];

/**
 * Strip a recognized conversational lead-in from the front of a candidate.
 * Returns the input unchanged when no preamble is recognized, so ordinary
 * Markdown content (including a trailing newline) is preserved exactly.
 */
export function stripCandidatePreamble(text: string): string {
  const lines = text.split("\n");
  let first = 0;
  while (first < lines.length && lines[first].trim() === "") {
    first += 1;
  }
  if (first >= lines.length) {
    return text;
  }

  const line = lines[first].trim();

  // 1) A standalone lead-in sentence (「修正後の文章は以下の通りです。」) is
  // dropped entirely; the real content starts on the next line. This is an
  // exact whole-line match, not a prefix match, so a heading or sentence that
  // merely starts with the same words is left untouched.
  const normalized = line.replace(/[：:。.!！…\s]+$/u, "");
  if (CANDIDATE_LEADIN_SENTENCES.includes(normalized)) {
    return lines.slice(first + 1).join("\n").trim();
  }

  // 2) An inline label ("修正後：本文…" / "Translation: New text") keeps the
  // remainder, but only when a clear separator follows the label. A colon may
  // follow directly; a dash-family separator must be surrounded by whitespace
  // so "Translation-based" stays intact.
  for (const prefix of CANDIDATE_INLINE_PREFIXES) {
    if (!line.startsWith(prefix)) {
      continue;
    }
    const after = line.slice(prefix.length);
    const separator =
      after.match(/^[：:]+\s*/u) ?? after.match(/^\s+[-–—－]+\s+/u);
    if (!separator) {
      break;
    }
    const rest = after.slice(separator[0].length).trim();
    if (rest.length > 0) {
      lines[first] = rest;
      return lines.slice(first).join("\n").trim();
    }
    // The label consumed the whole line ("修正後："): drop it and keep what
    // follows on the next lines.
    return lines.slice(first + 1).join("\n").trim();
  }

  return text;
}

export function isSameAppleAssistTargetTab(
  initial: ActiveTab,
  latest: ActiveTab,
): boolean {
  // The open editor session is now identified by `sessionId`
  // (id follows the path). A document can be closed and
  // reopened under the same path, which swaps the session,
  // so the guard must also reject a session change —
  // otherwise a stale generation result from the old session
  // would land in the freshly reopened document.
  return (
    initial.id === latest.id &&
    initial.path === latest.path &&
    initial.sessionId === latest.sessionId
  );
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

export function resolveApplyActionId(payload: AppleAssistApplyEvent): LocalAssistActionId {
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

export function readTargetTextForGeneration(
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
  if (
    target.activeDocumentSessionId !== null &&
    target.activeDocumentSessionId !== undefined &&
    target.activeDocumentSessionId !== tab.sessionId
  ) {
    return {
      ok: false,
      error: "Hazakura Local Assist target is stale for the active editor session.",
    };
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
