import { useState } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceTreeEntry } from "../../lib/tauri";
import { useWorkspaceTreeLoader } from "./useWorkspaceTreeLoader";

const { listWorkspaceTree, listWorkspaceDirectory } = vi.hoisted(() => ({ listWorkspaceTree: vi.fn(), listWorkspaceDirectory: vi.fn() }));
vi.mock("../../lib/tauri", () => ({ listWorkspaceTree, listWorkspaceDirectory }));
const dir = (path: string, children: WorkspaceTreeEntry[] = [], loaded = true): WorkspaceTreeEntry => ({ path, name: path.split("/").pop()!, kind: "directory", children, children_loaded: loaded, children_truncated: false });
const file = (path: string): WorkspaceTreeEntry => ({ ...dir(path), kind: "file" });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { resolve, promise }; }
afterEach(() => { cleanup(); vi.resetAllMocks(); });

function setup(initial: WorkspaceTreeEntry = dir("/book")) {
  const onError = vi.fn();
  const onStatus = vi.fn();
  const hook = renderHook(({ root }) => {
    const [tree, setTree] = useState<WorkspaceTreeEntry | null>(initial);
    return { tree, ...useWorkspaceTreeLoader({ workspaceRootPath: root, workspaceTree: tree, setWorkspaceTree: setTree, onError, onStatus }) };
  }, { initialProps: { root: "/book" as string | null } });
  act(() => hook.result.current.onWorkspaceDirectoryExpanded("/book", true));
  return { onError, onStatus, ...hook };
}

