/// <reference types="node" />

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const lModeCss = readFileSync(
  `${process.cwd()}/src/styles/lMode.css`,
  "utf8",
);

describe("lMode.css", () => {
  it("keeps CSS blocks balanced so later L Mode rules still apply", () => {
    const openBraces = (lModeCss.match(/{/g) ?? []).length;
    const closeBraces = (lModeCss.match(/}/g) ?? []).length;

    expect(openBraces).toBe(closeBraces);
  });

  it("keeps the L Mode editor height chain explicit", () => {
    for (const selector of [
      ".app-shell",
      ".workspace",
      ".editor-preview-grid",
      ".editor-pane",
    ]) {
      const escapedSelector = selector.replace(".", "\\.");
      const rule =
        lModeCss.match(
          new RegExp(
            `:root\\[data-l-mode="on"\\] ${escapedSelector}\\s*{(?<body>[^}]*)}`,
            "s",
          ),
        )?.groups?.body ?? "";

      if (selector === ".app-shell") {
        expect(rule).toMatch(/grid-template-rows:\s*minmax\(0,\s*1fr\)/);
      } else {
        expect(rule).toMatch(/height:\s*100%/);
      }
      expect(rule).toMatch(/min-height:\s*0/);
    }
  });

  it("keeps the CodeMirror scroller geometry close to its default", () => {
    const scrollerRule =
      lModeCss.match(
        /:root\[data-l-mode="on"\] \.cm-scroller\s*{(?<body>[^}]*)}/s,
      )?.groups?.body ?? "";

    expect(scrollerRule).toMatch(/overflow-y:\s*auto/);
    expect(scrollerRule).not.toMatch(/overflow-x:\s*hidden/);
    expect(scrollerRule).not.toMatch(/height:/);
    expect(scrollerRule).not.toMatch(/padding:/);
  });

  it("keeps secondary status details out of the quiet default view", () => {
    const statusRule =
      lModeCss.match(
        /:root\[data-l-mode="on"\] \.status-bar\s*{(?<body>[^}]*)}/s,
      )?.groups?.body ?? "";
    const detailRule =
      lModeCss.match(
        /:root\[data-l-mode="on"\] \.status-bar-detail\s*{(?<body>[^}]*)}/s,
      )?.groups?.body ?? "";

    expect(statusRule).toMatch(/color:\s*color-mix\(in srgb,\s*var\(--text-muted\)/);
    expect(statusRule).not.toMatch(/var\(--status-text\)/);
    expect(statusRule).not.toMatch(/var\(--status-bg\)/);
    expect(lModeCss).toMatch(
      /:root\[data-l-mode="on"\] \.status-agent-indicator/,
    );
    expect(detailRule).toMatch(/display:\s*none/);
    expect(lModeCss).toMatch(
      /:root\[data-l-mode="on"\] \.status-bar:hover \.status-bar-detail/,
    );
    expect(lModeCss).toMatch(
      /:root\[data-l-mode="on"\] \.status-bar:focus-within \.status-bar-detail/,
    );
  });

  it("does not restyle CodeMirror's measured line boxes with margins", () => {
    expect(lModeCss).not.toMatch(/\.cm-line[^{]*{[^}]*margin/s);
    expect(lModeCss).not.toMatch(/\.cm-lmode-heading-[^{]*{[^}]*margin/s);
    expect(lModeCss).not.toMatch(/\.cm-lmode-blockquote\s*{[^}]*margin/s);
  });

  it("keeps fenced code readable without borrowing status bar colors", () => {
    const fencedCodeRule =
      lModeCss.match(
        /:root\[data-l-mode="on"\] \.cm-lmode-fenced-code\s*{(?<body>[^}]*)}/s,
      )?.groups?.body ?? "";

    expect(fencedCodeRule).not.toMatch(/var\(--status-bg\)/);
    expect(fencedCodeRule).not.toMatch(/var\(--status-text\)/);
    expect(fencedCodeRule).toMatch(/color:\s*var\(--text\)/);
    expect(lModeCss).toMatch(
      /:root\[data-l-mode="on"\] \.cm-lmode-fenced-code span:not\(\.cm-lmode-hidden\)/,
    );
  });

  it("keeps the paper surface outside the editable content DOM", () => {
    const paperRule =
      lModeCss.match(
        /:root\[data-l-mode="on"\] \.editor-host::before\s*{(?<body>[^}]*)}/s,
      )?.groups?.body ?? "";
    const contentRule =
      lModeCss.match(
        /:root\[data-l-mode="on"\] \.cm-content\s*{(?<body>[^}]*)}/s,
      )?.groups?.body ?? "";

    expect(contentRule).not.toMatch(/background:/);
    expect(contentRule).not.toMatch(/box-shadow:/);
    expect(contentRule).not.toMatch(/border-(left|right):/);
    expect(contentRule).not.toMatch(/min-height:/);
    expect(lModeCss).toMatch(
      /:root\[data-l-mode="on"\] \.editor-host::before/,
    );
    expect(paperRule).toMatch(/inset:\s*0 auto 0 50%/);
  });

  it("does not hide Markdown markers with display none", () => {
    const hiddenMarkerRule =
      lModeCss.match(
        /:root\[data-l-mode="on"\] \.cm-lmode-hidden\s*{(?<body>[^}]*)}/s,
      )?.groups?.body ?? "";

    expect(hiddenMarkerRule).not.toMatch(/display:\s*none/);
    expect(hiddenMarkerRule).toMatch(/text-decoration:\s*none/);
    expect(hiddenMarkerRule).toMatch(/background:\s*transparent/);
  });

  it("reveals hidden Markdown markers on the active or hovered line", () => {
    expect(lModeCss).toMatch(
      /:root\[data-l-mode="on"\] \.cm-lmode-source-line \.cm-lmode-hidden/,
    );
    expect(lModeCss).toMatch(
      /:root\[data-l-mode="on"\] \.cm-line:hover \.cm-lmode-hidden/,
    );
    const hoverMarkerRule =
      lModeCss.match(
        /:root\[data-l-mode="on"\] \.cm-lmode-source-line \.cm-lmode-hidden,\s*:root\[data-l-mode="on"\] \.cm-line:hover \.cm-lmode-hidden\s*{(?<body>[^}]*)}/s,
      )?.groups?.body ?? "";

    expect(hoverMarkerRule).toMatch(/font-size:\s*inherit/);
    expect(hoverMarkerRule).toMatch(/inline-size:\s*auto/);
    expect(hoverMarkerRule).toMatch(/max-inline-size:\s*none/);
  });
});
