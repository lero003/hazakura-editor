import { describe, expect, it } from "vitest";
import type { WorkspaceTreeEntry } from "../../lib/tauri";
import { replaceWorkspaceTreeEntry } from "./workspaceTree";

export function directory(path: string, children: WorkspaceTreeEntry[] = [], loaded = true): WorkspaceTreeEntry {
  return { path, name: path.split("/").pop()!, kind: "directory", children, children_loaded: loaded, children_truncated: false };
}

export function file(path: string): WorkspaceTreeEntry {
  return { ...directory(path), kind: "file" };
}

describe("workspace tree refresh", () => {
  it("keeps loaded descendants while replacing a shallow directory listing", () => {
    const nested = directory("/book/chapters", [file("/book/chapters/one.md")]);
    const current = directory("/book", [nested, file("/book/old.md")]);
    const refreshed = replaceWorkspaceTreeEntry(current, directory("/book", [directory(nested.path, [], false), file("/book/new.md")]));
    expect(refreshed.children.map((child) => child.path)).toEqual([nested.path, "/book/new.md"]);
    expect(refreshed.children[0]).toBe(nested);
  });

  it("preserves the whole snapshot identity when a listing is unchanged", () => {
    const current = directory("/book", [directory("/book/chapters", [file("/book/chapters/one.md")]), file("/book/index.md")]);
    expect(replaceWorkspaceTreeEntry(current, directory("/book", [directory("/book/chapters", [], false), file("/book/index.md")]))).toBe(current);
  });

  it("does not retain children across a path or kind change", () => {
    const current = directory("/book", [directory("/book/chapters", [file("/book/chapters/one.md")])]);
    expect(replaceWorkspaceTreeEntry(current, directory("/book", [file("/book/chapters")])).children[0].children).toEqual([]);
    expect(replaceWorkspaceTreeEntry(current, directory("/book", [directory("/book/renamed", [], false)])).children[0].children_loaded).toBe(false);
  });

  it("ignores a directory response after its parent removed it", () => {
    const current = directory("/book", [file("/book/index.md")]);
    expect(replaceWorkspaceTreeEntry(current, directory("/book/gone", [file("/book/gone/one.md")]))).toBe(current);
  });
});
