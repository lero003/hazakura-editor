import { describe, expect, it } from "vitest";
import type { WorkspaceTreeEntry } from "../../lib/tauri";
import {
  flattenWorkspaceFiles,
  workspaceTreeIsPartial,
} from "./quickOpenFiles";

function dir(
  path: string,
  children: WorkspaceTreeEntry[],
  flags: Partial<
    Pick<WorkspaceTreeEntry, "children_loaded" | "children_truncated">
  > = {},
): WorkspaceTreeEntry {
  return {
    name: path.split("/").pop() ?? path,
    path,
    kind: "directory",
    children,
    children_loaded: flags.children_loaded ?? true,
    children_truncated: flags.children_truncated ?? false,
  };
}

function file(path: string): WorkspaceTreeEntry {
  return {
    name: path.split("/").pop() ?? path,
    path,
    kind: "file",
    children: [],
    children_loaded: true,
    children_truncated: false,
  };
}

describe("flattenWorkspaceFiles", () => {
  it("collects only files from the loaded tree", () => {
    const tree = dir("/ws", [
      file("/ws/a.md"),
      dir("/ws/nested", [file("/ws/nested/b.md")]),
    ]);
    expect(flattenWorkspaceFiles(tree)).toEqual([
      { path: "/ws/a.md", name: "a.md" },
      { path: "/ws/nested/b.md", name: "b.md" },
    ]);
  });
});

describe("workspaceTreeIsPartial", () => {
  it("is false when every directory is fully loaded and not truncated", () => {
    const tree = dir("/ws", [file("/ws/a.md"), dir("/ws/nested", [])]);
    expect(workspaceTreeIsPartial(tree)).toBe(false);
  });

  it("is true when a directory has not been expanded", () => {
    const tree = dir("/ws", [
      dir("/ws/nested", [], { children_loaded: false }),
    ]);
    expect(workspaceTreeIsPartial(tree)).toBe(true);
  });

  it("is true when a directory hit the per-folder listing cap", () => {
    const tree = dir("/ws", [
      dir("/ws/big", [file("/ws/big/a.md")], { children_truncated: true }),
    ]);
    expect(workspaceTreeIsPartial(tree)).toBe(true);
  });
});
