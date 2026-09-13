import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { QuickOpen } from "./QuickOpen";
import type { WorkspaceTreeEntry } from "../../lib/tauri";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
beforeAll(() => { HTMLElement.prototype.scrollIntoView = vi.fn(); });
afterAll(() => {
  if (originalScrollIntoView) HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  else delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
});

it("opens the first match after changing a query with the same number of results", () => {
  // The highlighted row from a different search must not become the default action.
  const tree: WorkspaceTreeEntry = {
    name: "workspace", path: "/workspace", kind: "directory",
    children_loaded: true, children_truncated: false,
    children: ["朝の余白.md", "朝の散歩.md", "夜の余白.md", "夜の散歩.md"].map((name) => ({
      name, path: `/workspace/${name}`, kind: "file",
      children_loaded: true, children_truncated: false, children: [],
    })),
  };
  const onOpenFile = vi.fn();
  render(<QuickOpen tree={tree} menuLanguage="ja" onClose={vi.fn()} onOpenFile={onOpenFile} />);
  const input = screen.getByRole("combobox");
  fireEvent.change(input, { target: { value: "朝" } });
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.change(input, { target: { value: "夜" } });
  expect(screen.getByRole("option", { selected: true }).textContent).toContain("夜の余白.md");
  fireEvent.keyDown(input, { key: "Enter" });
  expect(onOpenFile).toHaveBeenCalledWith("/workspace/夜の余白.md");
});
