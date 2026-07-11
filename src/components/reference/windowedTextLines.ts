/**
 * Windowed line range for long read-only text references.
 * Avoids mounting one DOM node per line for multi-thousand-line docs.
 */

export const REFERENCE_LINE_WINDOW = 200;
export const REFERENCE_LINE_OVERSCAN = 40;

export type WindowedLineRange = {
  start: number;
  end: number;
  total: number;
};

export function computeWindowedLineRange(
  totalLines: number,
  scrollTop: number,
  viewportHeight: number,
  lineHeight: number,
  windowSize = REFERENCE_LINE_WINDOW,
  overscan = REFERENCE_LINE_OVERSCAN,
): WindowedLineRange {
  const total = Math.max(0, totalLines);
  if (total === 0) {
    return { start: 0, end: 0, total: 0 };
  }

  const safeLineHeight = Math.max(1, lineHeight);
  const firstVisible = Math.floor(Math.max(0, scrollTop) / safeLineHeight);
  const visibleCount = Math.max(
    1,
    Math.ceil(Math.max(1, viewportHeight) / safeLineHeight),
  );
  let start = Math.max(0, firstVisible - overscan);
  let end = Math.min(total, firstVisible + visibleCount + overscan);

  // Hard cap DOM nodes for very tall viewports.
  if (end - start > windowSize) {
    end = Math.min(total, start + windowSize);
  }
  if (end - start < Math.min(windowSize, total) && total <= windowSize) {
    start = 0;
    end = total;
  }

  return { start, end, total };
}
