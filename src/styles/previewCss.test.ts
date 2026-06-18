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

  it("scopes the e-book reader chrome to the e-book pane", () => {
    const body = ruleBody(".ebook-pane .ebook-reader-chrome");

    expect(body).toMatch(/position:\s*sticky/);
    expect(body).toMatch(/grid-template-columns:/);
    expect(previewCss).not.toMatch(/(?:^|\n)\.ebook-reader-chrome\s*{/);
  });

  it("keeps e-book chapter header styling inside the e-book pane flow", () => {
    const body = ruleBody(".ebook-chapter .ebook-page-flow > h1:first-child");

    expect(body).toMatch(/text-align:\s*center/);
    expect(body).toMatch(/border-bottom:\s*0/);
    expect(previewCss).not.toMatch(/(?:^|\n)\.markdown-preview > div > h1:first-child/);
  });

  it("keeps e-book CSS columns scoped to the page flow only", () => {
    const flowBody = ruleBody(".ebook-page-flow");
    const paneBody = ruleBody(".ebook-pane");
    const chromeBody = ruleBody(".ebook-pane .ebook-reader-chrome");

    expect(flowBody).toMatch(/column-width:/);
    expect(flowBody).toMatch(/column-gap:/);
    expect(flowBody).toMatch(/column-fill:\s*auto/);
    expect(paneBody).not.toMatch(/column-/);
    expect(chromeBody).not.toMatch(/column-/);
  });

  it("keeps the e-book page viewport as the only clipping page frame", () => {
    const viewportBody = ruleBody(".ebook-page-viewport");

    expect(viewportBody).toMatch(/overflow:\s*hidden/);
    expect(viewportBody).toMatch(/height:/);
    expect(viewportBody).toMatch(/max-width:/);
  });

  it("caps long e-book code blocks inside the simulated page", () => {
    const preBody = ruleBody(".ebook-chapter pre");

    expect(preBody).toMatch(/max-height:\s*calc\(var\(--ebook-page-height\) \* 0\.72\)/);
    expect(preBody).toMatch(/overflow:\s*auto/);
  });

  it("removes the old multi-sheet e-book dependencies", () => {
    expect(previewCss).not.toMatch(/\.ebook-pane \.ebook-nav/);
    expect(previewCss).not.toMatch(/\.ebook-chapter \+ \.ebook-chapter::before/);
    expect(ruleBody(".ebook-chapter")).not.toMatch(/box-shadow:/);
    expect(previewCss).not.toMatch(/writing-mode:\s*vertical/);
    expect(previewCss).not.toMatch(/\.ebook-spread/);
  });
});
