/// <reference types="node" />

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const previewCss = readFileSync(
  `${process.cwd()}/src/styles/preview.css`,
  "utf8",
);

describe("status bar CSS", () => {
  it("keeps the normal status bar visible while shedding secondary text on narrow windows", () => {
    const statusBarRule =
      previewCss.match(/\.status-bar\s*{(?<body>[^}]*)}/s)?.groups?.body ?? "";
    const detailRule =
      previewCss.match(/\.status-bar-detail\s*{(?<body>[^}]*)}/s)?.groups
        ?.body ?? "";
    const mediumRule =
      previewCss.match(
        /@media \(max-width: 860px\)\s*{(?<body>[\s\S]*?)\n}/,
      )?.groups?.body ?? "";
    const compactRule =
      previewCss.match(
        /@media \(max-width: 720px\)\s*{(?<body>[\s\S]*)\n}/,
      )?.groups?.body ?? "";

    expect(statusBarRule).toMatch(/min-height:\s*28px/);
    expect(statusBarRule).toMatch(/overflow:\s*visible/);
    expect(detailRule).toMatch(/max-width:\s*min\(64ch,\s*52vw\)/);
    expect(mediumRule).toMatch(/\.status-bar-detail\s*{[^}]*display:\s*none/s);
    expect(compactRule).toMatch(
      /\.status-bar-format-label\s*{[^}]*display:\s*none/s,
    );
  });
});
