import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef, type ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppWorkspace } from "./AppWorkspace";
import {
  getAppleAssistCopy,
  getLModeCopy,
  getSafeEditorCopy,
  getSidePaneCopy,
  getSlashMenuCopy,
  getWorkspaceFileOpsCopy,
} from "../../lib/locale";
import type { EditorPaneHandle } from "../editor/EditorPane";
import type { WorkspaceTreeEntry } from "../../lib/tauri";
import type { EditorSettings, EditorTab } from "../../types";
import type {
  EditorViewState,
  EditorViewStatePatch,
} from "../../features/editor/documentViewState";

const editorMainPaneMock = vi.hoisted(() => ({
  props: null as null | {
    activeContents?: string;
    editorViewState?: EditorViewState | null;
    onEditorViewStateChange?: (patch: EditorViewStatePatch) => void;
  },
}));

vi.mock("../editor/EditorMainPane", () => ({
  EditorMainPane: (props: NonNullable<typeof editorMainPaneMock.props>) => {
    editorMainPaneMock.props = props;
    return <div data-testid="editor-main-pane" />;
  },
}));

vi.mock("../editor/PaneResizer", () => ({
  PaneResizer: () => <div data-testid="pane-resizer" />,
}));

vi.mock("./SidePane", () => ({
  SidePane: (props: {
    ebookLocation?: { chapterIndex: number; pageIndex: number } | null;
    previewViewState?: { scrollRatio: number } | null;
    onEbookLocationChange?: (location: {
      chapterIndex: number;
      pageIndex: number;
      sourceLine?: number;
    }) => void;
    onOpenEbookReadingFocus?: (location: {
      chapterIndex: number;
      pageIndex: number;
    }) => void;
    onPreviewViewStateChange?: (state: { scrollRatio: number }) => void;
  }) => (
    <div data-testid="side-pane">
      <span data-testid="side-ebook-location">
        side location{" "}
        {props.ebookLocation
          ? `${props.ebookLocation.chapterIndex}:${props.ebookLocation.pageIndex}`
          : "none"}
      </span>
      <span data-testid="side-preview-location">
        preview location {props.previewViewState?.scrollRatio ?? "none"}
      </span>
      <button
        onClick={() =>
          props.onPreviewViewStateChange?.({ scrollRatio: 0.75 })
        }
        type="button"
      >
        Mock store preview location
      </button>
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
          props.onEbookLocationChange?.({
            chapterIndex: 2,
            pageIndex: 3,
            sourceLine: 7,
          })
        }
        type="button"
      >
        Mock reader location chapter 2 page 3
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
  sessionId: "session:book",
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
    sessionId: "session:1",
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
    appleAssistCopy: getAppleAssistCopy("en"),
    clearCompareSource: vi.fn(),
    clearCompareTarget: vi.fn(),
    changeHeadingLevel: vi.fn(),
    closeCompareView: vi.fn(),
    closeReferenceCompare: vi.fn(),
    onPdfPageIndexChange: vi.fn(),
    onResumeReferenceFollow: vi.fn(),
    pdfPageIndex: 0,
    referenceFollowPaused: false,
    compareAnchor: null,
    compareTarget: null,
    compareView: null,
    createFile: vi.fn(),
    createFolder: vi.fn(),
    createOkfScaffoldAt: vi.fn(),
    createNewFile: vi.fn(),
    currentHeadingLine: null,
    documentHeadings: [],
    documentStructureAdvisories: [],
    documentStructureItems: [],
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
    openReferenceFile: vi.fn(),
    openRootWorkspaceContextMenu: vi.fn(),
    openWorkspace: vi.fn(),
    openWorkspaceContextMenu: vi.fn(),
    openWorkspaceFile: vi.fn(),
    orphanPathlessDrafts: [],
    outlineTruncated: false,
    recoveryCopy: {
      closeWithoutSaving: "Close without saving",
      conflictActions: "Conflict actions",
      conflictDetail: "Conflict detail",
      conflictHeading: "Conflict",
      dismiss: "Dismiss",
      discardDraft: "Discard draft",
      discardDraftConfirm: "Discard this draft?",
      draftActions: "Draft actions",
      draftAvailable: (name: string) => `Draft for ${name}`,
      errorActions: "Error actions",
      keepEditing: "Keep editing",
      pathlessDraftAvailable: (name: string) => `Pathless draft ${name}`,
      pathlessDraftDetail: "Pathless detail",
      pathlessDraftFallbackName: "Untitled draft",
      reopenFromDisk: "Reopen from disk",
      reviewChanges: "Review changes",
      restoreDraft: "Restore draft",
      saveErrorActions: "Save error actions",
      saveFailure: "Save failed",
      savedLocally: () => "Saved locally",
      trySaveAgain: "Try save again",
    },
    reopenPersistedWorkspace: vi.fn(),
    restoreDraft: vi.fn(),
    discardDraft: vi.fn(),
    previewColumnPercent: 45,
    previewPaneRef: createRef<HTMLDivElement | null>(),
    previewVisible: true,
    referenceColumnPercent: 42,
    referenceCompare: null,
    referencePaneVisible: false,
    referenceCopy: {
      closeReference: "Close reference",
      emptyEditorHint: "Open Markdown to edit",
      externalChangeNotice: "The reference file has changed on disk.",
      fitWidth: "Fit width",
      followActive: "Following",
      importWorkflowHint:
        "Center is the editable draft; right is the source reference. Fix it, then save.",
      loadingPage: "Loading page",
      narrowFocusLabel: "Reference focus",
      nextPage: "Next page",
      nextReview: "Next to review",
      openAsReference: "Open as reference",
      openReferenceFile: "Open reference file…",
      pageLabel: "Page",
      previousPage: "Previous page",
      previousReview: "Previous to review",
      readOnly: "Read-only",
      referenceLabel: "Reference",
      reloadReference: "Reload",
      replaceReference: "Replace reference…",
      resumeFollow: "Resume follow",
      retryRender: "Retry",
      reviewAdvisory: "Advisory only",
      reviewLabel: "Review",
      showDiff: "View diff",
      showEditor: "Draft (editable)",
      showReference: "Reference",
      textBudgetExceeded: "Reference is too large",
      unsupportedType: "Unsupported",
      zoomIn: "Zoom in",
      zoomOut: "Zoom out",
    },
    referenceNarrowFocus: "editor",
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
    setReferenceColumnPercent: vi.fn(),
    setReferenceNarrowFocus: vi.fn(),
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
  it("exposes and keyboard-navigates the workspace new menu", () => {
    const createOkfScaffoldAt = vi.fn();
    renderWorkspace({
      createOkfScaffoldAt,
      workspaceRootPath: "/workspace",
      workspaceTree: workspaceEntry("workspace", "/workspace", "directory"),
    });

    const trigger = screen.getByRole("button", { name: "New" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(trigger);

    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const items = screen.getAllByRole("menuitem");
    expect(document.activeElement).toBe(items[0]);

    fireEvent.keyDown(items[0], { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[1]);

    fireEvent.keyDown(items[1], { key: "End" });
    expect(document.activeElement).toBe(items[items.length - 1]);
    fireEvent.click(items[items.length - 1]);

    expect(createOkfScaffoldAt).toHaveBeenCalledWith(
      "/workspace",
      "book-like",
    );
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getAllByRole("menuitem")[0], { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

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
        changeHeadingLevel: vi.fn(),
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

  it("keeps pathless e-book reader locations isolated by sessionId across Save As", () => {
    const firstUntitledTab = {
      ...bookTab,
      id: "untitled:1",
      name: "untitled.md",
      path: "",
      sessionId: "session:untitled-1",
    };
    const secondUntitledTab = {
      ...bookTab,
      id: "untitled:2",
      name: "untitled.md",
      path: "",
      sessionId: "session:untitled-2",
    };
    const sharedProps = {
      activeContents: bookTab.contents,
      hasWorkspaceSelection: true,
      sidePaneMode: "ebook" as const,
      sidePaneVisible: true,
      tabs: [firstUntitledTab, secondUntitledTab],
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

    const savedFirstTab = {
      ...firstUntitledTab,
      // Save As rewrites id/path (id === path), while sessionId stays stable.
      // View state is keyed by sessionId, so e-book location carries over
      // without a path-based rekey race.
      id: "/workspace/untitled.md",
      name: "untitled.md",
      path: "/workspace/untitled.md",
    };
    rerenderWorkspace(rerender, {
      ...sharedProps,
      activeTab: savedFirstTab,
      tabs: [savedFirstTab, secondUntitledTab],
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
        changeHeadingLevel: vi.fn(),
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
        changeHeadingLevel: vi.fn(),
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
      sessionId: "session:book-a",
    };
    const secondBookTab = {
      ...bookTab,
      id: "/workspace/book-b.md",
      name: "book-b.md",
      path: "/workspace/book-b.md",
      sessionId: "session:book-b",
    };
    const sharedPinProps = {
      activeContents: pinContents,
      activeDocumentLineCount: 7,
      documentHeadings: pinHeadings,
      hasWorkspaceSelection: true,
      sidePaneMode: "ebook" as const,
      sidePaneVisible: true,
      tabs: [firstBookTab, secondBookTab],
      workspaceRootPath: "/workspace",
    };

    it("keeps each tab's editor position independently", () => {
      const tabs = [firstBookTab, secondBookTab];
      const { rerender } = renderWorkspace({
        ...sharedPinProps,
        activeTab: firstBookTab,
        documentKey: firstBookTab.id,
        tabs,
      });

      expect(editorMainPaneMock.props?.editorViewState).toBeNull();
      act(() => {
        editorMainPaneMock.props?.onEditorViewStateChange?.({
          anchor: 12,
          head: 12,
          scrollRatio: 0.6,
        });
      });

      rerenderWorkspace(rerender, {
        ...sharedPinProps,
        activeTab: secondBookTab,
        documentKey: secondBookTab.id,
        tabs,
      });
      expect(editorMainPaneMock.props?.editorViewState).toBeNull();
      act(() => {
        editorMainPaneMock.props?.onEditorViewStateChange?.({
          anchor: 3,
          head: 3,
          scrollRatio: 0.1,
        });
      });

      rerenderWorkspace(rerender, {
        ...sharedPinProps,
        activeTab: firstBookTab,
        documentKey: firstBookTab.id,
        tabs,
      });
      expect(editorMainPaneMock.props?.editorViewState).toEqual({
        anchor: 12,
        head: 12,
        scrollRatio: 0.6,
      });

      rerenderWorkspace(rerender, {
        ...sharedPinProps,
        activeTab: secondBookTab,
        documentKey: secondBookTab.id,
        tabs,
      });
      expect(editorMainPaneMock.props?.editorViewState).toEqual({
        anchor: 3,
        head: 3,
        scrollRatio: 0.1,
      });
    });

    it("keeps each tab's Preview position independently", () => {
      const tabs = [firstBookTab, secondBookTab];
      const { rerender } = renderWorkspace({
        ...sharedPinProps,
        activeTab: firstBookTab,
        documentKey: firstBookTab.id,
        sidePaneMode: "preview",
        tabs,
      });

      fireEvent.click(
        screen.getByRole("button", { name: "Mock store preview location" }),
      );
      expect(screen.getByTestId("side-preview-location").textContent).toContain(
        "preview location 0.75",
      );

      rerenderWorkspace(rerender, {
        ...sharedPinProps,
        activeTab: secondBookTab,
        documentKey: secondBookTab.id,
        sidePaneMode: "preview",
        tabs,
      });
      expect(screen.getByTestId("side-preview-location").textContent).toContain(
        "preview location none",
      );

      rerenderWorkspace(rerender, {
        ...sharedPinProps,
        activeTab: firstBookTab,
        documentKey: firstBookTab.id,
        sidePaneMode: "preview",
        tabs,
      });
      expect(screen.getByTestId("side-preview-location").textContent).toContain(
        "preview location 0.75",
      );
    });

    it("keeps each tab's reader location independently (single-slot fix)", () => {
      // A and B store DISTINCT reader locations (A: 1:2, B: 2:3). A test where
      // both shared the same visible value would pass even for a future global
      // last-location regression, so distinct values are required.
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

      // 3. Move B's reader location to a DIFFERENT value (chapter 2 / page 3).
      //    The Map now holds A's 1:2 and B's 2:3.
      fireEvent.click(
        screen.getByRole("button", {
          name: "Mock reader location chapter 2 page 3",
        }),
      );

      // 4. Return to tab A. The reader position IS A's 1:2, not B's 2:3 and
      //    not the editor anchor. This is the per-documentKey Map behavior
      //    (single-slot baseline returned 0:0; a global last-location
      //    regression would return 2:3 here).
      rerenderWorkspace(rerender, {
        ...sharedPinProps,
        activeTab: firstBookTab,
        currentHeadingLine: 1,
      });
      expect(screen.getByTestId("side-ebook-location").textContent).toContain(
        "side location 1:2",
      );

      // 5. Return to tab B. Its own 2:3 is restored, proving both slots are
      //    independent rather than a single shared value.
      rerenderWorkspace(rerender, {
        ...sharedPinProps,
        activeTab: secondBookTab,
        currentHeadingLine: 1,
      });
      expect(screen.getByTestId("side-ebook-location").textContent).toContain(
        "side location 2:3",
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

describe("AppWorkspace reference compare layout", () => {
  it("keeps the editor buffer untouched when closing or replacing a reference", () => {
    const tab = makeTab({
      contents: "EDITOR-BUFFER-MARKER",
      id: "/workspace/draft.md",
      name: "draft.md",
      path: "/workspace/draft.md",
    });
    const closeReferenceCompare = vi.fn();
    const handleEditorChange = vi.fn();
    const openReferenceFile = vi.fn();

    renderWorkspace({
      activeContents: tab.contents,
      activeTab: tab,
      closeReferenceCompare,
      handleEditorChange,
      hasWorkspaceSelection: true,
      openReferenceFile,
      referenceCompare: {
        externalChangePending: false,
        followMode: "off",
        linkedEditorSessionId: null,
        origin: "manual",
        reference: {
          contents: "# style guide",
          encoding: "utf-8",
          kind: "text",
          name: "guide.md",
          path: "/workspace/guide.md",
        },
        sourceFingerprint: null,
      },
      referencePaneVisible: true,
      tabs: [tab],
      workspaceRootPath: "/workspace",
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Replace reference…" }),
    );
    expect(openReferenceFile).toHaveBeenCalledTimes(1);
    expect(closeReferenceCompare).not.toHaveBeenCalled();
    expect(handleEditorChange).not.toHaveBeenCalled();
    expect(editorMainPaneMock.props?.activeContents).toBe(
      "EDITOR-BUFFER-MARKER",
    );

    fireEvent.click(screen.getByRole("button", { name: "Close reference" }));
    expect(closeReferenceCompare).toHaveBeenCalledTimes(1);
    expect(handleEditorChange).not.toHaveBeenCalled();
    expect(editorMainPaneMock.props?.activeContents).toBe(
      "EDITOR-BUFFER-MARKER",
    );
  });

  it("announces the empty editor hint as a polite status", () => {
    const { container } = renderWorkspace({
      activeContents: "",
      activeTab: null,
      hasWorkspaceSelection: true,
      referenceCompare: {
        externalChangePending: false,
        followMode: "off",
        linkedEditorSessionId: null,
        origin: "manual",
        reference: {
          contents: "# style guide",
          encoding: "utf-8",
          kind: "text",
          name: "guide.md",
          path: "/workspace/guide.md",
        },
        sourceFingerprint: null,
      },
      referencePaneVisible: true,
      tabs: [],
      workspaceRootPath: "/workspace",
    });

    const hint = container.querySelector(
      ".reference-empty-editor-hint[role='status']",
    );
    expect(hint?.textContent).toContain("Open Markdown to edit");
    expect(hint?.getAttribute("aria-live")).toBe("polite");
  });

  it("exposes the active narrow-pane target as a pressed state", () => {
    const tab = makeTab({ contents: "# draft" });
    const referenceCompare = {
      externalChangePending: false,
      followMode: "off" as const,
      linkedEditorSessionId: null,
      origin: "manual" as const,
      reference: {
        contents: "# style guide",
        encoding: "utf-8" as const,
        kind: "text" as const,
        name: "guide.md",
        path: "/workspace/guide.md",
      },
      sourceFingerprint: null,
    };
    const sharedProps = {
      activeContents: tab.contents,
      activeTab: tab,
      hasWorkspaceSelection: true,
      referenceCompare,
      referencePaneVisible: true,
      referenceNarrowFocus: "editor",
      tabs: [tab],
      workspaceRootPath: "/workspace",
    } as const;
    const { rerender } = renderWorkspace(sharedProps);

    expect(screen.getByRole("toolbar", { name: "Reference focus" })).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Draft (editable)" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen.getByRole("button", { name: "Reference" }).getAttribute(
        "aria-pressed",
      ),
    ).toBe("false");

    rerenderWorkspace(rerender, {
      ...sharedProps,
      referenceNarrowFocus: "reference" as const,
    });

    expect(
      screen
        .getByRole("button", { name: "Draft (editable)" })
        .getAttribute("aria-pressed"),
    ).toBe("false");
    expect(
      screen.getByRole("button", { name: "Reference" }).getAttribute(
        "aria-pressed",
      ),
    ).toBe("true");
  });

  it("places the editor before the right-hand reference pane (preview-like)", () => {
    const tab = makeTab({
      contents: "# draft",
      id: "/workspace/draft.md",
      name: "draft.md",
      path: "/workspace/draft.md",
    });

    const { container } = renderWorkspace({
      activeContents: tab.contents,
      activeTab: tab,
      hasWorkspaceSelection: true,
      referenceCompare: {
        externalChangePending: false,
        followMode: "off",
        linkedEditorSessionId: null,
        origin: "manual",
        reference: {
          contents: "# style guide",
          encoding: "utf-8",
          kind: "text",
          name: "guide.md",
          path: "/workspace/guide.md",
        },
        sourceFingerprint: null,
      },
      referencePaneVisible: true,
      tabs: [tab],
      workspaceRootPath: "/workspace",
    });

    const grid = container.querySelector(".editor-preview-grid.reference-compare");
    expect(grid).not.toBeNull();

    const editorHost = grid?.querySelector(".reference-editor-host");
    const referencePane = grid?.querySelector(".reference-compare-pane");
    expect(editorHost).not.toBeNull();
    expect(referencePane).not.toBeNull();

    const position = editorHost!.compareDocumentPosition(referencePane!);
    // REFERENCE is FOLLOWING the editor (editor comes first in DOM / layout).
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(grid?.className).not.toContain("diff-workbench");
  });

  it("keeps a loaded reference hidden while another right pane is selected", () => {
    const tab = makeTab({ contents: "# draft" });
    const { container } = renderWorkspace({
      activeContents: tab.contents,
      activeTab: tab,
      hasWorkspaceSelection: true,
      referenceCompare: {
        externalChangePending: false,
        followMode: "off",
        linkedEditorSessionId: null,
        origin: "manual",
        reference: {
          contents: "# style guide",
          encoding: "utf-8",
          kind: "text",
          name: "guide.md",
          path: "/workspace/guide.md",
        },
        sourceFingerprint: null,
      },
      referencePaneVisible: false,
      sidePaneMode: "preview",
      sidePaneVisible: true,
      tabs: [tab],
      workspaceRootPath: "/workspace",
    });

    expect(container.querySelector(".reference-compare-pane")).toBeNull();
    expect(container.querySelector(".editor-preview-grid")?.className).not.toContain(
      "reference-compare",
    );
  });

  it("hides a loaded reference in L Mode and restores it on return", () => {
    const tab = makeTab({ contents: "# draft" });
    const referenceCompare = {
      externalChangePending: false,
      followMode: "off" as const,
      linkedEditorSessionId: null,
      origin: "manual" as const,
      reference: {
        contents: "# style guide",
        encoding: "utf-8" as const,
        kind: "text" as const,
        name: "guide.md",
        path: "/workspace/guide.md",
      },
      sourceFingerprint: null,
    };
    const { container, rerender } = renderWorkspace({
      activeContents: tab.contents,
      activeTab: tab,
      editorSettings: { ...editorSettings, lModeEnabled: true },
      hasWorkspaceSelection: true,
      referenceCompare,
      referencePaneVisible: true,
      tabs: [tab],
      workspaceRootPath: "/workspace",
    });

    expect(container.querySelector(".reference-compare-pane")).toBeNull();
    expect(container.querySelector(".editor-preview-grid")?.className).not.toContain(
      "reference-compare",
    );

    rerenderWorkspace(rerender, {
      activeContents: tab.contents,
      activeTab: tab,
      editorSettings: { ...editorSettings, lModeEnabled: false },
      hasWorkspaceSelection: true,
      referenceCompare,
      referencePaneVisible: true,
      tabs: [tab],
      workspaceRootPath: "/workspace",
    });

    expect(container.querySelector(".reference-compare-pane")).not.toBeNull();
    expect(container.querySelector(".editor-preview-grid")?.className).toContain(
      "reference-compare",
    );
  });
});
