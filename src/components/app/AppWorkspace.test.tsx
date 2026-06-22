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
import type { EditorSettings } from "../../types";

vi.mock("../editor/EditorMainPane", () => ({
  EditorMainPane: () => <div data-testid="editor-main-pane" />,
}));

vi.mock("../editor/PaneResizer", () => ({
  PaneResizer: () => <div data-testid="pane-resizer" />,
}));

vi.mock("./SidePane", () => ({
  SidePane: (props: {
    onOpenEbookReadingFocus?: (location: {
      chapterIndex: number;
      pageIndex: number;
    }) => void;
  }) => (
    <div data-testid="side-pane">
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
    onExitReadingFocus?: () => void;
  }) => (
    <div data-testid="ebook-focus-pane">
      focus {props.initialLocation?.chapterIndex ?? 0}:
      {props.initialLocation?.pageIndex ?? 0}
      <button onClick={props.onExitReadingFocus} type="button">
        Mock exit reading focus
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

function renderWorkspace(overrides: Partial<ComponentProps<typeof AppWorkspace>> = {}) {
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
    workspaceRootPath: null,
    workspaceTree: null,
    ...overrides,
  };

  return render(<AppWorkspace {...props} />);
}

describe("AppWorkspace workspace sidebar collapse", () => {
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
});
