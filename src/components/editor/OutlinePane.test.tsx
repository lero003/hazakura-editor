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
    const onChangeHeadingLevel = vi.fn();
    const items = markdownStructureItems(
      parseMarkdownStructure("# Chapter\n\n---\n\n### Scene\n"),
    );

    render(
      <OutlinePane
        copy={getSidePaneCopy("ja")}
        currentHeadingLine={1}
        advisories={[]}
        items={items}
        onChangeHeadingLevel={onChangeHeadingLevel}
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

    const promoteChapter = screen.getByRole("button", {
      name: "1: 「Chapter」の見出しレベルを1つ上げる",
    });
    expect(promoteChapter.hasAttribute("disabled")).toBe(true);

    fireEvent.click(
      screen.getByRole("button", {
        name: "5: 「Scene」の見出しレベルを1つ上げる",
      }),
    );
    expect(onChangeHeadingLevel).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "heading", level: 3, line: 5 }),
      "promote",
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
        onChangeHeadingLevel={vi.fn()}
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
        onChangeHeadingLevel={vi.fn()}
        onSelect={vi.fn()}
        truncated={false}
      />,
    );

    expect(
      screen.getByText("構造のヒント 1件（エラーではありません）"),
    ).toBeTruthy();
    expect(
      screen.getByText("ヒント: 見出しレベルが 1 から 3 へ飛んでいます"),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "2: Scene" })).toBeTruthy();
  });
});

it("separates structure notes from navigation without inventing notes or editing source", () => {
  const items = markdownStructureItems(parseMarkdownStructure("# Start\n\n### Scene\n"));
  const select = vi.fn(); const change = vi.fn();
  render(<OutlinePane copy={getSidePaneCopy("en")} currentHeadingLine={1} items={items}
    advisories={[]} onSelect={select} onChangeHeadingLevel={change} truncated={false} />);
  fireEvent.click(screen.getByRole("button", { name: "Structure notes" }));
  expect(screen.getByText("No structure notes for this document.")).toBeTruthy();
  expect(select).not.toHaveBeenCalled(); expect(change).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Headings" }));
  fireEvent.click(screen.getByRole("button", { name: "3: Scene" }));
  expect(select).toHaveBeenCalledWith(items[1]);
});

it("keeps current source targets and the analysis limit in the notes surface", () => {
  const items = markdownStructureItems(parseMarkdownStructure("# Start\n\n### Scene\n"));
  const select = vi.fn(); const change = vi.fn();
  render(<OutlinePane copy={getSidePaneCopy("en")} currentHeadingLine={3} items={items}
    advisories={[{ kind: "skipped-level", line: 3, previousLevel: 1, level: 3 }]}
    onSelect={select} onChangeHeadingLevel={change} truncated />);
  fireEvent.click(screen.getByRole("button", { name: "Structure notes" }));
  expect(screen.queryByRole("button", { name: "1: Start" })).toBeNull();
  const target = screen.getByRole("button", { name: "3: Scene" });
  expect(target.getAttribute("aria-current")).toBe("location");
  fireEvent.click(target); expect(select).toHaveBeenCalledWith(items[1]);
  fireEvent.click(screen.getByRole("button", { name: /Promote.*Scene/ }));
  expect(change).toHaveBeenCalledWith(items[1], "promote");
  expect(screen.getByText(getSidePaneCopy("en").outlineTruncated)).toBeTruthy();
});
