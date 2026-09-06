import type { AppleAssistTargetSnapshot } from "../../types";
import { APPLE_ASSIST_MAX_SELECTED_CHARS } from "../../lib/tauri/appleAssist";

export type SidebarScope = "selection" | "lines" | "document";
export type SidebarDocument = { path: string; name: string; sessionId: string; contents: string };
export type SidebarTargetError = "noSelection" | "invalidLines" | "empty" | "tooLong" | "editorChanged";
export type SidebarTargetResult = { ok: true; target: AppleAssistTargetSnapshot; firstLine: number; lastLine: number; characters: number }
  | { ok: false; error: SidebarTargetError };

export function countLocalAssistCharacters(text: string, limit = Number.MAX_SAFE_INTEGER): number {
  let count = 0;
  for (const _ of text) { if (++count > limit) break; }
  return count;
}

/** Source lines, not wrapped screen rows. Keep the final line separator OUTSIDE the replacement. */
export function sourceLineRange(text: string, first: number, last: number): { start: number; end: number } | null {
  if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last) || first < 1 || last < first) return null;
  let start = 0;
  for (let line = 1; line < first; line++) {
    const newline = text.indexOf("\n", start);
    if (newline < 0) return null;
    start = newline + 1;
  }
  let end = start;
  for (let line = first; line <= last; line++) {
    const newline = text.indexOf("\n", end);
    if (newline < 0) return line === last ? { start, end: text.length } : null;
    if (line === last) return { start, end: newline > start && text[newline - 1] === "\r" ? newline - 1 : newline };
    end = newline + 1;
  }
  return null;
}
function sourceLineAt(text: string, offset: number): number {
  let line = 1;
  for (let index = 0; index < offset; index++) if (text[index] === "\n") line++;
  return line;
}
function splitsSurrogate(text: string, offset: number): boolean {
  const previous = text.charCodeAt(offset - 1), next = text.charCodeAt(offset);
  return previous >= 0xd800 && previous <= 0xdbff && next >= 0xdc00 && next <= 0xdfff;
}

export function buildSidebarTarget(input: {
  document: SidebarDocument;
  scope: SidebarScope;
  firstLine?: string;
  lastLine?: string;
  selection?: { text: string; from: number; to: number } | null;
  now?: number;
}): SidebarTargetResult {
  const { document, scope } = input;
  const text = document.contents;
  let range: { start: number; end: number };
  if (scope === "document") range = { start: 0, end: text.length };
  else if (scope === "lines") {
    if (!/^\d+$/.test(input.firstLine ?? "") || !/^\d+$/.test(input.lastLine ?? "")) return { ok: false, error: "invalidLines" };
    const lines = sourceLineRange(text, Number(input.firstLine), Number(input.lastLine));
    if (!lines) return { ok: false, error: "invalidLines" };
    range = lines;
  } else {
    const selection = input.selection;
    if (!selection || selection.from === selection.to) return { ok: false, error: "noSelection" };
    if (selection.text !== text) return { ok: false, error: "editorChanged" };
    range = { start: Math.min(selection.from, selection.to), end: Math.max(selection.from, selection.to) };
  }
  if (!Number.isSafeInteger(range.start) || !Number.isSafeInteger(range.end) || range.start < 0 || range.end > text.length ||
      splitsSurrogate(text, range.start) || splitsSurrogate(text, range.end)) return { ok: false, error: "editorChanged" };
  const selected = text.slice(range.start, range.end);
  if (!selected.trim()) return { ok: false, error: "empty" };
  const characters = countLocalAssistCharacters(selected, APPLE_ASSIST_MAX_SELECTED_CHARS);
  if (characters > APPLE_ASSIST_MAX_SELECTED_CHARS) return { ok: false, error: "tooLong" };
  return {
    ok: true, characters,
    firstLine: sourceLineAt(text, range.start), lastLine: sourceLineAt(text, Math.max(range.start, range.end - 1)),
    target: { kind: scope === "document" ? "document" : "selection", ...range, text: selected, label: "",
      activeDocumentPath: document.path, activeDocumentName: document.name, activeDocumentSessionId: document.sessionId,
      capturedAtMs: input.now ?? Date.now() },
  };
}
