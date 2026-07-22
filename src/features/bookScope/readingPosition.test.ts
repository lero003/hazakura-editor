import { beforeEach, describe, expect, it } from "vitest";
import { BOOK_READER_POSITION_STORAGE_KEY } from "../../types";
import {
  clearBookReaderPosition,
  clampScrollRatio,
  readBookReaderPosition,
  resolveReaderDocumentIndex,
  writeBookReaderPosition,
} from "./readingPosition";

describe("book reader reading position", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("persists and restores a per-workspace chapter and scroll ratio", () => {
    writeBookReaderPosition("/ws", "chapters/two.md", 0.42);
    expect(readBookReaderPosition("/ws")).toMatchObject({
      workspaceRootPath: "/ws",
      relativePath: "chapters/two.md",
      scrollRatio: 0.42,
    });
    expect(readBookReaderPosition("/other")).toBeNull();
  });

  it("rejects unsafe paths and clamps scroll ratios", () => {
    writeBookReaderPosition("/ws", "../escape.md", 2);
    expect(readBookReaderPosition("/ws")).toBeNull();
    expect(clampScrollRatio(-0.2)).toBe(0);
    expect(clampScrollRatio(1.4)).toBe(1);
    writeBookReaderPosition("/ws", "ok.md", Number.NaN);
    expect(readBookReaderPosition("/ws")?.scrollRatio).toBe(0);
  });

  it("keeps only a bounded number of workspaces and can clear one", () => {
    for (let index = 0; index < 12; index += 1) {
      writeBookReaderPosition(`/ws-${index}`, "a.md", 0.1, index + 1);
    }
    const raw = window.localStorage.getItem(BOOK_READER_POSITION_STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw ?? "{}") as { workspaces: unknown[] };
    expect(parsed.workspaces).toHaveLength(8);
    clearBookReaderPosition("/ws-11");
    expect(readBookReaderPosition("/ws-11")).toBeNull();
    expect(readBookReaderPosition("/ws-10")?.relativePath).toBe("a.md");
  });

  it("maps a saved chapter onto the loaded document list", () => {
    const documents = [
      { relativePath: "one.md" },
      { relativePath: "two.md" },
    ];
    expect(resolveReaderDocumentIndex(documents, "two.md")).toBe(1);
    expect(resolveReaderDocumentIndex(documents, "missing.md")).toBe(0);
    expect(resolveReaderDocumentIndex([], "two.md")).toBe(0);
  });
});
