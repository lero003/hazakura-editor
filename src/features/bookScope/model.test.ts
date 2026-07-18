import { describe, expect, it } from "vitest";
import {
  documentBookScopeNodes,
  flattenBookScopeNodes,
  mergeBookScopeTreeSelection,
  moveBookScopeNode,
  normalizeBookScopeRelativePath,
  remapBookScopeNodePathPrefix,
  removeBookScopeNodePath,
  sanitizeBookScopeNodes,
} from "./model";

describe("Book Scope model", () => {
  it("retains existing order and appends newly selected tree entries", () => {
    expect(
      flattenBookScopeNodes(
        mergeBookScopeTreeSelection(
          documentBookScopeNodes(["b.md", "a.md"]),
          ["a.md", "chapters/c.md", "b.md", "d.md"],
        ),
      ),
    ).toEqual(["b.md", "a.md", "chapters/c.md", "d.md"]);
  });

  it("flattens a structured scope in reading order and moves only among siblings", () => {
    const nodes = [
      {
        kind: "document" as const,
        relativePath: "index.md",
        children: [
          {
            kind: "group" as const,
            title: "Works",
            children: [
              {
                kind: "document" as const,
                relativePath: "books/one/index.md",
                children: [
                  {
                    kind: "document" as const,
                    relativePath: "books/one/01.md",
                    children: [],
                  },
                  {
                    kind: "document" as const,
                    relativePath: "books/one/02.md",
                    children: [],
                  },
                ],
              },
            ],
          },
          {
            kind: "document" as const,
            relativePath: "afterword.md",
            children: [],
          },
        ],
      },
    ];

    expect(flattenBookScopeNodes(nodes)).toEqual([
      "index.md",
      "books/one/index.md",
      "books/one/01.md",
      "books/one/02.md",
      "afterword.md",
    ]);
    expect(
      flattenBookScopeNodes(moveBookScopeNode(nodes, "books/one/02.md", -1)),
    ).toEqual([
      "index.md",
      "books/one/index.md",
      "books/one/02.md",
      "books/one/01.md",
      "afterword.md",
    ]);
    expect(
      flattenBookScopeNodes(moveBookScopeNode(nodes, "books/one/index.md", 1)),
    ).toEqual(flattenBookScopeNodes(nodes));
  });

  it("remaps and removes a directory prefix without touching siblings", () => {
    const remapped = remapBookScopeNodePathPrefix(
      documentBookScopeNodes([
        "draft/a.md",
        "draft/nested/b.md",
        "drafts/c.md",
      ]),
      "draft",
      "book",
    );
    expect(flattenBookScopeNodes(remapped)).toEqual([
      "book/a.md",
      "book/nested/b.md",
      "drafts/c.md",
    ]);
    expect(
      flattenBookScopeNodes(removeBookScopeNodePath(remapped, "book", true)),
    ).toEqual(["drafts/c.md"]);
  });

  it("accepts only safe Markdown relative paths", () => {
    expect(normalizeBookScopeRelativePath("chapters/one.md")).toBe("chapters/one.md");
    expect(normalizeBookScopeRelativePath("../one.md")).toBeNull();
    expect(normalizeBookScopeRelativePath("/one.md")).toBeNull();
    expect(normalizeBookScopeRelativePath("one.txt")).toBeNull();
  });

  it("bounds and sanitizes an untrusted persisted tree", () => {
    let tooDeep: unknown = {
      kind: "document",
      relativePath: "too-deep.md",
      children: [],
    };
    for (let depth = 0; depth < 18; depth += 1) {
      tooDeep = { kind: "group", title: `Depth ${depth}`, children: [tooDeep] };
    }

    const sanitized = sanitizeBookScopeNodes([
      {
        kind: "group",
        title: "  Works  ",
        children: [
          { kind: "document", relativePath: "chapter.md", children: [] },
          { kind: "document", relativePath: "chapter.md", children: [] },
          { kind: "document", relativePath: "../escape.md", children: [] },
        ],
      },
      tooDeep,
      ...Array.from({ length: 105 }, (_, index) => ({
        kind: "document",
        relativePath: `chapters/${String(index).padStart(3, "0")}.md`,
        children: [],
      })),
    ]);

    expect(sanitized[0]).toMatchObject({ kind: "group", title: "Works" });
    expect(flattenBookScopeNodes(sanitized)).toHaveLength(100);
    expect(flattenBookScopeNodes(sanitized)[0]).toBe("chapter.md");
    expect(flattenBookScopeNodes(sanitized)).not.toContain("too-deep.md");
    expect(new Set(flattenBookScopeNodes(sanitized)).size).toBe(100);
  });
});
