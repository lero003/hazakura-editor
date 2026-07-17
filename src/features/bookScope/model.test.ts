import { describe, expect, it } from "vitest";
import {
  mergeBookScopeSelection,
  moveBookScopeChapter,
  normalizeBookScopeRelativePath,
  remapBookScopePathPrefix,
  removeBookScopePath,
} from "./model";

describe("Book Scope model", () => {
  it("retains existing order and appends newly selected tree entries", () => {
    expect(
      mergeBookScopeSelection(
        ["b.md", "a.md"],
        ["a.md", "chapters/c.md", "b.md", "d.md"],
      ),
    ).toEqual(["b.md", "a.md", "chapters/c.md", "d.md"]);
  });

  it("moves only inside list boundaries", () => {
    expect(moveBookScopeChapter(["a.md", "b.md"], 1, -1)).toEqual(["b.md", "a.md"]);
    expect(moveBookScopeChapter(["a.md", "b.md"], 0, -1)).toEqual(["a.md", "b.md"]);
  });

  it("remaps and removes a directory prefix without touching siblings", () => {
    const remapped = remapBookScopePathPrefix(
      ["draft/a.md", "draft/nested/b.md", "drafts/c.md"],
      "draft",
      "book",
    );
    expect(remapped).toEqual(["book/a.md", "book/nested/b.md", "drafts/c.md"]);
    expect(removeBookScopePath(remapped, "book", true)).toEqual(["drafts/c.md"]);
  });

  it("accepts only safe Markdown relative paths", () => {
    expect(normalizeBookScopeRelativePath("chapters/one.md")).toBe("chapters/one.md");
    expect(normalizeBookScopeRelativePath("../one.md")).toBeNull();
    expect(normalizeBookScopeRelativePath("/one.md")).toBeNull();
    expect(normalizeBookScopeRelativePath("one.txt")).toBeNull();
  });
});
