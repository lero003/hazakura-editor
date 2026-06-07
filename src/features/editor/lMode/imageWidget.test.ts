import { describe, expect, it } from "vitest";
import {
  classifyImageUrl,
  LModeImageWidget,
  __test__ as widgetInternals,
} from "./imageWidget";

describe("classifyImageUrl", () => {
  it("returns http for http(s) URLs", () => {
    expect(classifyImageUrl("http://example.com/foo.png", null, "/ws")).toEqual({
      kind: "http",
      value: "http://example.com/foo.png",
    });
    expect(classifyImageUrl("https://example.com/foo.png", null, "/ws")).toEqual({
      kind: "http",
      value: "https://example.com/foo.png",
    });
  });

  it("returns data for supported data:image URLs", () => {
    const data = "data:image/png;base64,iVBORw0KGgo=";
    expect(classifyImageUrl(data, null, "/ws")).toEqual({
      kind: "data",
      value: data,
    });
    const jpeg = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==";
    expect(classifyImageUrl(jpeg, null, "/ws")).toEqual({
      kind: "data",
      value: jpeg,
    });
  });

  it("rejects non-preview-safe data URLs", () => {
    expect(
      classifyImageUrl("data:text/html,<script></script>", null, "/ws"),
    ).toEqual({
      kind: "outside",
      value: "data:text/html,<script></script>",
    });
    expect(
      classifyImageUrl("data:image/svg+xml,<svg></svg>", null, "/ws"),
    ).toEqual({
      kind: "outside",
      value: "data:image/svg+xml,<svg></svg>",
    });
    expect(classifyImageUrl("javascript:alert(1)", null, "/ws")).toEqual({
      kind: "outside",
      value: "javascript:alert(1)",
    });
  });

  it("returns outside when there is no workspace root and the URL is not http/data", () => {
    // Without a workspace, anything other than http(s) and
    // data: cannot be resolved. The classifier must not try.
    expect(classifyImageUrl("./foo.png", null, null)).toEqual({
      kind: "outside",
      value: "./foo.png",
    });
    expect(classifyImageUrl("/abs/foo.png", null, null)).toEqual({
      kind: "outside",
      value: "/abs/foo.png",
    });
  });

  it("resolves absolute paths under the workspace root as workspace", () => {
    expect(
      classifyImageUrl("/ws/assets/foo.png", null, "/ws"),
    ).toEqual({
      kind: "workspace",
      value: "/ws/assets/foo.png",
    });
    // The root itself counts as workspace.
    expect(classifyImageUrl("/ws", null, "/ws")).toEqual({
      kind: "workspace",
      value: "/ws",
    });
  });

  it("rejects absolute paths outside the workspace as outside", () => {
    expect(
      classifyImageUrl("/other/foo.png", null, "/ws"),
    ).toEqual({
      kind: "outside",
      value: "/other/foo.png",
    });
    // A sibling workspace must not be considered the same root.
    expect(
      classifyImageUrl("/ws-other/foo.png", null, "/ws"),
    ).toEqual({
      kind: "outside",
      value: "/ws-other/foo.png",
    });
  });

  it("resolves relative paths against the document directory", () => {
    // The document is at /ws/notes/today.md. `./figure.png`
    // should resolve to /ws/notes/figure.png (under the
    // workspace root → workspace).
    expect(
      classifyImageUrl(
        "./figure.png",
        "/ws/notes/today.md",
        "/ws",
      ),
    ).toEqual({
      kind: "workspace",
      value: "/ws/notes/figure.png",
    });
  });

  it("resolves relative paths against the workspace root when there is no document path", () => {
    expect(
      classifyImageUrl("assets/foo.png", null, "/ws"),
    ).toEqual({
      kind: "workspace",
      value: "/ws/assets/foo.png",
    });
  });

  it("resolves README image paths against the document directory", () => {
    expect(
      classifyImageUrl(
        "docs/images/v0.11-l-mode.png",
        "/ws/README.md",
        "/ws",
      ),
    ).toEqual({
      kind: "workspace",
      value: "/ws/docs/images/v0.11-l-mode.png",
    });
  });

  it("normalizes .. segments and rejects escapes from the workspace", () => {
    // `..` is collapsed. From /ws/notes, ../assets → /ws/assets
    // (still under the workspace → workspace).
    expect(
      classifyImageUrl(
        "../assets/foo.png",
        "/ws/notes/today.md",
        "/ws",
      ),
    ).toEqual({
      kind: "workspace",
      value: "/ws/assets/foo.png",
    });
    // A double-`..` that escapes the workspace is rejected.
    expect(
      classifyImageUrl(
        "../../etc/passwd",
        "/ws/notes/today.md",
        "/ws",
      ),
    ).toEqual({
      kind: "outside",
      value: "../../etc/passwd",
    });
  });

  it("rejects relative paths that resolve outside the workspace", () => {
    // The document is at the workspace root. `../outside.png`
    // resolves to /outside.png → not under /ws → outside.
    expect(
      classifyImageUrl(
        "../outside.png",
        "/ws/today.md",
        "/ws",
      ),
    ).toEqual({
      kind: "outside",
      value: "../outside.png",
    });
  });

  it("strips trailing slashes from the workspace root for the boundary check", () => {
    // The caller may pass the workspace root with or without a
    // trailing slash. The classifier must treat both forms
    // identically.
    expect(
      classifyImageUrl("/ws/assets/foo.png", null, "/ws/"),
    ).toEqual({
      kind: "workspace",
      value: "/ws/assets/foo.png",
    });
  });
});