describe("useWorkspaceTreeLoader", () => {
  it("refreshes expanded directories and retains loaded collapsed snapshots", async () => {
    const deep = dir("/book/chapters/deep", [file("/book/chapters/deep/keep.md")]);
    const initial = dir("/book", [dir("/book/chapters", [deep, file("/book/chapters/old.md")]), dir("/book/closed", [], false)]);
    listWorkspaceTree.mockResolvedValue(dir("/book", [dir("/book/chapters", [], false), dir("/book/closed", [], false)]));
    listWorkspaceDirectory.mockResolvedValue(dir("/book/chapters", [dir(deep.path, [], false), file("/book/chapters/new.md")]));
    const hook = setup(initial);
    act(() => hook.result.current.onWorkspaceDirectoryExpanded("/book/chapters", true));
    await act(() => hook.result.current.refreshWorkspaceTree());
    expect(listWorkspaceDirectory).toHaveBeenCalledExactlyOnceWith("/book", "/book/chapters");
    expect(hook.result.current.tree?.children[0].children.map((child) => child.path)).toEqual([deep.path, "/book/chapters/new.md"]);
    expect(hook.result.current.tree?.children[0].children[0]).toBe(deep);
  });

  it("excludes expanded descendants of a collapsed ancestor", async () => {
    const hook = setup(dir("/book", [dir("/book/closed", [dir("/book/closed/deep")])]));
    listWorkspaceTree.mockResolvedValue(dir("/book", [dir("/book/closed", [], false)]));
    act(() => hook.result.current.onWorkspaceDirectoryExpanded("/book/closed/deep", true));
    await act(() => hook.result.current.refreshWorkspaceTree());
    expect(listWorkspaceDirectory).not.toHaveBeenCalled();
  });

  it("only checks the root when the root row is collapsed", async () => {
    const hook = setup(dir("/book", [dir("/book/chapters")]));
    listWorkspaceTree.mockResolvedValue(dir("/book", [dir("/book/chapters", [], false)]));
    act(() => {
      hook.result.current.onWorkspaceDirectoryExpanded("/book/chapters", true);
      hook.result.current.onWorkspaceDirectoryExpanded("/book", false);
    });
    await act(() => hook.result.current.refreshWorkspaceTree());
    expect(listWorkspaceDirectory).not.toHaveBeenCalled();
  });

  it("discards an old response after switching roots even when switching back", async () => {
    const old = deferred<WorkspaceTreeEntry>();
    listWorkspaceTree.mockReturnValue(old.promise);
    const hook = setup();
    let request!: Promise<void>;
    act(() => { request = hook.result.current.refreshWorkspaceTree(); });
    hook.rerender({ root: "/other" });
    hook.rerender({ root: "/book" });
    await act(async () => { old.resolve(dir("/book", [file("/book/stale.md")])); await request; });
    expect(hook.result.current.tree?.children).toEqual([]);
  });

  it("lets a newer local reload win over an older automatic snapshot", async () => {
    const old = deferred<WorkspaceTreeEntry>();
    listWorkspaceTree.mockReturnValue(old.promise);
    listWorkspaceDirectory.mockResolvedValue(dir("/book", [file("/book/new.md")]));
    const hook = setup();
    let auto!: Promise<void>;
    act(() => { auto = hook.result.current.refreshWorkspaceTreeAutomatically(); });
    await act(() => hook.result.current.reloadWorkspaceParent("/book"));
    await act(async () => { old.resolve(dir("/book", [file("/book/old.md")])); await auto; });
    expect(hook.result.current.tree?.children[0].path).toBe("/book/new.md");
  });

  it("does not start an automatic check during a manual or local reload", async () => {
    const pending = deferred<WorkspaceTreeEntry>();
    listWorkspaceDirectory.mockReturnValue(pending.promise);
    const hook = setup();
    let manual!: Promise<void>;
    act(() => { manual = hook.result.current.reloadWorkspaceParent("/book"); });
    await act(() => hook.result.current.refreshWorkspaceTreeAutomatically());
    expect(listWorkspaceTree).not.toHaveBeenCalled();
    await act(async () => { pending.resolve(dir("/book", [file("/book/new.md")])); await manual; });
    expect(hook.result.current.tree?.children[0].path).toBe("/book/new.md");
  });

  it("applies only the latest response when a directory is requested twice", async () => {
    const old = deferred<WorkspaceTreeEntry>();
    listWorkspaceDirectory.mockReturnValueOnce(old.promise).mockResolvedValueOnce(dir("/book", [file("/book/new.md")]));
    const hook = setup();
    let first!: Promise<void>;
    act(() => { first = hook.result.current.reloadWorkspaceParent("/book"); });
    await act(() => hook.result.current.reloadWorkspaceParent("/book"));
    await act(async () => { old.resolve(dir("/book", [file("/book/old.md")])); await first; });
    expect(hook.result.current.tree?.children[0].path).toBe("/book/new.md");
  });

  it("coalesces automatic checks and keeps failures silent with the last snapshot", async () => {
    const pending = deferred<WorkspaceTreeEntry>();
    listWorkspaceTree.mockReturnValue(pending.promise);
    const initial = dir("/book", [file("/book/keep.md")]);
    const hook = setup(initial);
    let request!: Promise<void>;
    act(() => { request = hook.result.current.refreshWorkspaceTreeAutomatically(); });
    await act(() => hook.result.current.refreshWorkspaceTreeAutomatically());
    expect(listWorkspaceTree).toHaveBeenCalledTimes(1);
    await act(async () => { pending.resolve(initial); await request; });
    listWorkspaceTree.mockRejectedValue(new Error("offline"));
    await act(() => hook.result.current.refreshWorkspaceTreeAutomatically());
    expect(hook.result.current.tree).toBe(initial);
    expect(hook.onError).not.toHaveBeenCalled();
    expect(hook.onStatus).not.toHaveBeenCalled();
  });

  it("ignores a pending automatic response when the displayed tree is paused", async () => {
    const pending = deferred<WorkspaceTreeEntry>();
    listWorkspaceTree.mockReturnValue(pending.promise);
    const hook = setup();
    let auto!: Promise<void>;
    act(() => { auto = hook.result.current.refreshWorkspaceTreeAutomatically(); });
    act(() => hook.result.current.onWorkspaceTreeVisibilityChange(false));
    await act(async () => { pending.resolve(dir("/book", [file("/book/old.md")])); await auto; });
    expect(hook.result.current.tree?.children).toEqual([]);
  });

  it("does not apply a completion after unmount", async () => {
    const pending = deferred<WorkspaceTreeEntry>();
    listWorkspaceDirectory.mockReturnValue(pending.promise);
    const onError = vi.fn(); const onStatus = vi.fn(); const setWorkspaceTree = vi.fn();
    const hook = renderHook(() => useWorkspaceTreeLoader({ workspaceRootPath: "/book", setWorkspaceTree, onError, onStatus }));
    let request!: Promise<void>;
    act(() => { request = hook.result.current.loadWorkspaceDirectory("/book/chapters"); });
    hook.unmount();
    await act(async () => { pending.resolve(dir("/book/chapters")); await request; });
    expect(setWorkspaceTree).not.toHaveBeenCalled();
    expect(onStatus).toHaveBeenCalledTimes(1);
  });
});
