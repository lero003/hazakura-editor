/// <reference types="node" />

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LModeClasses, LModeChipLabels } from "../features/editor/lMode/classes";

const lModeCss = readFileSync(
  `${process.cwd()}/src/styles/lMode.css`,
  "utf8",
);

// Strip block comments from a CSS string so test assertions
// don't accidentally match prose inside /* ... */. Block
// comments cannot be nested in CSS, so a single non-greedy
// pass is enough.
function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

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

  it("hides the normal status bar in L Mode", () => {
    const statusRule =
      lModeCss.match(
        /:root\[data-l-mode="on"\] \.status-bar\s*{(?<body>[^}]*)}/s,
      )?.groups?.body ?? "";

    expect(statusRule).toMatch(/display:\s*none/);
    expect(statusRule).not.toMatch(/var\(--status-text\)/);
    expect(statusRule).not.toMatch(/var\(--status-bg\)/);
  });

  it("keeps the L Mode change review diff compact and higher contrast", () => {
    const diffRule =
      lModeCss.match(
        /:root\[data-l-mode="on"\] \.l-mode-change-review-diff\s*{(?<body>[^}]*)}/s,
      )?.groups?.body ?? "";
    const lineNumberRule =
      lModeCss.match(
        /:root\[data-l-mode="on"\] \.l-mode-change-review-diff \.diff-line-number\s*{(?<body>[^}]*)}/s,
      )?.groups?.body ?? "";

    expect(diffRule).toMatch(/font-size:\s*11\.25px/);
    expect(lineNumberRule).toMatch(/font-size:\s*9px/);
    expect(lModeCss).toMatch(
      /:root\[data-l-mode="on"\] \.l-mode-change-review-diff \.diff-cell\.added,\s*:root\[data-l-mode="on"\] \.l-mode-change-review-diff \.diff-line-number\.added\s*{[^}]*var\(--diff-added-fg\) 18%/s,
    );
    expect(lModeCss).toMatch(
      /:root\[data-l-mode="on"\] \.l-mode-change-review-diff \.diff-cell\.removed,\s*:root\[data-l-mode="on"\] \.l-mode-change-review-diff \.diff-line-number\.removed\s*{[^}]*var\(--diff-removed-fg\) 18%/s,
    );
  });

  it("moves the scroll position HUD away from the top-right L Mode controls", () => {
    const hudRule =
      lModeCss.match(
        /:root\[data-l-mode="on"\] \.scroll-position-hud\s*{(?<body>[^}]*)}/s,
      )?.groups?.body ?? "";

    expect(hudRule).toMatch(/top:\s*50%/);
    expect(hudRule).toMatch(/left:\s*50%/);
    expect(hudRule).toMatch(/right:\s*auto/);
    expect(hudRule).toMatch(/transform:\s*translate\(-50%,\s*-50%\)/);
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

  it("treats the editor background as a flat page, not a framed panel", () => {
    // v0.11+ design direction: L Mode is a sheet of paper on
    // a quiet desk, not a screen panel. The previous shape —
    // a centered `.editor-host::before` rectangle with border
    // and shadow that stretched edge-to-edge vertically —
    // read as "screen with a window," and gradients on
    // `.cm-editor` added to the "screen" feel. The current
    // shape is a flat warm cream surface (no panel, no
    // gradient, no border, no shadow), with the prose
    // centered by the `.cm-content` max-width + margin auto.
    const editorRule =
      lModeCss.match(
        /:root\[data-l-mode="on"\] (?:[^{]*\.)?cm-editor\s*[,{][^{]*\{(?<body>[^}]*)}/s,
      )?.groups?.body ?? "";
    const contentRule =
      lModeCss.match(
        /:root\[data-l-mode="on"\] \.cm-content\s*{(?<body>[^}]*)}/s,
      )?.groups?.body ?? "";

    // No framed "paper" panel. Catches a regression where
    // the .editor-host::before rectangle comes back.
    expect(lModeCss).not.toMatch(
      /:root\[data-l-mode="on"\] \.editor-host::before/,
    );

    // The editor background is a single flat color, not a
    // gradient stack. (color-mix is fine, but the rule body
    // must not declare `background:` with a `linear-gradient`
    // / `radial-gradient` body — that's the "screen panel"
    // pattern.) Comments inside the rule body are stripped
    // first so prose like "no radial / linear gradients"
    // doesn't trigger a false positive.
    const editorRuleStripped = stripCssComments(editorRule);
    expect(editorRuleStripped).not.toMatch(/gradient/);
    // The body of `.cm-editor` is a single flat `background:`
    // declaration pointing at one of the surface tokens.
    expect(editorRule).toMatch(
      /background:\s*var\(--(?:bg|surface)\)/,
    );

    // The prose container stays clean — no border, no
    // shadow, no min-height that would push the body to
    // fill the screen.
    expect(contentRule).not.toMatch(/background:/);
    expect(contentRule).not.toMatch(/box-shadow:/);
    expect(contentRule).not.toMatch(/border-(left|right):/);
    expect(contentRule).not.toMatch(/min-height:/);
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

  it("keeps hidden Markdown markers hidden on every line (layout stability)", () => {
    // v0.11+ direction: L Mode is a WYSIWYG-tier writing
    // surface. The document should read like a document, and
    // the layout must not shift as the cursor moves. The
    // active-line and hover-reveal path that briefly
    // re-showed the Markdown markers is gone — toggling L
    // Mode off is the way to see the source.
    expect(lModeCss).not.toMatch(
      /\.cm-lmode-source-line \.cm-lmode-hidden/,
    );
    expect(lModeCss).not.toMatch(
      /\.cm-line:hover \.cm-lmode-hidden/,
    );
  });

  // --- Catalog ↔ CSS drift ---
  //
  // The L Mode class catalog (`lMode/classes.ts`) is the
  // single source of truth: extension code, widgets, the React
  // chrome components, and this CSS file all reference the
  // same constants. A drift between the catalog and the CSS
  // (e.g. a class renamed in one place, or a CSS rule added
  // without a catalog entry) would silently break styling.
  // These assertions catch that drift at test time.
  it("includes a CSS rule for every L Mode class in the catalog", () => {
    for (const cls of Object.values(LModeClasses)) {
      // Look for the class as a CSS selector (a `.` followed
      // by the class name). The `\b` boundary makes sure
      // `cm-lmode-link` does not silently match
      // `cm-lmode-link-...`.
      const pattern = new RegExp(
        `\\.${cls.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\b`,
      );
      expect(lModeCss, `L Mode class ${cls} not found in lMode.css`).toMatch(
        pattern,
      );
    }
  });

  it("does not define a cm-lmode-* or l-mode-* class that the catalog does not know about", () => {
    // Reverse check: the CSS file does not invent its own
    // L Mode classes. Catches typos in CSS or forgotten
    // catalog entries.
    const selectorClass = /\.(cm-lmode-[a-z0-9-]+|l-mode-[a-z0-9-]+)/g;
    const cssClasses = new Set<string>();
    for (const match of lModeCss.matchAll(selectorClass)) {
      cssClasses.add(match[1]);
    }
    const catalogClasses = new Set<string>(Object.values(LModeClasses));
    for (const cssCls of cssClasses) {
      expect(
        catalogClasses.has(cssCls),
        `${cssCls} is in lMode.css but not in LModeClasses`,
      ).toBe(true);
    }
  });

  it("renders chip labels from the data-l-chip attribute, not from per-chip content rules", () => {
    // v0.11+ refactor: chip labels live in the TS catalog
    // (`LModeChipLabels`) and the line-decoration code
    // attaches a `data-l-chip` attribute to the line. The
    // CSS uses `content: attr(data-l-chip)` to render the
    // label. This guards against regressions where a
    // per-chip `content: "H1"` etc. gets re-introduced
    // (typos in CSS would no longer be caught by TS).
    const css = stripCssComments(lModeCss);
    expect(css).toMatch(/content:\s*attr\(data-l-chip\)/);
    for (const label of Object.values(LModeChipLabels)) {
      // No `content: "H1"` (or "H2" .. "```", ">") literal
      // in CSS — those strings are owned by the catalog.
      const literal = new RegExp(
        `content:\\s*["']${label.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}["']`,
      );
      expect(
        css,
        `chip label ${label} is hardcoded in CSS as a content literal`,
      ).not.toMatch(literal);
    }
  });

  it("keeps the chip attribute name in sync between the catalog and the CSS", () => {
    // The attribute name `data-l-chip` is shared between the
    // extension code (`buildLineDecorations` in
    // `lMode/contentDecorations.ts`) and the CSS rule. A
    // rename in one place must be matched in the other.
    expect(lModeCss).toMatch(/attr\(data-l-chip\)/);
    // The orchestrator's extension code reads from the same
    // literal — this is the only string the two layers share.
    // If you find yourself wanting to extract it into the
    // catalog, do so as a single constant shared by both,
    // not by introducing a second source of truth.
  });
});
