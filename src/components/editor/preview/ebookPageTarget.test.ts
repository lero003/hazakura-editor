import { describe, expect, it } from "vitest";
import {
  clampChapterIndex,
  clampPageIndex,
  commitPageCount,
  getReaderPageTargetByDelta,
  normalizeEBookPageCount,
} from "./ebookPageTarget";

describe("normalizeEBookPageCount", () => {
  it("returns the integer count as-is when already >= 1", () => {
    expect(normalizeEBookPageCount(1)).toBe(1);
    expect(normalizeEBookPageCount(3)).toBe(3);
  });

  it("truncates fractional counts down to an integer", () => {
    expect(normalizeEBookPageCount(3.9)).toBe(3);
    expect(normalizeEBookPageCount(1.5)).toBe(1);
  });

  it("clamps non-positive values to 1", () => {
    expect(normalizeEBookPageCount(0)).toBe(1);
    expect(normalizeEBookPageCount(-2)).toBe(1);
  });

  it("clamps non-finite values to 1", () => {
    expect(normalizeEBookPageCount(Number.NaN)).toBe(1);
    expect(normalizeEBookPageCount(Number.POSITIVE_INFINITY)).toBe(1);
    expect(normalizeEBookPageCount(Number.NEGATIVE_INFINITY)).toBe(1);
  });
});

describe("clampChapterIndex", () => {
  it("returns 0 when there are no chapters", () => {
    expect(clampChapterIndex(0, 0)).toBe(0);
    expect(clampChapterIndex(5, 0)).toBe(0);
  });

  it("clamps below zero to zero", () => {
    expect(clampChapterIndex(-1, 3)).toBe(0);
  });

  it("clamps above the last index to the last index", () => {
    expect(clampChapterIndex(5, 3)).toBe(2);
  });

  it("keeps an in-range index unchanged", () => {
    expect(clampChapterIndex(1, 3)).toBe(1);
  });
});

describe("clampPageIndex", () => {
  it("returns 0 when there are no pages", () => {
    expect(clampPageIndex(0, 0)).toBe(0);
    expect(clampPageIndex(3, 0)).toBe(0);
  });

  it("clamps below zero to zero", () => {
    expect(clampPageIndex(-1, 4)).toBe(0);
  });

  it("clamps above the last index to the last index", () => {
    expect(clampPageIndex(10, 4)).toBe(3);
  });

  it("keeps an in-range index unchanged", () => {
    expect(clampPageIndex(2, 4)).toBe(2);
  });
});

describe("commitPageCount", () => {
  it("trusts the measured count once images have settled", () => {
    expect(commitPageCount(7, 12, true)).toBe(7);
    expect(commitPageCount(2, 5, true)).toBe(2);
  });

  it("applies the same-chapter floor while images are still settling", () => {
    // A still-decoding image reports a too-small provisional count; the
    // committed value must not drop below the previously committed count.
    expect(commitPageCount(3, 12, false)).toBe(12);
    expect(commitPageCount(5, 5, false)).toBe(5);
  });

  it("does not apply a floor right after a chapter change (prev null)", () => {
    // The previous count belonged to the old chapter; using it as a floor
    // would pad a short new chapter up to the old count and create blank
    // pages, so the freshly measured count is trusted even mid-settle.
    expect(commitPageCount(1, null, false)).toBe(1);
    expect(commitPageCount(2, null, false)).toBe(2);
  });

  it("lets the committed count grow within the same chapter mid-settle", () => {
    // The floor only prevents a drop; growth is always allowed while images
    // expand the content.
    expect(commitPageCount(14, 12, false)).toBe(14);
  });

  it("normalizes fractional or non-positive measured counts", () => {
    expect(commitPageCount(0, 5, false)).toBe(5);
    expect(commitPageCount(2.9, null, false)).toBe(2);
    expect(commitPageCount(Number.NaN, 4, false)).toBe(4);
    expect(commitPageCount(Number.NaN, null, false)).toBe(1);
  });
});

