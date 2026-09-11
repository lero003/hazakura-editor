import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { GlobalSearch } from "./GlobalSearch";
import type { WorkspaceSearchMatch } from "../../lib/tauri/workspace";

afterEach(cleanup);

/**
 * テスト用の一致。backend は「一致位置を中心に切った snippet」を返す契約なので、
 * 短い行では `snippetStart = 1`（行頭から）・`lineLength` は行の文字数になる。
 */
function hit(
  line: number,
  column: number,
  text: string,
  matchLength: number,
): WorkspaceSearchMatch {
  return {
    line,
    column,
    text,
    snippetStart: 1,
    matchLength,
    lineLength: Array.from(text).length,
  };
}
it("runs a match from the keyboard and ignores the right button (R5)", () => {
  // 外部レビュー R5: 行の実行が onPointerDown だけで、右クリックでも実行されていた。
  const original = HTMLElement.prototype.scrollIntoView;
  HTMLElement.prototype.scrollIntoView = vi.fn();
  const run = vi.fn();
  const match = hit(3, 1, "needle here", 6);
  const row = { fileIndex: 0, matchIndex: 0, file: { path: "/work/a.md", relativePath: "chapters/a.md", matches: [match], truncated: false }, match };
  try {
  render(<GlobalSearch activeIndex={0} menuLanguage="en" onClose={vi.fn()} onRun={run}
    onSetActiveIndex={() => {}} onSetQuery={() => {}} query="needle" searching={false}
    rows={[row]} summary={null} searchError={null}
    workspaceOpen workspaceName="My manuscript" />);

  const option = screen.getByRole("option");
  fireEvent.pointerDown(option, { button: 2 });
  expect(run).not.toHaveBeenCalled();
  fireEvent.pointerDown(option, { button: 0 });
  expect(run).toHaveBeenCalledTimes(1);
  fireEvent.click(option, { detail: 0 });
  expect(run).toHaveBeenCalledTimes(2);
  fireEvent.click(option, { detail: 1 });
  expect(run).toHaveBeenCalledTimes(2);
  } finally {
    if (original) { HTMLElement.prototype.scrollIntoView = original; } else { delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView; }
  }
});

it("keeps the selected folder visible and exposes a close action without running a match", () => {
  const close = vi.fn(); const run = vi.fn();
  render(<GlobalSearch activeIndex={0} menuLanguage="en" onClose={close} onRun={run}
    onSetActiveIndex={() => {}} onSetQuery={() => {}} query="" rows={[]} searching={false}
    summary={null} searchError={null} workspaceOpen workspaceName="My manuscript" />);
  expect(screen.getByText("My manuscript")).toBeTruthy();
  expect(screen.getByText("Search within this folder. Files are not changed.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Close search" }));
  expect(close).toHaveBeenCalledOnce(); expect(run).not.toHaveBeenCalled();
});

it("uses the selected match for Enter and keeps truncation distinct from completion", () => {
  const original = HTMLElement.prototype.scrollIntoView;
  HTMLElement.prototype.scrollIntoView = vi.fn();
  const match = hit(7, 2, "a needle in this file", 6);
  const row = { fileIndex: 0, matchIndex: 0, file: { path: "/work/b.md", relativePath: "chapters/b.md", matches: [match], truncated: true }, match };
  const run = vi.fn();
  try {
    render(<GlobalSearch activeIndex={0} menuLanguage="en" onClose={() => {}} onRun={run}
      onSetActiveIndex={() => {}} onSetQuery={() => {}} query="needle" rows={[row]} searching={false}
      summary={{ totalFilesScanned: 12, totalMatches: 1, totalFilesMatched: 1, truncated: true }} searchError={null} workspaceOpen workspaceName="Book" />);
    const input = screen.getByRole("combobox");
    fireEvent.keyDown(input, { key: "Enter", isComposing: true }); expect(run).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Enter" }); expect(run).toHaveBeenCalledWith(row);
    expect(screen.getByText("Results were truncated. Narrow the query to see more.")).toBeTruthy();
    expect(screen.getByRole("option").tabIndex).toBe(-1);
  } finally { HTMLElement.prototype.scrollIntoView = original; }
});

it("marks only the matched text and separates per-file counts from the scan count", () => {
  // jsdom には scrollIntoView が無い（選択項目の追従で呼ばれる）。
  const original = HTMLElement.prototype.scrollIntoView;
  HTMLElement.prototype.scrollIntoView = vi.fn();
  const first = hit(3, 5, "the needle is here", 6);
  const second = hit(9, 1, "needle again", 6);
  const file = { path: "/work/a.md", relativePath: "chapters/a.md", matches: [first, second], truncated: false };
  const rows = [
    { fileIndex: 0, matchIndex: 0, file, match: first },
    { fileIndex: 0, matchIndex: 1, file, match: second },
  ];
  render(<GlobalSearch activeIndex={0} menuLanguage="en" onClose={() => {}} onRun={() => {}}
    onSetActiveIndex={() => {}} onSetQuery={() => {}} query="needle" rows={rows} searching={false}
    summary={{ totalFilesScanned: 4, totalMatches: 2, totalFilesMatched: 1, truncated: false }} searchError={null} workspaceOpen workspaceName="Book" />);

  // 一致した範囲だけが mark になる（前後の文はそのまま）。
  const marks = [...document.querySelectorAll("mark.global-search-match")];
  expect(marks.map((mark) => mark.textContent)).toEqual(["needle", "needle"]);
  // 着色の前後は素のテキストのまま（行全体は変わらない）。
  expect(marks[0].parentElement?.textContent).toBe("the needle is here");
  expect(marks[1].parentElement?.textContent).toBe("needle again");

  // ファイル別の件数と、走査したファイル数は別物として出す。
  expect(screen.getByLabelText("2 matches").textContent).toBe("2");
  expect(screen.getByText("1 file · 2 matches (scanned 4)")).toBeTruthy();
  HTMLElement.prototype.scrollIntoView = original;
});

