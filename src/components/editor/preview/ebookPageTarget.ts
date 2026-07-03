// v1.4 observability seam: the pure page-commit / chapter-cross navigation
// decisions for e-book Mode, extracted from EBookPane so the previously
// module-private logic gains focused regression coverage.
//
// These functions take only plain values (and a read-only callback for the
// remembered per-chapter page counts) and return plain values. EBookPane.tsx
// supplies the DOM-dependent measurements (measured page count, image-settled
// flag, visible page step) and the ref-backed chapter-count map as inputs, so
// this module owns no React, DOM, or effect state.

export type PendingPageTarget = "first" | "last" | number;

export type ReaderPageTarget = {
  chapterIndex: number;
  pageIndex: PendingPageTarget;
};

export function normalizeEBookPageCount(pageCount: number): number {
  if (!Number.isFinite(pageCount)) {
    return 1;
  }
  return Math.max(1, Math.trunc(pageCount));
}

export function clampChapterIndex(index: number, totalChapters: number): number {
  if (totalChapters <= 0) {
    return 0;
  }
  return Math.min(Math.max(index, 0), totalChapters - 1);
}

export function clampPageIndex(index: number, totalPages: number): number {
  if (totalPages <= 0) {
    return 0;
  }
  return Math.min(Math.max(index, 0), totalPages - 1);
}

// Decide the page count to commit given a freshly measured `next` value.
// While images are still decoding, `next` is provisional and may be smaller
// than the real count (the content has not yet expanded to its final
// height). Committing a too-small count would shrink the displayed total,
// the page offset, the reader location, and the chapter-cross calculations —
// all of which can make the page jump backward from one heading to another.
// So while images are unsettled, never let the committed count drop below its
// previous value — but only within the same chapter: the previous value is
// passed as `null` right after a chapter change, so a short new chapter is
// never padded up to the old chapter's page count (which would create blank
// pages and `Page 1 / 12`-style ghost totals). Once images settle, the
// freshly measured count is trusted as final.
export function commitPageCount(
  next: number,
  prev: number | null,
  imagesSettled: boolean,
): number {
  const normalizedNext = normalizeEBookPageCount(next);
  if (imagesSettled || prev === null) {
    return normalizedNext;
  }
  return Math.max(normalizedNext, normalizeEBookPageCount(prev));
}

// epub-like page-break rule. One user action moves by one spread (pageStep
// pages, 2 in spread mode / 1 in single-page mode) and crosses at most one
// chapter boundary.
//
// Crossing into the next chapter lands on the continuation when the next
// chapter is already previewed on the spare right spread page (so the reader
// does not see a backwards jump), otherwise on the chapter opener (pageIndex
// 0). This mirrors how an EPUB reader keeps a spread continuous across a
// chapter break the reader has already glimpsed, but still opens an unseen
// chapter from its first page.
export function getReaderPageTargetByDelta({
  currentChapterIndex,
  currentPageCount,
  currentPageIndex,
  getChapterPageCount,
  pageDelta,
  totalChapters,
  hasVisibleNextChapterPreview,
}: {
  currentChapterIndex: number;
  currentPageCount: number;
  currentPageIndex: number;
  getChapterPageCount: (chapterIndex: number) => number | null;
  pageDelta: number;
  totalChapters: number;
  hasVisibleNextChapterPreview: boolean;
}): ReaderPageTarget {
  const lastChapterIndex = Math.max(totalChapters - 1, 0);
  const step = Math.abs(Math.trunc(pageDelta));
  const direction = Math.sign(pageDelta);
  const chapterIndex = clampChapterIndex(currentChapterIndex, totalChapters);
  const pageIndex = clampPageIndex(currentPageIndex, currentPageCount);

  if (direction === 0 || step === 0) {
    return { chapterIndex, pageIndex };
  }

  if (direction > 0) {
    const pageCount = normalizeEBookPageCount(currentPageCount);
    const lastIndex = Math.max(pageCount - 1, 0);
    const nextInChapter = pageIndex + step;
    if (nextInChapter <= lastIndex) {
      return { chapterIndex, pageIndex: nextInChapter };
    }
    // The step would run past the last page of this chapter. If there is no
    // following chapter, clamp to the final page here.
    if (chapterIndex >= lastChapterIndex) {
      return { chapterIndex, pageIndex: lastIndex };
    }
    // Cross at most one chapter boundary. When the next chapter's first
    // page is already previewed on the spare right spread page, the turn
    // continues just past that previewed page (so the spread stays
    // continuous and the reader sees no backwards jump) — that is
    // `step - 1` pages into the next chapter, because pageIndex 0 was the
    // previewed page. When the next chapter is unseen, open it from its
    // opener (pageIndex 0). The continuation is clamped back to the opener
    // when the next chapter is too short to hold it, so a turn never skips
    // pages (e.g. a heading-only single page chapter whose preview already
    // showed everything).
    const nextChapterPageCount = getChapterPageCount(chapterIndex + 1);
    const nextLastIndex =
      nextChapterPageCount === null
        ? null
        : Math.max(normalizeEBookPageCount(nextChapterPageCount) - 1, 0);
    const continuationIndex = hasVisibleNextChapterPreview
      ? Math.max(step - 1, 0)
      : 0;
    const nextPageIndex =
      nextLastIndex !== null && continuationIndex > nextLastIndex
        ? 0
        : continuationIndex;
    return {
      chapterIndex: chapterIndex + 1,
      pageIndex: nextPageIndex,
    };
  }

  // direction < 0. Move backward by the step within the chapter, and when
  // that crosses the chapter opener, return to the previous chapter's last
  // page. One user action crosses at most one chapter boundary.
  const previousInChapter = pageIndex - step;
  if (previousInChapter >= 0) {
    return { chapterIndex, pageIndex: previousInChapter };
  }
  if (chapterIndex <= 0) {
    return { chapterIndex: 0, pageIndex: 0 };
  }
  const previousChapterPageCount = getChapterPageCount(chapterIndex - 1);
  if (previousChapterPageCount === null) {
    return { chapterIndex: chapterIndex - 1, pageIndex: "last" };
  }
  return {
    chapterIndex: chapterIndex - 1,
    pageIndex: Math.max(normalizeEBookPageCount(previousChapterPageCount) - 1, 0),
  };
}
