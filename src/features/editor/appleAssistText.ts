import type { AppleAssistTargetSnapshot } from "../../types";

export const APPLE_ASSIST_CONTEXT_PRE_CHARS = 2000;
export const APPLE_ASSIST_CONTEXT_POST_CHARS = 2000;
export const APPLE_ASSIST_SELECTION_CONTEXT_PRE_CHARS = 500;
export const APPLE_ASSIST_SELECTION_CONTEXT_POST_CHARS = 500;
export type ActiveTab = { id: string; sessionId: string; name: string; path: string; contents: string };

/** Completed proposals may not retain reserved prompt delimiters, even malformed ones. */
/**
 * 対象枠に出す短い抜粋。改行・連続空白は1つに畳み、上限を超えたら末尾を省く。
 * ここで返す文字列は表示だけに使い、送信内容は変えない。
 */
export function appleAssistTargetExcerpt(text: string, limit = 60): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > limit ? `${flat.slice(0, limit)}…` : flat;
}

export function isAppleAssistCandidateReadyForReview(text: string): boolean {
  return text.trim().length > 0 && !/HAZAKURA_(?:TEXT|CONTEXT|ORIGINAL)_(?:START|END)/u.test(text) &&
    sanitizeAppleAssistCandidateText(text) === text;
}

export function getAppleAssistContextWindow(kind: AppleAssistTargetSnapshot["kind"]): { preChars: number; postChars: number } {
  return kind === "selection"
    ? { preChars: APPLE_ASSIST_SELECTION_CONTEXT_PRE_CHARS, postChars: APPLE_ASSIST_SELECTION_CONTEXT_POST_CHARS }
    : { preChars: APPLE_ASSIST_CONTEXT_PRE_CHARS, postChars: APPLE_ASSIST_CONTEXT_POST_CHARS };
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
    if (match) return stripCandidatePreamble(match[1]?.trim() ?? "");
  }
  const withoutBoundaryStart = trimmed
    .replace(/^<<<HAZAKURA_(TEXT|CONTEXT|ORIGINAL)_START(?:>>>)?\s*/u, "")
    .replace(/\s*(?:<<<)?HAZAKURA_(TEXT|CONTEXT|ORIGINAL)_END>>>$/u, "").trim();
  if (!withoutBoundaryStart || /^<<<HAZAKURA_(TEXT|CONTEXT|ORIGINAL)_START(?:>>>)?$/u.test(trimmed)) return "";
  return stripCandidatePreamble(withoutBoundaryStart === trimmed ? candidateText : withoutBoundaryStart);
}

const CANDIDATE_LEADIN_SENTENCES: ReadonlyArray<string> = [
  "修正後の文章は以下の通りです", "修正後の文章は以下のとおりです", "修正した文章は以下の通りです",
  "校正後の文章は以下の通りです", "翻訳後の文章は以下の通りです", "以下は修正後の文章です",
  "以下が修正後の文章です", "以下、修正後の文章です", "以下は修正した文章です", "以下は校正後の文章です",
  "Here is the revised text", "Here is the corrected text", "Here's the revised text", "The revised text is",
  "The corrected text is", "The revised version is",
];
const CANDIDATE_INLINE_PREFIXES: ReadonlyArray<string> = [
  "修正後", "改善後", "校正後", "翻訳後", "完成した本文", "完成した文章", "修正した本文", "修正した文章",
  "Revised text", "Corrected text", "Revised version", "Translation", "Translated text",
];

/** Narrow allowlists preserve ordinary Markdown and its trailing newline. */
export function stripCandidatePreamble(text: string): string {
  const lines = text.split("\n");
  let first = 0;
  while (first < lines.length && lines[first].trim() === "") first += 1;
  if (first >= lines.length) return text;
  const line = lines[first].trim();
  const normalized = line.replace(/[：:。.!！…\s]+$/u, "");
  if (CANDIDATE_LEADIN_SENTENCES.includes(normalized)) return lines.slice(first + 1).join("\n").trim();
  for (const prefix of CANDIDATE_INLINE_PREFIXES) {
    if (!line.startsWith(prefix)) continue;
    const after = line.slice(prefix.length);
    const separator = after.match(/^[：:]+\s*/u) ?? after.match(/^\s+[-–—－]+\s+/u);
    if (!separator) break;
    const rest = after.slice(separator[0].length).trim();
    if (rest.length > 0) { lines[first] = rest; return lines.slice(first).join("\n").trim(); }
    return lines.slice(first + 1).join("\n").trim();
  }
  return text;
}

