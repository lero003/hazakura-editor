import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef, type ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppWorkspace } from "./AppWorkspace";
import {
  getLModeCopy,
  getSafeEditorCopy,
  getSidePaneCopy,
  getSlashMenuCopy,
  getWorkspaceFileOpsCopy,
} from "../../lib/locale";
import type { EditorPaneHandle } from "../editor/EditorPane";
import type { WorkspaceTreeEntry } from "../../lib/tauri";
import type { EditorSettings, EditorTab } from "../../types";

vi.mock("../editor/EditorMainPane", () => ({
  EditorMainPane: () => <div data-testid="editor-main-pane" />,
}));

vi.mock("../editor/PaneResizer", () => ({
  PaneResizer: () => <div data-testid="pane-resizer" />,
}));

vi.mock("./SidePane", () => ({
  SidePane: (props: {
    ebookLocation?: { chapterIndex: number; pageIndex: number } | null;
    onEbookLocationChange?: (location: {
      chapterIndex: number;
      pageIndex: number;
      sourceLine?: number;
    }) => void;
    onOpenEbookReadingFocus?: (location: {
      chapterIndex: number;
      pageIndex: number;
    }) => void;
  }) => (
    <div data-testid="side-pane">
      <span data-testid="side-ebook-location">
        side location{" "}
        {props.ebookLocation
          ? `${props.ebookLocation.chapterIndex}:${props.ebookLocation.pageIndex}`
          : "none"}
      </span>
      <button
        onClick={() =>
          props.onEbookLocationChange?.({ chapterIndex: 1, pageIndex: 2 })
        }
        type="button"
      >
        Mock store old reader location
      </button>
      <button
        onClick={() =>
          props.onEbookLocationChange?.({
            chapterIndex: 1,
            pageIndex: 2,
            sourceLine: 6,
          })
        }
        type="button"
      >
        Mock one-page reader location change
      </button>
      <button
        onClick={() =>
          props.onOpenEbookReadingFocus?.({ chapterIndex: 1, pageIndex: 2 })
        }
        type="button"
      >
        Mock enter reading focus
      </button>
    </div>
  ),
}));

vi.mock("../editor/preview/EBookPane", () => ({
  default: (props: {
    initialLocation?: { chapterIndex: number; pageIndex: number } | null;
    onExitReadingFocus?: (location: {
      chapterIndex: number;
      pageIndex: number;
      sourceLine?: number;
    }) => void;
    onLocationChange?: (location: {
      chapterIndex: number;
      pageIndex: number;
    }) => void;
  }) => (
    <div data-testid="ebook-focus-pane">
      focus {props.initialLocation?.chapterIndex ?? 0}:
      {props.initialLocation?.pageIndex ?? 0}
      <button
        onClick={() =>
          props.onLocationChange?.({ chapterIndex: 2, pageIndex: 3 })
        }
        type="button"
      >
        Mock focus location change
      </button>
      <button
        onClick={() =>
          props.onExitReadingFocus?.({
            chapterIndex: props.initialLocation?.chapterIndex ?? 0,
            pageIndex: props.initialLocation?.pageIndex ?? 0,
          })
        }
        type="button"
      >
        Mock exit reading focus
      </button>
      <button
        onClick={() =>
          props.onExitReadingFocus?.({
            chapterIndex: props.initialLocation?.chapterIndex ?? 0,
            pageIndex: props.initialLocation?.pageIndex ?? 0,
            sourceLine: 6,
          })
        }
        type="button"
      >
        Mock exit reading focus with source line
      </button>
    </div>
  ),
}));

afterEach(cleanup);

const editorSettings: EditorSettings = {
  ambientIntensity: "subtle",
  appleAssistDiffInitiallyOpen: true,
  autoBackupEnabled: true,
  editorFontSize: 14,
  lModeEnabled: false,
  lModeFontSize: 15,
  lModeTypewriter: false,
  previewFontSize: 15,
  showInvisibles: false,
  spellcheckEnabled: true,
  tabSize: 2,
  workspaceFontSize: 13,
  wrapLines: true,
};

