import { describe, expect, it } from "vitest";
import {
  getEBookPageOffset,
  measureEBookPageCount,
  resolveEBookSpread,
} from "./ebookPagination";

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

function setRect(element: Element, left: number, width: number) {
  const rect = {
    bottom: 24,
    height: 24,
    left,
    right: left + width,
    top: 0,
    width,
    x: left,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect;
  element.getBoundingClientRect = () => rect;
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

  it("does not count the visible spread width as an extra blank page", () => {
    const flow = document.createElement("div");
    flow.style.columnWidth = "420px";
    flow.style.columnGap = "44px";
    setReadOnlyNumber(flow, "clientWidth", 884);
    setReadOnlyNumber(flow, "scrollWidth", 884);
    setRect(flow, 100, 884);

    const heading = document.createElement("h2");
    setRect(heading, 100, 320);
    flow.append(heading);

    expect(measureEBookPageCount(flow)).toBe(1);
  });
});

// 実機フィードバック⑦: 本文が1列にしか満ちない章で、見開きの器だけが広がって
// 右半分が空くのを避ける。紙を1ページ分に縮めるのは「右ページに出す物が無い」ときだけ。
describe("resolveEBookSpread", () => {
  it("shrinks the paper to one page when a single column is all the chapter uses", () => {
    expect(resolveEBookSpread({ nextChapterPreview: false, pageCount: 1 })).toBe(
      "one",
    );
  });

  it("keeps the spread when the body fills both columns", () => {
    expect(resolveEBookSpread({ nextChapterPreview: false, pageCount: 2 })).toBe(
      "two",
    );
  });

  it("keeps the spread when the next chapter opens on the facing page", () => {
    expect(resolveEBookSpread({ nextChapterPreview: true, pageCount: 1 })).toBe(
      "two",
    );
  });
});
