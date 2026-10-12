import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceTreeEntry } from "../../lib/tauri";
import { BookScopeSelectorTree } from "./BookScopeSelectorTree";

afterEach(cleanup);

function folder(path: string, children: WorkspaceTreeEntry[] = [], loaded = true): WorkspaceTreeEntry {
  return { path, name: path.split("/").pop()!, kind: "directory", children,
    children_loaded: loaded, children_truncated: false };
}

describe("BookScopeSelectorTree folder lifecycle", () => {
  it("keeps a failed folder load collapsed and permits retry without an unhandled rejection", async () => {
    const onLoadDirectory = vi.fn().mockRejectedValueOnce(new Error("Folder unavailable")).mockResolvedValueOnce(undefined);
    render(<BookScopeSelectorTree entry={folder("/book", [folder("/book/chapters", [], false)])}
      onLoadDirectory={onLoadDirectory} onToggle={vi.fn()} selectedPaths={new Set()} workspaceRootPath="/book" />);
    const button = screen.getByRole("button", { name: "chapters" });
    await act(async () => { fireEvent.click(button); });
    expect(button.hasAttribute("disabled")).toBe(false);
    expect(button.getAttribute("aria-expanded")).toBe("false");
    await act(async () => { fireEvent.click(button); });
    expect(onLoadDirectory).toHaveBeenCalledTimes(2);
    expect(button.getAttribute("aria-expanded")).toBe("true");
  });

  it("opens a newly selected workspace after the previous root was collapsed", () => {
    const props = { onLoadDirectory: vi.fn(async () => {}), onToggle: vi.fn(), selectedPaths: new Set<string>() };
    const view = render(<BookScopeSelectorTree {...props} entry={folder("/book")} workspaceRootPath="/book" />);
    fireEvent.click(screen.getByRole("button", { name: "book" }));
    expect(screen.getByRole("button", { name: "book" }).getAttribute("aria-expanded")).toBe("false");
    view.rerender(<BookScopeSelectorTree {...props} entry={folder("/next")} workspaceRootPath="/next" />);
    expect(screen.getByRole("button", { name: "next" }).getAttribute("aria-expanded")).toBe("true");
  });
});
