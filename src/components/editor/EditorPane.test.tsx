import { cleanup, render } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getEditorWrappingExtensions,
  type EditorPaneHandle,
} from "./EditorPane";
import EditorPane from "./EditorPane";
import { getLModeCopy, getSlashMenuCopy } from "../../lib/locale";

afterEach(cleanup);

describe("getEditorWrappingExtensions", () => {
  it("forces line wrapping in L Mode even when normal wrapping is off", () => {
    expect(getEditorWrappingExtensions(false, false)).toHaveLength(0);
    expect(getEditorWrappingExtensions(true, false).length).toBeGreaterThan(0);
    expect(getEditorWrappingExtensions(false, true).length).toBeGreaterThan(0);
  });
});

describe("EditorPane", () => {
  function renderEditorPane({
    documentKey = "/workspace/note.md",
    onChange = vi.fn(),
    ref,
    value,
  }: {
    documentKey?: string;
    onChange?: (nextValue: string) => void;
    ref?: React.Ref<EditorPaneHandle>;
    value: string;
  }) {
    return (
      <EditorPane
        ref={ref}
        activeSearchMatchIndex={-1}
        documentKey={documentKey}
        fontSize={15}
        lModeCopy={getLModeCopy("en")}
        lModeEnabled={false}
        onChange={onChange}
        onScrollRatioChange={vi.fn()}
        onSelectionChange={vi.fn()}
        searchMatches={[]}
        showInvisibles={false}
        slashCommands={[]}
        slashMenuCopy={getSlashMenuCopy("en")}
        spellcheckEnabled={true}
        tabSize={2}
        theme="light"
        value={value}
        wrapLines={true}
      />
    );
  }

  it("mounts a restored markdown document", () => {
    const { container } = render(
      renderEditorPane({ value: "# Note\n\nRestored." }),
    );

    expect(container.querySelector(".editor-mount")).not.toBeNull();
  });

  it("syncs the CodeMirror document when the same tab receives an external value reset", () => {
    const editorRef = createRef<EditorPaneHandle>();
    const onChange = vi.fn();
    const { rerender } = render(
      renderEditorPane({
        onChange,
        ref: editorRef,
        value: "unsaved draft",
      }),
    );

    expect(editorRef.current?.getActiveDocument()?.text).toBe("unsaved draft");

    rerender(
      renderEditorPane({
        onChange,
        ref: editorRef,
        value: "saved on disk",
      }),
    );

    expect(editorRef.current?.getActiveDocument()?.text).toBe("saved on disk");
    expect(onChange).not.toHaveBeenCalled();
  });
});
