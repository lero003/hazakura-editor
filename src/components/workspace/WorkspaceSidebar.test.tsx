import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getSafeEditorCopy, getWorkspaceFileOpsCopy } from "../../lib/locale";
import type { WorkspaceTreeEntry } from "../../lib/tauri";
import { WorkspaceSidebar } from "./WorkspaceSidebar";

const workspaceTree: WorkspaceTreeEntry = {
  children: [
    {
      children: [],
      children_loaded: true,
      children_truncated: false,
      kind: "file",
      name: "draft.md",
      path: "/workspace/draft.md",
    },
  ],
  children_loaded: true,
  children_truncated: false,
  kind: "directory",
  name: "workspace",
  path: "/workspace",
};

afterEach(cleanup);

function renderSidebar(options: {
  activePath?: string | null;
  onMoveToTrash?: (path: string, name: string, isDirectory: boolean) => void;
  onOpenGlobalSearch?: () => void;
  workspaceRootPath?: string | null;
  workspaceTree?: WorkspaceTreeEntry | null;
} = {}) {
  const onMoveToTrash = options.onMoveToTrash ?? vi.fn();
  const onOpenGlobalSearch = options.onOpenGlobalSearch ?? vi.fn();
  const result = render(
    <WorkspaceSidebar
      activePath={options.activePath ?? null}
      compareSelectionEnabled={false}
      compareSourcePath={null}
      compareTargetPath={null}
      copy={getSafeEditorCopy("en")}
      dirtyFilePaths={[]}
      fileOpsCopy={getWorkspaceFileOpsCopy("en")}
      onClearCompareSelection={vi.fn()}
      onCollapse={vi.fn()}
      onCreateFile={vi.fn()}
      onCreateFolder={vi.fn()}
      onCreateOkfScaffoldBookLike={vi.fn()}
      onCreateOkfScaffoldMinimal={vi.fn()}
      onLoadDirectory={vi.fn(async () => {})}
      onMoveEntry={vi.fn()}
      onMoveToTrash={onMoveToTrash}
      onOpenContextMenu={vi.fn()}
      onOpenFile={vi.fn()}
      onOpenRootContextMenu={vi.fn()}
      onOpenGlobalSearch={onOpenGlobalSearch}
      onOpenWorkspace={vi.fn()}
      onSelectCompareFile={vi.fn()}
      onSubmitRename={vi.fn()}
      openFilePaths={[]}
      renamingPath={null}
      requestRename={vi.fn()}
      workspaceRootPath={options.workspaceRootPath === undefined ? "/workspace" : options.workspaceRootPath}
      workspaceTree={options.workspaceTree === undefined ? workspaceTree : options.workspaceTree}
    />,
  );
  return { ...result, onMoveToTrash, onOpenGlobalSearch };
}

describe("WorkspaceSidebar Theme A clarity", () => {
  it("puts Search in folder next to Trash in the footer", () => {
    // 実機フィードバック: ゴミ箱だけでは何ができる場所か分からない。モックの
    // サイドバー下端に合わせて「フォルダ内を検索」を並べる。
    const onOpenGlobalSearch = vi.fn();
    renderSidebar({ onOpenGlobalSearch });
    const search = screen.getByRole("button", {
      name: "Search in folder",
    });
    fireEvent.click(search);
    expect(onOpenGlobalSearch).toHaveBeenCalledOnce();
  });

  it("names the exact active-file Trash target and keeps no-active copy honest", () => {
    const onMoveToTrash =
      vi.fn<(path: string, name: string, isDirectory: boolean) => void>();
    const { unmount } = renderSidebar();
    const unavailable = screen.getByRole("button", {
      name: "Open a file from the workspace tree",
    });
    expect(unavailable.hasAttribute("disabled")).toBe(true);

    unmount();
    renderSidebar({ activePath: "/workspace/draft.md", onMoveToTrash });
    const available = screen.getByRole("button", {
      name: "Move “draft.md” to Trash",
    });
    expect(available.hasAttribute("disabled")).toBe(false);
    fireEvent.click(available);
    expect(onMoveToTrash).toHaveBeenCalledWith(
      "/workspace/draft.md",
      "draft.md",
      false,
    );
  });

  it("keeps file and folder actions before the labeled OKF starter group", () => {
    renderSidebar();
    fireEvent.click(screen.getByRole("button", { name: "New" }));

    const items = screen.getAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "New File",
      "New Folder",
      "Minimal",
      "Book-like chapters",
    ]);
    expect(
      screen.getByRole("group", { name: "Knowledge folder starters" }),
    ).toBeTruthy();
  });
});

describe("WorkspaceSidebar empty workspace", () => {
  it("says the empty-folder message once and keeps the open action", () => {
    const copy = getSafeEditorCopy("en");
    renderSidebar({ workspaceRootPath: null, workspaceTree: null });
    // ヘッダーの見出しと空状態の本文で同じ文言を二度出さない。
    expect(screen.getAllByText(copy.noFolderOpen)).toHaveLength(1);
    expect(screen.getByRole("button", { name: copy.openFolder })).toBeTruthy();
  });
});
