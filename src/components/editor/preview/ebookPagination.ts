export function measureEBookPageCount(element: HTMLElement | null): number {
  if (!element) {
    return 1;
  }

  const pageStep = getEBookPageStep(element);
  if (pageStep <= 0) {
    return 1;
  }

  const scrollWidth = Math.max(0, element.scrollWidth);
  if (scrollWidth <= 0) {
    return 1;
  }

  const gap = getColumnGap(element);
  return Math.max(1, Math.ceil((scrollWidth + gap) / pageStep));
}

export function getEBookPageOffset(
  pageIndex: number,
  element: HTMLElement | null,
): number {
  if (!element) {
    return 0;
  }
  return Math.max(0, pageIndex) * getEBookPageStep(element);
}

function getEBookPageStep(element: HTMLElement): number {
  const pageWidth = getColumnWidth(element) || Math.max(0, element.clientWidth);
  if (pageWidth <= 0) {
    return 0;
  }
  return pageWidth + getColumnGap(element);
}

function getColumnWidth(element: HTMLElement): number {
  const value = window.getComputedStyle(element).columnWidth;
  return parseCssPixelValue(value);
}

function getColumnGap(element: HTMLElement): number {
  const value = window.getComputedStyle(element).columnGap;
  return parseCssPixelValue(value);
}

function parseCssPixelValue(value: string): number {
  if (!value || value === "normal" || value === "auto") {
    return 0;
  }
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, parsed);
}
