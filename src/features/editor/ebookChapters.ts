import { parseMarkdownStructure } from "./markdownStructure";

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

export type EbookChapter = {
  // Zero-based ordinal of the chapter among the returned segments.
  index: number;
  // One-based source line where this chapter segment starts. For a
  // heading chapter this is the ATX heading line; for a preamble chapter
  // this is 1. This is display metadata only and never rewrites source.
  startLine: number;
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
  startLine: number;
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
  let currentStart = 0;
  let currentStartLine = 1;
  let currentLevel: number | null = null;
  let currentText: string | null = null;

  const pushSegment = (end: number) => {
    segments.push({
      start: currentStart,
      end,
      startLine: currentStartLine,
      level: currentLevel,
      text: currentText,
    });
  };

  for (const heading of parseMarkdownStructure(source).headings) {
    // Close the previous segment up to (but not including) this line. The
    // heading line belongs to the new chapter, and the offsets remain exact.
    pushSegment(heading.startOffset);
    currentStart = heading.startOffset;
    currentStartLine = heading.line;
    currentLevel = heading.level;
    currentText = heading.text;
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
      : [{ start: 0, end: 0, startLine: 1, level: null, text: null }];

  return effectiveSegments.map((segment, index) => ({
    index,
    startLine: segment.startLine,
    headingLevel: segment.level,
    headingText: segment.text,
    source: source.slice(segment.start, segment.end),
  }));
}

/**
 * Merge segments from `splitMarkdownIntoChapters` so that only H1 (`#`) and
 * H2 (`##`) headings start a chapter. Deeper ATX headings (H3 `###` and
 * below) are folded into the preceding H1/H2 chapter as in-chapter
 * subheadings, and a leading run of deep headings before any H1/H2 is folded
 * into the preamble.
 *
 * The shared Markdown structure model also feeds EPUB navigation, which needs
 * every heading level, so the level filter lives here in the reader path only.
 * The merged `source` is the concatenation of the constituent
 * verbatim slices, so the bytes that reach `renderMarkdown()` are unchanged
 * from the canonical document model — only the chapter grouping changes.
 * `index` is re-numbered over the merged list, and the merged chapter keeps
 * the first constituent segment's heading metadata and start line.
 */
export function coalesceChaptersToTopLevel(
  chapters: EbookChapter[],
): EbookChapter[] {
  if (chapters.length === 0) {
    return chapters;
  }

  type Acc = {
    index: number;
    headingLevel: number | null;
    headingText: string | null;
    startLine: number;
    source: string;
  };

  const merged: Acc[] = [];
  for (const chapter of chapters) {
    const isTopLevelBoundary =
      chapter.headingLevel === null || chapter.headingLevel <= 2;
    const current = merged[merged.length - 1];
    if (isTopLevelBoundary || !current) {
      merged.push({
        index: merged.length,
        headingLevel: chapter.headingLevel,
        headingText: chapter.headingText,
        startLine: chapter.startLine,
        source: chapter.source,
      });
      continue;
    }
    // This H3-and-below segment folds into the current chapter. Keep the
    // current chapter's heading metadata and start line; only its source
    // grows by the verbatim slice of the folded segment.
    current.source += chapter.source;
  }

  return merged.map((chapter) => ({ ...chapter }));
}

export function collectEbookChapterSubheadings(
  rawChapters: EbookChapter[],
  topLevelChapters: EbookChapter[],
): string[][] {
  return topLevelChapters.map((chapter, index) => {
    const nextStartLine = topLevelChapters[index + 1]?.startLine ?? Infinity;

    return rawChapters
      .filter(
        (candidate) =>
          candidate.startLine > chapter.startLine &&
          candidate.startLine < nextStartLine &&
          (candidate.headingLevel ?? 0) >= 3 &&
          candidate.headingText !== null,
      )
      .map((candidate) => candidate.headingText as string);
  });
}

export function applyEbookPageBreakMarkers(source: string): string {
  const pageBreaks = parseMarkdownStructure(source).pageBreaks;
  if (pageBreaks.length === 0) {
    return source;
  }

  const output: string[] = [];
  let cursor = 0;
  for (const pageBreak of pageBreaks) {
    output.push(source.slice(cursor, pageBreak.startOffset));
    const ending = source.slice(
      pageBreak.contentEndOffset,
      pageBreak.endOffset,
    );
    output.push(
      pageBreak.role === "page-break"
        ? `${pageBreakMarkerHtml()}${ending}`
        : ending,
    );
    cursor = pageBreak.endOffset;
  }
  output.push(source.slice(cursor));
  return output.join("");
}

function pageBreakMarkerHtml(): string {
  return '<div class="page-break" role="separator" aria-label="Page break"></div>';
}
