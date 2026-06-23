// v0.21 e-book Mode PoC — chapter splitting for a single Markdown source.
//
// This is a display-only helper. It splits a Markdown source string into
// chapter-like segments at ATX headings (`#`, `##`, ...). Each returned
// `source` is a verbatim `source.slice(start, end)` substring of the
// original — the exact bytes that reach `renderMarkdown()` are
// byte-compatible with the canonical document model. This module never
// edits, reorders, or rewrites Markdown, and it never collapses trailing
// blank lines or newlines the way a split/join round-trip would.
//
// The heading detection here is intentionally narrow and line-based:
// it matches the same ATX rule used by the document outline (a line
// that starts with 1-6 `#` followed by whitespace or end-of-line, not
// inside a fenced code block). Setext headings (`===` / `---` under a
// paragraph) are intentionally NOT treated as chapter boundaries, both
// because they are easy to mis-detect with a line scan and because the
// L Mode plan keeps Setext as a visual-divider concern rather than a
// structural one.

const FENCE_MIN_LENGTH = 3;

export type EbookChapter = {
  // Zero-based ordinal of the chapter among the returned segments.
  index: number;
  // Detected ATX heading level (1-6), or null for the leading preamble
  // before the first heading.
  headingLevel: number | null;
  // Trimmed heading text (without the leading `#` markers), or null for
  // the preamble.
  headingText: string | null;
  // The Markdown source segment, suitable for `renderMarkdown()`.
  source: string;
};

type RawSegment = {
  // Half-open offset range into the original source string.
  start: number;
  end: number;
  level: number | null;
  text: string | null;
};

/**
 * Split a Markdown source into chapter-like segments at ATX headings.
 *
 * Each returned `source` is a verbatim `source.slice(start, end)`
 * substring of the input, so nothing that reaches `renderMarkdown()` is
 * rewritten, reordered, or invented — including any trailing blank
 * lines. Fenced code blocks are respected so a `#` inside a code fence
 * never starts a chapter, and a fence only closes for the same fence
 * character (`` ` `` or `~`) with a run at least as long as the opener.
 *
 * Empty segments — such as the implicit preamble before a document that
 * starts with a heading — are dropped so the renderer never receives a
 * blank chapter. A document with no ATX heading yields a single
 * preamble chapter that carries the whole source, so the caller can
 * always iterate over a non-empty list.
 */
export function splitMarkdownIntoChapters(source: string): EbookChapter[] {
  const segments: RawSegment[] = [];
  let inFence = false;
  let fenceChar = "";
  let fenceLength = 0;
  const frontmatterEnd = yamlFrontmatterEndOffset(source);
  let currentStart = 0;
  let currentLevel: number | null = null;
  let currentText: string | null = null;

  const pushSegment = (end: number) => {
    segments.push({
      start: currentStart,
      end,
      level: currentLevel,
      text: currentText,
    });
  };

  // Walk the source by line, but track offsets into the original string
  // rather than rebuilding it from split lines. `lineStart` is the
  // offset of the current line's first character; `pos` advances past
  // the line and its terminator. A final line without a trailing "\n"
  // is still captured because `lineStart <= source.length` at the last
  // iteration.
  let lineStart = 0;
  for (let pos = 0; pos <= source.length; ) {
    const nlIndex = source.indexOf("\n", pos);
    const lineEnd = nlIndex === -1 ? source.length : nlIndex;
    const line = source.slice(lineStart, lineEnd);

    if (frontmatterEnd !== null && lineStart < frontmatterEnd) {
      pos = nextLineStart(source, lineEnd);
      lineStart = pos;
      continue;
    }

    const fence = matchFence(line);
    if (fence) {
      const role = classifyFence(fence, inFence, fenceChar, fenceLength);
      if (role === "open") {
        inFence = true;
        fenceChar = fence.char;
        fenceLength = fence.length;
      } else if (role === "close") {
        inFence = false;
        fenceChar = "";
        fenceLength = 0;
      }
      // Advance past this line including its terminator.
      pos = nextLineStart(source, lineEnd);
      lineStart = pos;
      continue;
    }

    if (!inFence) {
      const heading = matchAtxHeading(line);
      if (heading) {
        // Close the previous segment up to (but not including) this
        // line. The heading line belongs to the new chapter.
        pushSegment(lineStart);
        currentStart = lineStart;
        currentLevel = heading.level;
        currentText = heading.text;
      }
    }

    pos = nextLineStart(source, lineEnd);
    lineStart = pos;
  }

  // Final segment runs to the end of the document.
  pushSegment(source.length);

  const visibleSegments = segments.filter(
    (segment) => segment.end > segment.start,
  );

  // An empty source yields a single empty preamble so callers can always
  // iterate over a non-empty list and render a heading-less / empty
  // document as one chapter instead of crashing on `chapters[0]`.
  const effectiveSegments =
    visibleSegments.length > 0
      ? visibleSegments
      : [{ start: 0, end: 0, level: null, text: null }];

  return effectiveSegments.map((segment, index) => ({
    index,
    headingLevel: segment.level,
    headingText: segment.text,
    source: source.slice(segment.start, segment.end),
  }));
}

