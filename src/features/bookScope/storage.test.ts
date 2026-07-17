import { beforeEach, describe, expect, it } from "vitest";
import { BOOK_SCOPE_STORAGE_KEY } from "../../types";
import {
  BOOK_SCOPE_STORAGE_VERSION,
  migrateBookScopeWorkspaceRoot,
  readBookScope,
  readBookScopeRegistry,
  writeBookScope,
} from "./storage";

describe("Book Scope storage", () => {
  beforeEach(() => window.localStorage.clear());

  it("ignores corrupt or unknown schema data", () => {
    window.localStorage.setItem(BOOK_SCOPE_STORAGE_KEY, "{");
    expect(readBookScopeRegistry().workspaces).toEqual([]);
    window.localStorage.setItem(
      BOOK_SCOPE_STORAGE_KEY,
      JSON.stringify({ version: 99, workspaces: [] }),
    );
    expect(readBookScopeRegistry().workspaces).toEqual([]);
  });

  it("sanitizes paths and keeps only eight recent workspaces", () => {
    for (let index = 0; index < 10; index += 1) {
      writeBookScope(`/ws/${index}`, ["a.md", "../bad.md", "a.md"], index);
    }
    const registry = readBookScopeRegistry();
    expect(registry.version).toBe(BOOK_SCOPE_STORAGE_VERSION);
    expect(registry.workspaces).toHaveLength(8);
    expect(registry.workspaces[0].workspaceRootPath).toBe("/ws/9");
    expect(registry.workspaces[0].chapterRelativePaths).toEqual(["a.md"]);
  });

  it("migrates a scope after bookmark root resolution without overwriting a target", () => {
    writeBookScope("/old", ["chapters/a.md"], 10);
    migrateBookScopeWorkspaceRoot("/old", "/new");
    expect(readBookScope("/old")).toBeNull();
    expect(readBookScope("/new")?.chapterRelativePaths).toEqual(["chapters/a.md"]);
  });
});
