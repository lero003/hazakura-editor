import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

  it("closes Quick Open with Escape from the input and from any result (F3)", () => {
    // 外部レビュー F3: Escape が input にしか付いていなかったため、Tab で結果へ移ると
    // 閉じられなかった。面（dialog）側で1回だけ受け、二重取消にしない。
    const onClose = vi.fn();
    render(
      <QuickOpen
        menuLanguage="en"
        onClose={onClose}
        onOpenFile={vi.fn()}
        tree={{
          name: "workspace",
          path: "/workspace",
          kind: "directory",
          children_loaded: true,
          children_truncated: false,
          children: ["draft.md", "other.md"].map((name) => ({
            name,
            path: `/workspace/${name}`,
            kind: "file" as const,
            children_loaded: true,
            children_truncated: false,
            children: [],
          })),
        }}
      />,
    );

    const input = screen.getByRole("combobox");
    const options = screen.getAllByRole("option");
    // 入力欄
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    // 先頭の結果（Tab で移った先）
    fireEvent.keyDown(options[0], { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
    // 末尾の結果
    fireEvent.keyDown(options[options.length - 1], { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(3);
    // IME 変換中の Escape は IME に渡す（閉じない）
    fireEvent.keyDown(options[0], { key: "Escape", isComposing: true });
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("activates a result from the keyboard and ignores the right button (R5)", () => {
    // 外部レビュー R5: 結果は onPointerDown だけで実行していたため、Tab で結果へ移って
    // Enter/Space を押しても何も起きず、右クリックでも実行されていた。
    const onOpenFile = vi.fn();
    render(
      <QuickOpen
        menuLanguage="en"
        onClose={vi.fn()}
        onOpenFile={onOpenFile}
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

    const option = screen.getByRole("option", { name: /draft\.md/ });
    // 右クリック（主ボタン以外）では実行しない。
    fireEvent.pointerDown(option, { button: 2 });
    expect(onOpenFile).not.toHaveBeenCalled();
    // 主ボタンでは実行する（ポインタ経路の既存挙動）。
    fireEvent.pointerDown(option, { button: 0 });
    expect(onOpenFile).toHaveBeenCalledTimes(1);
    // キーボード由来の click（detail === 0。Enter/Space がボタンに送る）でも実行する。
    fireEvent.click(option, { detail: 0 });
    expect(onOpenFile).toHaveBeenCalledTimes(2);
    // ポインタ由来の click（detail !== 0）では二重実行しない。
    fireEvent.click(option, { detail: 1 });
    expect(onOpenFile).toHaveBeenCalledTimes(2);
  });

  it("does not run a command on the right button in the palette (R5)", () => {
    const onRun = vi.fn();
    render(
      <CommandPalette
        activeIndex={0}
        commands={[{ id: "save", label: "Save", category: "File", run: vi.fn() }]}
        menuLanguage="en"
        onClose={vi.fn()}
        onRun={onRun}
        onSetActiveIndex={vi.fn()}
        onSetQuery={vi.fn()}
        query=""
      />,
    );

    const option = screen.getByRole("option", { name: /Save/ });
    fireEvent.pointerDown(option, { button: 2 });
    expect(onRun).not.toHaveBeenCalled();
    fireEvent.pointerDown(option, { button: 0 });
    expect(onRun).toHaveBeenCalledTimes(1);
    fireEvent.click(option, { detail: 0 });
    expect(onRun).toHaveBeenCalledTimes(2);
  });

  it("keeps Tab inside the palette frame (R5)", () => {
    // 外部レビュー R5: パレット自身に focus trap が無く、Tab で枠外のボタンへ抜けていた。
    // jsdom には layout が無く `getClientRects()` が常に空なので、trap の可視判定
    // （focusTrap.ts が getClientRects で可視を判定する）を通すための最小の stub。
    const originalRects = Element.prototype.getClientRects;
    Element.prototype.getClientRects = function getClientRects() {
      return [{ bottom: 0, height: 0, left: 0, right: 0, top: 0, width: 0, x: 0, y: 0, toJSON: () => ({}) }] as unknown as DOMRectList;
    };
    try {
      render(
      <CommandPalette
        activeIndex={0}
        commands={[{ id: "save", label: "Save", category: "File", run: vi.fn() }]}
        menuLanguage="en"
        onClose={vi.fn()}
        onRun={vi.fn()}
        onSetActiveIndex={vi.fn()}
        onSetQuery={vi.fn()}
        query=""
      />,
    );

      const dialog = screen.getByRole("dialog", { name: "Command palette" });
      const input = screen.getByRole("combobox", { name: "Command palette" });
      const option = screen.getByRole("option", { name: /Save/ });
      option.focus();
      expect(document.activeElement).toBe(option);

      fireEvent.keyDown(option, { key: "Tab" });
      // 枠の中で循環する（最後の要素から Tab で先頭＝入力へ戻る）。
      expect(document.activeElement).toBe(input);
      expect(dialog.contains(document.activeElement)).toBe(true);
    } finally {
      Element.prototype.getClientRects = originalRects;
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
            match: {
              line: 4,
              column: 2,
              text: "hazakura",
              snippetStart: 1,
              matchLength: 8,
              lineLength: 8,
            },
          },
        ]}
        searchError={null}
        searching={false}
        summary={{ totalFilesScanned: 1, totalMatches: 1, totalFilesMatched: 1, truncated: false }}
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
            match: {
              line: 1,
              column: 1,
              text: "stale result",
              snippetStart: 1,
              matchLength: 6,
              lineLength: 12,
            },
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
