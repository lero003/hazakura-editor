import { describe, expect, it, vi } from "vitest";
import {
  embedAndStampPdfImages,
  preparePdfImagesForCapture,
} from "./pdfExportImages";

describe("embedAndStampPdfImages", () => {
  it("inlines path placeholders and stamps max-height on data images", async () => {
    const html =
      '<p><img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==" data-hazakura-image-path="/ws/a.png" alt="a"></p>' +
      '<p><img src="data:image/png;base64,iVBORw0KGgo=" alt="already"></p>';

    const load = vi.fn(async (path: string) => {
      expect(path).toBe("/ws/a.png");
      return "data:image/jpeg;base64,qqq";
    });

    const result = await embedAndStampPdfImages(html, load, {
      bodyMaxHeightPx: 400,
    });

    expect(result.embeddedCount).toBe(1);
    expect(result.failedPaths).toEqual([]);
    expect(result.html).toContain("data:image/jpeg;base64,qqq");
    expect(result.html).not.toContain("data-hazakura-image-path");
    expect(result.html).toMatch(/max-height:\s*400px/i);
    // Already-embedded PNG also stamped.
    expect(result.html).toContain("data:image/png;base64,iVBORw0KGgo=");
  });

  it("records failures without throwing", async () => {
    const html =
      '<img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==" data-hazakura-image-path="/missing.png" alt="x">';
    const result = await embedAndStampPdfImages(
      html,
      async () => {
        throw new Error("sandbox");
      },
      { bodyMaxHeightPx: 300 },
    );
    expect(result.embeddedCount).toBe(0);
    expect(result.failedPaths).toEqual(["/missing.png"]);
    expect(result.html).toContain('data-hazakura-image-block="load-failed"');
    expect(result.html).toContain("読めませんでした");
  });
});

describe("preparePdfImagesForCapture", () => {
  it("makes an async lazy cover eager and synchronously decoded", () => {
    const html =
      '<p><img src="data:image/png;base64,iVBORw0KGgo=" loading="lazy" decoding="async" alt="cover"></p>';

    const prepared = preparePdfImagesForCapture(html);

    expect(prepared).toContain('loading="eager"');
    expect(prepared).toContain('decoding="sync"');
    expect(prepared).not.toContain('loading="lazy"');
    expect(prepared).not.toContain('decoding="async"');
  });
});
