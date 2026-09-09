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
      summary={{ totalFilesScanned: 12, totalMatches: 1, truncated: true }} searchError={null} workspaceOpen workspaceName="Book" />);
    const input = screen.getByRole("combobox");
    fireEvent.keyDown(input, { key: "Enter", isComposing: true }); expect(run).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Enter" }); expect(run).toHaveBeenCalledWith(row);
    expect(screen.getByText("Results were truncated. Narrow the query to see more.")).toBeTruthy();
    expect(screen.getByRole("option").tabIndex).toBe(-1);
  } finally { HTMLElement.prototype.scrollIntoView = original; }
});
