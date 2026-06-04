// Inline task-list checkbox widget for L Mode (えるモード).
//
// GFM task list items look like `- [ ] todo` or `- [x] done`.
// The L Mode extension replaces the 3-char `TaskMarker` range
// (`[ ]` or `[x]`) with this widget so the cursor sees a single
// inline checkbox glyph instead of the marker text. The
// underlying doc text is never modified by the decoration
// engine — the same cornerstone invariant the rest of L Mode
// honors.
//
// Clicking the widget toggles `[ ]` ↔ `[x]` in the buffer via a
// dispatched transaction. The toggle path is the only place in
// L Mode where the user input flows from a widget back into
// the doc. We do NOT mark the doc dirty ourselves (CodeMirror's
// `changes` dispatch is the dirty signal — the editor pane
// re-derives `saveStatus` from the tab contents on its own).
//
// `from` / `to` are stored in `data-*` attributes on the
// widget DOM so the click handler can find the range to
// replace without re-walking the syntax tree. The attributes
// stay in sync with the widget's actual range because the
// widget is rebuilt on every decoration recompute (i.e., on
// every doc change).

import { ViewPlugin, type EditorView, WidgetType } from "@codemirror/view";
import type { Extension } from "@codemirror/state";

const CHECKED_GLYPH = "☑";
const UNCHECKED_GLYPH = "☐";

export class LModeTaskWidget extends WidgetType {
  constructor(
    readonly from: number,
    readonly to: number,
    readonly checked: boolean,
  ) {
    super();
  }

  eq(other: LModeTaskWidget): boolean {
    return (
      other.from === this.from &&
      other.to === this.to &&
      other.checked === this.checked
    );
  }

  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = this.checked
      ? "cm-lmode-task cm-lmode-task-checked"
      : "cm-lmode-task cm-lmode-task-unchecked";
    span.dataset.lmodeTaskFrom = String(this.from);
    span.dataset.lmodeTaskTo = String(this.to);
    span.textContent = this.checked ? CHECKED_GLYPH : UNCHECKED_GLYPH;
    span.setAttribute("role", "checkbox");
    span.setAttribute("aria-checked", this.checked ? "true" : "false");
    return span;
  }

  ignoreEvent(): boolean {
    // Allow click events to reach the widget. The click handler
    // on the editor view decides whether to toggle the marker
    // (click on the widget) or let CodeMirror place the cursor
    // (click elsewhere).
    return false;
  }
}

// `ViewPlugin` that toggles the marker text when a task widget
// is clicked. The plugin is only included in the L Mode
// extension, so it's dormant outside L Mode.
const lModeTaskClickViewPlugin = ViewPlugin.fromClass(
  class {
    constructor(readonly view: EditorView) {}
    destroy() {}
  },
  {
    eventHandlers: {
      click(event, view) {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const taskEl = target.closest(".cm-lmode-task");
        if (!taskEl) return;
        const from = Number(taskEl.getAttribute("data-lmode-task-from"));
        const to = Number(taskEl.getAttribute("data-lmode-task-to"));
        if (Number.isNaN(from) || Number.isNaN(to)) return;

        // Read the marker text. The TaskMarker is always 3
        // chars (`[ ]` or `[x]`); we replace exactly that range
        // so the rest of the line is untouched.
        const text = view.state.doc.sliceString(from, to);
        const next = text === "[ ]" ? "[x]" : text === "[x]" ? "[ ]" : null;
        if (!next) return;

        view.dispatch({ changes: { from, to, insert: next } });
        // Returning `true` tells CodeMirror we've handled the
        // event, so it does NOT also place the cursor at the
        // click position. The user just wanted to toggle, not
        // to move the caret.
        return true;
      },
    },
  },
);

export function lModeTaskClickPlugin(): Extension {
  return lModeTaskClickViewPlugin;
}
