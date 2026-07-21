import { describe, expect, it, vi } from "vitest";
import {
  loadBookScopeReaderDocuments,
  searchBookScopeReaderDocuments,
} from "./reader";

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

  it("matches live buffers by workspace-relative path when absolute paths differ", async () => {
    const openTextFile = vi.fn(async () => ({
      contents: "# from disk\n",
      size: 12,
    }));
    const result = await loadBookScopeReaderDocuments({
      chapters: [
        {
          name: "one.md",
          // Canonical chapter path from Rust resolve
          path: "/private/var/folders/ws/one.md",
          relativePath: "one.md",
        },
      ],
      tabs: [
        // Tab path as returned from open without full canonicalize
        { path: "/var/folders/ws/one.md", contents: "# dirty via relative match\n" },
      ],
      openTextFile,
      workspaceRoot: "/var/folders/ws",
    });

    // Absolute forms differ and relative match needs a shared root form.
    // Prefer relative match when the tab root matches workspaceRoot.
    expect(result.documents[0]?.source).toBe("# dirty via relative match\n");
    expect(result.documents[0]?.usesLiveBuffer).toBe(true);
    expect(openTextFile).not.toHaveBeenCalled();
  });

  it("matches live buffers when only Unicode normalization differs", async () => {
    const openTextFile = vi.fn(async () => ({ contents: "# disk\n", size: 6 }));
    // "が" as NFC vs NFD
    const nfcName = "が.md";
    const nfdName = "か\u3099.md";
    const result = await loadBookScopeReaderDocuments({
      chapters: [
        {
          name: nfcName,
          path: `/workspace/${nfcName}`,
          relativePath: nfcName,
        },
      ],
      tabs: [{ path: `/workspace/${nfdName}`, contents: "# dirty nfd tab\n" }],
      openTextFile,
      workspaceRoot: "/workspace",
    });

    expect(result.documents[0]?.source).toBe("# dirty nfd tab\n");
    expect(result.documents[0]?.usesLiveBuffer).toBe(true);
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

describe("Book Scope reader search", () => {
  const documents = [
    {
      name: "第一章.md",
      path: "/workspace/第一章.md",
      relativePath: "第一章.md",
      source: "---\ntitle: 秘密の題\n---\n# 朝\n\n桜を二度見た。桜。\n",
      usesLiveBuffer: false,
    },
    {
      name: "Cafe.md",
      path: "/workspace/Cafe.md",
      relativePath: "Cafe.md",
      source: "# ＣＡＦＥ\n\n午後の本文。\n",
      usesLiveBuffer: true,
    },
  ];

  it("searches only visible names and Markdown with normalized case-insensitive text", () => {
    expect(searchBookScopeReaderDocuments(documents, "桜")).toEqual([
      { documentIndex: 0, occurrenceCount: 2 },
    ]);
    expect(searchBookScopeReaderDocuments(documents, "cafe")).toEqual([
      { documentIndex: 1, occurrenceCount: 2 },
    ]);
    expect(searchBookScopeReaderDocuments(documents, "秘密の題")).toEqual([]);
  });

  it("returns no matches for an empty or whitespace-only query", () => {
    expect(searchBookScopeReaderDocuments(documents, "")).toEqual([]);
    expect(searchBookScopeReaderDocuments(documents, "  \n ")).toEqual([]);
  });
});
