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

  it("keeps the Markdown preview loading surface theme-bound", () => {
    const body = ruleBody(".markdown-preview-loading");

    expect(body).toMatch(/min-height:\s*220px/);
    expect(previewCss).toMatch(
      /\.markdown-preview-loading::before,\n\.markdown-preview-loading::after\s*{[^}]*var\(--text-muted\)/s,
    );
    expect(previewCss).not.toMatch(/(?:^|\n)\.preview-loading\s*{/);
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
    const buttonBody = ruleBody(".ebook-pane .ebook-reader-button");
    const statusBody = ruleBody(".ebook-pane .ebook-reader-status");
    const floatingBody = ruleBody(".ebook-pane .ebook-reader-floating-action");

    expect(body).toMatch(/position:\s*sticky/);
    expect(body).toMatch(/height:\s*72px/);
    expect(body).toMatch(/grid-template-columns:\s*minmax\(104px,\s*128px\) minmax\(0,\s*1fr\) minmax\(104px,\s*128px\)/);
    expect(ruleBody(".ebook-pane .ebook-reader-chrome-with-focus")).toBe("");
    expect(statusBody).toMatch(/align-self:\s*center/);
    expect(buttonBody).toMatch(/width:\s*100%/);
    expect(floatingBody).toMatch(/position:\s*absolute/);
    expect(floatingBody).toMatch(/bottom:\s*clamp/);
    expect(floatingBody).toMatch(/left:\s*50%/);
    expect(floatingBody).toMatch(/transform:\s*translateX\(-50%\)/);
    expect(floatingBody).toMatch(/border-radius:\s*999px/);
    expect(floatingBody).not.toMatch(/width:\s*100%/);
    expect(
      ruleBody(".ebook-pane .ebook-reader-floating-action:hover,\n.ebook-pane .ebook-reader-floating-action:focus-visible"),
    ).toMatch(/transform:\s*translateX\(-50%\)/);
    expect(previewCss).not.toMatch(/(?:^|\n)\.ebook-reader-chrome\s*{/);
  });

  it("keeps the Reading Focus table of contents as a quiet overlay drawer", () => {
    const toggleBody = ruleBody(".ebook-pane .ebook-reader-toc-toggle");
    const backdropBody = ruleBody(".ebook-pane .ebook-reader-toc-backdrop");
    const panelBody = ruleBody(".ebook-pane .ebook-reader-toc-panel");
    const listBody = ruleBody(".ebook-pane .ebook-reader-toc-list");
    const itemBody = ruleBody(".ebook-pane .ebook-reader-toc-item");

    expect(toggleBody).toMatch(/position:\s*absolute/);
    expect(toggleBody).toMatch(/bottom:\s*clamp/);
    expect(toggleBody).toMatch(/left:\s*clamp/);
    expect(backdropBody).toMatch(/position:\s*absolute/);
    expect(backdropBody).toMatch(/inset:\s*0/);
    expect(panelBody).toMatch(/position:\s*absolute/);
    expect(panelBody).toMatch(/left:\s*clamp/);
    expect(panelBody).toMatch(/max-width:\s*min\(320px,\s*calc\(100% - 32px\)\)/);
    expect(listBody).toMatch(/overflow:\s*auto/);
    expect(itemBody).toMatch(/grid-template-columns:\s*2\.6em minmax\(0,\s*1fr\)/);
    expect(previewCss).not.toMatch(/(?:^|\n)\.ebook-reader-toc-panel\s*{/);
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
    expect(viewportBody).toMatch(
      /padding-bottom:\s*var\(--ebook-page-bottom-safe-area\)/,
    );
  });

  it("pins the single-page e-book reading frame dimensions", () => {
    const chapterBody = ruleBody(".ebook-chapter");

    expect(chapterBody).not.toMatch(/100vh/);
    expect(chapterBody).toMatch(/container-type:\s*inline-size/);
    expect(chapterBody).toMatch(/--ebook-page-height-max:\s*700px/);
    expect(chapterBody).toMatch(
      /--ebook-page-width:\s*min\(420px,\s*calc\(100vw - 56px\)\)/,
    );
    expect(chapterBody).toMatch(
      /--ebook-page-gap:\s*clamp\(28px,\s*5vw,\s*44px\)/,
    );
    expect(chapterBody).toMatch(/--ebook-page-footer-height:\s*34px/);
    expect(chapterBody).toMatch(
      /--ebook-page-bottom-safe-area:\s*clamp\(18px,\s*2\.4vw,\s*26px\)/,
    );
    expect(chapterBody).toMatch(
      /padding:\s*clamp\(22px,\s*3vw,\s*42px\) clamp\(22px,\s*4vw,\s*48px\) clamp\(38px,\s*5vw,\s*60px\)/,
    );
  });

  it("gates the e-book spread frame on available reader width", () => {
    expect(previewCss).toMatch(/@container\s*\(min-width:\s*920px\)/);
    expect(previewCss).toMatch(
      /\.ebook-page-sheet-spread\s*{[^}]*max-width:\s*var\(--ebook-spread-width\)/s,
    );
    expect(previewCss).toMatch(
      /\.ebook-page-sheet-spread \.ebook-page-viewport\s*{[^}]*max-width:\s*var\(--ebook-spread-width\)/s,
    );
  });

  it("keeps the e-book footer fixed outside the paginated flow", () => {
    const sheetBody = ruleBody(".ebook-page-sheet");
    const footerBody = ruleBody(".ebook-pane .ebook-reader-footer");
    const flowBody = ruleBody(".ebook-page-flow");

    expect(sheetBody).toMatch(/max-width:\s*var\(--ebook-page-width\)/);
    expect(sheetBody).toMatch(/height:\s*min\(100%,\s*calc\(var\(--ebook-page-height-max\) \+ var\(--ebook-page-footer-height\)\)\)/);
    expect(sheetBody).toMatch(/grid-template-rows:\s*minmax\(0,\s*1fr\) var\(--ebook-page-footer-height\)/);
    expect(sheetBody).toMatch(/min-height:\s*0/);
    expect(ruleBody(".ebook-page-viewport")).toMatch(/min-height:\s*0/);
    expect(footerBody).toMatch(/display:\s*grid/);
    expect(footerBody).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\) auto/);
    expect(footerBody).toMatch(/height:\s*100%/);
    expect(footerBody).toMatch(/padding:\s*0 1px/);
    expect(footerBody).not.toMatch(/position:\s*sticky/);
    expect(flowBody).not.toMatch(/footer/);
    expect(previewCss).not.toMatch(/\.ebook-page-flow\s+\.ebook-reader-footer/);
  });

  it("keeps e-book accent styling on current design tokens", () => {
    expect(previewCss).not.toMatch(/#b3416a|#f8dbe8/);
    expect(ruleBody(".ebook-pane .ebook-reader-button:hover:not(:disabled)")).toMatch(
      /var\(--accent-soft\)/,
    );
    expect(ruleBody(".ebook-pane .ebook-reader-button:focus-visible")).toMatch(
      /var\(--accent\)/,
    );
  });

  it("caps large e-book media inside the simulated page", () => {
    const imgBody = ruleBody(".ebook-chapter img");
    const preBody = ruleBody(".ebook-chapter pre");
    const imagePageBody = ruleBody(".ebook-chapter .ebook-image-page");
    const imagePageImageBody = ruleBody(".ebook-chapter .ebook-image-page > img");

    expect(imgBody).toMatch(/display:\s*block/);
    expect(imgBody).toMatch(/height:\s*auto/);
    expect(imgBody).toMatch(/margin:\s*0 auto 1em/);
    expect(imgBody).toMatch(/max-width:\s*100%/);
    expect(imgBody).toMatch(
      /max-height:\s*min\(78%,\s*calc\(var\(--ebook-page-height-max\) - 96px\)\)/,
    );
    expect(imgBody).toMatch(/object-fit:\s*contain/);
    expect(imagePageBody).toMatch(/break-before:\s*column/);
    expect(imagePageBody).not.toMatch(/break-after:/);
    expect(imagePageBody).toMatch(/break-inside:\s*avoid/);
    expect(imagePageBody).toMatch(/-webkit-column-break-before:\s*always/);
    expect(imagePageBody).not.toMatch(/-webkit-column-break-after:/);
    expect(imagePageBody).toMatch(/-webkit-column-break-inside:\s*avoid/);
    expect(imagePageBody).toMatch(/contain:\s*layout paint/);
    expect(imagePageBody).toMatch(/display:\s*grid/);
    expect(imagePageBody).toMatch(
      /block-size:\s*var\(--ebook-page-viewport-height,\s*100%\)/,
    );
    expect(imagePageBody).toMatch(
      /height:\s*var\(--ebook-page-viewport-height,\s*100%\)/,
    );
    expect(imagePageBody).toMatch(/inline-size:\s*100%/);
    expect(imagePageBody).toMatch(/line-height:\s*0/);
    expect(imagePageBody).toMatch(/margin:\s*0/);
    expect(imagePageBody).toMatch(/min-inline-size:\s*0/);
    expect(imagePageBody).toMatch(/max-height:\s*var\(--ebook-page-viewport-height,\s*100%\)/);
    expect(imagePageBody).toMatch(/overflow:\s*hidden/);
    expect(imagePageBody).toMatch(/align-items:\s*start/);
    expect(imagePageBody).toMatch(/justify-items:\s*center/);
    expect(imagePageBody).not.toMatch(/place-items:\s*center/);
    expect(imagePageImageBody).toMatch(/border:\s*0/);
    expect(imagePageImageBody).toMatch(/box-shadow:\s*none/);
    expect(imagePageImageBody).toMatch(/box-sizing:\s*border-box/);
    expect(imagePageImageBody).toMatch(/margin:\s*0 auto/);
    expect(imagePageImageBody).toMatch(
      /max-height:\s*min\(100%,\s*var\(--ebook-page-viewport-height,\s*var\(--ebook-page-height-max\)\)\)/,
    );
    expect(imagePageImageBody).toMatch(/max-width:\s*100%/);
    expect(preBody).toMatch(/max-height:\s*72%/);
    expect(preBody).toMatch(/overflow:\s*auto/);
  });

  it("does not force a leading image-only page to start after a blank column", () => {
    const firstImagePageBody = ruleBody(
      ".ebook-chapter .ebook-page-flow > .ebook-image-page:first-child",
    );

    expect(firstImagePageBody).toMatch(/break-before:\s*auto/);
    expect(firstImagePageBody).toMatch(/-webkit-column-break-before:\s*auto/);
  });

  it("scopes e-book page-break marker styling to the paginated flow", () => {
    const body = ruleBody(".ebook-page-flow .page-break");

    expect(body).toMatch(/break-before:\s*column/);
    expect(body).toMatch(/page-break-before:\s*always/);
    expect(body).not.toMatch(/border-top:/);
    expect(previewCss).not.toMatch(/(?:^|\n)\.page-break\s*{/);
  });

  it("removes the old multi-sheet e-book dependencies", () => {
    expect(previewCss).not.toMatch(/\.ebook-pane \.ebook-nav/);
    expect(previewCss).not.toMatch(/\.ebook-flow-/);
    expect(previewCss).not.toMatch(/\.ebook-reader-mode-toggle/);
    expect(previewCss).not.toMatch(/\.ebook-chapter \+ \.ebook-chapter::before/);
    expect(ruleBody(".ebook-chapter")).not.toMatch(/box-shadow:/);
    expect(previewCss).not.toMatch(/writing-mode:\s*vertical/);
    expect(previewCss).not.toMatch(/\.ebook-spread/);
    expect(previewCss).not.toMatch(/2-up|two-page|spread-view/);
  });
});
