import { describe, expect, it, vi } from "vitest";
import { loadBookScopeReaderDocuments } from "./reader";

const chapters = [
  { name: "one.md", path: "/workspace/one.md", relativePath: "one.md" },
  { name: "two.md", path: "/workspace/two.md", relativePath: "two.md" },
];

describe("Book Scope reader loading", () => {
  it("preserves scope order and prefers live tab buffers over disk", async () => {
    const openTextFile = vi.fn(async (path: string) => ({
      contents: path.endsWith("two.md") ? "# Two from disk\n" : "# One from disk\n",
      size: 16,
    }));
    const result = await loadBookScopeReaderDocuments({
      chapters,
      tabs: [{ path: "/workspace/one.md", contents: "# One dirty\n" }],
      openTextFile,
    });

    expect(result.documents.map((document) => document.relativePath)).toEqual([
      "one.md",
      "two.md",
    ]);
    expect(result.documents[0]?.source).toBe("# One dirty\n");
    expect(result.documents[0]?.usesLiveBuffer).toBe(true);
    expect(openTextFile).toHaveBeenCalledTimes(1);
    expect(openTextFile).toHaveBeenCalledWith("/workspace/two.md");
  });

  it("reports read failures and stops before the total byte budget", async () => {
    const openTextFile = vi.fn(async (path: string) => {
      if (path.endsWith("one.md")) throw new Error("missing");
      return { contents: "123456", size: 6 };
    });
    const result = await loadBookScopeReaderDocuments({
      chapters,
      maxTotalBytes: 5,
      openTextFile,
      tabs: [],
    });

    expect(result.documents).toEqual([]);
    expect(result.failures).toEqual([
      { relativePath: "one.md", reason: "missing" },
    ]);
    expect(result.skippedForBudget).toEqual(["two.md"]);
    expect(result.truncated).toBe(true);
  });
});
