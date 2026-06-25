import { act, cleanup, renderHook } from "@testing-library/react";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { afterEach, describe, expect, it } from "vitest";
import { useSlashMenu } from "./useSlashMenu";
import type { SlashCommand } from "../../types/slash";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

function makeEditorView(doc = "body", selection?: { anchor: number; head?: number }) {
  const parent = document.createElement("div");
  document.body.append(parent);
  return new EditorView({
    parent,
    state: EditorState.create({
      doc,
      selection: selection
        ? { anchor: selection.anchor, head: selection.head ?? selection.anchor }
        : undefined,
    }),
  });
}

describe("useSlashMenu", () => {
  it("opens a full command menu for context invocation", () => {
    const view = makeEditorView();
    const commands: SlashCommand[] = [
      {
        category: "markdown",
        hint: "#",
        id: "heading-1",
        insertText: "# ",
        label: "Heading 1",
        searchKeys: ["heading", "h1"],
      },
    ];

    const { result } = renderHook(() =>
      useSlashMenu({
        commands,
        enabled: true,
        viewKey: "doc",
        viewRef: { current: view },
      }),
    );

    act(() => {
      result.current.openMenuAtContext(view, {
        bottom: 64,
        left: 48,
        top: 64,
      });
    });

    expect(result.current.state.visible).toBe(true);
    expect(result.current.state.query).toBe("");
    expect(result.current.commands).toEqual(commands);
    expect(result.current.state.rect).toEqual({
      bottom: 64,
      left: 48,
      top: 64,
    });
  });

  it("runs insert commands from context invocation at the current cursor", () => {
    const view = makeEditorView("body");
    const command: SlashCommand = {
      category: "markdown",
      hint: "#",
      id: "heading-1",
      insertText: "# ",
      label: "Heading 1",
      searchKeys: ["heading", "h1"],
    };

    const { result } = renderHook(() =>
      useSlashMenu({
        commands: [command],
        enabled: true,
        viewKey: "doc",
        viewRef: { current: view },
      }),
    );

    act(() => {
      result.current.openMenuAtContext(view, {
        bottom: 64,
        left: 48,
        top: 64,
      });
      result.current.runCommand(command);
    });

    expect(view.state.doc.toString()).toBe("# body");
    expect(result.current.state.visible).toBe(false);
  });

  // Regression: a right-click context invocation with an active selection
  // must not replace the selected text. Previously the context path used
  // selection.main.to as the change end, so picking e.g. "Heading 1" while
  // a stray selection existed silently deleted the selection.
  it("keeps the active selection when running an insert command from the context menu", () => {
    const view = makeEditorView("hello world", { anchor: 0, head: 5 });
    const command: SlashCommand = {
      category: "markdown",
      hint: "#",
      id: "heading-1",
      insertText: "# ",
      label: "Heading 1",
      searchKeys: ["heading", "h1"],
    };

    const { result } = renderHook(() =>
      useSlashMenu({
        commands: [command],
        enabled: true,
        viewKey: "doc",
        viewRef: { current: view },
      }),
    );

    act(() => {
      result.current.openMenuAtContext(view, {
        bottom: 64,
        left: 48,
        top: 64,
      });
      result.current.runCommand(command);
    });

    expect(view.state.doc.toString()).toBe("# hello world");
    expect(result.current.state.visible).toBe(false);
  });
});