it("does not activate or announce old results while the replacement query searches", () => {
  const run = vi.fn();
  const match = hit(1, 1, "apple", 6);
  render(<GlobalSearch activeIndex={0} menuLanguage="en" onClose={() => {}} onRun={run}
    onSetActiveIndex={() => {}} onSetQuery={() => {}} query="banana"
    rows={[{ fileIndex: 0, matchIndex: 0, file: { path: "/book/a.md", relativePath: "a.md", matches: [match], truncated: true }, match }]}
    searching summary={{ totalFilesScanned: 4, totalMatches: 2, totalFilesMatched: 1, truncated: true }} searchError={null} workspaceOpen />);
  const input = screen.getByRole("combobox");
  fireEvent.keyDown(input, { key: "Enter" });
  expect(run).not.toHaveBeenCalled();
  expect(screen.queryByRole("option")).toBeNull();
  expect(screen.queryByText(/Results were truncated/)).toBeNull();
  expect(document.activeElement).toBe(input);
});

it("keeps emoji and supplementary-plane characters intact around the match (R1)", () => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  // Rust の column はコードポイント数（chars()）。UTF-16 の slice だと
  // 絵文字の途中から切り出してしまう。
  const emoji = hit(1, 2, "😀余白のはなし", 2);
  const kanji = hit(2, 5, "𠮷野家の余白の話", 2);
  const file = { path: "/work/b.md", relativePath: "chapters/b.md", matches: [emoji, kanji], truncated: false };
  render(<GlobalSearch activeIndex={0} menuLanguage="en" onClose={() => {}} onRun={() => {}}
    onSetActiveIndex={() => {}} onSetQuery={() => {}} query="余白"
    rows={[
      { fileIndex: 0, matchIndex: 0, file, match: emoji },
      { fileIndex: 0, matchIndex: 1, file, match: kanji },
    ]}
    searching={false}
    summary={{ totalFilesScanned: 4, totalMatches: 2, totalFilesMatched: 1, truncated: false }} searchError={null}
    workspaceOpen workspaceName="Book" />);

  const marks = [...document.querySelectorAll("mark.global-search-match")];
  // 一致した2文字だけが mark になり、絵文字・補助面漢字は分断されない。
  expect(marks.map((mark) => mark.textContent)).toEqual(["余白", "余白"]);
  expect(marks[0].parentElement?.textContent).toBe("😀余白のはなし");
  expect(marks[1].parentElement?.textContent).toBe("𠮷野家の余白の話");
  // サロゲート片（壊れた文字）が混ざっていないこと。
  for (const mark of marks) {
    expect(mark.textContent).not.toMatch(/[\uD800-\uDFFF]/u);
  }
});

it("shows a late match that the backend snippet kept", () => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  // backend は 4096 バイトの行でも「一致位置を中心に切った snippet」を返すので、
  // 行の後方の一致も payload に入っている（レビューP2）。
  const long = "あ".repeat(600) + "余白" + "い".repeat(600);
  const chars = Array.from(long);
  const snippetStart = 541; // 一致(601文字目)の手前60文字から
  const snippet = chars.slice(snippetStart - 1, snippetStart - 1 + 240).join("");
  const late: WorkspaceSearchMatch = {
    line: 1,
    column: 601,
    text: snippet,
    snippetStart,
    matchLength: 2,
    lineLength: chars.length,
  };
  const file = { path: "/work/c.md", relativePath: "chapters/c.md", matches: [late], truncated: false };
  render(<GlobalSearch activeIndex={0} menuLanguage="en" onClose={() => {}} onRun={() => {}}
    onSetActiveIndex={() => {}} onSetQuery={() => {}} query="余白"
    rows={[{ fileIndex: 0, matchIndex: 0, file, match: late }]}
    searching={false}
    summary={{ totalFilesScanned: 1, totalMatches: 1, totalFilesMatched: 1, truncated: false }} searchError={null}
    workspaceOpen workspaceName="Book" />);

  const mark = document.querySelector("mark.global-search-match");
  expect(mark?.textContent).toBe("余白");
  const line = mark?.parentElement?.textContent ?? "";
  // 一致が見えており、行頭と行末の両方を切った印が付いている。
  expect(line).toContain("余白");
  expect(line.startsWith("…")).toBe(true);
  expect(line.endsWith("…")).toBe(true);
  // 表示は 240 文字ぶんに収まる（＋省略記号）。
  expect(Array.from(line.replace(/…/gu, "")).length).toBeLessThanOrEqual(240);
});
