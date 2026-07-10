import { describe, expect, it } from "vitest";
import {
  hasImportPageMarkers,
  nextReviewPage,
  pageIndexAtLine,
  parseImportPageMarkers,
  reviewPageIndices,
} from "./importPageMarkers";

const SAMPLE = `<!-- hazakura:import source=a.pdf pages=3 -->

> draft

<!-- hazakura:import-page index=0 -->

page zero text

<!-- hazakura:import-page index=1 -->

page one text

<!-- hazakura:import-page index=2 -->

page two text
`;

const WITH_CONFIDENCE = `<!-- hazakura:import-page index=0 confidence=0.910 -->

ok

<!-- hazakura:import-page index=1 confidence=0.410 -->

maybe

<!-- hazakura:import-page index=2 confidence=0.000 -->

empty-ish
`;

describe("importPageMarkers", () => {
  it("parses zero-based page markers with 1-based line numbers", () => {
    const markers = parseImportPageMarkers(SAMPLE);
    expect(markers).toEqual([
      { pageIndex: 0, startLine: 5, confidence: null },
      { pageIndex: 1, startLine: 9, confidence: null },
      { pageIndex: 2, startLine: 13, confidence: null },
    ]);
    expect(hasImportPageMarkers(SAMPLE)).toBe(true);
    expect(hasImportPageMarkers("no markers")).toBe(false);
  });

  it("maps cursor lines to the enclosing page section", () => {
    expect(pageIndexAtLine(SAMPLE, 1)).toBe(0);
    expect(pageIndexAtLine(SAMPLE, 5)).toBe(0);
    expect(pageIndexAtLine(SAMPLE, 7)).toBe(0);
    expect(pageIndexAtLine(SAMPLE, 9)).toBe(1);
    expect(pageIndexAtLine(SAMPLE, 12)).toBe(1);
    expect(pageIndexAtLine(SAMPLE, 13)).toBe(2);
    expect(pageIndexAtLine(SAMPLE, 99)).toBe(2);
  });

  it("returns null when markers were deleted", () => {
    expect(pageIndexAtLine("just text\n", 1)).toBeNull();
  });

  it("lists advisory review pages only when confidence is present and low", () => {
    expect(reviewPageIndices(SAMPLE)).toEqual([]);
    expect(reviewPageIndices(WITH_CONFIDENCE)).toEqual([1, 2]);
  });

  it("navigates review pages with wrap-around", () => {
    const pages = [1, 2];
    expect(nextReviewPage(pages, 1, 1)).toBe(2);
    expect(nextReviewPage(pages, 2, 1)).toBe(1);
    expect(nextReviewPage(pages, 2, -1)).toBe(1);
    expect(nextReviewPage(pages, 1, -1)).toBe(2);
    expect(nextReviewPage([], 0, 1)).toBeNull();
  });
});