describe("getReaderPageTargetByDelta", () => {
  // A read-only getter backed by a Map<chapterIndex, pageCount>. Returns null
  // when the chapter's page count has not been measured yet.
  const rememberedCounts = (counts: Record<number, number>) =>
    (chapterIndex: number): number | null =>
      chapterIndex in counts ? counts[chapterIndex] : null;

  it("holds position when the delta has no magnitude", () => {
    expect(
      getReaderPageTargetByDelta({
        currentChapterIndex: 1,
        currentPageCount: 4,
        currentPageIndex: 1,
        getChapterPageCount: rememberedCounts({}),
        pageDelta: 0,
        totalChapters: 3,
        hasVisibleNextChapterPreview: false,
      }),
    ).toEqual({ chapterIndex: 1, pageIndex: 1 });

    expect(
      getReaderPageTargetByDelta({
        currentChapterIndex: 1,
        currentPageCount: 4,
        currentPageIndex: 1,
        getChapterPageCount: rememberedCounts({}),
        pageDelta: 0.4,
        totalChapters: 3,
        hasVisibleNextChapterPreview: false,
      }),
    ).toEqual({ chapterIndex: 1, pageIndex: 1 });
  });

  it("advances within the same chapter when the step fits", () => {
    expect(
      getReaderPageTargetByDelta({
        currentChapterIndex: 0,
        currentPageCount: 5,
        currentPageIndex: 0,
        getChapterPageCount: rememberedCounts({}),
        pageDelta: 2,
        totalChapters: 3,
        hasVisibleNextChapterPreview: false,
      }),
    ).toEqual({ chapterIndex: 0, pageIndex: 2 });
  });

  it("clamps to the final page when there is no next chapter", () => {
    expect(
      getReaderPageTargetByDelta({
        currentChapterIndex: 2,
        currentPageCount: 4,
        currentPageIndex: 2,
        getChapterPageCount: rememberedCounts({}),
        pageDelta: 2,
        totalChapters: 3,
        hasVisibleNextChapterPreview: false,
      }),
    ).toEqual({ chapterIndex: 2, pageIndex: 3 });
  });

  it("opens an unseen next chapter from its opener when the preview is hidden", () => {
    expect(
      getReaderPageTargetByDelta({
        currentChapterIndex: 0,
        currentPageCount: 4,
        currentPageIndex: 3,
        getChapterPageCount: rememberedCounts({ 1: 4 }),
        pageDelta: 2,
        totalChapters: 3,
        hasVisibleNextChapterPreview: false,
      }),
    ).toEqual({ chapterIndex: 1, pageIndex: 0 });
  });

  it("continues past a previewed next-chapter opener without a backwards jump", () => {
    // A two-page step (spread mode) where the next chapter's opener was
    // already shown on the spare right spread page: continue one page past
    // the opener (step - 1) instead of rewinding to page 0.
    expect(
      getReaderPageTargetByDelta({
        currentChapterIndex: 0,
        currentPageCount: 4,
        currentPageIndex: 3,
        getChapterPageCount: rememberedCounts({ 1: 4 }),
        pageDelta: 2,
        totalChapters: 3,
        hasVisibleNextChapterPreview: true,
      }),
    ).toEqual({ chapterIndex: 1, pageIndex: 1 });
  });

  it("clamps the continuation back to the opener when the next chapter is too short", () => {
    // The next chapter has only one page and its opener was already
    // previewed, so the continuation index (1) would skip past it; fall back
    // to the opener (0) so a turn never skips pages.
    expect(
      getReaderPageTargetByDelta({
        currentChapterIndex: 0,
        currentPageCount: 4,
        currentPageIndex: 3,
        getChapterPageCount: rememberedCounts({ 1: 1 }),
        pageDelta: 2,
        totalChapters: 3,
        hasVisibleNextChapterPreview: true,
      }),
    ).toEqual({ chapterIndex: 1, pageIndex: 0 });
  });

  it("moves backward within the same chapter", () => {
    expect(
      getReaderPageTargetByDelta({
        currentChapterIndex: 1,
        currentPageCount: 4,
        currentPageIndex: 3,
        getChapterPageCount: rememberedCounts({}),
        pageDelta: -2,
        totalChapters: 3,
        hasVisibleNextChapterPreview: false,
      }),
    ).toEqual({ chapterIndex: 1, pageIndex: 1 });
  });

  it("returns to the previous chapter's last page when crossing backward", () => {
    expect(
      getReaderPageTargetByDelta({
        currentChapterIndex: 1,
        currentPageCount: 4,
        currentPageIndex: 0,
        getChapterPageCount: rememberedCounts({ 0: 3 }),
        pageDelta: -1,
        totalChapters: 3,
        hasVisibleNextChapterPreview: false,
      }),
    ).toEqual({ chapterIndex: 0, pageIndex: 2 });
  });

  it("flags 'last' when crossing back into an unmeasured previous chapter", () => {
    expect(
      getReaderPageTargetByDelta({
        currentChapterIndex: 1,
        currentPageCount: 4,
        currentPageIndex: 0,
        getChapterPageCount: rememberedCounts({}),
        pageDelta: -1,
        totalChapters: 3,
        hasVisibleNextChapterPreview: false,
      }),
    ).toEqual({ chapterIndex: 0, pageIndex: "last" });
  });

  it("clamps to the first chapter and first page when crossing back from the start", () => {
    expect(
      getReaderPageTargetByDelta({
        currentChapterIndex: 0,
        currentPageCount: 4,
        currentPageIndex: 0,
        getChapterPageCount: rememberedCounts({}),
        pageDelta: -1,
        totalChapters: 3,
        hasVisibleNextChapterPreview: false,
      }),
    ).toEqual({ chapterIndex: 0, pageIndex: 0 });
  });
});
