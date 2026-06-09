import { describe, expect, it } from "vitest";
import { inlineWorkspaceAssetImages, renderMarkdown } from "./markdown";

describe("renderMarkdown image policy", () => {
  it("allows README-relative workspace images outside assets", () => {
    const html = renderMarkdown("![shot](docs/images/shot.png)", {
      documentPath: "/ws/README.md",
      workspaceRoot: "/ws",
    });

    expect(html).toContain('data-hazakura-image-path="/ws/docs/images/shot.png"');
    expect(html).not.toContain("Image blocked");
  });

  it("keeps existing assets image references allowed", () => {
    const html = renderMarkdown("![asset](assets/pic.png)", {
      documentPath: "/ws/README.md",
      workspaceRoot: "/ws",
    });

    expect(html).toContain('data-hazakura-image-path="/ws/assets/pic.png"');
    expect(html).not.toContain("Image blocked");
  });

  it("allows README raw HTML image tags inside the workspace", () => {
    const html = renderMarkdown(
      '<img src="src/assets/hazakura-mark.png" alt="logo" width="128">',
      {
        documentPath: "/ws/README.md",
        workspaceRoot: "/ws",
      },
    );

    expect(html).toContain(
      'data-hazakura-image-path="/ws/src/assets/hazakura-mark.png"',
    );
    expect(html).toContain('alt="logo"');
    expect(html).not.toContain("Image blocked");
  });

  it("inlines workspace image placeholders through the preview loader", async () => {
    const html = renderMarkdown("![shot](docs/images/shot.png)", {
      documentPath: "/ws/README.md",
      workspaceRoot: "/ws",
    });

    const inlined = await inlineWorkspaceAssetImages(html, async (path) => {
      expect(path).toBe("/ws/docs/images/shot.png");
      return "data:image/png;base64,iVBORw0KGgo=";
    });

    expect(inlined).toContain('src="data:image/png;base64,iVBORw0KGgo="');
    expect(inlined).not.toContain("data-hazakura-image-path");
  });

  it("resolves nested document-relative images inside the workspace", () => {
    const html = renderMarkdown("![figure](../docs/images/figure%201.png)", {
      documentPath: "/ws/notes/today.md",
      workspaceRoot: "/ws",
    });

    expect(html).toContain('data-hazakura-image-path="/ws/docs/images/figure 1.png"');
    expect(html).not.toContain("Image blocked");
  });

  it("blocks relative images that escape the workspace", () => {
    const html = renderMarkdown("![secret](../outside.png)", {
      documentPath: "/ws/README.md",
      workspaceRoot: "/ws",
    });

    expect(html).toContain("Image blocked: secret");
    expect(html).not.toContain("data-hazakura-image-path");
  });

  it("continues to block external images", () => {
    const html = renderMarkdown("![remote](https://example.com/shot.png)", {
      documentPath: "/ws/README.md",
      workspaceRoot: "/ws",
    });

    expect(html).toContain("Image blocked: remote");
    expect(html).not.toContain("https://example.com/shot.png");
  });
});

// v0.17 app-store-quality: markdown-preview-export-security slice 2.1
// — script execution vectors in Markdown preview and HTML export.
// Both preview and export share the same `renderMarkdown` pipeline
// (marked → image/table policy → DOMPurify.sanitize), so a single
// test surface covers both. The tests below pin three script-
// execution vectors: inline `<script>` tags, event-handler
// attributes on raw-HTML elements, and `javascript:` URIs in
// Markdown link/image targets. The final test asserts that
// `renderMarkdown` never mutates the source string — the
// Markdown source is canonical, and sanitization happens only
// in the rendered tree.
//
// DOMPurify with `USE_PROFILES: { html: true }` already rejects
// all event handlers and dangerous tags by default; the explicit
// `FORBID_TAGS` / `FORBID_ATTR` lists in the config are defense-
// in-depth. The `ALLOWED_URI_REGEXP` rejects any URI scheme that
// is not http/https/mailto/tel/etc., including `javascript:`.

describe("renderMarkdown sanitization", () => {
  it("strips inline script tags from Markdown raw HTML", () => {
    const html = renderMarkdown('<script>alert("xss")</script>\n\nHello');

    expect(html).not.toContain("<script");
    expect(html).not.toContain("alert");
    // Non-script content must pass through.
    expect(html).toContain("Hello");
  });

  it("strips event-handler attributes from inline HTML elements", () => {
    // Use `<span>` rather than `<img>` so the assertion
    // is against DOMPurify's attribute removal, not a
    // side effect of `applyImagePreviewPolicy` replacing
    // the image node before DOMPurify runs. A `<span>`
    // survives both the image and table policies, so any
    // disappearance of `onclick` / `onmouseover` is
    // solely DOMPurify's work.
    const html = renderMarkdown(
      '<span onclick="alert(1)" onmouseover="boom()">keep</span>',
    );

    expect(html).not.toContain("onclick");
    expect(html).not.toContain("onmouseover");
    expect(html).not.toContain("alert(1)");
    expect(html).not.toContain("boom()");
    // The element and its text content must survive —
    // only the dangerous attributes are stripped.
    expect(html).toContain("<span");
    expect(html).toContain("keep");
  });

  it("removes javascript: URLs from Markdown link targets", () => {
    const html = renderMarkdown("[click me](javascript:alert(1))");

    expect(html).not.toContain("javascript:");
    // The link text must survive; only the dangerous href
    // is removed.
    expect(html).toContain("click me");
  });

  it("removes javascript: URLs from Markdown image sources", () => {
    const html = renderMarkdown(
      "![xss](javascript:alert(document.cookie))",
    );

    expect(html).not.toContain("javascript:");
    // The alt text should remain as the blocked-image
    // message or a replacement node — not as a passive
    // `<img src="...">`.
    expect(html).not.toContain('<img src="javascript');
  });

  it("does not mutate the source Markdown string", () => {
    const source = '<script>alert("xss")</script>\n\nHello';
    const snapshot = source.slice();

    renderMarkdown(source);

    expect(source).toBe(snapshot);
  });
});
