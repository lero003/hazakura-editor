/// <reference types="node" />

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const previewCss = readFileSync(
  `${process.cwd()}/src/styles/preview.css`,
  "utf8",
);

function ruleBody(selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    previewCss.match(
      new RegExp(`${escapedSelector}\\s*{(?<body>[^}]*)}`, "s"),
    )?.groups?.body ?? ""
  );
}

describe("preview.css", () => {
  it("uses the preview font-size variable as the Markdown preview base", () => {
    expect(ruleBody(".markdown-preview")).toMatch(
      /font-size:\s*var\(--preview-font-size,\s*15px\)/,
    );
  });

  it("keeps the preview card outside gutter compact", () => {
    const body = ruleBody(".markdown-preview");

    expect(body).toMatch(/margin:\s*14px auto/);
    expect(body).toMatch(/width:\s*calc\(100% - 28px\)/);
  });

  it("keeps Markdown preview hierarchy scaled from the preview font size", () => {
    for (const selector of [
      ".markdown-preview h1",
      ".markdown-preview h2",
      ".markdown-preview h3",
      ".markdown-table-frame table",
    ]) {
      const body = ruleBody(selector);

      expect(body).toMatch(/font-size:\s*(?:calc\([^)]*em[^)]*\)|[0-9.]+em)/);
      expect(body).not.toMatch(/font-size:\s*[0-9.]+px/);
    }
  });

  it("keeps the e-book pane from inheriting the standalone preview card", () => {
    const body = ruleBody(".ebook-pane.markdown-preview");

    expect(body).toMatch(/border:\s*0/);
    expect(body).toMatch(/box-shadow:\s*none/);
    expect(body).toMatch(/margin:\s*0/);
    expect(body).toMatch(/max-width:\s*none/);
    expect(body).toMatch(/width:\s*100%/);
  });

  it("keeps the e-book cover title on its own short rule", () => {
    const body = ruleBody(".ebook-chapter-opener.ebook-chapter-cover h1");

    expect(body).toMatch(/border-bottom:\s*0/);
    expect(body).toMatch(/padding-bottom:\s*0/);
  });

  it("scopes the e-book chapter navigation to the e-book pane", () => {
    const body = ruleBody(".ebook-pane .ebook-nav");

    expect(body).toMatch(/position:\s*sticky/);
    expect(body).toMatch(/overflow-x:\s*auto/);
    expect(previewCss).not.toMatch(/(?:^|\n)\.ebook-nav\s*{/);
  });
});
