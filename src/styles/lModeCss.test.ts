/// <reference types="node" />

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const lModeCss = readFileSync(
  `${process.cwd()}/src/styles/lMode.css`,
  "utf8",
);

describe("lMode.css", () => {
  it("keeps the L Mode editor height chain explicit", () => {
    for (const selector of [
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

      expect(rule).toMatch(/height:\s*100%/);
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
    expect(scrollerRule).not.toMatch(/padding:/);
  });

  it("does not restyle CodeMirror's measured line boxes with margins", () => {
    expect(lModeCss).not.toMatch(/\.cm-line[^{]*{[^}]*margin/s);
    expect(lModeCss).not.toMatch(/\.cm-lmode-heading-[^{]*{[^}]*margin/s);
    expect(lModeCss).not.toMatch(/\.cm-lmode-blockquote\s*{[^}]*margin/s);
  });

  it("keeps the paper surface outside the editable content DOM", () => {
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
  });

  it("does not hide Markdown markers with display none", () => {
    const hiddenMarkerRule =
      lModeCss.match(
        /:root\[data-l-mode="on"\] \.cm-lmode-hidden\s*{(?<body>[^}]*)}/s,
      )?.groups?.body ?? "";

    expect(hiddenMarkerRule).not.toMatch(/display:\s*none/);
  });
});
