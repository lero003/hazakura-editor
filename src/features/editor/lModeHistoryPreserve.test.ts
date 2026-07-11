import { history, historyField, undo, undoDepth } from "@codemirror/commands";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { describe, expect, it } from "vitest";

/**
 * T-1: prove CodeMirror history can survive a remount via historyField JSON.
 * EditorPane uses this path on L Mode-only remounts (same session + language).
 */
describe("L Mode history preserve via historyField", () => {
  it("restores undo depth after fromJSON remount", () => {
    const parent = document.createElement("div");
    document.body.appendChild(parent);

    const first = new EditorView({
      doc: "hello",
      parent,
      extensions: [history()],
    });
    first.dispatch({
      changes: { from: 5, insert: " world" },
    });
    expect(first.state.doc.toString()).toBe("hello world");
    expect(undoDepth(first.state)).toBeGreaterThan(0);

    const json = first.state.toJSON({ history: historyField }) as {
      doc: string;
      history?: unknown;
      selection?: unknown;
    };
    first.destroy();

    const restoredState = EditorState.fromJSON(
      json,
      { extensions: [history()] },
      { history: historyField },
    );
    const second = new EditorView({ state: restoredState, parent });
    expect(second.state.doc.toString()).toBe("hello world");
    expect(undoDepth(second.state)).toBeGreaterThan(0);
    undo(second);
    expect(second.state.doc.toString()).toBe("hello");

    second.destroy();
    parent.remove();
  });
});
