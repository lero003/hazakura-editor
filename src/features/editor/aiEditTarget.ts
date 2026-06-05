// v0.12+ Apple Local Assist Writing Companion (slice 3+).
// Bounded target inference for AI edit transactions.
//
// When the Apple Assist window sends an "apply" request, the
// main window must decide *which* span of the unsaved buffer
// the request is meant to operate on. The user might have
// selected a sentence, or only placed the cursor inside a
// paragraph, or inside a fenced code block, or somewhere with
// no clear "paragraph" boundary. We do not have live Foundation
// Models and we do not have a strong "intent classifier", so the
// inference here is intentionally narrow and predictable:
//
//   1. If the current selection is non-empty, it is the target.
//   2. Else, if the cursor is inside a fenced code block, the
//      whole block is the target.
//   3. Else, if the cursor is under a Markdown heading (`#` ...
//      `######`), the section from that heading to the next
//      heading of equal or higher level is the target.
//   4. Else, expand to the current "paragraph": the run of
//      non-blank lines containing the cursor (line above + line
//      below, both stopping at a blank line / start of doc /
//      end of doc).
//
// Block and section are checked before paragraph because a
// fenced code block is also a run of non-blank lines, and a
// heading + its body is also a run of non-blank lines — the
// more specific label wins.
//
// The `kind` is a label for the UI ("Apply to selection" /
// "Apply to paragraph" / "Apply to code block" / "Apply to
// section"), and `range` is a `{ start, end }` character index
// pair so the editor can apply the edit deterministically
// without re-tokenizing.
//
// The function is pure: it takes the full document text and
// the cursor / selection range and returns the inferred
// target. No CodeMirror state, no React, no async.

export type AppleAssistTargetKind =
  | "selection"
  | "paragraph"
  | "block"
  | "section"
  | "document";

export type AppleAssistTarget = {
  kind: AppleAssistTargetKind;
  // Character offsets into the document text. `start` is
  // inclusive; `end` is exclusive. Both are bounded by
  // `[0, text.length]`.
  start: number;
  end: number;
  // The slice of text covered by the target, in document
  // order. Always `text.slice(start, end)` for non-document
  // kinds; for `document` it is the full `text`.
  text: string;
  // Display label for the UI ("Apply to section: 概要").
  // Empty string when there is no informative label.
  label: string;
};

export type InferAppleAssistTargetInput = {
  // Full document text the cursor / selection is anchored in.
  text: string;
  // Inclusive character offset of the selection anchor (or
  // cursor) — typically `state.selection.main.from`.
  from: number;
  // Exclusive character offset of the selection head (or
  // cursor) — typically `state.selection.main.to`.
  to: number;
};

const HEADING_REGEX = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const FENCE_REGEX = /^(```|~~~)/;

export function inferAppleAssistTarget(
  input: InferAppleAssistTargetInput,
): AppleAssistTarget {
  const { text, from, to } = input;
  const textLength = text.length;
  const safeFrom = clamp(from, 0, textLength);
  const safeTo = clamp(to, 0, textLength);

  if (safeTo > safeFrom) {
    return {
      kind: "selection",
      start: safeFrom,
      end: safeTo,
      text: text.slice(safeFrom, safeTo),
      label: "",
    };
  }

  const cursor = safeFrom;

  // Fenced code block is checked first: it is also a run of
  // non-blank lines, and the `Code block (lang)` label is more
  // informative than the unlabeled paragraph.
  const blockRange = findFencedCodeBlockRange(text, cursor);
  if (blockRange) {
    return {
      kind: "block",
      start: blockRange.start,
      end: blockRange.end,
      text: text.slice(blockRange.start, blockRange.end),
      label: blockRange.label,
    };
  }

  // Section is checked next: a heading + its body is a more
  // informative label than the paragraph, and the section
  // walker uses the heading hierarchy to draw the right
  // boundary. The very first non-blank heading of the
  // document is treated as a title, not a section, so the
  // user can still target the body via paragraph.
  const sectionRange = findSectionRange(text, cursor);
  if (sectionRange) {
    return {
      kind: "section",
      start: sectionRange.start,
      end: sectionRange.end,
      text: text.slice(sectionRange.start, sectionRange.end),
      label: sectionRange.label,
    };
  }

  // Paragraph is the generic fallback for any non-blank run
  // of lines containing the cursor.
  const paragraphRange = findParagraphRange(text, cursor);
  if (paragraphRange) {
    return {
      kind: "paragraph",
      start: paragraphRange.start,
      end: paragraphRange.end,
      text: text.slice(paragraphRange.start, paragraphRange.end),
      label: "",
    };
  }

  return {
    kind: "document",
    start: 0,
    end: textLength,
    text,
    label: "",
  };
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function isBlankLine(line: string): boolean {
  return line.trim().length === 0;
}

function findParagraphRange(
  text: string,
  cursor: number,
): { start: number; end: number } | null {
  // A "paragraph" here is a run of non-blank lines that
  // contains the cursor. Walk up to the previous blank line
  // (or BOF) and down to the next blank line (or EOF).
  if (text.length === 0) return null;

  const lines = splitLinesPreservingOffsets(text);
  const cursorLine = findLineIndex(lines, cursor);
  if (cursorLine < 0) return null;

  if (isBlankLine(lines[cursorLine].text)) {
    return null;
  }

  let startLine = cursorLine;
  while (startLine > 0 && !isBlankLine(lines[startLine - 1].text)) {
    startLine -= 1;
  }
  let endLine = cursorLine;
  while (
    endLine + 1 < lines.length &&
    !isBlankLine(lines[endLine + 1].text)
  ) {
    endLine += 1;
  }

  return {
    start: lines[startLine].start,
    end: lines[endLine].end,
  };
}

function findFencedCodeBlockRange(
  text: string,
  cursor: number,
): { start: number; end: number; label: string } | null {
  const lines = splitLinesPreservingOffsets(text);
  const cursorLine = findLineIndex(lines, cursor);
  if (cursorLine < 0) return null;

  let openIndex: number | null = null;
  let fenceMarker = "";

  // Parse top-down so a closing fence above the cursor is not
  // mistaken for a fresh opening fence. This keeps paragraph
  // inference stable immediately after a completed code block.
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].text.match(FENCE_REGEX);
    if (!match) {
      continue;
    }

    if (openIndex === null) {
      openIndex = i;
      fenceMarker = match[1];
      continue;
    }

    if (match[1] !== fenceMarker) {
      continue;
    }

    if (cursorLine >= openIndex && cursorLine <= i) {
      return buildFencedCodeBlockRange(lines, openIndex, i, fenceMarker);
    }

    openIndex = null;
    fenceMarker = "";
  }

  if (openIndex !== null && cursorLine >= openIndex) {
    return buildFencedCodeBlockRange(
      lines,
      openIndex,
      lines.length - 1,
      fenceMarker,
    );
  }

  return null;
}

function buildFencedCodeBlockRange(
  lines: LineSpan[],
  openIndex: number,
  closeIndex: number,
  fenceMarker: string,
): { start: number; end: number; label: string } {
  // Capture the language hint (e.g. ```ts) for the label.
  const openText = lines[openIndex].text;
  const languageHint = openText.slice(fenceMarker.length).trim();

  return {
    start: lines[openIndex].start,
    end: lines[closeIndex].end,
    label: languageHint
      ? `Code block (${languageHint})`
      : "Code block",
  };
}

