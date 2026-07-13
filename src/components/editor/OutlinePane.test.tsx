import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  markdownStructureItems,
  parseMarkdownStructure,
} from "../../features/editor/markdownStructure";
import { getSidePaneCopy } from "../../lib/locale";
import { OutlinePane } from "./OutlinePane";

afterEach(cleanup);

describe("OutlinePane", () => {
  it("shows heading hierarchy and page breaks in source order", () => {
    const onSelect = vi.fn();
    const items = markdownStructureItems(
      parseMarkdownStructure("# Chapter\n\n---\n\n### Scene\n"),
    );

    render(
      <OutlinePane
        copy={getSidePaneCopy("ja")}
        currentHeadingLine={1}
        advisories={[]}
        items={items}
        onSelect={onSelect}
        truncated={false}
      />,
    );

    const chapter = screen.getByRole("button", { name: "1: Chapter" });
    const pageBreak = screen.getByRole("button", { name: "3: ページ区切り" });
    const scene = screen.getByRole("button", { name: "5: Scene" });

    expect(chapter.getAttribute("aria-current")).toBe("location");
    expect(chapter.getAttribute("style")).toContain("padding-left: 10px");
    expect(scene.getAttribute("style")).toContain("padding-left: 34px");

    fireEvent.click(pageBreak);
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "page-break", line: 3 }),
    );
  });

  it("distinguishes a trailing marker that is omitted from rendered output", () => {
    const items = markdownStructureItems(
      parseMarkdownStructure("body\n\n---\n\n"),
    );

    render(
      <OutlinePane
        copy={getSidePaneCopy("en")}
        currentHeadingLine={null}
        advisories={[]}
        items={items}
        onSelect={vi.fn()}
        truncated={false}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "3: Trailing page break (not rendered)",
      }),
    ).toBeTruthy();
  });

  it("shows non-blocking structure suggestions beside their heading", () => {
    const items = markdownStructureItems(
      parseMarkdownStructure("# Chapter\n### Scene\n"),
    );

    render(
      <OutlinePane
        advisories={[
          {
            kind: "skipped-level",
            level: 3,
            line: 2,
            previousLevel: 1,
          },
        ]}
        copy={getSidePaneCopy("ja")}
        currentHeadingLine={null}
        items={items}
        onSelect={vi.fn()}
        truncated={false}
      />,
    );

    expect(screen.getByText("構造の提案 1件")).toBeTruthy();
    expect(
      screen.getByText("見出しレベルが 1 から 3 へ飛んでいます"),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "2: Scene" })).toBeTruthy();
  });
});