const bookTab = {
  contents: "# Chapter\n\nbody",
  encoding: "utf-8",
  error: null,
  externalFingerprint: null,
  fingerprint: "book-fp",
  ignoredExternalFingerprint: null,
  id: "/workspace/book.md",
  large_file_warning: false,
  lastSavedContents: "# Chapter\n\nbody",
  lastSavedEncoding: "utf-8",
  lastSavedLineEnding: "lf",
  line_ending: "lf",
  modified_ms: null,
  name: "book.md",
  path: "/workspace/book.md",
  saveStatus: "idle",
  size: 15,
} as const;

function makeTab(overrides: Partial<EditorTab> = {}): EditorTab {
  return {
    contents: "saved",
    encoding: "utf-8",
    error: null,
    externalFingerprint: null,
    fingerprint: "fingerprint",
    id: "/workspace/book.md",
    ignoredExternalFingerprint: null,
    large_file_warning: false,
    lastSavedContents: "saved",
    lastSavedEncoding: "utf-8",
    lastSavedLineEnding: "lf",
    line_ending: "lf",
    modified_ms: null,
    name: "book.md",
    path: "/workspace/book.md",
    saveStatus: "idle",
    size: 5,
    ...overrides,
  };
}

function workspaceEntry(
  name: string,
  path: string,
  kind: WorkspaceTreeEntry["kind"],
  children: WorkspaceTreeEntry[] = [],
): WorkspaceTreeEntry {
  return {
    children,
    children_loaded: true,
    children_truncated: false,
    kind,
    name,
    path,
  };
}

function makeWorkspaceProps(
  overrides: Partial<ComponentProps<typeof AppWorkspace>> = {},
): ComponentProps<typeof AppWorkspace> {
  const props: ComponentProps<typeof AppWorkspace> = {
    activeContents: "",
    activeDocumentLineCount: 0,
    activeMatchIndex: -1,
    activeTab: null,
    agentLaunchGate: { kind: "passed", message: "", preflight: null },
    agentOutput: [],
    agentSession: null,
    agentStopPending: false,
    agentWorkbenchProvider: "codex",
    clearCompareSource: vi.fn(),
    clearCompareTarget: vi.fn(),
    closeCompareView: vi.fn(),
    compareAnchor: null,
    compareTarget: null,
    compareView: null,
    createFile: vi.fn(),
    createFolder: vi.fn(),
    createNewFile: vi.fn(),
    currentHeadingLine: null,
    documentHeadings: [],
    documentKey: "empty",
    editorPaneRef: createRef<EditorPaneHandle | null>(),
    editorPreviewGridRef: createRef<HTMLDivElement | null>(),
    editorPreviewGridStyle: undefined,
    editorSettings,
    editorTheme: "light",
    fileOpsCopy: getWorkspaceFileOpsCopy("en"),
    findMatches: [],
    getCompareCaseByKey: vi.fn(),
    handleEditorChange: vi.fn(),
    handlePasteImage: vi.fn(),
    handlePresetPrompt: vi.fn(),
    handlePreviewResizeKeyDown: vi.fn(),
    handlePreviewResizePointerDown: vi.fn(),
    handlePreviewResizePointerMove: vi.fn(),
    handleSendSelectionToAgent: vi.fn(),
    hasWorkspaceSelection: false,
    jumpToHeading: vi.fn(),
    loadWorkspaceDirectory: vi.fn(),
    lModeCopy: getLModeCopy("en"),
    menuLanguage: "en",
    onApplyBackup: vi.fn(),
    onCheckAgentGate: vi.fn(),
    onMoveEntry: vi.fn(),
    onMoveToTrash: vi.fn(),
    onOpenAgentWindow: vi.fn(),
    onResumeAgentUiRefresh: vi.fn(),
    onResizeAgentTerminal: vi.fn(),
    onSendAgentTerminalData: vi.fn(),
    onStopAgentSession: vi.fn(),
    onSubmitRename: vi.fn(),
    onSuspendAgentUiRefresh: vi.fn(),
    openFile: vi.fn(),
    openFilePath: vi.fn(),
    openPreviewMarkdownLink: vi.fn(),
    openRootWorkspaceContextMenu: vi.fn(),
    openWorkspace: vi.fn(),
    openWorkspaceContextMenu: vi.fn(),
    openWorkspaceFile: vi.fn(),
    outlineTruncated: false,
    previewColumnPercent: 45,
    previewPaneRef: createRef<HTMLDivElement | null>(),
    previewVisible: true,
    renamingPath: null,
    requestRename: vi.fn(),
    restoreComplete: true,
    resolvedTheme: "light",
    runSelectedFileCompare: vi.fn(),
    safeEditorCopy: getSafeEditorCopy("en"),
    scrollHudContext: { current: null, next: null, previous: null },
    scrollHudLine: 0,
    scrollHudVisible: false,
    selectedImage: null,
    selectWorkspaceCompareFile: vi.fn(),
    setSelectionInfo: vi.fn(),
    sidePaneCopy: getSidePaneCopy("en"),
    sidePaneMode: null,
    sidePaneVisible: false,
    slashCommands: [],
    slashMenuCopy: getSlashMenuCopy("en"),
    syncEditorScroll: vi.fn(),
    syncPreviewScroll: vi.fn(),
    tabs: [],
    workspaceRootPath: null,
    workspaceTree: null,
    ...overrides,
  };

  return props;
}

