/**
 * Import Assist page markers embedded in the unsaved Markdown draft.
 * Format (1-based editor lines when counting):
 *   <!-- hazakura:import-page index=0 -->
 *   <!-- hazakura:import-page index=1 confidence=0.410 -->
 *
 * R4: optional page-level confidence is advisory only — never treated as
 * per-character correctness. Text-layer pages omit confidence.
 */

const IMPORT_PAGE_MARKER =
  /<!--\s*hazakura:import-page\s+index=(\d+)(?:\s+confidence=([0-9]*\.?[0-9]+))?\s*-->/;

/** Pages at or below this confidence are offered as advisory 要確認 targets. */
export const IMPORT_PAGE_REVIEW_CONFIDENCE_THRESHOLD = 0.55;

export type ImportPageMarker = {
  /** Zero-based source page index from the marker. */
  pageIndex: number;
  /** 1-based line number where the marker appears. */
  startLine: number;
  /** Optional page-level OCR confidence in [0, 1]. */
  confidence: number | null;
};

/** Collect import-page markers in document order. */
export function parseImportPageMarkers(contents: string): ImportPageMarker[] {
  const lines = contents.split("\n");
  const markers: ImportPageMarker[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(IMPORT_PAGE_MARKER);
    if (!match) continue;
    const confidenceRaw = match[2];
    markers.push({
      pageIndex: Number.parseInt(match[1], 10),
      startLine: i + 1,
      confidence:
        confidenceRaw === undefined
          ? null
          : Number.parseFloat(confidenceRaw),
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

/**
 * Zero-based page indices that deserve advisory review navigation.
 * Only markers with an explicit confidence at or below the threshold.
 * Does not invent review flags for text-layer pages without confidence.
 */
export function reviewPageIndices(
  contents: string,
  threshold: number = IMPORT_PAGE_REVIEW_CONFIDENCE_THRESHOLD,
): number[] {
  const seen = new Set<number>();
  const pages: number[] = [];
  for (const marker of parseImportPageMarkers(contents)) {
    if (marker.confidence === null || Number.isNaN(marker.confidence)) {
      continue;
    }
    if (marker.confidence > threshold) {
      continue;
    }
    if (seen.has(marker.pageIndex)) {
      continue;
    }
    seen.add(marker.pageIndex);
    pages.push(marker.pageIndex);
  }
  return pages;
}

/** Next review page after `currentPage`, wrapping. Null if no review pages. */
export function nextReviewPage(
  reviewPages: number[],
  currentPage: number,
  direction: 1 | -1,
): number | null {
  if (reviewPages.length === 0) {
    return null;
  }
  const sorted = [...reviewPages].sort((a, b) => a - b);
  if (direction === 1) {
    const next = sorted.find((p) => p > currentPage);
    return next ?? sorted[0] ?? null;
  }
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    if (sorted[i] < currentPage) {
      return sorted[i];
    }
  }
  return sorted[sorted.length - 1] ?? null;
}
