import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getEditorWrappingExtensions,
  isScrollerPointerOnScrollbar,
  type EditorPaneHandle,
} from "./EditorPane";
import EditorPane from "./EditorPane";
import { getLModeCopy, getSlashMenuCopy } from "../../lib/locale";
import type { SlashCommand } from "../../types/slash";

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

describe("isScrollerPointerOnScrollbar", () => {
  function makeScroller({
    clientHeight = 200,
    clientWidth = 280,
    offsetHeight = 215,
    offsetWidth = 300,
    scrollHeight = 1200,
    scrollWidth = 280,
  }: {
    clientHeight?: number;
    clientWidth?: number;
    offsetHeight?: number;
    offsetWidth?: number;
    scrollHeight?: number;
    scrollWidth?: number;
  }) {
    const scroller = document.createElement("div");
    Object.defineProperties(scroller, {
      clientHeight: { configurable: true, value: clientHeight },
      clientWidth: { configurable: true, value: clientWidth },
      offsetHeight: { configurable: true, value: offsetHeight },
      offsetWidth: { configurable: true, value: offsetWidth },
      scrollHeight: { configurable: true, value: scrollHeight },
      scrollWidth: { configurable: true, value: scrollWidth },
    });
    scroller.getBoundingClientRect = () =>
      ({
        bottom: 215,
        height: 215,
        left: 0,
        right: 300,
        top: 0,
        width: 300,
      }) as DOMRect;

    return scroller;
  }

  it("detects pointer down in the vertical scrollbar gutter", () => {
    expect(
      isScrollerPointerOnScrollbar(
        { button: 0, clientX: 292, clientY: 50, target: null },
        makeScroller({ offsetWidth: 300, clientWidth: 280 }),
      ),
    ).toBe(true);
  });

  it("uses a narrow right-edge fallback for overlay scrollbars", () => {
    const scroller = makeScroller({ offsetWidth: 300, clientWidth: 300 });

    expect(
      isScrollerPointerOnScrollbar(
        { button: 0, clientX: 292, clientY: 50, target: scroller },
        scroller,
      ),
    ).toBe(true);
  });

  it("does not treat normal editor content clicks as scrollbar interaction", () => {
    const scroller = makeScroller({ offsetWidth: 300, clientWidth: 280 });
    const content = document.createElement("div");
    scroller.append(content);

    expect(
      isScrollerPointerOnScrollbar(
        { button: 0, clientX: 120, clientY: 50, target: content },
        scroller,
      ),
    ).toBe(false);
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
    readOnly = false,
    ref,
    slashCommands = [],
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
    readOnly?: boolean;
    ref?: React.Ref<EditorPaneHandle>;
    slashCommands?: readonly SlashCommand[];
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
        readOnly={readOnly}
        onSelectionChange={vi.fn()}
        searchMatches={[]}
        showInvisibles={false}
        slashCommands={slashCommands}
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

  it("opens the slash command menu from the editor context menu", async () => {
    const slashCommands: SlashCommand[] = [
      {
        category: "markdown",
        hint: "#",
        id: "heading-1",
        insertText: "# ",
        label: "Heading 1",
        searchKeys: ["heading", "h1"],
      },
    ];
    const { container } = render(
      renderEditorPane({
        slashCommands,
        value: "body",
      }),
    );

    await waitFor(() => {
      expect(container.querySelector(".cm-content")).not.toBeNull();
    });

    fireEvent.contextMenu(container.querySelector(".cm-content") as Element, {
      clientX: 48,
      clientY: 64,
    });

    expect(await screen.findByRole("listbox", { name: "Slash command menu" }))
      .toBeTruthy();
    expect(screen.getByRole("option", { name: /Heading 1/ })).toBeTruthy();
  });

  it("closes the context slash command menu on outside click", async () => {
    const slashCommands: SlashCommand[] = [
      {
        category: "markdown",
        hint: "#",
        id: "heading-1",
        insertText: "# ",
        label: "Heading 1",
        searchKeys: ["heading", "h1"],
      },
    ];
    const { container } = render(
      renderEditorPane({
        slashCommands,
        value: "body",
      }),
    );

    await waitFor(() => {
      expect(container.querySelector(".cm-content")).not.toBeNull();
    });

    fireEvent.contextMenu(container.querySelector(".cm-content") as Element, {
      clientX: 48,
      clientY: 64,
    });
    expect(await screen.findByRole("listbox", { name: "Slash command menu" }))
      .toBeTruthy();

    fireEvent.mouseDown(document.body);

    await waitFor(() => {
      expect(
        screen.queryByRole("listbox", { name: "Slash command menu" }),
      ).toBeNull();
    });
  });

  it("marks CodeMirror content non-editable when readOnly is true and editable again when released", async () => {
    const { container, rerender } = render(
      renderEditorPane({ readOnly: true, value: "# Locked\n" }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(
      container.querySelector(".cm-content")?.getAttribute("contenteditable"),
    ).toBe("false");

    rerender(renderEditorPane({ readOnly: false, value: "# Locked\n" }));
    await waitFor(() => {
      expect(
        container.querySelector(".cm-content")?.getAttribute("contenteditable"),
      ).toBe("true");
    });
  });

  it("suppresses the default CodeMirror focused outline while adding a subtle focus signal", () => {
    expect(editorPaneSource).toMatch(
      /"&\.cm-focused"\s*:\s*{[^}]*outline:\s*"none"/s,
    );
    expect(editorPaneSource).toMatch(
      /"&\.cm-focused"\s*:\s*{[^}]*boxShadow:\s*"inset 0 1px 0 color-mix\(in srgb, var\(--accent\) 40%, transparent\)"/s,
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

  it("reports the settled editor scroll position when jumping to a line", () => {
    const editorRef = createRef<EditorPaneHandle>();
    const onScrollRatioChange = vi.fn();
    const { container } = render(
      renderEditorPane({
        onScrollRatioChange,
        ref: editorRef,
        value: "line 1\nline 2\nline 3\nline 4\nline 5",
      }),
    );
    const scroller = container.querySelector(".cm-scroller") as HTMLElement;
    Object.defineProperty(scroller, "scrollHeight", {
      configurable: true,
      value: 1000,
    });
    Object.defineProperty(scroller, "clientHeight", {
      configurable: true,
      value: 200,
    });
    scroller.scrollTop = 100;
    const frameCallbacks: FrameRequestCallback[] = [];
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        frameCallbacks.push(callback);
        return frameCallbacks.length;
      });

    try {
      onScrollRatioChange.mockClear();
      editorRef.current?.goToLine(4);
      scroller.scrollTop = 400;
      frameCallbacks.forEach((callback) => callback(0));

      expect(onScrollRatioChange).not.toHaveBeenCalledWith(0.75);
      expect(onScrollRatioChange).toHaveBeenLastCalledWith(0.5);
    } finally {
      requestAnimationFrameSpy.mockRestore();
    }
  });

  it("blurs the editor content when the native scrollbar gutter is pressed", () => {
    const { container } = render(
      renderEditorPane({
        value: Array.from({ length: 80 }, (_, index) => `line ${index + 1}`).join(
          "\n",
        ),
      }),
    );
    const scroller = container.querySelector(".cm-scroller") as HTMLElement;
    const content = container.querySelector(".cm-content") as HTMLElement;
    Object.defineProperties(scroller, {
      clientHeight: { configurable: true, value: 200 },
      clientWidth: { configurable: true, value: 280 },
      offsetHeight: { configurable: true, value: 215 },
      offsetWidth: { configurable: true, value: 300 },
      scrollHeight: { configurable: true, value: 1200 },
      scrollWidth: { configurable: true, value: 280 },
    });
    scroller.getBoundingClientRect = () =>
      ({
        bottom: 215,
        height: 215,
        left: 0,
        right: 300,
        top: 0,
        width: 300,
      }) as DOMRect;
    const blurSpy = vi.spyOn(content, "blur");

    fireEvent.mouseDown(scroller, {
      button: 0,
      clientX: 292,
      clientY: 50,
    });

    expect(blurSpy).toHaveBeenCalledTimes(1);
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
