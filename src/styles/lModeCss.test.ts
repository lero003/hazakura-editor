/// <reference types="node" />

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const lModeCss = readFileSync(
  `${process.cwd()}/src/styles/lMode.css`,
  "utf8",
);

describe("lMode.css", () => {
  it("keeps the CodeMirror scroller as the L Mode scroll surface", () => {
    expect(lModeCss).toMatch(
      /:root\[data-l-mode="on"\] \.cm-scroller\s*{[^}]*overflow-y:\s*auto/s,
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
