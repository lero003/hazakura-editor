import { describe, expect, it } from "vitest";
import {
  IMAGE_ZOOM_MAX,
  IMAGE_ZOOM_MIN,
  fitImageZoom,
  formatImageZoom,
  imageFormatLabel,
  nextImageZoom,
  relativeImagePath,
} from "./imageZoom";

describe("image zoom steps", () => {
  it("walks the ladder up and down", () => {
    expect(nextImageZoom(1, 1)).toBe(1.5);
    expect(nextImageZoom(1, -1)).toBe(0.67);
  });

  it("never runs past the ends of the ladder", () => {
    expect(nextImageZoom(IMAGE_ZOOM_MAX, 1)).toBe(IMAGE_ZOOM_MAX);
    expect(nextImageZoom(IMAGE_ZOOM_MIN, -1)).toBe(IMAGE_ZOOM_MIN);
  });

  it("shows the percent for the image px / CSS px definition", () => {
    expect(formatImageZoom(1)).toBe("100%");
    expect(formatImageZoom(0.33)).toBe("33%");
    expect(formatImageZoom(1.5)).toBe("150%");
  });
});

describe("fit zoom", () => {
  it("never enlarges a small image past 100%", () => {
    expect(fitImageZoom({ width: 1200, height: 800 }, { width: 320, height: 160 })).toBe(1);
  });

  it("fits a large image inside the stage and leaves the padding", () => {
    const zoom = fitImageZoom({ width: 1024, height: 624 }, { width: 1240, height: 848 });
    expect(zoom).toBeLessThan(1);
    // (1024-24)/1240 = 0.806…, (624-24)/848 = 0.707… → 高さ側が効く
    expect(zoom).toBeCloseTo((624 - 24) / 848, 6);
    expect(zoom * 1240).toBeLessThanOrEqual(1024 - 24 + 1);
  });

  it("falls back to 100% while the stage is unmeasured", () => {
    expect(fitImageZoom({ width: 0, height: 0 }, { width: 1240, height: 848 })).toBe(1);
  });

  it("keeps fit and 100% distinct positions in the ladder", () => {
    const fit = fitImageZoom({ width: 700, height: 500 }, { width: 1240, height: 848 });
    expect(formatImageZoom(fit)).not.toBe("100%");
    expect(nextImageZoom(fit, 1)).toBeGreaterThan(fit);
    expect(nextImageZoom(1, -1)).toBeLessThan(1);
  });
});

describe("image metadata from real data", () => {
  it("labels the format from the file name", () => {
    expect(imageFormatLabel("morning-sketch.png")).toBe("PNG");
    expect(imageFormatLabel("photo.JPG")).toBe("JPEG");
    expect(imageFormatLabel("art.webp")).toBe("WebP");
    expect(imageFormatLabel("diagram.svg")).toBe("SVG");
  });

  it("does not invent a format it cannot tell", () => {
    expect(imageFormatLabel("no-extension")).toBeNull();
    expect(imageFormatLabel("")).toBeNull();
  });

  it("shows a relative path only inside the workspace", () => {
    expect(relativeImagePath("/workspace/assets/a.png", "/workspace")).toBe("assets/a.png");
    expect(relativeImagePath("/workspace/assets/a.png", "/workspace/")).toBe("assets/a.png");
    expect(relativeImagePath("/elsewhere/a.png", "/workspace")).toBeNull();
    expect(relativeImagePath("/workspace/a.png", null)).toBeNull();
    expect(relativeImagePath("/workspace/a.png", "")).toBeNull();
  });
});
