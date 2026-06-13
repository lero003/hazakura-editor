import { cleanup, render, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getEditorWrappingExtensions,
  type EditorPaneHandle,
} from "./EditorPane";
import EditorPane from "./EditorPane";
import { getLModeCopy, getSlashMenuCopy } from "../../lib/locale";

const editorPaneSource = readFileSync(
  `${process.cwd()}/src/components/editor/EditorPane.tsx`,
  "utf8",
);

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
    lModeEnabled = false,
    lModeTypewriter = false,
    onChange = vi.fn(),
    onScrollRatioChange = vi.fn(),
    onPasteImage,
    ref,
    value,
  }: {
    documentKey?: string;
    lModeEnabled?: boolean;
    lModeTypewriter?: boolean;
    onChange?: (nextValue: string) => void;
    onScrollRatioChange?: (ratio: number) => void;
    onPasteImage?: (
      dataBase64: string,
      fileName: string,
    ) => Promise<string | null>;
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
        lModeEnabled={lModeEnabled}
        lModeTypewriter={lModeTypewriter}
        onChange={onChange}
        onPasteImage={onPasteImage}
        onScrollRatioChange={onScrollRatioChange}
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

  it("suppresses the default CodeMirror focused outline", () => {
    expect(editorPaneSource).toMatch(
      /"&\.cm-focused"\s*:\s*{\s*outline:\s*"none"/,
    );
  });

  it("keeps the cursor position when L Mode is toggled on", async () => {
    const editorRef = createRef<EditorPaneHandle>();
    const { rerender } = render(
      renderEditorPane({
        ref: editorRef,
        value: "line 1\nline 2\nline 3\n",
      }),
    );

    editorRef.current?.goToLine(2);
    expect(editorRef.current?.getActiveDocument()?.from).toBeGreaterThan(0);

    rerender(
      renderEditorPane({
        ref: editorRef,
        value: "line 1\nline 2\nline 3\n",
        lModeEnabled: true,
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(editorRef.current?.getActiveDocument()?.from).toBeGreaterThan(0);
  });

  it("keeps the cursor position when L Mode is toggled off", async () => {
    const editorRef = createRef<EditorPaneHandle>();
    const { rerender } = render(
      renderEditorPane({
        ref: editorRef,
        value: "line 1\nline 2\nline 3\n",
        lModeEnabled: true,
      }),
    );

    editorRef.current?.goToLine(2);
    expect(editorRef.current?.getActiveDocument()?.from).toBeGreaterThan(0);

    rerender(
      renderEditorPane({
        ref: editorRef,
        value: "line 1\nline 2\nline 3\n",
        lModeEnabled: false,
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(editorRef.current?.getActiveDocument()?.from).toBeGreaterThan(0);
  });

  it("keeps the cursor when only lModeTypewriter changes (not a real mode toggle)", async () => {
    const editorRef = createRef<EditorPaneHandle>();
    const { rerender } = render(
      renderEditorPane({
        ref: editorRef,
        value: "line 1\nline 2\nline 3\n",
        lModeEnabled: true,
      }),
    );

    editorRef.current?.goToLine(2);
    expect(editorRef.current?.getActiveDocument()?.from).toBeGreaterThan(0);

    // lModeTypewriter だけ変化 → カーソル位置は維持されるはず。
    rerender(
      renderEditorPane({
        ref: editorRef,
        value: "line 1\nline 2\nline 3\n",
        lModeEnabled: true,
        lModeTypewriter: true,
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(editorRef.current?.getActiveDocument()?.from).toBeGreaterThan(0);
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

  it("remounts the editor session when switching between Markdown documents", async () => {
    const editorRef = createRef<EditorPaneHandle>();
    const { container, rerender } = render(
      renderEditorPane({
        documentKey: "/workspace/first.md",
        ref: editorRef,
        value: "first line\nsecond line\nthird line\n",
      }),
    );

    editorRef.current?.insertText("draft ");
    expect(editorRef.current?.getActiveDocument()?.text).toBe(
      "draft first line\nsecond line\nthird line\n",
    );
    const firstEditor = container.querySelector(".cm-editor");
    expect(firstEditor).not.toBeNull();

    rerender(
      renderEditorPane({
        documentKey: "/workspace/second.md",
        ref: editorRef,
        value: "new file\nstill new\n",
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(editorRef.current?.getActiveDocument()).toMatchObject({
      text: "new file\nstill new\n",
      from: 0,
      to: 0,
    });

    expect(container.querySelector(".cm-editor")).not.toBe(firstEditor);
  });

  it("removes the old scroll listener when remounting the editor session", async () => {
    const onScrollRatioChange = vi.fn();
    const { container, rerender } = render(
      renderEditorPane({
        documentKey: "/workspace/first.md",
        onScrollRatioChange,
        value: "first line\nsecond line\nthird line\n",
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    const firstScroller = container.querySelector(".cm-scroller");
    expect(firstScroller).not.toBeNull();

    rerender(
      renderEditorPane({
        documentKey: "/workspace/second.md",
        onScrollRatioChange,
        value: "new file\nstill new\n",
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(container.querySelector(".cm-scroller")).not.toBe(firstScroller);

    onScrollRatioChange.mockClear();
    firstScroller?.dispatchEvent(new Event("scroll"));

    expect(onScrollRatioChange).not.toHaveBeenCalled();
  });

  it("inserts a pasted image at the paste-time selection even if the cursor moves before save completes", async () => {
    const editorRef = createRef<EditorPaneHandle>();
    const onChange = vi.fn();
    let resolvePaste:
      | ((relativePath: string | null) => void)
      | undefined;
    const onPasteImage = vi.fn(
      () =>
        new Promise<string | null>((resolve) => {
          resolvePaste = resolve;
        }),
    );
    const { container } = render(
      renderEditorPane({
        onChange,
        onPasteImage,
        ref: editorRef,
        value: "alpha\nbeta\n",
      }),
    );

    const content = container.querySelector(".cm-content");
    expect(content).not.toBeNull();
    const file = new File(["fake"], "figure.png", { type: "image/png" });
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", {
      value: {
        items: [
          {
            type: "image/png",
            getAsFile: () => file,
          },
        ],
      },
    });

    content?.dispatchEvent(event);
    await waitFor(() => {
      expect(onPasteImage).toHaveBeenCalled();
    });
    editorRef.current?.goToLine(2);
    resolvePaste?.("assets/figure.png");

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(
        "![](assets/figure.png)\nalpha\nbeta\n",
      );
    });
  });

  it("does not insert a pasted image if the document changes before save completes", async () => {
    const editorRef = createRef<EditorPaneHandle>();
    const onChange = vi.fn();
    let resolvePaste:
      | ((relativePath: string | null) => void)
      | undefined;
    const onPasteImage = vi.fn(
      () =>
        new Promise<string | null>((resolve) => {
          resolvePaste = resolve;
        }),
    );
    const { container } = render(
      renderEditorPane({
        onChange,
        onPasteImage,
        ref: editorRef,
        value: "alpha\nbeta\n",
      }),
    );

    const content = container.querySelector(".cm-content");
    expect(content).not.toBeNull();
    const file = new File(["fake"], "figure.png", { type: "image/png" });
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", {
      value: {
        items: [
          {
            type: "image/png",
            getAsFile: () => file,
          },
        ],
      },
    });

    content?.dispatchEvent(event);
    await waitFor(() => {
      expect(onPasteImage).toHaveBeenCalled();
    });
    editorRef.current?.insertText("typed ");
    resolvePaste?.("assets/figure.png");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(editorRef.current?.getActiveDocument()?.text).toBe(
      "typed alpha\nbeta\n",
    );
    expect(onChange).not.toHaveBeenCalledWith(
      "![](assets/figure.png)\nalpha\nbeta\n",
    );
  });
});
