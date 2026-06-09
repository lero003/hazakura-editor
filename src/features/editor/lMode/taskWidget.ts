// Inline task-list checkbox widget for L Mode (えるモード).
//
// GFM task list items look like `- [ ] todo`, `- [x] done`,
// or `- [X] done`.
// The L Mode extension replaces the 3-char `TaskMarker` range
// (`[ ]`, `[x]`, or `[X]`) with this widget so the cursor sees a
// single inline checkbox glyph instead of the marker text. The
// underlying doc text is never modified by the decoration
// engine — the same cornerstone invariant the rest of L Mode
// honors.
//
// Clicking the widget toggles `[ ]` -> `[x]` and checked markers
// (`[x]` / `[X]`) -> `[ ]` in the buffer via a dispatched
// transaction. The toggle path is the only place in L Mode where
// the user input flows from a widget back into the doc. We do NOT
// mark the doc dirty ourselves (CodeMirror's `changes` dispatch is
// the dirty signal — the editor pane re-derives `saveStatus` from
// the tab contents on its own).
//
// `from` / `to` are stored in `data-*` attributes on the
// widget DOM so the click handler can find the range to
// replace without re-walking the syntax tree. The attributes
// stay in sync with the widget's actual range because the
// widget is rebuilt on every decoration recompute (i.e., on
// every doc change).

import { ViewPlugin, type EditorView, WidgetType } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import { LModeClasses } from "./classes";

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
      ? `${LModeClasses.task} ${LModeClasses.taskChecked}`
      : `${LModeClasses.task} ${LModeClasses.taskUnchecked}`;
    span.dataset.lmodeTaskFrom = String(this.from);
    span.dataset.lmodeTaskTo = String(this.to);
    span.textContent = this.checked ? CHECKED_GLYPH : UNCHECKED_GLYPH;
    span.setAttribute("role", "checkbox");
    span.setAttribute("aria-checked", this.checked ? "true" : "false");
    span.setAttribute(
      "aria-label",
      this.checked ? "Completed task" : "Incomplete task",
    );
    // `tabindex="0"` puts the widget into the keyboard tab
    // order so a keyboard-only user can reach the checkbox
    // without the mouse. The `keydown` handler in
    // `lModeTaskClickPlugin` then toggles the marker on
    // Enter / Space — the standard a11y interaction for a
    // `role="checkbox"` element.
    span.setAttribute("tabindex", "0");
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
// is clicked or focused-and-keyed. The plugin is only included
// in the L Mode extension, so it's dormant outside L Mode.
//
// v0.15 stability: the `keydown` handler now ignores events
// while the editor is in an IME composition session
// (`view.composing === true` or `event.isComposing === true`).
// Without this guard, pressing Space to confirm a Japanese IME
// candidate would also flip the task checkbox underneath the
// composition — a daily-writing paper cut for anyone who uses
// task lists inside prose. Click and keydown share the same
// dispatch helper so the click path stays untouched.

export function dispatchTaskToggle(view: EditorView, event: Event): boolean {
  const target = event.target;
  if (!(target instanceof Element)) return false;
  const taskEl = target.closest(`.${LModeClasses.task}`);
  if (!taskEl) return false;
  const fromAttr = taskEl.getAttribute("data-lmode-task-from");
  const toAttr = taskEl.getAttribute("data-lmode-task-to");
  if (
    fromAttr === null ||
    toAttr === null ||
    fromAttr === "" ||
    toAttr === ""
  ) {
    return false;
  }
  const from = Number(fromAttr);
  const to = Number(toAttr);
  if (!Number.isInteger(from) || !Number.isInteger(to)) return false;
  if (from < 0 || to > view.state.doc.length || to - from !== 3) {
    return false;
  }

  // The TaskMarker is always 3 chars (`[ ]`, `[x]`, or `[X]`); we
  // replace exactly that range so the rest of the line is
  // untouched.
  const text = view.state.doc.sliceString(from, to);
  const next =
    text === "[ ]" ? "[x]" : text === "[x]" || text === "[X]" ? "[ ]" : null;
  if (!next) return false;

  view.dispatch({ changes: { from, to, insert: next } });
  return true;
}

const lModeTaskClickViewPlugin = ViewPlugin.fromClass(
  class {
    constructor(readonly view: EditorView) {}
    destroy() {}
  },
  {
    eventHandlers: {
      click(event, view) {
        // Click is always a deliberate toggle intent — IME
        // composition does not produce clicks, so we skip the
        // `view.composing` guard here.
        if (dispatchTaskToggle(view, event)) {
          // Returning `true` tells CodeMirror we've handled the
          // event, so it does NOT also place the cursor at the
          // click position. The user just wanted to toggle, not
          // to move the caret.
          return true;
        }
        return undefined;
      },
      keydown(event, view) {
        // Standard `role="checkbox"` keyboard interaction:
        // Enter and Space toggle the marker. The widget is
        // keyboard-reachable thanks to `tabindex="0"` on
        // `toDOM`, so a keyboard-only user can land focus on
        // the checkbox and toggle it without the mouse.
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }
        // IME composition guard. While the editor is mid-
        // composition (e.g. the user is confirming a Japanese
        // candidate with Space), the keypress belongs to the
        // IME, not to the checkbox. The two reliable signals
        // are `event.isComposing` (set on the native keydown)
        // and `view.composing` (the editor's own view of the
        // composition state); check both to cover Chrome
        // WebView / Safari / Tauri WebView differences.
        if (event.isComposing || view.composing) {
          return;
        }

        if (!dispatchTaskToggle(view, event)) {
          return;
        }
        // Prevent the default Space scroll and Enter code
        // completion paths so the toggle is the only thing
        // that happens.
        event.preventDefault();
        return true;
      },
    },
  },
);

export function lModeTaskClickPlugin(): Extension {
  return lModeTaskClickViewPlugin;
}
