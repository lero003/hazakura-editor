import { cleanup, render, screen } from "@testing-library/react";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { CommandPalette } from "../commandPalette/CommandPalette";
import { QuickOpen } from "../editor/QuickOpen";
import { GlobalSearch } from "../globalSearch/GlobalSearch";

describe("search surface accessibility semantics", () => {
  const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

  beforeAll(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  afterAll(() => {
    if (originalScrollIntoView) {
      HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    } else {
      delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
    }
  });

  it("links Quick Open's combobox to its active option", () => {
    render(
      <QuickOpen
        menuLanguage="en"
        onClose={vi.fn()}
        onOpenFile={vi.fn()}
        tree={{
          name: "workspace",
          path: "/workspace",
          kind: "directory",
          children_loaded: true,
          children_truncated: false,
          children: [
            {
              name: "draft.md",
              path: "/workspace/draft.md",
              kind: "file",
              children_loaded: true,
              children_truncated: false,
              children: [],
            },
          ],
        }}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Quick Open" })).toBeTruthy();
    const combobox = screen.getByRole("combobox", { name: "Quick Open" });
    const option = screen.getByRole("option", { name: /draft\.md/ });
    expect(combobox.getAttribute("aria-controls")).toBe("quick-open-results");
    expect(combobox.getAttribute("aria-activedescendant")).toBe(option.id);
    expect(option.getAttribute("aria-selected")).toBe("true");
    expect(
      screen.getByText(/already loaded in the workspace tree/i),
    ).toBeTruthy();
  });

  it("states partial tree and result cap honestly", () => {
    const manyFiles = Array.from({ length: 120 }, (_, i) => ({
      name: `f${i}.md`,
      path: `/workspace/f${i}.md`,
      kind: "file" as const,
      children_loaded: true,
      children_truncated: false,
      children: [],
    }));
    render(
      <QuickOpen
        menuLanguage="en"
        onClose={vi.fn()}
        onOpenFile={vi.fn()}
        tree={{
          name: "workspace",
          path: "/workspace",
          kind: "directory",
          children_loaded: true,
          children_truncated: true,
          children: manyFiles,
        }}
      />,
    );

    expect(
      screen.getByText(/truncated by the per-folder cap/i),
    ).toBeTruthy();
    expect(screen.getByText(/Showing 100 of 120/i)).toBeTruthy();
  });

  it("links the Command Palette combobox to its active option", () => {
    render(
      <CommandPalette
        activeIndex={0}
        commands={[
          {
            id: "save",
            label: "Save",
            category: "File",
            run: vi.fn(),
          },
        ]}
        menuLanguage="en"
        onClose={vi.fn()}
        onRun={vi.fn()}
        onSetActiveIndex={vi.fn()}
        onSetQuery={vi.fn()}
        query=""
      />,
    );

    expect(
      screen.getByRole("dialog", { name: "Command palette" }),
    ).toBeTruthy();
    const combobox = screen.getByRole("combobox", {
      name: "Command palette",
    });
    const option = screen.getByRole("option", { name: /Save/ });
    expect(combobox.getAttribute("aria-activedescendant")).toBe(option.id);
    expect(option.getAttribute("aria-selected")).toBe("true");
  });

  it("localizes Command Palette semantics and empty copy", () => {
    render(
      <CommandPalette
        activeIndex={0}
        commands={[]}
        menuLanguage="ja"
        onClose={vi.fn()}
        onRun={vi.fn()}
        onSetActiveIndex={vi.fn()}
        onSetQuery={vi.fn()}
        query="なし"
      />,
    );

    expect(
      screen.getByRole("dialog", { name: "コマンドパレット" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("combobox", { name: "コマンドパレット" }),
    ).toBeTruthy();
    expect(screen.getByText("一致するコマンドがありません")).toBeTruthy();
  });

  it("localizes Global Search semantics in kana", () => {
    render(
      <GlobalSearch
        activeIndex={0}
        menuLanguage="kana"
        onClose={vi.fn()}
        onRun={vi.fn()}
        onSetActiveIndex={vi.fn()}
        onSetQuery={vi.fn()}
        query=""
        rows={[]}
        searchError={null}
        searching={false}
        summary={null}
        workspaceOpen
      />,
    );

    expect(
      screen.getByRole("dialog", { name: "ふみのなかを さがす" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("combobox", { name: "ふみのなかを さがす" }),
    ).toBeTruthy();
  });

  it("announces Global Search progress and active result semantics", () => {
    render(
      <GlobalSearch
        activeIndex={0}
        menuLanguage="en"
        onClose={vi.fn()}
        onRun={vi.fn()}
        onSetActiveIndex={vi.fn()}
        onSetQuery={vi.fn()}
        query="hazakura"
        rows={[
          {
            fileIndex: 0,
            matchIndex: 0,
            file: {
              path: "/workspace/draft.md",
              relativePath: "draft.md",
              matches: [],
              truncated: false,
            },
            match: { line: 4, column: 2, text: "hazakura" },
          },
        ]}
        searchError={null}
        searching={false}
        summary={{ totalFilesScanned: 1, totalMatches: 1, truncated: false }}
        workspaceOpen
      />,
    );

    expect(
      screen.getByRole("dialog", { name: "Find in files" }),
    ).toBeTruthy();
    const combobox = screen.getByRole("combobox", {
      name: "Find in files",
    });
    const option = screen.getByRole("option", { name: /hazakura/ });
    expect(combobox.getAttribute("aria-activedescendant")).toBe(option.id);
    expect(screen.getByRole("status").textContent).toContain("1 match");
  });

  it("localizes the missing-workspace state instead of exposing the hook error", () => {
    render(
      <GlobalSearch
        activeIndex={0}
        menuLanguage="ja"
        onClose={vi.fn()}
        onRun={vi.fn()}
        onSetActiveIndex={vi.fn()}
        onSetQuery={vi.fn()}
        query="hazakura"
        rows={[]}
        searchError="Open a workspace to search its files."
        searching={false}
        summary={null}
        workspaceOpen={false}
      />,
    );

    expect(screen.getByRole("status").textContent).toBe(
      "ワークスペースを開いてから検索してください",
    );
    expect(screen.queryByText("一致するファイルがありません")).toBeNull();
  });

  it("adds localized context while preserving a search failure detail", () => {
    render(
      <GlobalSearch
        activeIndex={0}
        menuLanguage="ja"
        onClose={vi.fn()}
        onRun={vi.fn()}
        onSetActiveIndex={vi.fn()}
        onSetQuery={vi.fn()}
        query="hazakura"
        rows={[
          {
            fileIndex: 0,
            matchIndex: 0,
            file: {
              path: "/workspace/stale.md",
              relativePath: "stale.md",
              matches: [],
              truncated: false,
            },
            match: { line: 1, column: 1, text: "stale result" },
          },
        ]}
        searchError="Workspace folder is unavailable."
        searching={false}
        summary={null}
        workspaceOpen
      />,
    );

    expect(screen.getByRole("status").textContent).toBe(
      "検索に失敗しました。Workspace folder is unavailable.",
    );
    expect(screen.queryByText("一致するファイルがありません")).toBeNull();
    expect(screen.queryByRole("option")).toBeNull();
    expect(
      screen
        .getByRole("combobox", { name: "ファイル内検索" })
        .getAttribute("aria-activedescendant"),
    ).toBeNull();
  });

  it("uses gentle kana copy for a search failure", () => {
    render(
      <GlobalSearch
        activeIndex={0}
        menuLanguage="kana"
        onClose={vi.fn()}
        onRun={vi.fn()}
        onSetActiveIndex={vi.fn()}
        onSetQuery={vi.fn()}
        query="はざくら"
        rows={[]}
        searchError="Workspace folder is unavailable."
        searching={false}
        summary={null}
        workspaceOpen
      />,
    );

    expect(screen.getByRole("status").textContent).toBe(
      "さがせませんでした。Workspace folder is unavailable.",
    );
  });
});
