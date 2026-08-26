import { describe, expect, it } from "vitest";
import {
  applyCachedPreviewImages,
  applyPreviewSelectionAutoScroll,
  isPreviewSelectionGesture,
  isPreviewUserSelecting,
  PREVIEW_SELECTING_ATTR,
  previewSelectionScrollDelta,
  rememberResolvedPreviewImage,
  setPreviewSelecting,
} from "./previewPaintStability";

describe("preview paint stability", () => {
  it("reports an active text selection inside the Preview host", () => {
    const host = document.createElement("article");
    const paragraph = document.createElement("p");
    paragraph.textContent = "Select this sentence.";
    host.append(paragraph);
    document.body.append(host);

    const range = document.createRange();
    range.selectNodeContents(paragraph);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    expect(isPreviewUserSelecting(host)).toBe(true);

    selection?.removeAllRanges();
    expect(isPreviewUserSelecting(host)).toBe(false);
    host.remove();
  });

  it("ignores selections that live outside the Preview host", () => {
    const host = document.createElement("article");
    host.append(document.createTextNode("Preview"));
    const outside = document.createElement("p");
    outside.textContent = "Editor";
    document.body.append(host, outside);

    const range = document.createRange();
    range.selectNodeContents(outside);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    expect(isPreviewUserSelecting(host)).toBe(false);

    selection?.removeAllRanges();
    host.remove();
    outside.remove();
  });

  it("reapplies cached data URLs onto placeholder images without rewriting other nodes", () => {
    const host = document.createElement("article");
    const paragraph = document.createElement("p");
    paragraph.textContent = "Keep me.";
    const image = document.createElement("img");
    image.setAttribute("data-hazakura-image-path", "/workspace/cover.png");
    image.setAttribute("loading", "lazy");
    host.append(paragraph, image);

    const cache = new Map<string, string>();
    rememberResolvedPreviewImage(
      cache,
      "/workspace/cover.png",
      "data:image/png;base64,COVER",
    );

    expect(applyCachedPreviewImages(host, cache)).toBe(1);
    expect(image.getAttribute("src")).toBe("data:image/png;base64,COVER");
    expect(image.hasAttribute("data-hazakura-image-path")).toBe(false);
    expect(image.hasAttribute("loading")).toBe(false);
    expect(host.querySelector("p")).toBe(paragraph);
  });

  it("treats an in-progress Preview pointer gesture as selecting before a range exists", () => {
    const host = document.createElement("div");
    expect(isPreviewSelectionGesture(host)).toBe(false);
    setPreviewSelecting(host, true);
    expect(host.hasAttribute(PREVIEW_SELECTING_ATTR)).toBe(true);
    expect(isPreviewSelectionGesture(host)).toBe(true);
    setPreviewSelecting(host, false);
    expect(isPreviewSelectionGesture(host)).toBe(false);
  });

  it("scrolls a Preview scroller when the pointer sits on the viewport edge", () => {
    expect(
      previewSelectionScrollDelta({ top: 0, bottom: 400 }, 200),
    ).toBe(0);
    expect(
      previewSelectionScrollDelta({ top: 0, bottom: 400 }, 8),
    ).toBeLessThan(0);
    expect(
      previewSelectionScrollDelta({ top: 0, bottom: 400 }, 392),
    ).toBeGreaterThan(0);

    const scroller = document.createElement("div");
    Object.defineProperty(scroller, "clientHeight", {
      configurable: true,
      value: 200,
    });
    Object.defineProperty(scroller, "scrollHeight", {
      configurable: true,
      value: 1200,
    });
    scroller.scrollTop = 80;
    scroller.getBoundingClientRect = () =>
      ({
        top: 0,
        bottom: 200,
        left: 0,
        right: 300,
        width: 300,
        height: 200,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;

    expect(applyPreviewSelectionAutoScroll(scroller, 100)).toBe(0);
    expect(scroller.scrollTop).toBe(80);
    expect(applyPreviewSelectionAutoScroll(scroller, 196)).toBeGreaterThan(0);
    expect(scroller.scrollTop).toBeGreaterThan(80);
  });
});
