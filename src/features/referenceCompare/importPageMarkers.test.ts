import { describe, expect, it } from "vitest";
import {
  hasImportPageMarkers,
  pageIndexAtLine,
  parseImportPageMarkers,
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

describe("importPageMarkers", () => {
  it("parses zero-based page markers with 1-based line numbers", () => {
    const markers = parseImportPageMarkers(SAMPLE);
    expect(markers).toEqual([
      { pageIndex: 0, startLine: 5 },
      { pageIndex: 1, startLine: 9 },
      { pageIndex: 2, startLine: 13 },
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
});
