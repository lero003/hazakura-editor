import { applyLiveEditorContentsById } from "../../features/editor/editorTabs";
import { useSaveConflictSurface } from "../../hooks/document/useSaveConflictSurface";
import { useWindowDialogActions } from "../../hooks/app/useWindowDialogActions";
import { useBackupReviewActions } from "../../hooks/workspace/useBackupReviewActions";
import { captureChangeReviewSnapshot } from "../../features/diff/changeReviewStale";
import type { EditorTab } from "../../types";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { readFileSync } from "node:fs";
import { createRef, useState } from "react";
import { applyReviewedLocalAssistProposal } from "../../hooks/editor/useAppleAssistApplyHandler";
import { localAssistProposalStore, type LocalAssistProposal } from "../../features/editor/localAssistProposal";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditorView } from "@codemirror/view";
import {
  getEditorWrappingExtensions,
  isScrollerPointerOnScrollbar,
  type EditorPaneHandle,
} from "./EditorPane";
import EditorPane from "./EditorPane";
import { getLModeCopy, getSlashMenuCopy } from "../../lib/locale";
import { findTextMatches } from "../../hooks/find/useFindMatches";
import type { SlashCommand } from "../../types/slash";
import type {
  EditorViewState,
  EditorViewStatePatch,
} from "../../features/editor/documentViewState";
import { parseMarkdownStructure } from "../../features/editor/markdownStructure";

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
    editorSessionKey = documentKey,
    editorViewState = null,
    lModeEnabled = false,
    lModeTypewriter = false,
    onChange = vi.fn(),
    onEditorViewStateChange = vi.fn(),
    onScrollRatioChange = vi.fn(),
    onPasteImage,
    readOnly = false,
    ref,
    activeSearchMatchIndex = -1,
    searchMatches = [],
    slashCommands = [],
    value,
  }: {
    documentKey?: string;
    editorSessionKey?: string;
    editorViewState?: EditorViewState | null;
    lModeEnabled?: boolean;
    lModeTypewriter?: boolean;
    onChange?: (nextValue: string) => void;
    onEditorViewStateChange?: (patch: EditorViewStatePatch) => void;
    onScrollRatioChange?: (ratio: number) => void;
    onPasteImage?: (
      dataBase64: string,
      fileName: string,
    ) => Promise<string | null>;
    readOnly?: boolean;
    ref?: React.Ref<EditorPaneHandle>;
    activeSearchMatchIndex?: number;
    searchMatches?: readonly { from: number; to: number }[];
    slashCommands?: readonly SlashCommand[];
    value: string;
  }) {
    return (
      <EditorPane
        ref={ref}
        activeSearchMatchIndex={activeSearchMatchIndex}
        documentKey={documentKey}
        editorSessionKey={editorSessionKey}
        editorViewState={editorViewState}
        fontSize={15}
        lModeCopy={getLModeCopy("en")}
        lModeEnabled={lModeEnabled}
        lModeTypewriter={lModeTypewriter}
        onChange={onChange}
        onEditorViewStateChange={onEditorViewStateChange}
        onPasteImage={onPasteImage}
        onScrollRatioChange={onScrollRatioChange}
        readOnly={readOnly}
        onSelectionChange={vi.fn()}
        searchMatches={[...searchMatches]}
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

  it("changes a heading level as one undoable editor transaction", async () => {
    const source = "### Chapter ###\nbody\n";
    const [heading] = parseMarkdownStructure(source).headings;
    const editorRef = createRef<EditorPaneHandle>();
    const onChange = vi.fn();
    const { container } = render(
      renderEditorPane({ onChange, ref: editorRef, value: source }),
    );

    act(() => {
      expect(editorRef.current?.changeHeadingLevel(heading, "promote")).toBe(
        true,
      );
    });

    expect(onChange).toHaveBeenLastCalledWith("## Chapter ###\nbody\n");
    expect(editorRef.current?.getActiveDocument()?.text).toBe(
      "## Chapter ###\nbody\n",
    );

    fireEvent.keyDown(container.querySelector(".cm-content") as Element, {
      ctrlKey: true,
      key: "z",
    });
    await waitFor(() => {
      expect(editorRef.current?.getActiveDocument()?.text).toBe(source);
    });
    expect(onChange).toHaveBeenLastCalledWith(source);
  });

  it("applies a reviewed Local Assist proposal and restores the source with one Undo", async () => {
    const source = "before\nTARGET\nafter";
    const sessionId = "assist-undo";
    const editorRef = createRef<EditorPaneHandle>();
    const proposal: LocalAssistProposal = {
      requestId: "assist-undo-request", request: "短くして", actionId: "rewrite_natural",
      originalText: "TARGET", candidateText: "REVISED", conversationId: "assist-undo-chat", turnIndex: 0,
      target: { kind: "selection", start: 7, end: 13, text: "TARGET", label: "selection",
        activeDocumentPath: "/workspace/note.md", activeDocumentName: "note.md",
        activeDocumentSessionId: sessionId, capturedAtMs: 0 },
    };
    localAssistProposalStore.record(sessionId, proposal);
    function Host() {
      const [value, setValue] = useState(source);
      return <>
        <button onClick={() => void applyReviewedLocalAssistProposal({ proposal,
          activeTab: { id: "note", sessionId, path: "/workspace/note.md", name: "note.md", contents: value },
          setActiveTabContents: setValue,
        })}>Apply reviewed proposal</button>
        <output data-testid="assist-dirty">{String(value !== source)}</output>
        {renderEditorPane({ value, onChange: setValue, ref: editorRef, editorSessionKey: sessionId })}
      </>;
    }
    const { container } = render(<Host />);
    fireEvent.click(screen.getByRole("button", { name: "Apply reviewed proposal" }));
    await waitFor(() => expect(editorRef.current?.getActiveDocument()?.text).toBe("before\nREVISED\nafter"));
    expect(screen.getByTestId("assist-dirty").textContent).toBe("true");
    expect(localAssistProposalStore.getLatest(sessionId)).toBeNull();
    fireEvent.keyDown(container.querySelector(".cm-content") as Element, { ctrlKey: true, key: "z" });
    await waitFor(() => expect(editorRef.current?.getActiveDocument()?.text).toBe(source));
    expect(screen.getByTestId("assist-dirty").textContent).toBe("false");
    expect(localAssistProposalStore.getLatest(sessionId)).toBeNull();
  });

  it("does not change heading structure while IME composition is active", () => {
    const source = "## Chapter\nbody\n";
    const [heading] = parseMarkdownStructure(source).headings;
    const editorRef = createRef<EditorPaneHandle>();
    const onChange = vi.fn();
    const { container } = render(
      renderEditorPane({ onChange, ref: editorRef, value: source }),
    );
    const content = container.querySelector(".cm-content") as Element;

    fireEvent.compositionStart(content);
    expect(editorRef.current?.changeHeadingLevel(heading, "promote")).toBe(
      false,
    );
    expect(onChange).not.toHaveBeenCalled();
    expect(editorRef.current?.getActiveDocument()?.text).toBe(source);
    fireEvent.compositionEnd(content);
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

  it("remounts the editor on L Mode toggle while restoring the cursor position", async () => {
    // CodeMirror 6.43.3/6.43.4 の tile tree（行仮想化）破損を回避するため、
    // .md でも L Mode 切替時は EditorView を作り直す。その代わりカーソル位置と
    // スクロール比は直前の View から復元する。このテストは「再マウントされる
    // こと」と「カーソル位置が戻ること」を両方検証する。
    const editorRef = createRef<EditorPaneHandle>();
    const { container, rerender } = render(
      renderEditorPane({
        ref: editorRef,
        value: "line 1\nline 2\nline 3\n",
      }),
    );

    editorRef.current?.goToLine(2);
    const beforeEditor = container.querySelector(".cm-editor");
    const beforeFrom = editorRef.current?.getActiveDocument()?.from;
    expect(beforeFrom).toBeGreaterThan(0);

    rerender(
      renderEditorPane({
        ref: editorRef,
        value: "line 1\nline 2\nline 3\n",
        lModeEnabled: true,
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    // EditorView は作り直される（別 DOM ノード）
    const afterEditor = container.querySelector(".cm-editor");
    expect(afterEditor).not.toBe(beforeEditor);
    // カーソル位置は復元される
    expect(editorRef.current?.getActiveDocument()?.from).toBe(beforeFrom);
  });

  it("restores the controlled cursor when switching back to a tab", async () => {
    const editorRef = createRef<EditorPaneHandle>();
    const { rerender } = render(
      renderEditorPane({
        documentKey: "/workspace/a.md",
        editorViewState: { anchor: 14, head: 14, scrollRatio: 0.5 },
        ref: editorRef,
        value: "line 1\nline 2\nline 3\n",
      }),
    );

    expect(editorRef.current?.getActiveDocument()?.from).toBe(14);

    rerender(
      renderEditorPane({
        documentKey: "/workspace/b.md",
        editorViewState: null,
        ref: editorRef,
        value: "other content\n",
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(editorRef.current?.getActiveDocument()?.from).toBe(0);

    rerender(
      renderEditorPane({
        documentKey: "/workspace/a.md",
        editorViewState: { anchor: 14, head: 14, scrollRatio: 0.5 },
        ref: editorRef,
        value: "line 1\nline 2\nline 3\n",
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(editorRef.current?.getActiveDocument()?.from).toBe(14);
  });

  it("clamps a stale controlled selection to the current document", () => {
    const editorRef = createRef<EditorPaneHandle>();
    render(
      renderEditorPane({
        editorViewState: { anchor: 999, head: -4, scrollRatio: 2 },
        ref: editorRef,
        value: "short",
      }),
    );

    expect(editorRef.current?.getActiveDocument()).toMatchObject({
      from: 0,
      to: 5,
    });
  });

  it("restores the controlled scroll ratio after the editor layout settles", () => {
    const frameCallbacks: FrameRequestCallback[] = [];
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        frameCallbacks.push(callback);
        return frameCallbacks.length;
      });

    try {
      const { container } = render(
        renderEditorPane({
          editorViewState: { anchor: 0, head: 0, scrollRatio: 0.5 },
          value: Array.from({ length: 80 }, (_, index) => `line ${index + 1}`).join(
            "\n",
          ),
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

      for (let pass = 0; pass < 4 && frameCallbacks.length > 0; pass += 1) {
        const pending = frameCallbacks.splice(0);
        pending.forEach((callback) => callback(0));
      }

      expect(scroller.scrollTop).toBe(400);
    } finally {
      requestAnimationFrameSpy.mockRestore();
    }
  });

  it("reports selection changes as an editor view-state patch", () => {
    const editorRef = createRef<EditorPaneHandle>();
    const onEditorViewStateChange = vi.fn();
    render(
      renderEditorPane({
        onEditorViewStateChange,
        ref: editorRef,
        value: "line 1\nline 2\nline 3\n",
      }),
    );

    onEditorViewStateChange.mockClear();
    editorRef.current?.goToLine(3);

    expect(onEditorViewStateChange).toHaveBeenCalledWith({
      anchor: 14,
      head: 14,
    });
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
      // v0.34: goToLine は double-rAF で報告するため、2フレーム分進める。
      const firstPass = [...frameCallbacks];
      frameCallbacks.length = 0;
      firstPass.forEach((callback) => callback(0));
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

  it("restores editor focus after releasing the scrollbar drag", () => {
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

    // まずフォーカスを当てておき、スクロールバードラッグで blur、
    // mouseup でフォーカスが戻ることを検証する。
    content.focus();
    expect(document.activeElement).toBe(content);

    fireEvent.mouseDown(scroller, { button: 0, clientX: 292, clientY: 50 });
    expect(document.activeElement).not.toBe(content);

    fireEvent.mouseUp(window, { button: 0, clientX: 292, clientY: 60 });
    // v0.34: blur したままではなく、mouseup でフォーカスが戻る。
    expect(document.activeElement).toBe(content);
  });

  // トラック 500px / つまみ 100px（scrollHeight 2500・clientHeight 500・最大 2000）を
  // 前提に、末尾ドラッグの当たり判定を固定する。CodeMirror の再計測による高さの伸びは
  // mouseup の *後* に与え、rAF を1フレームずつ進めて確認する。
  function mountBottomDragHarness() {
    const frames: FrameRequestCallback[] = [];
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        frames.push(callback);
        return frames.length;
      });
    const stepFrames = () => {
      const pending = [...frames];
      frames.length = 0;
      pending.forEach((callback) => callback(0));
    };
    const { container } = render(
      renderEditorPane({
        value: Array.from({ length: 120 }, (_, index) => `line ${index + 1}`).join(
          "\n",
        ),
      }),
    );
    const scroller = container.querySelector(".cm-scroller") as HTMLElement;
    let scrollHeight = 2500;
    Object.defineProperties(scroller, {
      clientHeight: { configurable: true, value: 500 },
      clientWidth: { configurable: true, value: 280 },
      offsetHeight: { configurable: true, value: 515 },
      offsetWidth: { configurable: true, value: 300 },
      scrollHeight: { configurable: true, get: () => scrollHeight },
      scrollWidth: { configurable: true, value: 280 },
    });
    // 横スクロールバーが 15px を占める（clientHeight 500 + 横バー 15 = 515）。
    // 縦トラックは 0〜500 で、要素の rect とは一致しない。
    scroller.getBoundingClientRect = () =>
      ({
        bottom: 515,
        height: 515,
        left: 0,
        right: 300,
        top: 0,
        width: 300,
      }) as DOMRect;

    return {
      scroller,
      setScrollHeight: (next: number) => {
        scrollHeight = next;
      },
      stepFrames,
      requestAnimationFrameSpy,
    };
  }

  it("keeps the bottom when the thumb (grabbed at its center) reaches the track end", () => {
    const harness = mountBottomDragHarness();

    try {
      const { scroller } = harness;
      // つまみは先頭（scrollTop 0）にあり、その中央（y=50）をつかむ。
      scroller.scrollTop = 0;
      fireEvent.mouseDown(scroller, { button: 0, clientX: 292, clientY: 50 });
      // つまみの下端がトラック下端へ届く位置＝ポインタ y=450 まで運ぶ。
      scroller.scrollTop = 2000;
      fireEvent.mouseUp(window, { button: 0, clientX: 292, clientY: 450 });

      // 離した後に CodeMirror が測り直して総高さが伸びる（2500 → 2800）。
      harness.setScrollHeight(2800);
      act(() => {
        harness.stepFrames();
      });
      expect(scroller.scrollTop).toBe(2300);
    } finally {
      harness.requestAnimationFrameSpy.mockRestore();
    }
  });

  it("keeps the bottom when the pointer is released past the track end", () => {
    const harness = mountBottomDragHarness();

    try {
      const { scroller } = harness;
      scroller.scrollTop = 0;
      fireEvent.mouseDown(scroller, { button: 0, clientX: 292, clientY: 50 });
      scroller.scrollTop = 2000;
      fireEvent.mouseUp(window, { button: 0, clientX: 292, clientY: 540 });

      harness.setScrollHeight(2800);
      act(() => {
        harness.stepFrames();
      });
      expect(scroller.scrollTop).toBe(2300);
    } finally {
      harness.requestAnimationFrameSpy.mockRestore();
    }
  });

  it("uses the vertical track when a horizontal scrollbar occupies the bottom band", () => {
    const harness = mountBottomDragHarness();

    try {
      const { scroller } = harness;
      // 横バー併設の幾何モデル: 表示領域 500 / 本文 2000 / 横バー 15。
      // 縦トラックは 0〜500 で、つまみは 125。
      harness.setScrollHeight(2000);
      // つまみは先頭（scrollTop 0）にあり、その中央（y=62.5）をつかむ。
      scroller.scrollTop = 0;
      fireEvent.mouseDown(scroller, { button: 0, clientX: 292, clientY: 63 });
      // つまみの下端が縦トラックの下端（y=500）へ届く位置＝ポインタ y=437.5。
      scroller.scrollTop = 1500;
      fireEvent.mouseUp(window, { button: 0, clientX: 292, clientY: 438 });

      harness.setScrollHeight(2300);
      act(() => {
        harness.stepFrames();
      });
      // 横バーを含む rect（515）で計算すると到達しない位置で、補正が効く。
      expect(scroller.scrollTop).toBe(1800);
    } finally {
      harness.requestAnimationFrameSpy.mockRestore();
    }
  });

  it("does not treat a check short of the vertical track end as a bottom request", () => {
    const harness = mountBottomDragHarness();

    try {
      const { scroller } = harness;
      harness.setScrollHeight(2000);
      scroller.scrollTop = 0;
      fireEvent.mouseDown(scroller, { button: 0, clientX: 292, clientY: 63 });
      scroller.scrollTop = 1500;
      // 真の末尾到達 Y は 437.5。420 で離すのは途中停止なので補正しない。
      fireEvent.mouseUp(window, { button: 0, clientX: 292, clientY: 420 });

      act(() => {
        harness.stepFrames();
      });
      expect(scroller.scrollTop).toBe(1500);
    } finally {
      harness.requestAnimationFrameSpy.mockRestore();
    }
  });

  it("follows repeated height growth across later frames", () => {
    const harness = mountBottomDragHarness();

    try {
      const { scroller } = harness;
      scroller.scrollTop = 0;
      fireEvent.mouseDown(scroller, { button: 0, clientX: 292, clientY: 50 });
      scroller.scrollTop = 2000;
      fireEvent.mouseUp(window, { button: 0, clientX: 292, clientY: 450 });

      harness.setScrollHeight(2800);
      act(() => {
        harness.stepFrames();
      });
      harness.setScrollHeight(3000);
      act(() => {
        harness.stepFrames();
      });
      expect(scroller.scrollTop).toBe(2500);
    } finally {
      harness.requestAnimationFrameSpy.mockRestore();
    }
  });

  it("does not snap to the bottom when the drag ends in the middle of the track", () => {
    const harness = mountBottomDragHarness();

    try {
      const { scroller } = harness;
      scroller.scrollTop = 0;
      fireEvent.mouseDown(scroller, { button: 0, clientX: 292, clientY: 50 });
      scroller.scrollTop = 1000;
      fireEvent.mouseUp(window, { button: 0, clientX: 292, clientY: 250 });

      harness.setScrollHeight(2800);
      act(() => {
        harness.stepFrames();
      });
      expect(scroller.scrollTop).toBe(1000);
    } finally {
      harness.requestAnimationFrameSpy.mockRestore();
    }
  });

  it("does not replace part of a name when whole-word search skips astral boundaries", () => {
    const editorRef = createRef<EditorPaneHandle>();
    const source = "𠮷田 田";
    // 先頭の「田」は直前が補助面の漢字（𠮷）なので単語全体ではない。
    const matches = findTextMatches(source, "田", {
      caseSensitive: false,
      regex: false,
      wholeWord: true,
    });
    expect(matches).toEqual([{ from: 4, to: 5 }]);

    render(
      renderEditorPane({
        ref: editorRef,
        searchMatches: matches,
        value: source,
      }),
    );

    act(() => {
      editorRef.current?.replaceAll("bar");
    });
    // 名前に含まれる「田」は残る。
    expect(editorRef.current?.getActiveDocument()?.text).toBe("𠮷田 bar");
  });

  it("replaces the correct range for a case-insensitive match after İ", () => {
    const editorRef = createRef<EditorPaneHandle>();
    const source = "İ foo Z";
    // 検索範囲そのものを実装から取り、その範囲が置換トランザクションへ渡ることを見る。
    const matches = findTextMatches(source, "foo", {
      caseSensitive: false,
      regex: false,
      wholeWord: false,
    });
    render(
      renderEditorPane({
        activeSearchMatchIndex: 0,
        ref: editorRef,
        searchMatches: matches,
        value: source,
      }),
    );

    expect(editorRef.current?.replaceCurrent("bar")).toBe(true);
    // 旧実装は [3, 6) を返し、İ fbarZ になっていた。
    expect(editorRef.current?.getActiveDocument()?.text).toBe("İ bar Z");
  });

  it("replaces every case-insensitive match after İ and undoes in one step", async () => {
    const editorRef = createRef<EditorPaneHandle>();
    const onChange = vi.fn();
    const source = "İ foo foo";
    const matches = findTextMatches(source, "foo", {
      caseSensitive: false,
      regex: false,
      wholeWord: false,
    });
    const { container } = render(
      renderEditorPane({
        onChange,
        ref: editorRef,
        searchMatches: matches,
        value: source,
      }),
    );

    act(() => {
      editorRef.current?.replaceAll("bar");
    });
    expect(editorRef.current?.getActiveDocument()?.text).toBe("İ bar bar");

    fireEvent.keyDown(container.querySelector(".cm-content") as Element, {
      ctrlKey: true,
      key: "z",
    });
    await waitFor(() => {
      expect(editorRef.current?.getActiveDocument()?.text).toBe(source);
    });
    expect(onChange).toHaveBeenLastCalledWith(source);
  });

  it("refuses find/replace while the editor is locked (Local Assist generation)", () => {
    const editorRef = createRef<EditorPaneHandle>();
    const onChange = vi.fn();
    render(
      renderEditorPane({
        activeSearchMatchIndex: 0,
        onChange,
        readOnly: true,
        ref: editorRef,
        searchMatches: [{ from: 0, to: 3 }],
        value: "foo foo foo",
      }),
    );

    // 置換 API は編集ロックを自分で検査する（facet だけでは dispatch は止まらない）。
    expect(editorRef.current?.replaceCurrent("bar")).toBe(false);
    expect(editorRef.current?.replaceAll("bar")).toBeUndefined();

    // 見えている本文と保存対象（onChange が運ぶ正本）が食い違わない。
    expect(editorRef.current?.getActiveDocument()?.text).toBe("foo foo foo");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("replaces the active search match when the editor is editable", () => {
    const editorRef = createRef<EditorPaneHandle>();
    const onChange = vi.fn();
    render(
      renderEditorPane({
        activeSearchMatchIndex: 0,
        onChange,
        ref: editorRef,
        searchMatches: [{ from: 0, to: 3 }],
        value: "foo foo foo",
      }),
    );

    expect(editorRef.current?.replaceCurrent("bar")).toBe(true);
    expect(editorRef.current?.getActiveDocument()?.text).toBe("bar foo foo");
    expect(onChange).toHaveBeenCalledWith("bar foo foo");
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

  it("keeps the editor session when Save As changes only the Markdown path", async () => {
    const editorRef = createRef<EditorPaneHandle>();
    const onChange = vi.fn();
    const { container, rerender } = render(
      renderEditorPane({
        documentKey: "untitled:1",
        editorSessionKey: "untitled:1",
        onChange,
        ref: editorRef,
        value: "first line\nsecond line\n",
      }),
    );

    editorRef.current?.goToLine(2);
    editorRef.current?.insertText("draft ");
    const firstEditor = container.querySelector(".cm-editor");
    const firstScroller = container.querySelector(".cm-scroller");
    if (firstScroller instanceof HTMLElement) {
      firstScroller.scrollTop = 120;
    }
    const selectionBeforeSaveAs = editorRef.current?.getActiveDocument()?.from;

    rerender(
      renderEditorPane({
        documentKey: "/tmp/saved.md",
        editorSessionKey: "untitled:1",
        onChange,
        ref: editorRef,
        value: "first line\ndraft second line\n",
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(container.querySelector(".cm-editor")).toBe(firstEditor);
    expect(container.querySelector(".cm-scroller")).toBe(firstScroller);
    expect((firstScroller as HTMLElement | null)?.scrollTop).toBe(120);
    expect(editorRef.current?.getActiveDocument()?.from).toBe(
      selectionBeforeSaveAs,
    );

    fireEvent.keyDown(container.querySelector(".cm-content") as Element, {
      ctrlKey: true,
      key: "z",
    });
    expect(onChange).toHaveBeenLastCalledWith("first line\nsecond line\n");
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

  it("pins ResizeObserver-driven remeasure for preview/split width changes", () => {
    // Source pin so a future refactor cannot drop the width-change
    // remeasure path without failing a test. Runtime coverage is in
    // the ResizeObserver mock test below.
    expect(editorPaneSource).toMatch(/new ResizeObserver/);
    expect(editorPaneSource).toMatch(/requestMeasure/);
    expect(editorPaneSource).toMatch(/lastObservedWidth/);
  });

  it("requests a measure when the editor mount width changes after the baseline", async () => {
    type ResizeCallback = (entries: ResizeObserverEntry[]) => void;
    const observers: Array<{
      callback: ResizeCallback;
      targets: Element[];
    }> = [];
    const OriginalResizeObserver = globalThis.ResizeObserver;

    class MockResizeObserver {
      callback: ResizeCallback;
      targets: Element[] = [];
      constructor(callback: ResizeCallback) {
        this.callback = callback;
        observers.push(this);
      }
      observe(target: Element) {
        this.targets.push(target);
      }
      unobserve() {}
      disconnect() {
        this.targets = [];
      }
    }

    globalThis.ResizeObserver =
      MockResizeObserver as unknown as typeof ResizeObserver;

    try {
      const { container, unmount } = render(
        renderEditorPane({
          value: "# Note\n\n" + "long line ".repeat(40) + "\n",
        }),
      );
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(observers.length).toBeGreaterThan(0);
      const observer = observers[observers.length - 1];
      expect(observer.targets.some((t) => t.classList.contains("editor-mount"))).toBe(
        true,
      );

      // Baseline observation — must not remeasure yet.
      observer.callback([
        {
          contentRect: { width: 800, height: 400 } as DOMRectReadOnly,
        } as ResizeObserverEntry,
      ]);

      const scroller = container.querySelector(".cm-scroller");
      expect(scroller).not.toBeNull();
      const viewDom = container.querySelector(".cm-editor");
      expect(viewDom).not.toBeNull();

      // Spy requestMeasure on EditorView so a width shrink (preview
      // open) is observable without reading private CM fields.
      const requestMeasureSpy = vi.spyOn(
        EditorView.prototype,
        "requestMeasure",
      );

      // Preview-open style width shrink.
      observer.callback([
        {
          contentRect: { width: 420, height: 400 } as DOMRectReadOnly,
        } as ResizeObserverEntry,
      ]);

      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(requestMeasureSpy).toHaveBeenCalled();
      requestMeasureSpy.mockRestore();

      unmount();
      // After unmount the observer should be disconnected (no targets).
      expect(observer.targets).toHaveLength(0);
    } finally {
      globalThis.ResizeObserver = OriginalResizeObserver;
    }
  });

it("restores a reviewed backup through the real editor with one Undo and preserved DOM", async () => {
  const source = "current unsaved work";
  const tab = { id: "doc", sessionId: "backup-undo", path: "/workspace/doc.md", name: "doc.md", contents: source,
    encoding: "utf-8", line_ending: "lf", lastSavedContents: source } as EditorTab;
  const editorRef = createRef<EditorPaneHandle>();
  const claim = { documentPath: tab.path, backupContents: "backup contents", capturedSnapshot: captureChangeReviewSnapshot(tab) };
  const close = vi.fn();
  function Host() {
    const [value, setValue] = useState(source);
    const { focusEditorSoon } = useWindowDialogActions({ editorPaneRef: editorRef,
      setGlobalError: () => {}, setPendingAppClose: () => {}, setPendingCloseTabId: () => {},
      setPreferencesDialogMode: () => {}, setStatus: () => {} });
    const actions = useBackupReviewActions({ activeTab: { ...tab, contents: value }, workspaceRootPath: "/workspace", menuLanguage: "en",
      imageVisible: false, editorPaneRef: editorRef, readBackup: async () => "", closePicker: () => {}, leaveLMode: () => {},
      review: () => {}, closeComparison: () => { close(); focusEditorSoon(); }, setStatus: () => {}, rejectIfLocked: () => false });
    return <><button onClick={() => actions.apply(claim)}>Restore reviewed backup</button>
      <output data-testid="backup-dirty">{String(value !== source)}</output>
      {renderEditorPane({ value, onChange: setValue, ref: editorRef, editorSessionKey: tab.sessionId })}</>;
  }
  const { container } = render(<Host />);
  const content = container.querySelector(".cm-content")!;
  fireEvent.click(screen.getByRole("button", { name: "Restore reviewed backup" }));
  expect(editorRef.current?.getActiveDocument()?.text).toBe("backup contents");
  expect(screen.getByTestId("backup-dirty").textContent).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Restore reviewed backup" }));
  expect(close).toHaveBeenCalledOnce();
  await waitFor(() => expect(document.activeElement).toBe(content));
  fireEvent.keyDown(document.activeElement!, { ctrlKey: true, key: "z" });
  await waitFor(() => expect(editorRef.current?.getActiveDocument()?.text).toBe(source));
  expect(screen.getByTestId("backup-dirty").textContent).toBe("false");
  expect(container.querySelector(".cm-content")).toBe(content);
});

  it("keeps a dismissed conflict through real CodeMirror input", async () => {
    const initial = { id: "conflict", sessionId: "conflict-input", path: "/note.md", name: "note.md", contents: "text",
      lastSavedContents: "saved", saveStatus: "conflict", error: "Save conflict", externalFingerprint: "disk", encoding: "utf-8", line_ending: "lf" } as EditorTab;
    function Host() {
      const [tab, setTab] = useState(initial);
      const surface = useSaveConflictSurface(tab, tab.saveStatus === "conflict");
      return <>{surface.tab && <button onClick={surface.dismiss}>Return to editor</button>}
        <output data-testid="conflict-state">{tab.saveStatus}:{tab.error}</output>
        {renderEditorPane({ value: tab.contents, editorSessionKey: tab.sessionId,
          onChange: value => setTab(current => applyLiveEditorContentsById([current], current.id, value)[0]) })}</>;
    }
    const { container } = render(<Host />);
    fireEvent.click(screen.getByRole("button", { name: "Return to editor" }));
    const content = container.querySelector(".cm-content")!;
    act(() => { EditorView.findFromDOM(content as HTMLElement)!.dispatch({ changes: { from: 4, insert: "!" } }); });
    expect(content.textContent).toBe("text!");
    expect(screen.getByTestId("conflict-state").textContent).toBe("conflict:Save conflict");
    expect(screen.queryByRole("button", { name: "Return to editor" })).toBeNull();
    expect(container.querySelector(".cm-content")).toBe(content);
  });

});
