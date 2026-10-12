import { useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { WorkspaceTree } from "../../components/workspace/WorkspaceTree";
import type { WorkspaceTreeEntry } from "../../lib/tauri";
import { useWorkspaceTreeLoader } from "./useWorkspaceTreeLoader";
import { useWorkspaceAutoRefresh } from "./useWorkspaceAutoRefresh";

const { listWorkspaceTree, listWorkspaceDirectory } = vi.hoisted(() => ({ listWorkspaceTree: vi.fn(), listWorkspaceDirectory: vi.fn() }));
vi.mock("../../lib/tauri", () => ({ listWorkspaceTree, listWorkspaceDirectory }));
const dir = (path: string, children: WorkspaceTreeEntry[] = [], loaded = true): WorkspaceTreeEntry => ({ path, name: path.split("/").pop()!, kind: "directory", children, children_loaded: loaded, children_truncated: false });
const file = (path: string): WorkspaceTreeEntry => ({ ...dir(path), kind: "file" });
const noop = () => {};

afterEach(() => { cleanup(); vi.useRealTimers(); vi.resetAllMocks(); });

function Fixture() {
  const [tree, setTree] = useState<WorkspaceTreeEntry | null>(dir("/book", [dir("/book/chapters", [file("/book/chapters/old.md"), file("/book/chapters/keep.md")])]));
  const actions = useWorkspaceTreeLoader({ workspaceRootPath: "/book", workspaceTree: tree, setWorkspaceTree: setTree, onError: noop, onStatus: noop });
  useWorkspaceAutoRefresh({ enabled: true, refresh: actions.refreshWorkspaceTreeAutomatically, cancel: actions.cancelAutomaticWorkspaceRefresh });
  return tree && <WorkspaceTree
    entry={tree} activePath={null} compareSourcePath={null} compareTargetPath={null} compareSelectionEnabled={false}
    dirtyFilePaths={[]} openFilePaths={[]} loadingLabel="読み込み中" renameLabel="名前変更" renamingPath={null}
    openFileStateLabel="開いている" unsavedOpenFileStateLabel="未保存" partialEntriesLabel={() => "一部のみ"}
    requestRename={noop} onClearCompareSelection={noop} onMoveEntry={noop}
    onOpenContextMenu={noop} onOpenFile={noop} onSelectCompareFile={noop} onSubmitRename={noop}
    onLoadDirectory={actions.loadWorkspaceDirectory} onDirectoryExpanded={actions.onWorkspaceDirectoryExpanded}
  />;
}

it("retains initial mount expansion registration and reflects external changes in the actual tree", async () => {
  vi.useFakeTimers();
  listWorkspaceTree.mockResolvedValue(dir("/book", [dir("/book/chapters", [], false), file("/book/new-root.md")]));
  listWorkspaceDirectory.mockResolvedValue(dir("/book/chapters", [file("/book/chapters/new.md"), file("/book/chapters/keep.md")]));
  const view = render(<Fixture />);
  fireEvent.click(screen.getByRole("button", { name: "chapters" }));
  await act(async () => vi.advanceTimersByTime(250));
  expect(screen.getByRole("button", { name: "old.md" })).toBeTruthy();
  const retainedButton = screen.getByRole("button", { name: "keep.md" });
  retainedButton.focus();
  const treeElement = view.container.querySelector<HTMLElement>(".workspace-tree")!;
  treeElement.scrollTop = 180;
  await act(async () => vi.advanceTimersByTime(10_000));
  expect(listWorkspaceDirectory).toHaveBeenCalledExactlyOnceWith("/book", "/book/chapters");
  expect(screen.getByRole("button", { name: "new.md" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "new-root.md" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "old.md" })).toBeNull();
  expect(screen.getByRole("button", { name: "keep.md" })).toBe(retainedButton);
  expect(document.activeElement).toBe(retainedButton);
  expect(treeElement.scrollTop).toBe(180);
  expect(screen.getByRole("button", { name: "chapters" }).getAttribute("aria-expanded")).toBe("true");
});
