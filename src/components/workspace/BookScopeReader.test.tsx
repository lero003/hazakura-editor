import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BookScopeReader } from "./BookScopeReader";

vi.mock("../editor/preview/PreviewPane", () => ({
  default: ({ source }: { source: string }) => <article>{source}</article>,
}));

afterEach(cleanup);

describe("BookScopeReader", () => {
  it("renders chapters in order and opens the selected source for editing", async () => {
    const onEditChapter = vi.fn();
    render(
      <BookScopeReader
        documents={[
          { name: "one.md", path: "/workspace/one.md", relativePath: "one.md", source: "---\ntitle: One\n---\n# One", usesLiveBuffer: true },
          { name: "two.md", path: "/workspace/two.md", relativePath: "two.md", source: "# Two", usesLiveBuffer: false },
        ]}
        failures={[]}
        menuLanguage="ja"
        onClose={vi.fn()}
        onEditChapter={onEditChapter}
        onOpenLink={vi.fn()}
        skippedForBudget={[]}
        workspaceRoot="/workspace"
      />,
    );

    expect(screen.getAllByRole("heading", { level: 2 }).map((node) => node.textContent)).toEqual([
      "1. one.md未保存の編集を反映",
      "2. two.md",
    ]);
    expect(await screen.findByText("# One")).toBeTruthy();
    expect(screen.queryByText(/title: One/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "two.mdを編集" }));
    expect(onEditChapter).toHaveBeenCalledWith("/workspace/two.md");
  });

  it("reports partial chapters and closes with Escape", () => {
    const onClose = vi.fn();
    render(
      <BookScopeReader
        documents={[]}
        failures={[{ relativePath: "missing.md", reason: "missing" }]}
        menuLanguage="en"
        onClose={onClose}
        onEditChapter={vi.fn()}
        onOpenLink={vi.fn()}
        skippedForBudget={["large.md"]}
        workspaceRoot="/workspace"
      />,
    );

    expect(screen.getByText(/missing.md/)).toBeTruthy();
    expect(screen.getByText(/large.md/)).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("dialog", { name: "Read whole book" }), { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("filters the contents to bounded in-memory search results and jumps to a match", () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
    render(
      <BookScopeReader
        documents={[
          { name: "one.md", path: "/workspace/one.md", relativePath: "one.md", source: "# One\nfirst", usesLiveBuffer: false },
          { name: "two.md", path: "/workspace/two.md", relativePath: "two.md", source: "# Two\nsecond second", usesLiveBuffer: false },
        ]}
        failures={[]}
        menuLanguage="ja"
        onClose={vi.fn()}
        onEditChapter={vi.fn()}
        onOpenLink={vi.fn()}
        skippedForBudget={[]}
        workspaceRoot="/workspace"
      />,
    );

    fireEvent.change(screen.getByRole("searchbox", { name: "本の中を検索" }), {
      target: { value: "second" },
    });
    expect(screen.getByText("1章・2件一致")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /one\.mdへ移動/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /two\.mdへ移動/ }));
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
  });

  it("clears a search with Escape before closing the reader", () => {
    const onClose = vi.fn();
    render(
      <BookScopeReader
        documents={[
          { name: "one.md", path: "/workspace/one.md", relativePath: "one.md", source: "# One", usesLiveBuffer: false },
        ]}
        failures={[]}
        menuLanguage="en"
        onClose={onClose}
        onEditChapter={vi.fn()}
        onOpenLink={vi.fn()}
        skippedForBudget={[]}
        workspaceRoot="/workspace"
      />,
    );

    const search = screen.getByRole("searchbox", { name: "Search this book" });
    fireEvent.change(search, { target: { value: "one" } });
    fireEvent.keyDown(search, { key: "Escape" });
    expect((search as HTMLInputElement).value).toBe("");
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(search, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
