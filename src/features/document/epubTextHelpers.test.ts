import { describe, expect, it } from "vitest";
import {
  escapeXml,
  extensionFromMediaType,
  normalizeImageMediaType,
  slugify,
  stripYamlFrontmatter,
  titleFromDocumentName,
} from "./epubTextHelpers";

describe("slugify", () => {
  it("lowercases ASCII text and joins words with hyphens", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("keeps hiragana, katakana, and kanji characters", () => {
    expect(slugify("第一章　始まり")).toBe("第一章-始まり");
  });

  it("collapses runs of non-word characters into a single hyphen", () => {
    expect(slugify("a!!!b   c")).toBe("a-b-c");
  });

  it("strips leading and trailing hyphens", () => {
    expect(slugify("---hello---")).toBe("hello");
  });

  it("returns an empty string when the text has no word characters", () => {
    expect(slugify("!!! ???")).toBe("");
  });

  it("trims surrounding whitespace before slugifying", () => {
    expect(slugify("  見出し  ")).toBe("見出し");
  });
});

describe("titleFromDocumentName", () => {
  it("strips a single file extension", () => {
    expect(titleFromDocumentName("manuscript.md")).toBe("manuscript");
  });

  it("falls back to Untitled when only an extension remains", () => {
    expect(titleFromDocumentName(".md")).toBe("Untitled");
  });

  it("falls back to Untitled for an empty name", () => {
    expect(titleFromDocumentName("")).toBe("Untitled");
  });

  it("keeps dots that are not the final extension", () => {
    expect(titleFromDocumentName("v1.2.notes.txt")).toBe("v1.2.notes");
  });

  it("returns a name without an extension unchanged", () => {
    expect(titleFromDocumentName("原稿")).toBe("原稿");
  });
});

describe("escapeXml", () => {
  it("escapes the five XML special characters", () => {
    expect(escapeXml(`<a href="x">&'b'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp;&apos;b&apos;&lt;/a&gt;",
    );
  });

  it("leaves plain text unchanged", () => {
    expect(escapeXml("本文")).toBe("本文");
  });

  it("escapes an ampersand first to avoid double-escaping", () => {
    expect(escapeXml("&lt;")).toBe("&amp;lt;");
  });
});

describe("stripYamlFrontmatter", () => {
  it("removes a well-formed frontmatter block and returns the body", () => {
    expect(stripYamlFrontmatter("---\ntitle: Test\n---\n本文")).toBe("本文");
  });

  it("returns the markdown unchanged when the first line is not ---", () => {
    expect(stripYamlFrontmatter("# 見出し\n本文")).toBe("# 見出し\n本文");
  });

  it("returns the original markdown when no closing delimiter is found", () => {
    expect(stripYamlFrontmatter("---\ntitle: Test\n本文")).toBe(
      "---\ntitle: Test\n本文",
    );
  });

  it("handles a frontmatter block at the end with no trailing content", () => {
    expect(stripYamlFrontmatter("---\ntitle: Test\n---\n")).toBe("");
  });

  it("does not treat a --- inside the body as a closer", () => {
    // Only the first --- block is stripped; a later --- stays in the body.
    expect(stripYamlFrontmatter("---\na: 1\n---\n---\n本文")).toBe(
      "---\n本文",
    );
  });

  it("returns the markdown unchanged for a single-line source", () => {
    expect(stripYamlFrontmatter("本文")).toBe("本文");
  });
});

describe("normalizeImageMediaType", () => {
  it("maps image/jpg to the canonical image/jpeg", () => {
    expect(normalizeImageMediaType("image/jpg")).toBe("image/jpeg");
  });

  it("lowercases other media types", () => {
    expect(normalizeImageMediaType("IMAGE/PNG")).toBe("image/png");
  });

  it("leaves already-canonical types unchanged", () => {
    expect(normalizeImageMediaType("image/jpeg")).toBe("image/jpeg");
    expect(normalizeImageMediaType("image/webp")).toBe("image/webp");
  });
});

describe("extensionFromMediaType", () => {
  it("maps jpeg and jpg to jpg", () => {
    expect(extensionFromMediaType("image/jpeg")).toBe("jpg");
    expect(extensionFromMediaType("image/jpg")).toBe("jpg");
  });

  it("maps gif, webp, and png", () => {
    expect(extensionFromMediaType("image/gif")).toBe("gif");
    expect(extensionFromMediaType("image/webp")).toBe("webp");
    expect(extensionFromMediaType("image/png")).toBe("png");
  });

  it("defaults to png for an unknown media type", () => {
    expect(extensionFromMediaType("image/avif")).toBe("png");
    expect(extensionFromMediaType("application/octet-stream")).toBe("png");
  });

  it("is case-insensitive", () => {
    expect(extensionFromMediaType("IMAGE/JPEG")).toBe("jpg");
  });
});