function findSectionRange(
  text: string,
  cursor: number,
): { start: number; end: number; label: string } | null {
  const lines = splitLinesPreservingOffsets(text);
  const cursorLine = findLineIndex(lines, cursor);
  if (cursorLine < 0) return null;

  // Walk up looking for a heading. Track the *closest* one.
  let headingIndex = -1;
  let headingLevel = 0;
  let headingText = "";
  for (let i = cursorLine; i >= 0; i -= 1) {
    const match = lines[i].text.match(HEADING_REGEX);
    if (match) {
      headingIndex = i;
      headingLevel = match[1].length;
      headingText = match[2].trim();
      break;
    }
  }
  if (headingIndex < 0) return null;

  // The very first non-blank line of the document is treated
  // as a title, not a section. The user can still target the
  // body via paragraph. This keeps the section label
  // meaningful (it only fires for real sub-sections).
  if (isDocumentTitle(headingIndex, lines)) {
    return null;
  }

  // Walk down looking for the next heading of equal or higher
  // level (i.e. a heading with `#` length <= headingLevel).
  let endIndex = lines.length - 1;
  for (let i = headingIndex + 1; i < lines.length; i += 1) {
    const match = lines[i].text.match(HEADING_REGEX);
    if (match && match[1].length <= headingLevel) {
      endIndex = i - 1;
      break;
    }
  }

  return {
    start: lines[headingIndex].start,
    end: lines[endIndex].end,
    label: `Section: ${headingText}`,
  };
}

function isDocumentTitle(headingIndex: number, lines: LineSpan[]): boolean {
  // A heading is a "document title" when every preceding line
  // is either blank or non-existent. Front-matter is not
  // considered (the mock is Markdown-only).
  for (let i = 0; i < headingIndex; i += 1) {
    if (!isBlankLine(lines[i].text)) {
      return false;
    }
  }
  return true;
}

type LineSpan = { text: string; start: number; end: number };

function splitLinesPreservingOffsets(text: string): LineSpan[] {
  const lines: LineSpan[] = [];
  let cursor = 0;
  let lineStart = 0;
  while (cursor <= text.length) {
    if (cursor === text.length || text[cursor] === "\n") {
      lines.push({
        text: text.slice(lineStart, cursor),
        start: lineStart,
        end: cursor,
      });
      lineStart = cursor + 1;
    }
    cursor += 1;
  }
  // `splitLinesPreservingOffsets` always yields at least one
  // line (the empty document case is handled by the caller).
  return lines;
}

function findLineIndex(lines: LineSpan[], offset: number): number {
  // Linear scan: the mock is bounded by document size and the
  // call site runs on selection / cursor change, not in a hot
  // loop. For very large documents a binary search would be
  // the obvious next step, but the bounded target is already
  // paragraph / block / section scoped, so the cost is fine.
  for (let i = 0; i < lines.length; i += 1) {
    if (offset < lines[i].end || i === lines.length - 1) {
      return i;
    }
  }
  return -1;
}
