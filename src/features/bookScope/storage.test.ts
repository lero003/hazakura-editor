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

  it("reads version 1 flat scopes as version 2 root document nodes", () => {
    window.localStorage.setItem(
      BOOK_SCOPE_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        workspaces: [
          {
            workspaceRootPath: "/legacy",
            chapterRelativePaths: ["index.md", "chapters/one.md"],
            updatedAt: 10,
          },
        ],
      }),
    );

    const scope = readBookScope("/legacy");
    expect(scope?.chapterRelativePaths).toEqual(["index.md", "chapters/one.md"]);
    expect(scope?.nodes).toEqual([
      { kind: "document", relativePath: "index.md", children: [] },
      { kind: "document", relativePath: "chapters/one.md", children: [] },
    ]);
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
    expect(registry.workspaces[0].nodes).toEqual([
      { kind: "document", relativePath: "a.md", children: [] },
    ]);
    expect(
      JSON.parse(window.localStorage.getItem(BOOK_SCOPE_STORAGE_KEY) ?? "{}")
        .workspaces[0].chapterRelativePaths,
    ).toBeUndefined();
  });

  it("migrates a scope after bookmark root resolution without overwriting a target", () => {
    writeBookScope("/old", ["chapters/a.md"], 10);
    migrateBookScopeWorkspaceRoot("/old", "/new");
    expect(readBookScope("/old")).toBeNull();
    expect(readBookScope("/new")?.chapterRelativePaths).toEqual(["chapters/a.md"]);
  });
});