describe("LModeImageWidget.eq", () => {
  function w(rawUrl: string, resolvedSrc: string | null | undefined, alt: string) {
    return new LModeImageWidget(rawUrl, resolvedSrc, alt);
  }

  it("returns true when rawUrl, resolvedSrc, and alt all match", () => {
    const a = w("./foo.png", "data:image/png;base64,AAA", "figure");
    const b = w("./foo.png", "data:image/png;base64,AAA", "figure");
    expect(a.eq(b)).toBe(true);
  });

  it("returns true when both are still-pending placeholders", () => {
    // Two widgets for the same image, both with the same
    // `undefined` resolvedSrc — equal so the editor does not
    // re-create the widget on the next paint frame.
    const a = w("./foo.png", undefined, "figure");
    const b = w("./foo.png", undefined, "figure");
    expect(a.eq(b)).toBe(true);
  });

  it("returns false when rawUrl differs", () => {
    const a = w("./foo.png", "data:...", "figure");
    const b = w("./bar.png", "data:...", "figure");
    expect(a.eq(b)).toBe(false);
  });

  it("returns false when resolvedSrc differs (placeholder vs loaded)", () => {
    const a = w("./foo.png", undefined, "figure");
    const b = w("./foo.png", "data:image/png;base64,AAA", "figure");
    expect(a.eq(b)).toBe(false);
  });

  it("returns false when alt differs", () => {
    const a = w("./foo.png", "data:...", "figure A");
    const b = w("./foo.png", "data:...", "figure B");
    expect(a.eq(b)).toBe(false);
  });
});

describe("POSIX path utilities", () => {
  // The classifier runs in the Tauri WebView where the Node
  // `path` module is not available; the implementations are
  // inline. These cases pin the behavior so a future refactor
  // does not silently regress the workspace-traversal guard.
  it("isAbsolutePosix recognizes leading-slash paths", () => {
    expect(widgetInternals.isAbsolutePosix("/")).toBe(true);
    expect(widgetInternals.isAbsolutePosix("/foo")).toBe(true);
    expect(widgetInternals.isAbsolutePosix("foo")).toBe(false);
    expect(widgetInternals.isAbsolutePosix("./foo")).toBe(false);
    expect(widgetInternals.isAbsolutePosix("../foo")).toBe(false);
  });

  it("dirnamePosix returns the parent directory", () => {
    expect(widgetInternals.dirnamePosix("/a/b/c.md")).toBe("/a/b");
    expect(widgetInternals.dirnamePosix("/a.md")).toBe("/");
    expect(widgetInternals.dirnamePosix("a.md")).toBe("");
  });

  it("resolvePosix joins, normalizes, and collapses .. segments", () => {
    expect(widgetInternals.resolvePosix("/a", "b")).toBe("/a/b");
    expect(widgetInternals.resolvePosix("/a", "./b")).toBe("/a/b");
    expect(widgetInternals.resolvePosix("/a", "../b")).toBe("/b");
    expect(widgetInternals.resolvePosix("/a/b", "../../c")).toBe("/c");
    // A base with a trailing slash must not produce a double
    // slash in the middle of the result.
    expect(widgetInternals.resolvePosix("/a/", "b")).toBe("/a/b");
  });
});

describe("image resolution cache key", () => {
  it("does not collide when root or image paths contain spaces", () => {
    const first = widgetInternals.cacheKey("/ws a", "/img.png");
    const second = widgetInternals.cacheKey("/ws", "a /img.png");
    expect(first).not.toBe(second);
  });

  it("keeps the same root/path pair stable", () => {
    expect(widgetInternals.cacheKey("/ws a", "/img.png")).toBe(
      widgetInternals.cacheKey("/ws a", "/img.png"),
    );
  });
});
