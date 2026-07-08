// L Mode (えるモード) — display-only widgets that replace
// Markdown source with visual counterparts while keeping the
// underlying document text unchanged. These widgets are
// attached to specific Lezer node ranges; the content-
// decoration code in `contentDecorations.ts` is the only
// caller.
//
// CRITICAL INVARIANT — the widgets' `toDOM` methods build
// display DOM, but the source text is never modified. The
// extension's cornerstone test
// (`lModeExtension.test.ts`) enforces this end-to-end: the
// saved file in L Mode and in normal mode is byte-identical.

import { WidgetType } from "@codemirror/view";
import { LModeClasses } from "./classes";

/**
 * Widget for `---` / `***` / `___` HorizontalRule nodes.
 * Renders a single thin divider line; the line keeps its
 * own height (driven by the editor's line-height) so the
 * rule sits with comfortable whitespace above and below.
 *
 * Uses an inline `<span>` (not a block `<div>`) so the
 * CodeMirror height map treats the replacement as an
 * ordinary inline widget. Block-level DOM inside an inline
 * replace decoration can desync estimated vs measured
 * heights, especially in line-wrapped Japanese prose.
 * Exported for tests that verify the right widget is
 * attached to the right range.
 */
export class LModeHorizontalRuleWidget extends WidgetType {
  toDOM(): HTMLElement {
    const el = document.createElement("span");
    el.className = LModeClasses.hr;
    el.setAttribute("aria-hidden", "true");
    return el;
  }

  eq(other: LModeHorizontalRuleWidget): boolean {
    return other instanceof LModeHorizontalRuleWidget;
  }
}

/**
 * Widget for the `| --- | --- |` TableDelimiter row. We
 * collapse it to a near-zero-height empty node so the line
 * contributes only the spacing the next line needs, without
 * showing the delimiter source. Exported for tests.
 */
export class LModeTableDelimiterWidget extends WidgetType {
  toDOM(): HTMLElement {
    const el = document.createElement("span");
    el.className = LModeClasses.tableDelimiter;
    el.setAttribute("aria-hidden", "true");
    return el;
  }

  eq(other: LModeTableDelimiterWidget): boolean {
    return other instanceof LModeTableDelimiterWidget;
  }
}

/**
 * Widget for `<br>` inside GFM table cells. A physical
 * newline would split the Markdown table row, so the source
 * keeps the HTML break marker while L Mode presents it as an
 * actual line break inside the cell.
 */
export class LModeTableCellBreakWidget extends WidgetType {
  toDOM(): HTMLElement {
    const el = document.createElement("br");
    el.setAttribute("aria-hidden", "true");
    return el;
  }

  eq(other: LModeTableCellBreakWidget): boolean {
    return other instanceof LModeTableCellBreakWidget;
  }
}
