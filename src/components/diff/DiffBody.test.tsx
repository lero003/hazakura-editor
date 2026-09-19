import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DiffBody } from "./DiffBody";
import type { CompareCase, CompareViewState } from "../../types";

afterEach(cleanup);

// 見出しの下の変更があると、`DiffBody` はセクション行（UI 文言＋見出し）を挟む。
const comparison: Extract<CompareCase, { kind: "file" }> = {
  kind: "file",
  key: "reference",
  leftPath: "/ref.md",
  rightPath: "/doc.md",
  anchor: { path: "/ref.md", name: "Reference.md", label: "Source" },
  target: { path: "/doc.md", name: "Document.md", label: "Editor" },
};

const view: CompareViewState = {
  caseKey: comparison.key,
  additions: 1,
  removals: 1,
  lines: [
    { kind: "equal", leftLine: 1, rightLine: 1, text: "# Heading" },
    { kind: "removed", leftLine: 2, rightLine: null, text: "old body" },
    { kind: "added", leftLine: null, rightLine: 2, text: "new body" },
  ],
};

describe("DiffBody document language", () => {
  it("keeps the UI language off the body rows but leaves the section label to the UI", () => {
    document.documentElement.lang = "ja";
    const { container } = render(
      <DiffBody compareCase={comparison} menuLanguage="ja" view={view} />,
    );

    // 本文の行は UI 言語を継承しない。
    const bodyRow = container.querySelector(".diff-split-row") as HTMLElement;
    expect(bodyRow).not.toBeNull();
    expect(bodyRow.getAttribute("lang")).toBe("");

    // セクション行は「変更位置:」という UI 文言を含むので、UI 言語のまま。
    const sectionRow = container.querySelector(".diff-section-row") as HTMLElement;
    expect(sectionRow).not.toBeNull();
    expect(sectionRow.textContent).toContain("変更位置:");
    expect(sectionRow.hasAttribute("lang")).toBe(false);

    document.documentElement.lang = "";
  });
});
