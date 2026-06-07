import { describe, expect, it, vi } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { dispatchTaskToggle, LModeTaskWidget } from "./taskWidget";
import { LModeClasses } from "./classes";

// v0.15 L Mode task widget stability.
//
// `dispatchTaskToggle` is the shared helper used by both the
// `click` and `keydown` handlers on `lModeTaskClickViewPlugin`.
// These tests pin the contract that the helper depends on:
//   - it locates the checkbox via `.${LModeClasses.task}` and
//     the `data-lmode-task-from` / `data-lmode-task-to`
//     attributes set by `LModeTaskWidget.toDOM`,
//   - it dispatches a 3-char `[ ]` ↔ `[x]` swap exactly on
//     the TaskMarker range,
//   - it returns `false` (and does not dispatch) when the
//     click/keydown target is outside the widget, when the
//     data attributes are missing or non-numeric, or when
//     the slice is not a recognisable TaskMarker.
//
// The IME-composition guard for the `keydown` handler lives
// inside the plugin's `eventHandlers.keydown` closure, so it
// is covered by the existing plugin-level behaviour in
// `extension.test.ts` and the dedicated `extension.test.ts`
// composing-spy. Here we focus on the dispatch helper.

function makeView(initialDoc: string): EditorView {
  const state = EditorState.create({ doc: initialDoc });
  // jsdom is happy with detached parents; we just need a
  // place to mount the EditorView so `view.dom` exists.
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  return new EditorView({ state, parent });
}

function findTaskRange(view: EditorView): { from: number; to: number } {
  // Scan the doc for the first 3-char task marker. Fixtures
  // are arranged so the first one is the one we toggle.
  const doc = view.state.doc.toString();
  const match = doc.match(/\[ \]|\[[xX]\]/);
  if (!match || match.index === undefined) {
    throw new Error(`No task marker found in doc: ${doc}`);
  }
  return { from: match.index, to: match.index + match[0].length };
}

function makeTaskSpan(
  view: EditorView,
  from: number,
  to: number,
  checked: boolean,
): HTMLSpanElement {
  const widget = new LModeTaskWidget(from, to, checked);
  const span = widget.toDOM();
  view.dom.appendChild(span);
  return span;
}

describe("LModeTaskWidget DOM contract", () => {
  it("renders a checkbox with the right ARIA attributes for a task widget", () => {
    const view = makeView("- [ ] todo");
    const { from, to } = findTaskRange(view);
    const span = makeTaskSpan(view, from, to, false);
    expect(span.getAttribute("role")).toBe("checkbox");
    expect(span.getAttribute("aria-checked")).toBe("false");
    expect(span.getAttribute("tabindex")).toBe("0");
    expect(span.dataset.lmodeTaskFrom).toBe(String(from));
    expect(span.dataset.lmodeTaskTo).toBe(String(to));
    expect(span.classList.contains(LModeClasses.task)).toBe(true);
    expect(span.classList.contains(LModeClasses.taskUnchecked)).toBe(true);
    expect(span.textContent).toBe("\u2610"); // ☐
  });

  it("switches ARIA state and glyph when the widget is checked", () => {
    const view = makeView("- [x] done");
    const { from, to } = findTaskRange(view);
    const span = makeTaskSpan(view, from, to, true);
    expect(span.getAttribute("aria-checked")).toBe("true");
    expect(span.classList.contains(LModeClasses.taskChecked)).toBe(true);
    expect(span.textContent).toBe("\u2611"); // ☑
  });
});

describe("dispatchTaskToggle", () => {
  it("toggles [ ] -> [x] when the click target is the widget span", () => {
    const view = makeView("- [ ] todo");
    const { from, to } = findTaskRange(view);
    const span = makeTaskSpan(view, from, to, false);

    const event = new MouseEvent("click", { bubbles: true });
    Object.defineProperty(event, "target", { value: span });
    const result = dispatchTaskToggle(view, event);

    expect(result).toBe(true);
    expect(view.state.doc.toString()).toBe("- [x] todo");
  });

  it("toggles [x] -> [ ] when the click target is the widget span", () => {
    const view = makeView("- [x] done");
    const { from, to } = findTaskRange(view);
    const span = makeTaskSpan(view, from, to, true);

    const event = new MouseEvent("click", { bubbles: true });
    Object.defineProperty(event, "target", { value: span });
    const result = dispatchTaskToggle(view, event);

    expect(result).toBe(true);
    expect(view.state.doc.toString()).toBe("- [ ] done");
  });

  it("toggles [X] -> [ ] when the click target is the widget span", () => {
    const view = makeView("- [X] done");
    const { from, to } = findTaskRange(view);
    const span = makeTaskSpan(view, from, to, true);

    const event = new MouseEvent("click", { bubbles: true });
    Object.defineProperty(event, "target", { value: span });
    const result = dispatchTaskToggle(view, event);

    expect(result).toBe(true);
    expect(view.state.doc.toString()).toBe("- [ ] done");
  });

  it("returns false and leaves the doc untouched when the target is outside the widget", () => {
    const view = makeView("- [ ] todo");
    const before = view.state.doc.toString();

    // A click on the editor body, not on the task span.
    const outsideTarget = document.createElement("div");
    view.dom.appendChild(outsideTarget);
    const event = new MouseEvent("click", { bubbles: true });
    Object.defineProperty(event, "target", { value: outsideTarget });

    const result = dispatchTaskToggle(view, event);

    expect(result).toBe(false);
    expect(view.state.doc.toString()).toBe(before);
  });

  it("returns false when the data attributes are missing or non-numeric", () => {
    const view = makeView("- [ ] todo");
    // Build a span that LOOKS like a task widget but has no
    // range attributes set. This simulates a stale DOM
    // (e.g. a race with the decoration recompute) where the
    // `data-lmode-task-from` / `data-lmode-task-to`
    // attributes are missing.
    const span = document.createElement("span");
    span.className = LModeClasses.task;
    view.dom.appendChild(span);
    const event = new MouseEvent("click", { bubbles: true });
    Object.defineProperty(event, "target", { value: span });

    expect(dispatchTaskToggle(view, event)).toBe(false);
  });

  it("returns false when the slice under the widget is not a recognisable TaskMarker", () => {
    const view = makeView("- [?] weird");
    const from = view.state.doc.toString().indexOf("[?]");
    const to = from + 3;
    const span = makeTaskSpan(view, from, to, false);
    const event = new MouseEvent("click", { bubbles: true });
    Object.defineProperty(event, "target", { value: span });

    expect(dispatchTaskToggle(view, event)).toBe(false);
    expect(view.state.doc.toString()).toBe("- [?] weird");
  });

  it("uses `closest` so clicks on inner glyphs still resolve to the widget", () => {
    const view = makeView("- [ ] todo");
    const { from, to } = findTaskRange(view);
    const span = makeTaskSpan(view, from, to, false);

    // A nested child element (the glyph `<span>`) should still
    // resolve to the outer `.l-mode-task` widget via
    // `target.closest(`.${LModeClasses.task}`)`.
    const glyphChild = document.createElement("span");
    glyphChild.className = "l-mode-task-glyph";
    glyphChild.textContent = "x";
    span.appendChild(glyphChild);
    const event = new MouseEvent("click", { bubbles: true });
    Object.defineProperty(event, "target", { value: glyphChild });

    expect(dispatchTaskToggle(view, event)).toBe(true);
    expect(view.state.doc.toString()).toBe("- [x] todo");
  });
});
