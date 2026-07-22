import { describe, expect, it } from "vitest";
import {
  bookRecipeErrorMessage,
  buildBookRecipe,
  defaultBookRecipeFileName,
  parseBookRecipe,
  serializeBookRecipe,
} from "./recipe";

describe("book recipe portability", () => {
  it("round-trips a nested chapter tree without claiming OKF semantics", () => {
    const nodes = [
      {
        kind: "group" as const,
        title: "Part One",
        children: [
          {
            kind: "document" as const,
            relativePath: "parts/one.md",
            children: [],
          },
        ],
      },
      {
        kind: "document" as const,
        relativePath: "two.md",
        children: [],
      },
    ];
    const text = serializeBookRecipe(nodes);
    expect(text).toContain("hazakura-book-recipe");
    expect(text).toContain("Not an OKF standard");
    const parsed = parseBookRecipe(text);
    expect(parsed).toEqual({
      ok: true,
      nodes,
      chapterRelativePaths: ["parts/one.md", "two.md"],
    });
    expect(buildBookRecipe(nodes).version).toBe(1);
  });

  it("accepts a flat hand-authored chapterRelativePaths list", () => {
    const parsed = parseBookRecipe(
      JSON.stringify({
        format: "hazakura-book-recipe",
        version: 1,
        chapterRelativePaths: ["a.md", "../escape.md", "b.md", "a.md"],
      }),
    );
    expect(parsed).toEqual({
      ok: true,
      nodes: [
        { kind: "document", relativePath: "a.md", children: [] },
        { kind: "document", relativePath: "b.md", children: [] },
      ],
      chapterRelativePaths: ["a.md", "b.md"],
    });
  });

  it("rejects unknown formats, empty lists, and invalid JSON", () => {
    expect(parseBookRecipe("{").ok).toBe(false);
    expect(
      parseBookRecipe(
        JSON.stringify({ format: "other", version: 1, nodes: [] }),
      ),
    ).toMatchObject({ ok: false, error: "unknown-format" });
    expect(
      parseBookRecipe(
        JSON.stringify({
          format: "hazakura-book-recipe",
          version: 1,
          nodes: [],
        }),
      ),
    ).toMatchObject({ ok: false, error: "empty-recipe" });
    expect(bookRecipeErrorMessage("empty-recipe", "ja")).toContain("Markdown");
    expect(defaultBookRecipeFileName("My Book!")).toBe(
      "My-Book.hazakura-book.json",
    );
  });
});