export function isSameAppleAssistTargetTab(initial: ActiveTab, latest: ActiveTab): boolean {
  return initial.id === latest.id && initial.path === latest.path && initial.sessionId === latest.sessionId;
}

export function readTargetTextForGeneration(target: AppleAssistTargetSnapshot | null, tab: Pick<ActiveTab, "path" | "sessionId" | "contents">):
  { ok: true; target: AppleAssistTargetSnapshot; before: string } | { ok: false; error: string } {
  if (!target) return { ok: false, error: "No Hazakura Local Assist target snapshot was supplied with the request." };
  if (!Number.isSafeInteger(target.start) || !Number.isSafeInteger(target.end) || target.start < 0 || target.end < target.start) {
    return { ok: false, error: "Hazakura Local Assist target range is invalid." };
  }
  if (target.end > tab.contents.length) return { ok: false, error: "Hazakura Local Assist target range is out of bounds for the active buffer." };
  if (target.activeDocumentPath !== tab.path) return { ok: false, error: "Hazakura Local Assist target is stale for the active document." };
  if (target.activeDocumentSessionId != null && target.activeDocumentSessionId !== tab.sessionId) {
    return { ok: false, error: "Hazakura Local Assist target is stale for the active editor session." };
  }
  const before = tab.contents.slice(target.start, target.end);
  if (before !== target.text) return { ok: false, error: "Hazakura Local Assist target text no longer matches the active buffer." };
  return { ok: true, target, before };
}

/** Existing contiguous context contract: preserve the target and snap outer edges to lines. */
export function buildSurroundingDocumentContext(buffer: string, start: number, end: number,
  preChars: number, postChars: number, maxChars: number): string {
  const targetStart = clampNumber(start, 0, buffer.length);
  const targetEnd = clampNumber(Math.max(end, targetStart), 0, buffer.length);
  let preStart = snapStartToLineBoundary(buffer, Math.max(0, targetStart - preChars), targetStart);
  let postEnd = snapEndToLineBoundary(buffer, Math.min(buffer.length, targetEnd + postChars), targetEnd);
  const targetLength = targetEnd - targetStart;
  if (targetLength >= maxChars) return buffer.slice(targetStart, targetEnd);
  if (postEnd - preStart > maxChars) {
    const over = postEnd - preStart - maxChars;
    const preShrink = Math.min(targetStart - preStart, over);
    preStart = snapStartToLineBoundary(buffer, preStart + preShrink, targetStart);
    const remaining = postEnd - preStart - maxChars;
    if (remaining > 0) postEnd = snapEndToLineBoundary(buffer, postEnd - Math.min(postEnd - targetEnd, remaining), targetEnd);
  }
  if (postEnd - preStart > maxChars) {
    const over = postEnd - preStart - maxChars;
    preStart += Math.min(targetStart - preStart, over);
    const remaining = postEnd - preStart - maxChars;
    if (remaining > 0) postEnd -= Math.min(postEnd - targetEnd, remaining);
  }
  return buffer.slice(preStart, postEnd);
}
function clampNumber(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
function snapStartToLineBoundary(buffer: string, boundary: number, targetStart: number): number {
  if (boundary <= 0 || buffer[boundary - 1] === "\n") return boundary;
  const nextNewline = buffer.indexOf("\n", boundary);
  return nextNewline === -1 || nextNewline + 1 > targetStart ? boundary : nextNewline + 1;
}
function snapEndToLineBoundary(buffer: string, boundary: number, targetEnd: number): number {
  if (boundary >= buffer.length || buffer[boundary - 1] === "\n") return boundary;
  const previousNewline = buffer.lastIndexOf("\n", boundary - 1);
  return previousNewline === -1 || previousNewline + 1 < targetEnd ? boundary : previousNewline + 1;
}
