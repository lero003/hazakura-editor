import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { GlobalSearch } from "./GlobalSearch";
afterEach(cleanup);
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
  const match = { line: 7, column: 2, text: "a needle in this file" };
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
  const first = { line: 3, column: 5, text: "the needle is here" };
  const second = { line: 9, column: 1, text: "needle again" };
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
  const match = { line: 1, column: 1, text: "apple" };
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