export function applyEbookPageBreakMarkers(source: string): string {
  const lines = markdownLines(source);
  if (lines.length === 0) {
    return source;
  }

  let inFence = false;
  let fenceChar = "";
  let fenceLength = 0;
  const frontmatterEnd = yamlFrontmatterEndOffset(source);

  return lines
    .map((line, index) => {
      if (frontmatterEnd !== null && line.start < frontmatterEnd) {
        return line.raw;
      }

      const fence = matchFence(line.text);
      if (fence) {
        const role = classifyFence(fence, inFence, fenceChar, fenceLength);
        if (role === "open") {
          inFence = true;
          fenceChar = fence.char;
          fenceLength = fence.length;
        } else if (role === "close") {
          inFence = false;
          fenceChar = "";
          fenceLength = 0;
        }
        return line.raw;
      }

      if (!inFence && isPageBreakMarkerLine(lines, index)) {
        return `${pageBreakMarkerHtml()}${line.ending}`;
      }

      return line.raw;
    })
    .join("");
}

function pageBreakMarkerHtml(): string {
  return '<div class="page-break" role="separator" aria-label="Page break"></div>';
}

function isPageBreakMarkerLine(
  lines: Array<{ text: string }>,
  index: number,
): boolean {
  const marker = lines[index].text.trim();
  if (marker !== "---" && marker !== "===") {
    return false;
  }

  const previous = lines[index - 1]?.text.trim() ?? null;
  const next = lines[index + 1]?.text.trim() ?? "";
  const hasFollowingContent = lines
    .slice(index + 1)
    .some((line) => line.text.trim() !== "");
  return previous === "" && next === "" && hasFollowingContent;
}

function markdownLines(source: string): Array<{
  ending: string;
  raw: string;
  start: number;
  text: string;
}> {
  const lines: Array<{
    ending: string;
    raw: string;
    start: number;
    text: string;
  }> = [];

  let start = 0;
  while (start < source.length) {
    const nlIndex = source.indexOf("\n", start);
    const end = nlIndex === -1 ? source.length : nlIndex;
    const ending = nlIndex === -1 ? "" : "\n";
    const text = source.slice(start, end);
    lines.push({
      ending,
      raw: source.slice(start, end) + ending,
      start,
      text,
    });
    start = nlIndex === -1 ? source.length : nlIndex + 1;
  }

  return lines;
}

