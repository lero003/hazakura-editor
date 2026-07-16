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
} = {}) {
  const onMoveToTrash = options.onMoveToTrash ?? vi.fn();
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
      onOpenWorkspace={vi.fn()}
      onSelectCompareFile={vi.fn()}
      onSubmitRename={vi.fn()}
      openFilePaths={[]}
      renamingPath={null}
      requestRename={vi.fn()}
      workspaceRootPath="/workspace"
      workspaceTree={workspaceTree}
    />,
  );
  return { ...result, onMoveToTrash };
}

describe("WorkspaceSidebar Theme A clarity", () => {
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
