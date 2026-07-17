import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceTreeEntry } from "../../lib/tauri";
import { BookScopePanel } from "./BookScopePanel";

const workspaceTree: WorkspaceTreeEntry = {
  name: "workspace",
  path: "/workspace",
  kind: "directory",
  children_loaded: true,
  children_truncated: false,
  children: [
    {
      name: "a.md",
      path: "/workspace/a.md",
      kind: "file",
      children: [],
      children_loaded: true,
      children_truncated: false,
    },
    {
      name: "nested",
      path: "/workspace/nested",
      kind: "directory",
      children: [],
      children_loaded: false,
      children_truncated: false,
    },
    {
      name: "notes.txt",
      path: "/workspace/notes.txt",
      kind: "file",
      children: [],
      children_loaded: true,
      children_truncated: false,
    },
  ],
};

afterEach(cleanup);

describe("BookScopePanel", () => {
  it("opens available chapters, exposes unavailable entries, and reorders explicitly", () => {
    const onCommit = vi.fn();
    const onOpenChapter = vi.fn();
    render(
      <BookScopePanel
        activePath="/workspace/a.md"
        chapterRelativePaths={["a.md", "missing.md"]}
        chapters={[{ name: "a.md", path: "/workspace/a.md", relativePath: "a.md" }]}
        menuLanguage="ja"
        onCommit={onCommit}
        onLoadDirectory={vi.fn(async () => {})}
        onOpenChapter={onOpenChapter}
        onRevalidate={vi.fn()}
        resolving={false}
        unavailable={[{ relativePath: "missing.md", reason: "missing" }]}
        workspaceRootPath="/workspace"
        workspaceTree={workspaceTree}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "a.md" }));
    expect(onOpenChapter).toHaveBeenCalledWith("/workspace/a.md");
    expect(screen.getByText("利用できません: ファイルが見つかりません")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "missing.mdを上へ移動" }));
    expect(onCommit).toHaveBeenCalledWith(["missing.md", "a.md"]);
  });

  it("keeps selection changes as a draft until Save and supports Cancel", () => {
    const onCommit = vi.fn();
    const { rerender } = render(
      <BookScopePanel
        activePath={null}
        chapterRelativePaths={[]}
        chapters={[]}
        menuLanguage="en"
        onCommit={onCommit}
        onLoadDirectory={vi.fn(async () => {})}
        onOpenChapter={vi.fn()}
        onRevalidate={vi.fn()}
        resolving={false}
        unavailable={[]}
        workspaceRootPath="/workspace"
        workspaceTree={workspaceTree}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Choose chapters" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "a.md" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCommit).not.toHaveBeenCalled();

    rerender(
      <BookScopePanel
        activePath={null}
        chapterRelativePaths={[]}
        chapters={[]}
        menuLanguage="en"
        onCommit={onCommit}
        onLoadDirectory={vi.fn(async () => {})}
        onOpenChapter={vi.fn()}
        onRevalidate={vi.fn()}
        resolving={false}
        unavailable={[]}
        workspaceRootPath="/workspace"
        workspaceTree={workspaceTree}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Choose chapters" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "a.md" }));
    fireEvent.click(screen.getByRole("button", { name: "Save (1)" }));
    expect(onCommit).toHaveBeenCalledWith(["a.md"]);
  });

  it("cancels a draft with Escape and restores focus to the edit trigger", () => {
    const onCommit = vi.fn();
    render(
      <BookScopePanel
        activePath={null}
        chapterRelativePaths={[]}
        chapters={[]}
        menuLanguage="en"
        onCommit={onCommit}
        onLoadDirectory={vi.fn(async () => {})}
        onOpenChapter={vi.fn()}
        onRevalidate={vi.fn()}
        resolving={false}
        unavailable={[]}
        workspaceRootPath="/workspace"
        workspaceTree={workspaceTree}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Choose chapters" }));
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "workspace" }),
    );
    fireEvent.keyDown(screen.getByRole("group", { name: "Choose book chapters" }), {
      key: "Escape",
    });

    expect(onCommit).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Choose chapters" }),
    );
  });

  it("loads a lazy directory only after explicit expansion", () => {
    const onLoadDirectory = vi.fn(async () => {});
    render(
      <BookScopePanel
        activePath={null}
        chapterRelativePaths={[]}
        chapters={[]}
        menuLanguage="en"
        onCommit={vi.fn()}
        onLoadDirectory={onLoadDirectory}
        onOpenChapter={vi.fn()}
        onRevalidate={vi.fn()}
        resolving={false}
        unavailable={[]}
        workspaceRootPath="/workspace"
        workspaceTree={workspaceTree}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Choose chapters" }));
    fireEvent.click(screen.getByRole("button", { name: /nested/ }));
    expect(onLoadDirectory).toHaveBeenCalledWith("/workspace/nested");
  });
});
