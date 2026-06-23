import { describe, expect, it } from "vitest";
import { getEBookPageOffset, measureEBookPageCount } from "./ebookPagination";

function setReadOnlyNumber(
  element: HTMLElement,
  property: "clientWidth" | "scrollWidth",
  value: number,
) {
  Object.defineProperty(element, property, {
    configurable: true,
    value,
  });
}

describe("ebookPagination", () => {
  it("uses the CSS column width as the page step when a spread viewport is wider than one page", () => {
    const flow = document.createElement("div");
    flow.style.columnWidth = "420px";
    flow.style.columnGap = "40px";
    setReadOnlyNumber(flow, "clientWidth", 880);
    setReadOnlyNumber(flow, "scrollWidth", 1800);

    expect(getEBookPageOffset(1, flow)).toBe(460);
    expect(measureEBookPageCount(flow)).toBe(4);
  });

  it("uses the actual single-page column width when the viewport is wider than the ideal column width", () => {
    const flow = document.createElement("div");
    flow.style.columnWidth = "420px";
    flow.style.columnGap = "44px";
    setReadOnlyNumber(flow, "clientWidth", 620);
    setReadOnlyNumber(flow, "scrollWidth", 1950);

    expect(getEBookPageOffset(1, flow)).toBe(664);
    expect(measureEBookPageCount(flow)).toBe(4);
  });
});
