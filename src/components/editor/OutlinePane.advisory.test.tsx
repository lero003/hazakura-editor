import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { markdownStructureItems, parseMarkdownStructure } from "../../features/editor/markdownStructure";
import { analyzeMarkdownStructure } from "../../features/editor/markdownStructureAdvisories";
import { getSidePaneCopy } from "../../lib/locale";
import { OutlinePane } from "./OutlinePane";

afterEach(cleanup);

// 1 → 3 で見出しレベルが飛ぶ（skipped-level の指摘が出る）。
const SOURCE = "# Chapter\n\n### Scene\n";

function fixture() {
  const structure = parseMarkdownStructure(SOURCE);
  return { items: markdownStructureItems(structure), advisories: analyzeMarkdownStructure(SOURCE, structure) };
}

describe("OutlinePane structure advice", () => {
  it("tells what happened, why it matters, and offers a link to the heading", () => {
    const onSelect = vi.fn();
    const { items, advisories } = fixture();
    expect(advisories.length).toBeGreaterThan(0);

    render(
      <OutlinePane
        copy={getSidePaneCopy("ja")}
        currentHeadingLine={1}
        advisories={advisories}
        items={items}
        onChangeHeadingLevel={vi.fn()}
        onSelect={onSelect}
        truncated={false}
      />,
    );

    // 1) 何が起きているか
    expect(screen.getByText(/見出しレベルが 1 から 3 へ飛んでいます/)).toBeTruthy();
    // 2) なぜ確認するとよいか
    expect(screen.getByText(/見出しの深さが飛ぶと/)).toBeTruthy();
    // 3) 該当箇所へ（見出しの選択と同じ経路を使う）
    fireEvent.click(screen.getByRole("button", { name: "該当箇所へ" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0]).toMatchObject({ line: 3 });
  });

  it("keeps the level-change controls alongside the advice", () => {
    const { items, advisories } = fixture();
    render(
      <OutlinePane
        copy={getSidePaneCopy("ja")}
        currentHeadingLine={1}
        advisories={advisories}
        items={items}
        onChangeHeadingLevel={vi.fn()}
        onSelect={vi.fn()}
        truncated={false}
      />,
    );

    expect(screen.getByRole("button", { name: /「Scene」の見出しレベルを1つ上げる/ })).toBeTruthy();
  });
});