function matchAtxHeading(
  line: string,
): { level: number; text: string } | null {
  // ATX heading: 1-6 `#`, then a space or end-of-line. The text is the
  // remainder after the `#` run and a single optional space, with a
  // trailing `#` sequence (closing sequence) stripped.
  const match = /^(#{1,6})(?:[ \t]+(.*))?$/.exec(line);
  if (!match) {
    return null;
  }
  const level = match[1].length;
  let text = match[2] ?? "";
  // Strip an optional closing sequence of `#` with no preceding content
  // requirement, matching CommonMark's ATX closing.
  text = text.replace(/[ \t]+#*[ \t]*$/, "").trim();
  return { level, text };
}

type FenceMatch = {
  char: string;
  length: number;
  // The full line, kept so `classifyFence` can read the remainder after
  // the fence run without re-parsing it.
  line: string;
  // Offset in `line` where the fence run starts (after leading
  // indentation), and the offset just past the run.
  runStart: number;
  runEnd: number;
};

type FenceRole = "open" | "close" | "none";

// Classify a line's fence role against the current fence state. The
// line must already match `matchFence` (a run of at least three
// backticks or tildes at the start, after up to three spaces of
// indentation).
//
// CommonMark 4.6 (open) / 4.7 (close): a closing code fence may be
// indented up to three spaces and may be followed only by spaces / tabs
// — an "info string" after the run makes it an opener, not a closer.
// So a line like ``` ```not close ``` inside a code block is treated as
// fenced content (close: "none"), exactly like `marked` does, and any
// `#` on the following line stays inside the block instead of starting
// a chapter.
function classifyFence(
  fence: FenceMatch,
  inFence: boolean,
  fenceChar: string,
  fenceLength: number,
): FenceRole {
  if (!inFence) {
    return "open";
  }
  if (fence.char !== fenceChar || fence.length < fenceLength) {
    return "none";
  }
  // A closer must be a fence run plus only trailing whitespace: any
  // non-whitespace after the run means this is content inside the
  // block, not the closing fence. `runEnd` is the offset just past the
  // matched run, so everything from there to the line end is the
  // remainder we must check.
  const line = fence.line;
  const afterRun = line.slice(fence.runEnd);
  return /^[ \t]*$/.test(afterRun) ? "close" : "none";
}

function matchFence(line: string): FenceMatch | null {
  // CommonMark fenced code block: a line of three or more backticks or
  // tildes, optionally indented up to three spaces, optionally followed
  // by an info string. We capture both the fence character and the run
  // length so a close fence must match the opener's character and be at
  // least as long (CommonMark 4.5: "The closing code fence must be at
  // least as long as the opening fence").
  const match = /^[ \t]{0,3}([`~])(\1*)/.exec(line);
  if (!match) {
    return null;
  }
  const length = match[1].length + (match[2]?.length ?? 0);
  if (length < FENCE_MIN_LENGTH) {
    return null;
  }
  const runStart = match.index + match[0].length - length;
  return {
    char: match[1],
    length,
    line,
    runStart,
    runEnd: runStart + length,
  };
}

function nextLineStart(source: string, lineEnd: number): number {
  // `lineEnd` points at either a "\n" or the end of the string. Skip
  // past a single "\n" so the next line starts at the right offset;
  // never consume a trailing "\r\n" partially (offset correctness only
  // needs the "\n" boundary, and "\r" stays attached to its line).
  if (lineEnd < source.length && source[lineEnd] === "\n") {
    return lineEnd + 1;
  }
  return lineEnd + 1;
}

function yamlFrontmatterEndOffset(source: string): number | null {
  const firstLineEnd = source.indexOf("\n");
  const firstLine = firstLineEnd === -1 ? source : source.slice(0, firstLineEnd);
  if (firstLine.trim() !== "---") {
    return null;
  }

  let lineStart = firstLineEnd === -1 ? source.length : firstLineEnd + 1;
  while (lineStart < source.length) {
    const lineEnd = source.indexOf("\n", lineStart);
    const effectiveLineEnd = lineEnd === -1 ? source.length : lineEnd;
    const line = source.slice(lineStart, effectiveLineEnd);
    if (line.trim() === "---") {
      return lineEnd === -1 ? source.length : lineEnd + 1;
    }
    lineStart = lineEnd === -1 ? source.length : lineEnd + 1;
  }

  return null;
}
