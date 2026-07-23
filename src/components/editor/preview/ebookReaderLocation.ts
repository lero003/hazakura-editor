// v1.4 observability seam: the pure reader-location helpers for e-book Mode,
// extracted from EBookPane so the chapter page -> source line interpolation
// and the line-counting edge cases gain focused coverage.
//
// These functions take plain chapter / index / page values and return plain
// values. EBookPane.tsx supplies the chapter data (already split from source)
// and the measured page counts, so this module owns no React or DOM state.

import type { EbookChapter } from "../../../features/editor/ebookChapters";
import type { EBookViewState } from "../../../features/editor/documentViewState";
import { clampPageIndex } from "./ebookPageTarget";

export type EBookReaderLocation = EBookViewState;

export function getEBookReaderLocation(
  chapter: EbookChapter | undefined,
  chapterIndex: number,
  pageIndex: number,
  pageCount: number,
): EBookReaderLocation {
  const location = {
    chapterIndex,
    pageIndex,
  };
  const sourceLine = chapter
    ? estimateChapterSourceLine(chapter, pageIndex, pageCount)
    : null;

  return sourceLine === null ? location : { ...location, sourceLine };
}

export function readerLocationsEqual(
  first: EBookReaderLocation,
  second: EBookReaderLocation,
): boolean {
  return (
    first.chapterIndex === second.chapterIndex &&
    first.pageIndex === second.pageIndex &&
    first.sourceLine === second.sourceLine
  );
}

export function estimateChapterSourceLine(
  chapter: Pick<EbookChapter, "source" | "startLine">,
  pageIndex: number,
  pageCount: number,
): number {
  const lineCount = countMarkdownSourceLines(chapter.source);
  const safePageCount = Math.max(1, Math.trunc(pageCount));
  const safePageIndex = clampPageIndex(pageIndex, safePageCount);
  if (lineCount <= 1 || safePageCount <= 1) {
    return chapter.startLine;
  }

  const pageRatio = safePageIndex / (safePageCount - 1);
  return chapter.startLine + Math.round((lineCount - 1) * pageRatio);
}

export function findChapterIndexForSourceLine(
  chapters: readonly Pick<EbookChapter, "startLine">[],
  sourceLine: number,
): number {
  if (chapters.length === 0) return 0;
  const safeLine = Number.isFinite(sourceLine)
    ? Math.max(1, Math.trunc(sourceLine))
    : 1;
  let chapterIndex = 0;
  for (let index = 0; index < chapters.length; index += 1) {
    if (chapters[index].startLine > safeLine) break;
    chapterIndex = index;
  }
  return chapterIndex;
}

export function getPageIndexForSourceLine(
  chapter: Pick<EbookChapter, "source" | "startLine">,
  sourceLine: number,
  pageCount: number,
  visiblePageStep = 1,
): number {
  const safePageCount = Number.isFinite(pageCount)
    ? Math.max(1, Math.trunc(pageCount))
    : 1;
  const lineCount = countMarkdownSourceLines(chapter.source);
  if (lineCount <= 1 || safePageCount <= 1) return 0;

  const safeSourceLine = Number.isFinite(sourceLine)
    ? Math.trunc(sourceLine)
    : chapter.startLine;
  const relativeLine = Math.min(
    Math.max(safeSourceLine - chapter.startLine, 0),
    lineCount - 1,
  );
  const estimatedPage = Math.round(
    (relativeLine / (lineCount - 1)) * (safePageCount - 1),
  );
  const step = Number.isFinite(visiblePageStep)
    ? Math.max(1, Math.trunc(visiblePageStep))
    : 1;
  return clampPageIndex(
    Math.floor(estimatedPage / step) * step,
    safePageCount,
  );
}

export function countMarkdownSourceLines(source: string): number {
  if (source.length === 0) {
    return 1;
  }
  const lineCount = source.split(/\r\n|\n|\r/).length;
  return /(?:\r\n|\n|\r)$/.test(source)
    ? Math.max(1, lineCount - 1)
    : lineCount;
}
