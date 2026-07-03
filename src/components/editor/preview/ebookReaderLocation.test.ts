import { describe, expect, it } from "vitest";
import {
  countMarkdownSourceLines,
  estimateChapterSourceLine,
  getEBookReaderLocation,
  readerLocationsEqual,
} from "./ebookReaderLocation";

describe("countMarkdownSourceLines", () => {
  it("counts a single-line source as one line", () => {
    expect(countMarkdownSourceLines("本文")).toBe(1);
  });

  it("counts a multi-line source", () => {
    expect(countMarkdownSourceLines("一行目\n二行目\n三行目")).toBe(3);
  });

  it("treats an empty string as one line", () => {
    expect(countMarkdownSourceLines("")).toBe(1);
  });

  it("ignores a single trailing newline", () => {
    expect(countMarkdownSourceLines("一行目\n二行目\n")).toBe(2);
  });

  it("handles CRLF line endings", () => {
    expect(countMarkdownSourceLines("一行目\r\n二行目\r\n")).toBe(2);
  });

  it("handles CR-only line endings", () => {
    expect(countMarkdownSourceLines("一行目\r二行目")).toBe(2);
  });
});

describe("estimateChapterSourceLine", () => {
  const chapter = { source: "a\nb\nc\nd\ne", startLine: 10 };

  it("returns the start line when there is a single page", () => {
    expect(estimateChapterSourceLine(chapter, 0, 1)).toBe(10);
  });

  it("returns the start line when the chapter is a single line", () => {
    expect(
      estimateChapterSourceLine({ source: "only", startLine: 7 }, 2, 5),
    ).toBe(7);
  });

  it("interpolates the first page to the start line", () => {
    // 5 lines, 5 pages: page 0 → startLine + round(0 / 4 * 4) = startLine
    expect(estimateChapterSourceLine(chapter, 0, 5)).toBe(10);
  });

  it("interpolates the last page to the final line", () => {
    // page 4 of 5 → startLine + round(4 / 4 * 4) = 14
    expect(estimateChapterSourceLine(chapter, 4, 5)).toBe(14);
  });

  it("interpolates a mid-chapter page proportionally", () => {
    // page 2 of 5 → startLine + round(2 / 4 * 4) = 12
    expect(estimateChapterSourceLine(chapter, 2, 5)).toBe(12);
  });

  it("clamps an out-of-range page index before interpolating", () => {
    // pageIndex 10 clamps to 4 (last page) → 14
    expect(estimateChapterSourceLine(chapter, 10, 5)).toBe(14);
  });

  it("clamps a non-positive page count to a single page", () => {
    expect(estimateChapterSourceLine(chapter, 2, 0)).toBe(10);
  });
});

describe("getEBookReaderLocation", () => {
  const chapter = { source: "a\nb\nc", startLine: 20, headingLevel: 1, headingText: "見出し", index: 0 };

  it("returns chapter and page index without sourceLine when chapter is absent", () => {
    expect(getEBookReaderLocation(undefined, 1, 2, 4)).toEqual({
      chapterIndex: 1,
      pageIndex: 2,
    });
  });

  it("includes an interpolated sourceLine when chapter is present", () => {
    // chapter has 3 lines, pageCount 3 → page 1 → 20 + round(1 / 2 * 2) = 21
    expect(getEBookReaderLocation(chapter, 0, 1, 3)).toEqual({
      chapterIndex: 0,
      pageIndex: 1,
      sourceLine: 21,
    });
  });
});

describe("readerLocationsEqual", () => {
  it("returns true for matching chapter, page, and sourceLine", () => {
    expect(
      readerLocationsEqual(
        { chapterIndex: 1, pageIndex: 2, sourceLine: 30 },
        { chapterIndex: 1, pageIndex: 2, sourceLine: 30 },
      ),
    ).toBe(true);
  });

  it("returns false when chapterIndex differs", () => {
    expect(
      readerLocationsEqual(
        { chapterIndex: 1, pageIndex: 2 },
        { chapterIndex: 2, pageIndex: 2 },
      ),
    ).toBe(false);
  });

  it("returns false when pageIndex differs", () => {
    expect(
      readerLocationsEqual(
        { chapterIndex: 1, pageIndex: 2 },
        { chapterIndex: 1, pageIndex: 3 },
      ),
    ).toBe(false);
  });

  it("returns false when sourceLine differs", () => {
    expect(
      readerLocationsEqual(
        { chapterIndex: 1, pageIndex: 2, sourceLine: 30 },
        { chapterIndex: 1, pageIndex: 2, sourceLine: 31 },
      ),
    ).toBe(false);
  });

  it("treats a missing sourceLine as undefined", () => {
    expect(
      readerLocationsEqual(
        { chapterIndex: 1, pageIndex: 2 },
        { chapterIndex: 1, pageIndex: 2, sourceLine: undefined },
      ),
    ).toBe(true);
  });
});
