/// <reference types="node" />

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appleAssistReviewCss = readFileSync(
  `${process.cwd()}/src/styles/apple-assist-review.css`,
  "utf8",
);

function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

describe("apple-assist-review.css", () => {
  const css = stripCssComments(appleAssistReviewCss);

  it("keeps the inline Hazakura Local Assist diff from creating horizontal scroll", () => {
    const diffRule =
      css.match(/\.apple-assist-review-bar-diff\s*{(?<body>[^}]*)}/s)?.groups
        ?.body ?? "";
    const rowRule =
      css.match(
        /\.apple-assist-review-bar-diff \.diff-split-row\s*{(?<body>[^}]*)}/s,
      )?.groups?.body ?? "";
    const sectionRowRule =
      css.match(
        /\.apple-assist-review-bar-diff \.diff-section-row\s*{(?<body>[^}]*)}/s,
      )?.groups?.body ?? "";

    expect(diffRule).toMatch(/overflow-x:\s*hidden/);
    expect(rowRule).toMatch(/min-width:\s*0/);
    expect(rowRule).toMatch(/grid-template-columns:\s*40px minmax\(0,\s*1fr\) 40px minmax\(0,\s*1fr\)/);
    expect(sectionRowRule).toMatch(/min-width:\s*0/);
  });

  it("reads the proposal in the main editing region instead of floating (07)", () => {
    const reviewRule =
      css.match(/\.local-assist-proposal-review\s*{(?<body>[^}]*)}/s)?.groups
        ?.body ?? "";
    // 右下のフローティングではない（主編集領域いっぱいを占める）。
    expect(reviewRule).toMatch(/position:\s*absolute/);
    expect(reviewRule).toMatch(/inset:\s*0/);
    expect(reviewRule).not.toMatch(/position:\s*fixed/);
    expect(reviewRule).not.toMatch(/bottom:\s*\d+px/);
    expect(reviewRule).toMatch(/background:\s*var\(--surface-paper\)/);
    // 長い差分は面の内側でスクロールする。
    expect(reviewRule).toMatch(/overflow:\s*hidden/);
    expect(
      css.match(/\.local-assist-proposal-review-diff\s*{(?<body>[^}]*)}/s)
        ?.groups?.body ?? "",
    ).toMatch(/overflow:\s*auto/);
    // 操作は下端に固定する。
    expect(
      css.match(/\.local-assist-proposal-review-footer\s*{(?<body>[^}]*)}/s)
        ?.groups?.body ?? "",
    ).toMatch(/margin-top:\s*auto/);
  });
});
