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

  it("keeps the inline Apple Assist diff from creating horizontal scroll", () => {
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
});