function renderWorkspace(
  overrides: Partial<ComponentProps<typeof AppWorkspace>> = {},
) {
  return render(<AppWorkspace {...makeWorkspaceProps(overrides)} />);
}

function rerenderWorkspace(
  rerender: ReturnType<typeof render>["rerender"],
  overrides: Partial<ComponentProps<typeof AppWorkspace>> = {},
) {
  rerender(<AppWorkspace {...makeWorkspaceProps(overrides)} />);
}

describe("AppWorkspace workspace sidebar collapse", () => {
  it("passes open and dirty tab markers into the workspace tree", () => {
    const dirtyTab = makeTab({
      contents: "edited",
      id: "/workspace/draft.md",
      name: "draft.md",
      path: "/workspace/draft.md",
    });

    renderWorkspace({
      activeTab: makeTab({ path: "/workspace/book.md" }),
      tabs: [
        makeTab({ path: "/workspace/book.md" }),
        dirtyTab,
        makeTab({ id: "untitled:1", path: "" }),
        makeTab({ id: "/outside/other.md", path: "/outside/other.md" }),
      ],
      workspaceRootPath: "/workspace",
      workspaceTree: workspaceEntry("workspace", "/workspace", "directory", [
        workspaceEntry("book.md", "/workspace/book.md", "file"),
        workspaceEntry("draft.md", "/workspace/draft.md", "file"),
      ]),
    });

    const bookRow = document.querySelector(
      `button[title="/workspace/book.md"]`,
    );
    const draftRow = document.querySelector(
      `button[title="/workspace/draft.md"]`,
    );

    expect(bookRow?.querySelector(".tree-open-marker")).not.toBeNull();
    expect(bookRow?.querySelector(".tree-dirty-marker")).toBeNull();
    expect(draftRow?.querySelector(".tree-open-marker")).not.toBeNull();
    expect(draftRow?.querySelector(".tree-dirty-marker")).not.toBeNull();
  });

  it("collapses and restores the normal workspace sidebar", () => {
    const { container } = renderWorkspace();

    expect(screen.getByLabelText("Workspace file tree")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Collapse workspace sidebar" }));

    expect(screen.queryByLabelText("Workspace file tree")).toBeNull();
    expect(
      container
        .querySelector(".workspace")
        ?.classList.contains("workspace-sidebar-collapsed"),
    ).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Restore workspace sidebar" }));

    expect(screen.getByLabelText("Workspace file tree")).toBeTruthy();
    expect(
      container
        .querySelector(".workspace")
        ?.classList.contains("workspace-sidebar-collapsed"),
    ).toBe(false);
  });

  it("does not show the normal restore rail while L Mode owns the workspace drawer", () => {
    renderWorkspace({
      editorSettings: {
        ...editorSettings,
        lModeEnabled: true,
      },
    });

    expect(
      screen.queryByRole("button", { name: "Restore workspace sidebar" }),
    ).toBeNull();
  });

  it("uses externally controlled sidebar collapse state when provided", () => {
    const onWorkspaceSidebarCollapsedChange = vi.fn();

    renderWorkspace({
      onWorkspaceSidebarCollapsedChange,
      workspaceSidebarCollapsedOverride: false,
    });

    fireEvent.click(screen.getByRole("button", { name: "Collapse workspace sidebar" }));

    expect(onWorkspaceSidebarCollapsedChange).toHaveBeenCalledWith(true);
    expect(screen.getByLabelText("Workspace file tree")).toBeTruthy();
  });

  it("enters and exits same-window Reading Focus from the e-book pane", async () => {
    const { container } = renderWorkspace({
      activeContents: bookTab.contents,
      activeTab: bookTab,
      hasWorkspaceSelection: true,
      sidePaneMode: "ebook",
      sidePaneVisible: true,
      workspaceRootPath: "/workspace",
    });
    const workspace = container.querySelector(".workspace");

    expect(workspace?.classList.contains("workspace-reading-focus")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Mock enter reading focus" }));

    expect(workspace?.classList.contains("workspace-reading-focus")).toBe(true);
    expect((await screen.findByTestId("ebook-focus-pane")).textContent).toContain(
      "focus 1:2",
    );

    fireEvent.click(screen.getByRole("button", { name: "Mock exit reading focus" }));

    expect(workspace?.classList.contains("workspace-reading-focus")).toBe(false);
  });

  it("opens the e-book pane near the current editor heading when no reader location exists", () => {
    renderWorkspace({
      activeContents: ["# Chapter One", "", "body", "", "## Chapter Two", "", "body"].join("\n"),
      activeDocumentLineCount: 7,
      activeTab: bookTab,
      currentHeadingLine: 5,
      documentHeadings: [
        { level: 1, line: 1, text: "Chapter One" },
        { level: 2, line: 5, text: "Chapter Two" },
      ],
      hasWorkspaceSelection: true,
      sidePaneMode: "ebook",
      sidePaneVisible: true,
      workspaceRootPath: "/workspace",
    });

    expect(screen.getByTestId("side-ebook-location").textContent).toContain(
      "side location 1:0",
    );
  });

  it("uses the visible editor scroll heading when opening the e-book pane", () => {
    renderWorkspace({
      activeContents: ["# Chapter One", "", "body", "", "## Chapter Two", "", "body"].join("\n"),
      activeDocumentLineCount: 7,
      activeTab: bookTab,
      currentHeadingLine: 1,
      documentHeadings: [
        { level: 1, line: 1, text: "Chapter One" },
        { level: 2, line: 5, text: "Chapter Two" },
      ],
      hasWorkspaceSelection: true,
      scrollHudLine: 5,
      scrollHudVisible: true,
      sidePaneMode: "ebook",
      sidePaneVisible: true,
      workspaceRootPath: "/workspace",
    });

    expect(screen.getByTestId("side-ebook-location").textContent).toContain(
      "side location 1:0",
    );
  });

  it("moves the editor to the one-page reader source line as the reader moves", () => {
    const goToLine = vi.fn();
    const editorPaneRef = {
      current: {
        applyMarkdownFormat: vi.fn(),
        focus: vi.fn(),
        getActiveDocument: vi.fn(() => null),
        getSelectionText: vi.fn(() => ""),
        goToLine,
        insertTable: vi.fn(),
        insertText: vi.fn(),
        replaceAll: vi.fn(),
        replaceCurrent: vi.fn(() => false),
        setScrollRatio: vi.fn(() => false),
      },
    } as ComponentProps<typeof AppWorkspace>["editorPaneRef"];

    renderWorkspace({
      activeContents: [
        "# Chapter One",
        "",
        "body",
        "",
        "## Chapter Two",
        "line six",
        "line seven",
      ].join("\n"),
      activeDocumentLineCount: 7,
      activeTab: bookTab,
      currentHeadingLine: 1,
      documentHeadings: [
        { level: 1, line: 1, text: "Chapter One" },
        { level: 2, line: 5, text: "Chapter Two" },
      ],
      editorPaneRef,
      hasWorkspaceSelection: true,
      sidePaneMode: "ebook",
      sidePaneVisible: true,
      workspaceRootPath: "/workspace",
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Mock one-page reader location change",
      }),
    );

    expect(goToLine).toHaveBeenCalledWith(6, { focus: false });
  });

  it("keeps the right-pane reader location linked to Reading Focus movement", async () => {
    renderWorkspace({
      activeContents: ["# Chapter One", "", "body", "", "## Chapter Two", "", "body"].join("\n"),
      activeDocumentLineCount: 7,
      activeTab: bookTab,
      currentHeadingLine: 1,
      documentHeadings: [
        { level: 1, line: 1, text: "Chapter One" },
        { level: 2, line: 5, text: "Chapter Two" },
      ],
      hasWorkspaceSelection: true,
      sidePaneMode: "ebook",
      sidePaneVisible: true,
      workspaceRootPath: "/workspace",
    });

    fireEvent.click(screen.getByRole("button", { name: "Mock enter reading focus" }));
    await screen.findByTestId("ebook-focus-pane");
    fireEvent.click(
      screen.getByRole("button", { name: "Mock focus location change" }),
    );

    expect(screen.getByTestId("side-ebook-location").textContent).toContain(
      "side location 2:3",
    );
  });

  it("reanchors e-book entry to the current editor heading after leaving e-book mode", () => {
    const contents = [
      "# Chapter One",
      "",
      "body",
      "",
      "## Chapter Two",
      "",
      "body",
    ].join("\n");
    const headings = [
      { level: 1, line: 1, text: "Chapter One" },
      { level: 2, line: 5, text: "Chapter Two" },
    ];
    const { rerender } = renderWorkspace({
      activeContents: contents,
      activeDocumentLineCount: 7,
      activeTab: bookTab,
      currentHeadingLine: 5,
      documentHeadings: headings,
      hasWorkspaceSelection: true,
      sidePaneMode: "ebook",
      sidePaneVisible: true,
      workspaceRootPath: "/workspace",
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Mock store old reader location" }),
    );
    expect(screen.getByTestId("side-ebook-location").textContent).toContain(
      "side location 1:2",
    );

    rerenderWorkspace(rerender, {
      activeContents: contents,
      activeDocumentLineCount: 7,
      activeTab: bookTab,
      currentHeadingLine: 1,
      documentHeadings: headings,
      hasWorkspaceSelection: true,
      sidePaneMode: "preview",
      sidePaneVisible: true,
      workspaceRootPath: "/workspace",
    });
    rerenderWorkspace(rerender, {
      activeContents: contents,
      activeDocumentLineCount: 7,
      activeTab: bookTab,
      currentHeadingLine: 1,
      documentHeadings: headings,
      hasWorkspaceSelection: true,
      sidePaneMode: "ebook",
      sidePaneVisible: true,
      workspaceRootPath: "/workspace",
    });

    expect(screen.getByTestId("side-ebook-location").textContent).toContain(
      "side location 0:0",
    );
  });

  it("keeps pathless e-book reader locations isolated by tab id", () => {
    const firstUntitledTab = {
      ...bookTab,
      id: "untitled:1",
      name: "untitled.md",
      path: "",
    };
    const secondUntitledTab = {
      ...bookTab,
      id: "untitled:2",
      name: "untitled.md",
      path: "",
    };
    const sharedProps = {
      activeContents: bookTab.contents,
      hasWorkspaceSelection: true,
      sidePaneMode: "ebook" as const,
      sidePaneVisible: true,
      workspaceRootPath: "/workspace",
    };
    const { rerender } = renderWorkspace({
      ...sharedProps,
      activeTab: firstUntitledTab,
    });

    expect(screen.getByTestId("side-ebook-location").textContent).toContain(
      "side location none",
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Mock store old reader location" }),
    );
    expect(screen.getByTestId("side-ebook-location").textContent).toContain(
      "side location 1:2",
    );

    rerenderWorkspace(rerender, {
      ...sharedProps,
      activeTab: secondUntitledTab,
    });
    expect(screen.getByTestId("side-ebook-location").textContent).toContain(
      "side location none",
    );

    rerenderWorkspace(rerender, {
      ...sharedProps,
      activeTab: firstUntitledTab,
    });
    expect(screen.getByTestId("side-ebook-location").textContent).toContain(
      "side location 1:2",
    );
  });

  it("returns from Reading Focus to the active reader chapter heading", async () => {
    const goToLine = vi.fn();
    const editorPaneRef = {
      current: {
        applyMarkdownFormat: vi.fn(),
        focus: vi.fn(),
        getActiveDocument: vi.fn(() => null),
        getSelectionText: vi.fn(() => ""),
        goToLine,
        insertTable: vi.fn(),
        insertText: vi.fn(),
        replaceAll: vi.fn(),
        replaceCurrent: vi.fn(() => false),
        setScrollRatio: vi.fn(() => false),
      },
    } as ComponentProps<typeof AppWorkspace>["editorPaneRef"];

    renderWorkspace({
      activeContents: ["# Chapter One", "", "body", "", "## Chapter Two", "", "body"].join("\n"),
      activeDocumentLineCount: 7,
      activeTab: bookTab,
      currentHeadingLine: 1,
      documentHeadings: [
        { level: 1, line: 1, text: "Chapter One" },
        { level: 2, line: 5, text: "Chapter Two" },
      ],
      editorPaneRef,
      hasWorkspaceSelection: true,
      sidePaneMode: "ebook",
      sidePaneVisible: true,
      workspaceRootPath: "/workspace",
    });

    fireEvent.click(screen.getByRole("button", { name: "Mock enter reading focus" }));
    expect((await screen.findByTestId("ebook-focus-pane")).textContent).toContain(
      "focus 1:2",
    );

    fireEvent.click(screen.getByRole("button", { name: "Mock exit reading focus" }));

    expect(goToLine).toHaveBeenCalledWith(5, { focus: true });
  });

  it("returns from Reading Focus to an estimated reader source line when available", async () => {
    const goToLine = vi.fn();
    const editorPaneRef = {
      current: {
        applyMarkdownFormat: vi.fn(),
        focus: vi.fn(),
        getActiveDocument: vi.fn(() => null),
        getSelectionText: vi.fn(() => ""),
        goToLine,
        insertTable: vi.fn(),
        insertText: vi.fn(),
        replaceAll: vi.fn(),
        replaceCurrent: vi.fn(() => false),
        setScrollRatio: vi.fn(() => false),
      },
    } as ComponentProps<typeof AppWorkspace>["editorPaneRef"];

    renderWorkspace({
      activeContents: [
        "# Chapter One",
        "",
        "body",
        "",
        "## Chapter Two",
        "line six",
        "line seven",
      ].join("\n"),
      activeDocumentLineCount: 7,
      activeTab: bookTab,
      currentHeadingLine: 1,
      documentHeadings: [
        { level: 1, line: 1, text: "Chapter One" },
        { level: 2, line: 5, text: "Chapter Two" },
      ],
      editorPaneRef,
      hasWorkspaceSelection: true,
      sidePaneMode: "ebook",
      sidePaneVisible: true,
      workspaceRootPath: "/workspace",
    });

    fireEvent.click(screen.getByRole("button", { name: "Mock enter reading focus" }));
    await screen.findByTestId("ebook-focus-pane");
    fireEvent.click(
      screen.getByRole("button", {
        name: "Mock exit reading focus with source line",
      }),
    );

    expect(goToLine).toHaveBeenCalledWith(6, { focus: true });
  });

  // v1.1 position-continuity: `ebookLocation` was a single slot keyed by
  // documentKey; the single-slot fix (#2) changed it to a per-documentKey Map
  // so each tab keeps its own reader location. These tests verify the fixed
  // behavior against the old single-slot baseline.
  describe("v1.1 position-continuity pins", () => {
    const pinContents = [
      "# Chapter One",
      "",
      "body one",
      "",
      "# Chapter Two",
      "",
      "body two",
    ].join("\n");
    const pinHeadings = [
      { level: 1, line: 1, text: "Chapter One" },
      { level: 2, line: 5, text: "Chapter Two" },
    ];
    const firstBookTab = {
      ...bookTab,
      id: "/workspace/book-a.md",
      name: "book-a.md",
      path: "/workspace/book-a.md",
    };
    const secondBookTab = {
      ...bookTab,
      id: "/workspace/book-b.md",
      name: "book-b.md",
      path: "/workspace/book-b.md",
    };
    const sharedPinProps = {
      activeContents: pinContents,
      activeDocumentLineCount: 7,
      documentHeadings: pinHeadings,
      hasWorkspaceSelection: true,
      sidePaneMode: "ebook" as const,
      sidePaneVisible: true,
      workspaceRootPath: "/workspace",
    };

    it("keeps tab A reader location after tab B moves (single-slot fix)", () => {
      // 1. Open tab A, move its reader location to chapter 1 / page 2.
      const { rerender } = renderWorkspace({
        ...sharedPinProps,
        activeTab: firstBookTab,
        currentHeadingLine: 1,
      });
      fireEvent.click(
        screen.getByRole("button", { name: "Mock store old reader location" }),
      );
      expect(screen.getByTestId("side-ebook-location").textContent).toContain(
        "side location 1:2",
      );

      // 2. Switch to tab B. A's location is preserved in the per-key Map, so
      //    B (which has no stored location yet) falls back to the editor
      //    heading anchor (currentHeadingLine:1 -> Chapter One -> 0:0).
      rerenderWorkspace(rerender, {
        ...sharedPinProps,
        activeTab: secondBookTab,
        currentHeadingLine: 1,
      });
      expect(screen.getByTestId("side-ebook-location").textContent).toContain(
        "side location 0:0",
      );

      // 3. Move B's reader location. The Map now holds both A's and B's.
      fireEvent.click(
        screen.getByRole("button", { name: "Mock one-page reader location change" }),
      );

      // 4. Return to tab A. The reader position IS A's last 1:2; the
      //    per-documentKey Map restores it instead of falling back to the
      //    editor anchor. This is the fixed behavior (single-slot baseline
      //    returned 0:0 here).
      rerenderWorkspace(rerender, {
        ...sharedPinProps,
        activeTab: firstBookTab,
        currentHeadingLine: 1,
      });
      expect(screen.getByTestId("side-ebook-location").textContent).toContain(
        "side location 1:2",
      );
    });

    it("restores an unmoved tab's reader location after switching away and back", () => {
      // Contrast case: when B does NOT move, the Map still holds A's
      // location, so returning to A restores it. This is the optimistic path
      // that worked under single-slot too; keep it as a regression guard.
      const { rerender } = renderWorkspace({
        ...sharedPinProps,
        activeTab: firstBookTab,
        currentHeadingLine: 1,
      });
      fireEvent.click(
        screen.getByRole("button", { name: "Mock store old reader location" }),
      );

      rerenderWorkspace(rerender, {
        ...sharedPinProps,
        activeTab: secondBookTab,
        currentHeadingLine: 1,
      });

      rerenderWorkspace(rerender, {
        ...sharedPinProps,
        activeTab: firstBookTab,
        currentHeadingLine: 1,
      });

      expect(screen.getByTestId("side-ebook-location").textContent).toContain(
        "side location 1:2",
      );
    });
  });
});
