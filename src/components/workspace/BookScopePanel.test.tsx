import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceTreeEntry } from "../../lib/tauri";
import { BookScopePanel, shouldShowChapterPathHint } from "./BookScopePanel";

const nodes = (paths: readonly string[]) =>
  paths.map((relativePath) => ({
    kind: "document" as const,
    relativePath,
    children: [],
  }));

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
  it("discloses app-private chapter order storage on the empty state", () => {
    render(
      <BookScopePanel
        activePath={null}
        chapterRelativePaths={[]}
        chapters={[]}
        menuLanguage="ja"
        nodes={[]}
        onCommit={vi.fn()}
        onLoadDirectory={vi.fn(async () => {})}
        onOpenChapter={vi.fn()}
        onRevalidate={vi.fn()}
        resolving={false}
        unavailable={[]}
        workspaceRootPath="/workspace"
        workspaceTree={workspaceTree}
      />,
    );

    expect(
      screen.getByText(
        "章の順序はこの Mac のアプリ内に保存します。フォルダ内の並びや OKF の順序ではありません。",
      ),
    ).toBeTruthy();
  });

  it("imports a portable recipe as an editable draft without auto-saving", async () => {
    const onCommit = vi.fn();
    const onImportRecipeDraft = vi.fn(async () => ({
      nodes: nodes(["imported.md", "second.md"]),
      chapterRelativePaths: ["imported.md", "second.md"],
    }));
    render(
      <BookScopePanel
        activePath={null}
        chapterRelativePaths={[]}
        chapters={[]}
        menuLanguage="ja"
        nodes={[]}
        onCommit={onCommit}
        onImportRecipeDraft={onImportRecipeDraft}
        onLoadDirectory={vi.fn(async () => {})}
        onOpenChapter={vi.fn()}
        onRevalidate={vi.fn()}
        resolving={false}
        unavailable={[]}
        workspaceRootPath="/workspace"
        workspaceTree={workspaceTree}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "章立てを取り込む" }));
    expect(onImportRecipeDraft).toHaveBeenCalledOnce();
    expect(await screen.findByRole("button", { name: "保存 (2)" })).toBeTruthy();
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "保存 (2)" }));
    expect(onCommit).toHaveBeenCalledWith(nodes(["imported.md", "second.md"]));
  });

  it("opens workspace suggestions as a draft and commits only on Save", async () => {
    const onCommit = vi.fn();
    const onSuggest = vi.fn(async () => ({
      nodes: nodes(["nested/chapter.md", "a.md"]),
      chapterRelativePaths: ["nested/chapter.md", "a.md"],
      linkedChapterCount: 1,
      includedIndexPageCount: 1,
      excludedSupportFileCount: 2,
      unreadableFileCount: 0,
      candidateLimitReached: false,
      scanIncomplete: false,
    }));
    render(
      <BookScopePanel
        activePath={null}
        chapterRelativePaths={[]}
        chapters={[]}
        menuLanguage="ja"
        nodes={[]}
        onCommit={onCommit}
        onLoadDirectory={vi.fn(async () => {})}
        onOpenChapter={vi.fn()}
        onRevalidate={vi.fn()}
        onSuggest={onSuggest}
        resolving={false}
        unavailable={[]}
        workspaceRootPath="/workspace"
        workspaceTree={workspaceTree}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "候補を作る" }));
    expect(onSuggest).toHaveBeenCalledWith({ includeIndexPages: true });
    expect(
      await screen.findByText("2件を候補にしました（本文・資料1・扉/目次1）"),
    ).toBeTruthy();
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "保存 (2)" }));
    expect(onCommit).toHaveBeenCalledWith(
      nodes(["nested/chapter.md", "a.md"]),
    );
  });

  it("lets the user exclude index pages before creating a suggestion", async () => {
    const onSuggest = vi.fn(async () => null);
    render(
      <BookScopePanel
        activePath={null}
        chapterRelativePaths={[]}
        chapters={[]}
        menuLanguage="ja"
        nodes={[]}
        onCommit={vi.fn()}
        onLoadDirectory={vi.fn(async () => {})}
        onOpenChapter={vi.fn()}
        onRevalidate={vi.fn()}
        onSuggest={onSuggest}
        resolving={false}
        unavailable={[]}
        workspaceRootPath="/workspace"
        workspaceTree={workspaceTree}
      />,
    );

    fireEvent.click(
      screen.getByRole("checkbox", { name: "index.mdを扉・目次として含める" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "候補を作る" }));
    expect(onSuggest).toHaveBeenCalledWith({ includeIndexPages: false });
  });

  it("offers cancellation while a workspace suggestion scan is running", () => {
    const onCancelSuggest = vi.fn();
    render(
      <BookScopePanel
        activePath={null}
        chapterRelativePaths={[]}
        chapters={[]}
        menuLanguage="en"
        nodes={[]}
        onCancelSuggest={onCancelSuggest}
        onCommit={vi.fn()}
        onLoadDirectory={vi.fn(async () => {})}
        onOpenChapter={vi.fn()}
        onRevalidate={vi.fn()}
        resolving={false}
        suggesting
        unavailable={[]}
        workspaceRootPath="/workspace"
        workspaceTree={workspaceTree}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Stop scan" }));
    expect(onCancelSuggest).toHaveBeenCalledOnce();
  });

  it("opens available chapters, exposes unavailable entries, and reorders explicitly", () => {
    const onCommit = vi.fn();
    const onOpenChapter = vi.fn();
    const onRevalidate = vi.fn();
    render(
      <BookScopePanel
        activePath="/workspace/a.md"
        chapterRelativePaths={["a.md", "missing.md"]}
        chapters={[
          { name: "a.md", path: "/workspace/a.md", relativePath: "a.md" },
        ]}
        menuLanguage="ja"
        nodes={nodes(["a.md", "missing.md"])}
        onCommit={onCommit}
        onLoadDirectory={vi.fn(async () => {})}
        onOpenChapter={onOpenChapter}
        onRevalidate={onRevalidate}
        resolving={false}
        unavailable={[{ relativePath: "missing.md", reason: "missing" }]}
        workspaceRootPath="/workspace"
        workspaceTree={workspaceTree}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "a.md" }));
    expect(onOpenChapter).toHaveBeenCalledWith("/workspace/a.md");
    expect(
      screen.getByText("利用できません: ファイルが見つかりません"),
    ).toBeTruthy();
    expect(screen.getByText("利用不可 1")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "その他" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "再確認" }));
    expect(onRevalidate).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "missing.mdを上へ移動" }));
    expect(onCommit).toHaveBeenCalledWith(nodes(["missing.md", "a.md"]));
  });

  it("shows saved groups and keeps arrow reordering inside one parent", () => {
    const onCommit = vi.fn();
    const structuredNodes = [
      {
        kind: "document" as const,
        relativePath: "index.md",
        children: [
          {
            kind: "group" as const,
            title: "Works",
            children: [
              {
                kind: "document" as const,
                relativePath: "books/one.md",
                children: [],
              },
              {
                kind: "document" as const,
                relativePath: "books/two.md",
                children: [],
              },
            ],
          },
        ],
      },
    ];
    render(
      <BookScopePanel
        activePath={null}
        chapterRelativePaths={["index.md", "books/one.md", "books/two.md"]}
        chapters={[
          { name: "index.md", path: "/workspace/index.md", relativePath: "index.md" },
          { name: "one.md", path: "/workspace/books/one.md", relativePath: "books/one.md" },
          { name: "two.md", path: "/workspace/books/two.md", relativePath: "books/two.md" },
        ]}
        menuLanguage="en"
        nodes={structuredNodes}
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

    expect(screen.getByText("Works")).toBeTruthy();
    expect(
      (screen.getByRole("button", {
        name: "Move books/one.md up",
      }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", {
        name: "Move books/two.md down",
      }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(
      screen.getByRole("button", { name: "Move books/two.md up" }),
    );
    expect(onCommit).toHaveBeenCalledWith([
      {
        ...structuredNodes[0],
        children: [
          {
            ...structuredNodes[0].children[0],
            children: [
              structuredNodes[0].children[0].children[1],
              structuredNodes[0].children[0].children[0],
            ],
          },
        ],
      },
    ]);
  });

  it("keeps the settled book view quiet: read/edit primary, suggest only while editing", () => {
    const onSuggest = vi.fn(async () => null);
    const onRevalidate = vi.fn();
    render(
      <BookScopePanel
        activePath={null}
        chapterRelativePaths={["a.md"]}
        chapters={[
          { name: "a.md", path: "/workspace/a.md", relativePath: "a.md" },
        ]}
        menuLanguage="ja"
        nodes={nodes(["a.md"])}
        onCommit={vi.fn()}
        onLoadDirectory={vi.fn(async () => {})}
        onOpenChapter={vi.fn()}
        onReadBook={vi.fn()}
        onRevalidate={onRevalidate}
        onSuggest={onSuggest}
        resolving={false}
        unavailable={[]}
        workspaceRootPath="/workspace"
        workspaceTree={workspaceTree}
      />,
    );

    expect(screen.getByRole("button", { name: "本全体を読む" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "編集" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "候補を作る" })).toBeNull();
    expect(screen.queryByRole("button", { name: "再確認" })).toBeNull();
    // Root-level chapter names stay one line; full path is in title only.
    expect(screen.queryByText("a.md", { selector: "small" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "編集" }));
    expect(screen.getByRole("button", { name: "候補を作る" })).toBeTruthy();
    expect(screen.getByText("含めるMarkdownにチェックを入れます。")).toBeTruthy();
  });

  it("keeps settled book actions on one row and folds recipe actions into More", () => {
    const onExportRecipe = vi.fn();
    const onImportRecipeDraft = vi.fn(async () => null);
    render(
      <BookScopePanel
        activePath={null}
        chapterRelativePaths={["nested/chapter.md"]}
        chapters={[
          {
            name: "chapter.md",
            path: "/workspace/nested/chapter.md",
            relativePath: "nested/chapter.md",
          },
        ]}
        menuLanguage="ja"
        nodes={nodes(["nested/chapter.md"])}
        onCommit={vi.fn()}
        onExportRecipe={onExportRecipe}
        onImportRecipeDraft={onImportRecipeDraft}
        onLoadDirectory={vi.fn(async () => {})}
        onOpenChapter={vi.fn()}
        onReadBook={vi.fn()}
        onRevalidate={vi.fn()}
        resolving={false}
        unavailable={[]}
        workspaceRootPath="/workspace"
        workspaceTree={workspaceTree}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "章立てを書き出す" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "章立てを取り込む" }),
    ).toBeNull();

    const more = screen.getByRole("button", { name: "その他" });
    fireEvent.click(more);
    more.focus();
    fireEvent.keyDown(more, { key: "Escape" });
    expect(
      screen.queryByRole("menuitem", { name: "章立てを書き出す" }),
    ).toBeNull();
    expect(document.activeElement).toBe(more);

    fireEvent.click(more);
    fireEvent.click(screen.getByRole("menuitem", { name: "章立てを書き出す" }));

    expect(onExportRecipe).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole("menuitem", { name: "章立てを取り込む" }),
    ).toBeNull();
  });

  it("shows nested path hints without repeating root-level paths", () => {
    render(
      <BookScopePanel
        activePath={null}
        chapterRelativePaths={["a.md", "nested/chapter.md"]}
        chapters={[
          { name: "a.md", path: "/workspace/a.md", relativePath: "a.md" },
          {
            name: "chapter.md",
            path: "/workspace/nested/chapter.md",
            relativePath: "nested/chapter.md",
          },
        ]}
        menuLanguage="en"
        nodes={nodes(["a.md", "nested/chapter.md"])}
        onCommit={vi.fn()}
        onLoadDirectory={vi.fn(async () => {})}
        onOpenChapter={vi.fn()}
        onRevalidate={vi.fn()}
        resolving={false}
        unavailable={[]}
        workspaceRootPath="/workspace"
        workspaceTree={workspaceTree}
      />,
    );

    expect(screen.getByText("nested/chapter.md")).toBeTruthy();
    expect(screen.queryByText("a.md", { selector: "small" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "chapter.md" }).querySelector(
        ".book-scope-chapter-name",
      ),
    ).toBeTruthy();
  });

  it("keeps selection changes as a draft until Save and supports Cancel", () => {
    const onCommit = vi.fn();
    const { rerender } = render(
      <BookScopePanel
        activePath={null}
        chapterRelativePaths={[]}
        chapters={[]}
        menuLanguage="en"
        nodes={[]}
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
        nodes={[]}
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
    expect(onCommit).toHaveBeenCalledWith(nodes(["a.md"]));
  });

  it("cancels a draft with Escape and restores focus to the edit trigger", () => {
    const onCommit = vi.fn();
    render(
      <BookScopePanel
        activePath={null}
        chapterRelativePaths={[]}
        chapters={[]}
        menuLanguage="en"
        nodes={[]}
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

  it("restores focus to the edit trigger after saving a draft", () => {
    const onCommit = vi.fn();
    render(
      <BookScopePanel
        activePath={null}
        chapterRelativePaths={["a.md"]}
        chapters={[
          { name: "a.md", path: "/workspace/a.md", relativePath: "a.md" },
        ]}
        menuLanguage="ja"
        nodes={nodes(["a.md"])}
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

    fireEvent.click(screen.getByRole("button", { name: "編集" }));
    fireEvent.click(screen.getByRole("button", { name: "保存 (1)" }));

    expect(onCommit).toHaveBeenCalledWith(nodes(["a.md"]));
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "編集" }),
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
        nodes={[]}
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

describe("shouldShowChapterPathHint", () => {
  it("shows nested paths only", () => {
    expect(shouldShowChapterPathHint("a.md")).toBe(false);
    expect(shouldShowChapterPathHint("chapters/a.md")).toBe(true);
  });
});
