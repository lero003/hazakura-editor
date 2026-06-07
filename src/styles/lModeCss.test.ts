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
    expect(scrollerRule).toMatch(/scroll-behavior:\s*auto/);
    expect(scrollerRule).not.toMatch(/overflow-x:\s*hidden/);
    expect(scrollerRule).not.toMatch(/scroll-behavior:\s*smooth/);
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

  it("removes the normal image preview divider in L Mode", () => {
    const imagePreviewHeaderRule =
      lModeCss.match(
        /:root\[data-l-mode="on"\] \.image-preview-header\s*{(?<body>[^}]*)}/s,
      )?.groups?.body ?? "";

    expect(imagePreviewHeaderRule).toMatch(/border-bottom:\s*0/);
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
    expect(lModeCss).toMatch(
      /:root\[data-l-mode="on"\]\[data-theme="dark"\] \.l-mode-change-review-diff \.diff-cell\.added,[^}]*:root\[data-l-mode="on"\]\[data-theme="yakou"\] \.l-mode-change-review-diff \.diff-line-number\.added\s*{[^}]*var\(--diff-added-fg\) 24%/s,
    );
    expect(lModeCss).toMatch(
      /:root\[data-l-mode="on"\]\[data-theme="dark"\] \.l-mode-change-review-diff \.diff-cell\.removed,[^}]*:root\[data-l-mode="on"\]\[data-theme="yakou"\] \.l-mode-change-review-diff \.diff-line-number\.removed\s*{[^}]*var\(--diff-removed-fg\) 26%/s,
    );
  });

  it("lets the L Mode change review sheet shrink below 720px without horizontal scrolling", () => {
    // The shared workspace `.diff-split-row` carries
    // `min-width: 720px` so a normal-mode side-by-side
    // comparison has a comfortable floor. That same floor
    // turns into a horizontal scrollbar inside the L Mode
    // floating review sheet as soon as the sheet's content
    // area drops below 720px, which happens on most windows
    // once the 36px sheet padding and chrome are subtracted.
    // The L Mode sheet must override that floor so the diff
    // cells — which already wrap on their own thanks to
    // `white-space: pre-wrap; overflow-wrap: anywhere;` —
    // are allowed to shrink with the sheet.
    const reviewRowRule =
      lModeCss.match(
        /:root\[data-l-mode="on"\] \.l-mode-change-review-diff \.diff-split-row\s*{(?<body>[^}]*)}/s,
      )?.groups?.body ?? "";
    expect(reviewRowRule).toMatch(/min-width:\s*0/);
  });

  it("moves the scroll position HUD to the right side at mid-height in L Mode", () => {
    const hudRule =
      lModeCss.match(
        /:root\[data-l-mode="on"\] \.scroll-position-hud\s*{(?<body>[^}]*)}/s,
      )?.groups?.body ?? "";

    expect(hudRule).toMatch(/top:\s*50%/);
    expect(hudRule).toMatch(/right:\s*auto/);
    expect(hudRule).toMatch(
      /left:\s*min\(calc\(50% \+ 390px\),\s*calc\(100vw - 252px\)\)/,
    );
    expect(hudRule).toMatch(/width:\s*min\(224px,\s*calc\(100vw - 56px\)\)/);
    expect(hudRule).toMatch(/transform:\s*translateY\(-50%\)/);
  });

  it("keeps the action rail compact while showing short labels", () => {
    const railRule =
      lModeCss.match(
        /:root\[data-l-mode="on"\] \.l-mode-action-rail\s*{(?<body>[^}]*)}/s,
      )?.groups?.body ?? "";
    const labelRule =
      lModeCss.match(
        /:root\[data-l-mode="on"\] \.l-mode-action-button-label\s*{(?<body>[^}]*)}/s,
      )?.groups?.body ?? "";

    expect(railRule).toMatch(/flex-direction:\s*column/);
    expect(railRule).toMatch(/right:\s*18px/);
    expect(railRule).toMatch(/width:\s*94px/);
    expect(railRule).toMatch(/border-radius:\s*18px/);
    expect(labelRule).toMatch(/display:\s*inline-block/);
    expect(labelRule).toMatch(/flex:\s*1 1 auto/);
    expect(labelRule).toMatch(/text-overflow:\s*ellipsis/);
    expect(labelRule).not.toMatch(/clip-path:\s*inset\(50%\)/);
  });

  it("only renders active-line chips on lines that have chip labels", () => {
    expect(lModeCss).toMatch(
      /:root\[data-l-mode="on"\] \.cm-line\.cm-lmode-source-line\[data-l-chip\]::before/,
    );
    expect(lModeCss).not.toMatch(
      /:root\[data-l-mode="on"\] \.cm-line\.cm-lmode-source-line::before/,
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

  it("keeps task list rows from drawing both a bullet and a checkbox", () => {
    const taskRule =
      lModeCss.match(
        /:root\[data-l-mode="on"\] \.cm-lmode-list-task::before\s*{(?<body>[^}]*)}/s,
      )?.groups?.body ?? "";
    const taskWidgetRule =
      lModeCss.match(
        /:root\[data-l-mode="on"\] \.cm-lmode-task\s*{(?<body>[^}]*)}/s,
      )?.groups?.body ?? "";

    expect(taskRule).toMatch(/content:\s*none/);
    expect(taskWidgetRule).toMatch(/font-size:\s*1\.08em/);
  });

  it("gives L Mode tables width-aware cells instead of loose proportional text", () => {
    const tableHeaderRowRule =
      lModeCss.match(
        /:root\[data-l-mode="on"\] \.cm-lmode-table-header,\s*:root\[data-l-mode="on"\] \.cm-lmode-table-row\s*{(?<body>[^}]*)}/s,
      )?.groups?.body ?? "";
    const cellRule =
      lModeCss.match(
        /:root\[data-l-mode="on"\] \.cm-lmode-table-cell\s*{(?<body>[^}]*)}/s,
      )?.groups?.body ?? "";

    expect(tableHeaderRowRule).toMatch(
      /font-family:\s*var\(--lmode-ui-font-family\)/,
    );
    expect(cellRule).toMatch(/display:\s*inline-block/);
    expect(cellRule).toMatch(
      /min-inline-size:\s*var\(--lmode-table-cell-width,\s*8ch\)/,
    );
    expect(cellRule).toMatch(/overflow-wrap:\s*anywhere/);
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

// --- v0.14 print / export boundary (screen print only) ---
//
// SCOPE: this describe block pins the `@media print`
// block in `lMode.css`. That block only fires when the
// live CodeMirror editor is sent to the browser print
// dialog. It does NOT cover the user-facing Print to
// PDF / Export HTML flows: those go through
// `useDocumentExport`, which renders a standalone HTML
// document from the saved Markdown source via
// `renderMarkdown()` + `getMarkdownPreviewCss()` and
// does not carry L Mode's `.cm-*` classes. So the
// standalone preview / export pipeline is the canonical
// print path; this block is the screen-side fallback
// for "the user hit Cmd+P while the editor is open."
//
// The block also cannot reverse L Mode's widget
// replacements: `Image`, `HorizontalRule`, `TaskMarker`,
// and `TableDelimiter` are `Decoration.replace`d into
// display-only widgets whose underlying source text is
// not in the rendered DOM. What the block DOES undo is
// the floating chrome, the dim, the margin chip, the
// hidden marker spans, and the 720px column geometry —
// a useful insurance shape, not a full source round-trip.
//
// The tests run against the raw stylesheet text because
// jsdom does not lay out CSS — the same approach the
// rest of `lModeCss.test.ts` uses for the screen-side
// rules.
describe("v0.14 L Mode print boundary (screen print only)", () => {
  // Read the `@media print { ... }` block out of the
  // stylesheet. The block is the last top-level block in
  // `lMode.css`; `[\s\S]*?` with the lazy `*?` quantifier
  // matches the smallest closing brace, which is the
  // expected shape here.
  const printBlock =
    lModeCss.match(
      /@media\s+print\s*{(?<body>[\s\S]*?)\n}\s*$/m,
    )?.groups?.body ?? "";

  it("declares a single top-level @media print block", () => {
    // Multiple print blocks would scatter the print
    // override and make it hard to reason about. The
    // boundary slice keeps the override in one place.
    // Reminder: this block is the screen-print fallback
    // only; the canonical print path is the standalone
    // export pipeline in `useDocumentExport`.
    const matches = lModeCss.match(/@media\s+print\s*{/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it("hides L Mode floating chrome in print", () => {
    // Each of these selectors is rendered conditionally
    // inside the editor; on paper they would print as
    // empty boxes or, worse, overlapping glyphs.
    for (const selector of [
      ".l-mode-exit-pill",
      ".l-mode-action-rail",
      ".l-mode-workspace-toggle",
      ".l-mode-workspace-overlay",
      ".l-mode-workspace-drawer",
      ".l-mode-change-review-sheet",
      ".tabs-row",
      ".status-bar",
      ".scroll-position-hud",
      ".l-mode-empty-placeholder",
    ]) {
      const pattern = new RegExp(
        `:root\\[data-l-mode="on"\\] ${selector.replace(
          ".",
          "\\.",
        )}\\b`,
      );
      expect(printBlock, `selector ${selector}`).toMatch(pattern);
    }
    // The block must actually apply `display: none` to
    // those selectors. `!important` is required to win
    // against the screen-side rules' specificity.
    expect(printBlock).toMatch(/display:\s*none\s*!important/);
  });

  it("reveals the hidden Markdown markers in print", () => {
    // On screen the markers are zero-width transparent
    // spans; on paper the user is reading the document,
    // not editing it, so the markers should print as
    // ordinary source characters. The `cm-lmode-hidden`
    // override is the central print-boundary concern.
    // This only undoes the source-marker hiding; it
    // does NOT reverse the `Decoration.replace` widgets
    // for Image / HorizontalRule / TaskMarker /
    // TableDelimiter (those have no source text in the
    // rendered DOM to reveal).
    expect(printBlock).toMatch(
      /:root\[data-l-mode="on"\] \.cm-lmode-hidden\s*{[^}]*color:\s*inherit\s*!important/s,
    );
    expect(printBlock).toMatch(
      /:root\[data-l-mode="on"\] \.cm-lmode-hidden\s*{[^}]*display:\s*inline\s*!important/s,
    );
  });

  it("removes the dim and the margin chip in print", () => {
    // The soft-focus dim and the margin chip are
    // editing-affordance layers that do not translate to
    // paper. The dim override restores uniform color;
    // the chip override drops the `::before` content
    // entirely.
    expect(printBlock).toMatch(
      /:root\[data-l-mode="on"\] \.cm-lmode-dimmed\s*{[^}]*opacity:\s*1\s*!important/s,
    );
    expect(printBlock).toMatch(
      /:root\[data-l-mode="on"\]\s*\.cm-line\.cm-lmode-source-line\[data-l-chip\]::before\s*{[^}]*content:\s*none\s*!important/s,
    );
  });

  it("drops the centered 720px column and paper-feel background in print", () => {
    // The screen-side `.cm-content` max-width / margin /
    // padding shapes a quiet in-app column. On a printed
    // sheet the page itself is the page, so the override
    // unwinds that geometry and swaps the warm cream
    // surface for plain white.
    expect(printBlock).toMatch(
      /:root\[data-l-mode="on"\] \.cm-content\s*{[^}]*max-width:\s*none\s*!important/s,
    );
    expect(printBlock).toMatch(
      /:root\[data-l-mode="on"\] \.cm-editor\s*{[^}]*background:\s*white\s*!important/s,
    );
  });
});
