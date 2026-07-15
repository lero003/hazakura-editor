import { describe, expect, it } from "vitest";
import {
  analyzeBodyLinks,
  classifyOkfInlineLink,
  extractInlineMarkdownLinks,
  extractInlineMarkdownLinksBounded,
  maskCodeRegions,
} from "./okfLinks";

describe("extractInlineMarkdownLinks", () => {
  it("finds standard inline links and skips images", () => {
    const body =
      "See [a](./a.md) and ![img](./x.png) plus [b](/b.md \"title\").";
    const links = extractInlineMarkdownLinks(body);
    expect(links.map((link) => link.destination)).toEqual([
      "./a.md",
      "/b.md",
    ]);
  });

  it("skips fenced and inline code, and supports balanced parentheses", () => {
    const body = [
      "Real [ok](./ok.md).",
      "",
      "```md",
      "[fake](./fake.md)",
      "```",
      "",
      "   ```md",
      "[indented-fake](./indented.md)",
      "   ```",
      "",
      "Inline ` [also](./nope.md) ` stays quiet.",
      "",
      "Nested [path](./dir_(x)/file.md).",
    ].join("\n");
    const links = extractInlineMarkdownLinks(body);
    expect(links.map((link) => link.destination)).toEqual([
      "./ok.md",
      "./dir_(x)/file.md",
    ]);
  });

  it("skips escaped link openers", () => {
    const body = "Not a link \\[text](./no.md) but [yes](./yes.md).";
    const links = extractInlineMarkdownLinks(body);
    expect(links.map((link) => link.destination)).toEqual(["./yes.md"]);
  });

  it("stops malformed bracket and backtick runs at a linear work budget", () => {
    const malformed = `${"[".repeat(20_000)}${"`x".repeat(20_000)}`;
    const result = extractInlineMarkdownLinksBounded(malformed, 500);

    expect(result.truncated).toBe(true);
    expect(result.links).toEqual([]);
  });
});

describe("maskCodeRegions", () => {
  it("preserves offsets by blanking code without removing newlines", () => {
    const source = "a\n```\n[x](y)\n```\nb";
    const masked = maskCodeRegions(source);
    expect(masked.length).toBe(source.length);
    expect(masked).toContain("\n");
    expect(masked).not.toContain("[x](y)");
  });
});

describe("classifyOkfInlineLink", () => {
  const context = {
    sourceRelativePath: "dir/source.md",
    knownFiles: new Set([
      "dir/source.md",
      "dir/peer.md",
      "root.md",
      "section/index.md",
      "section/item.md",
    ]),
    knownDirectories: new Set(["", "dir", "section"]),
  };

  it("resolves relative, root-absolute, extensionless, and directory targets", () => {
    expect(classifyOkfInlineLink("./peer.md", context)).toMatchObject({
      kind: "internal",
      broken: false,
      targetRelativePath: "dir/peer.md",
    });
    expect(classifyOkfInlineLink("/root.md", context)).toMatchObject({
      kind: "internal",
      broken: false,
      targetRelativePath: "root.md",
    });
    expect(
      classifyOkfInlineLink("./section/item", {
        ...context,
        sourceRelativePath: "source.md",
        knownFiles: new Set([
          "source.md",
          "section/index.md",
          "section/item.md",
        ]),
        knownDirectories: new Set(["", "section"]),
      }),
    ).toMatchObject({
      kind: "internal",
      broken: false,
      targetRelativePath: "section/item.md",
    });
    expect(
      classifyOkfInlineLink("./section/", {
        ...context,
        sourceRelativePath: "source.md",
        knownFiles: new Set(["source.md", "section/index.md"]),
        knownDirectories: new Set(["", "section"]),
      }),
    ).toMatchObject({
      kind: "internal",
      broken: false,
    });
  });

  it("treats fragment-only links as internal to the source file", () => {
    expect(classifyOkfInlineLink("#section", context)).toMatchObject({
      kind: "internal",
      broken: false,
      targetRelativePath: "dir/source.md",
    });
  });

  it("marks missing targets broken and escapes out-of-scope", () => {
    expect(classifyOkfInlineLink("./missing.md", context).broken).toBe(true);
    expect(classifyOkfInlineLink("../../outside.md", context)).toMatchObject({
      kind: "out-of-scope",
      broken: false,
    });
  });

  it("classifies external and unsupported schemes", () => {
    expect(classifyOkfInlineLink("https://example.com", context).kind).toBe(
      "external",
    );
    expect(classifyOkfInlineLink("mailto:a@b.c", context).kind).toBe(
      "external",
    );
    expect(classifyOkfInlineLink("javascript:alert(1)", context).kind).toBe(
      "unsupported",
    );
    expect(classifyOkfInlineLink("C:\\\\Windows\\\\x.md", context).kind).toBe(
      "unsupported",
    );
  });

  it("ignores query and fragment for existence", () => {
    expect(
      classifyOkfInlineLink("./peer.md#section?x=1", context),
    ).toMatchObject({
      kind: "internal",
      broken: false,
      targetRelativePath: "dir/peer.md",
    });
  });
});

describe("analyzeBodyLinks", () => {
  it("returns classified links with offsets", () => {
    const body = "Go [there](./peer.md) now.";
    const links = analyzeBodyLinks(body, {
      sourceRelativePath: "dir/source.md",
      knownFiles: new Set(["dir/source.md", "dir/peer.md"]),
      knownDirectories: new Set(["", "dir"]),
    });
    expect(links).toHaveLength(1);
    expect(links[0]?.broken).toBe(false);
    expect(links[0]?.sourceOffset).toBe(body.indexOf("[there]"));
  });
});
