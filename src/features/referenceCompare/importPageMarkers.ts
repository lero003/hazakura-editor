/**
 * Import Assist page markers embedded in the unsaved Markdown draft.
 * Format (1-based editor lines when counting):
 *   <!-- hazakura:import-page index=0 -->
 */

const IMPORT_PAGE_MARKER =
  /<!--\s*hazakura:import-page\s+index=(\d+)\s*-->/;

export type ImportPageMarker = {
  /** Zero-based source page index from the marker. */
  pageIndex: number;
  /** 1-based line number where the marker appears. */
  startLine: number;
};

/** Collect import-page markers in document order. */
export function parseImportPageMarkers(contents: string): ImportPageMarker[] {
  const lines = contents.split("\n");
  const markers: ImportPageMarker[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(IMPORT_PAGE_MARKER);
    if (!match) continue;
    markers.push({
      pageIndex: Number.parseInt(match[1], 10),
      startLine: i + 1,
    });
  }
  return markers;
}

/**
 * Page index for the section containing `line` (1-based), or null when
 * no markers remain (follow should disable itself).
 */
export function pageIndexAtLine(
  contents: string,
  line: number,
): number | null {
  const markers = parseImportPageMarkers(contents);
  if (markers.length === 0) {
    return null;
  }
  const safeLine = Math.max(1, line);
  let current: number | null = null;
  for (const marker of markers) {
    if (marker.startLine <= safeLine) {
      current = marker.pageIndex;
    } else {
      break;
    }
  }
  // Cursor before the first marker still maps to the first page section.
  return current ?? markers[0]?.pageIndex ?? null;
}

export function hasImportPageMarkers(contents: string): boolean {
  return parseImportPageMarkers(contents).length > 0;
}
