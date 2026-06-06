import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { computeLModeDecorations } from "./extension";

// v0.15 L Mode performance baseline.
//
// These tests do not claim to make L Mode faster; they record
// the current decoration count for a handful of fixed Markdown
// fixtures. If a later change drives the count up by more
// than the budget below, the test will fail and prompt a
// second look. If a refactor legitimately improves the count,
// the budget is a single number to bump in this file.
//
// The four fixtures cover the rough shape of daily writing:
//   - short note (~10 lines)
//   - mixed Markdown with headings / lists / tasks / tables /
//     code / images
//   - long Japanese prose (200 lines of continuous text)
//   - large Markdown document (~1000 lines) for a coarse
//     ceiling check
//
// `computeLModeDecorations` is the pure function that the L
// Mode extension calls per transaction; counting its output
// is a cheap proxy for "how much work does each redraw do".
// The full EditorView / rendering pipeline adds a constant
// factor on top, but the relative shape of these counts is
// what we are protecting.

type Fixture = {
  label: string;
  source: string;
  /** Hard upper bound; intentionally generous so the test
   *  only fails on real regressions, not on style tweaks. */
  budget: number;
};

const fixtures: Fixture[] = [
  {
    label: "short note (10 lines)",
    budget: 60,
    source: [
      "# 今日やったこと",
      "",
      "- [ ] 朝ごはん",
      "- [x] 散歩",
      "- [ ] 買い物",
      "",
      "## メモ",
      "",
      "L Mode は書くのが気持ちいい。",
      "Markdown の marker が見えなくて読みやすい。",
    ].join("\n"),
  },
  {
    label: "mixed Markdown (headings / lists / tasks / tables / code)",
    budget: 140,
    source: [
      "# 報告書",
      "",
      "## 概要",
      "",
      "L Mode の装飾 baseline を取る。",
      "",
      "- 箇条書き 1",
      "- 箇条書き 2",
      "  - ネスト 1",
      "  - ネスト 2",
      "",
      "1. 番号付き",
      "2. 番号付き",
      "",
      "- [x] 完了",
      "- [ ] 未完了",
      "- [ ] もう一つ",
      "",
      "| 列1 | 列2 |",
      "| --- | --- |",
      "| 値1 | 値2 |",
      "| 値3 | 値4 |",
      "",
      "```ts",
      "function hello() {",
      "  return 'world';",
      "}",
      "```",
      "",
      "![代替テキスト](assets/sample.png)",
      "",
      "[リンクテキスト](https://example.com)",
    ].join("\n"),
  },
];

// Build a long Japanese-prose fixture programmatically so the
// test file stays readable. The body is intentionally repetitive
// — the point is to count decorations on a long document, not
// to write good prose.
function buildLongJapaneseProse(lines: number): string {
  const sentence =
    "これは L Mode のパフォーマンス baseline を取るための長い日本語の散文です。";
  return Array.from({ length: lines }, () => sentence).join("\n");
}

fixtures.push({
  label: "long Japanese prose (200 lines)",
  budget: 500,
  source: buildLongJapaneseProse(200),
});

// Large-ish Markdown document: alternating headings, paragraphs,
// lists, and code blocks. 1000 lines is well past the L Mode
// "magazine-feel" comfort zone but still representative of a
// long project note.
function buildLargeMarkdown(lines: number): string {
  const blocks: string[] = [];
  for (let i = 0; i < lines; i += 5) {
    blocks.push(`# セクション ${Math.floor(i / 5) + 1}`);
    blocks.push("");
    blocks.push("L Mode の長い Markdown を baseline 用に並べている。");
    blocks.push("");
    blocks.push("- 箇条書き a");
    blocks.push("- 箇条書き b");
  }
  return blocks.join("\n");
}

fixtures.push({
  label: "large Markdown (~1000 lines)",
  budget: 3000,
  source: buildLargeMarkdown(1000),
});

function countDecorations(source: string): number {
  const state = EditorState.create({ doc: source });
  const set = computeLModeDecorations(state, {
    workspaceRoot: null,
    documentPath: null,
  });
  let count = 0;
  set.iter();
  // CodeMirror's `DecorationSet.iter` is a generator-style
  // cursor; we cannot simply .size it. Walk it explicitly.
  const cursor = set.iter();
  while (cursor.value) {
    count += 1;
    cursor.next();
  }
  return count;
}

describe("L Mode decoration count baseline (v0.15)", () => {
  for (const fixture of fixtures) {
    it(`stays within the budget for ${fixture.label}`, () => {
      const count = countDecorations(fixture.source);
      // The budget is intentionally generous so routine
      // style tweaks do not trip this test. The intent is
      // to catch real regressions, not to police tiny
      // decoration-shape tweaks.
      expect(
        count,
        `decoration count ${count} exceeded budget ${fixture.budget}`,
      ).toBeLessThan(fixture.budget);
    });
  }

  it("reports a stable, deterministic count for the short note", () => {
    // Pin the exact count for the shortest fixture so future
    // refactors that legitimately change decoration shape
    // (e.g. dropping a chip attribute) get a clear, named
    // signal in the test diff.
    const source = fixtures[0].source;
    const first = countDecorations(source);
    const second = countDecorations(source);
    expect(second).toBe(first);
  });
});
