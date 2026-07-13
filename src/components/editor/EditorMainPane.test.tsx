import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditorMainPane } from "./EditorMainPane";
import { writeTextToClipboard } from "../../lib/clipboard";
import {
  getLModeCopy,
  getSafeEditorCopy,
  getSlashMenuCopy,
} from "../../lib/locale";
import type { EditorPaneHandle } from "./EditorPane";
import type { EditorSettings, EditorTab } from "../../types";
import type {
  EditorViewState,
  EditorViewStatePatch,
} from "../../features/editor/documentViewState";

const editorPaneMock = vi.hoisted(() => ({
  props: null as null | {
    editorViewState?: EditorViewState | null;
    onEditorViewStateChange?: (patch: EditorViewStatePatch) => void;
  },
}));

vi.mock("./EditorPane", () => ({
  default: (props: NonNullable<typeof editorPaneMock.props>) => {
    editorPaneMock.props = props;
    return <div data-testid="mock-editor-pane" />;
  },
}));

vi.mock("./ScrollPositionHud", () => ({
  ScrollPositionHud: () => <div data-testid="scroll-position-hud" />,
}));

vi.mock("../workspace/StartPanel", () => ({
  StartPanel: () => <div data-testid="start-panel" />,
}));

vi.mock("./preview/ImagePreviewPane", () => ({
  ImagePreviewPane: () => <div data-testid="image-preview-pane" />,
}));

vi.mock("../../lib/clipboard", () => ({
  writeTextToClipboard: vi.fn().mockResolvedValue(undefined),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

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

const activeTab: EditorTab = {
  contents: "# Draft",
  encoding: "utf-8",
  error: null,
  externalFingerprint: null,
  fingerprint: "fp",
  ignoredExternalFingerprint: null,
  id: "/workspace/docs/draft.md",
  sessionId: "/workspace/docs/draft.md",
  large_file_warning: false,
  lastSavedContents: "# Draft",
  lastSavedEncoding: "utf-8",
  lastSavedLineEnding: "lf",
  line_ending: "lf",
  modified_ms: null,
  name: "draft.md",
  path: "/workspace/docs/draft.md",
  saveStatus: "idle",
  size: 7,
};

function renderEditorMainPane(
  overrides: Partial<
    Parameters<typeof EditorMainPane>[0] & { restoreComplete: boolean }
  > = {},
) {
  return render(
    <EditorMainPane
      activeContents="# Draft"
      activeDocumentLineCount={1}
      activeSearchMatchIndex={-1}
      activeTab={activeTab}
      copy={getSafeEditorCopy("en")}
      documentKey={activeTab.path}
      editorSessionKey={activeTab.id}
      editorPaneRef={createRef<EditorPaneHandle | null>()}
      editorSettings={editorSettings}
      editorTheme="light"
      editorViewState={null}
      imagePreviewTitle="Image preview"
      lModeCopy={getLModeCopy("en")}
      menuLanguage="en"
      onChange={vi.fn()}
      onEditorViewStateChange={vi.fn()}
      onNewFile={vi.fn()}
      onOpenFile={vi.fn()}
      onOpenFolder={vi.fn()}
      onPasteImage={vi.fn()}
      onScrollRatioChange={vi.fn()}
      onSelectionChange={vi.fn()}
      onSendToAgent={vi.fn()}
      scrollHudContext={{ current: null, next: null, previous: null }}
      scrollHudLine={1}
      scrollHudVisible={false}
      searchMatches={[]}
      selectedImage={null}
      slashCommands={[]}
      slashMenuCopy={getSlashMenuCopy("en")}
      workspaceRootPath="/workspace"
      restoreComplete={true}
      {...overrides}
    />,
  );
}

describe("EditorMainPane", () => {
  it("passes the controlled editor view state through to EditorPane", () => {
    const editorViewState = { anchor: 4, head: 7, scrollRatio: 0.35 };
    const onEditorViewStateChange = vi.fn();

    renderEditorMainPane({ editorViewState, onEditorViewStateChange });

    expect(editorPaneMock.props?.editorViewState).toBe(editorViewState);
    editorPaneMock.props?.onEditorViewStateChange?.({ scrollRatio: 0.8 });
    expect(onEditorViewStateChange).toHaveBeenCalledWith({ scrollRatio: 0.8 });
  });

  it("shows the active full path in a thin bar below the editor", () => {
    renderEditorMainPane();

    expect(screen.getByLabelText("Editor")).toBeTruthy();
    expect(screen.queryByText("draft.md")).toBeNull();
    expect(screen.queryByText("docs/draft.md")).toBeNull();
    expect(screen.getByRole("button", {
      name: "Copy full path: /workspace/docs/draft.md",
    })).toBeTruthy();
    expect(screen.getByText("/workspace/docs/draft.md")).toBeTruthy();
    expect(screen.getByTestId("mock-editor-pane")).toBeTruthy();
  });

  it("copies the active full path from the bottom path bar", async () => {
    renderEditorMainPane();

    fireEvent.click(screen.getByRole("button", {
      name: "Copy full path: /workspace/docs/draft.md",
    }));

    await waitFor(() => {
      expect(writeTextToClipboard).toHaveBeenCalledWith(
        "/workspace/docs/draft.md",
      );
    });
  });

  it("shows a root workspace file as its full path only", () => {
    renderEditorMainPane({
      activeTab: {
        ...activeTab,
        id: "/workspace/root.md",
        name: "root.md",
        path: "/workspace/root.md",
      },
      documentKey: "/workspace/root.md",
    });

    expect(screen.queryByText("root.md")).toBeNull();
    expect(screen.getByText("/workspace/root.md")).toBeTruthy();
  });

  it("does not show the full-path copy bar for an untitled pathless tab", () => {
    renderEditorMainPane({
      activeTab: {
        ...activeTab,
        id: "untitled:1",
        name: "untitled.md",
        path: "",
      },
      documentKey: "untitled:1",
      workspaceRootPath: null,
    });

    expect(screen.getByTestId("mock-editor-pane")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: /^Copy full path:/ }),
    ).toBeNull();
  });

  it("hides the normal path bar in L Mode", () => {
    renderEditorMainPane({
      editorSettings: {
        ...editorSettings,
        lModeEnabled: true,
      },
    });

    expect(screen.queryByText("draft.md")).toBeNull();
    expect(screen.queryByText("docs/draft.md")).toBeNull();
    expect(screen.queryByText("/workspace/docs/draft.md")).toBeNull();
    expect(screen.getByTestId("mock-editor-pane")).toBeTruthy();
  });

  it("shows a centered Local Assist read-only status while generation locks the editor", () => {
    renderEditorMainPane({
      generationLock: {
        requestId: "request-1",
        tabId: activeTab.id,
        tabPath: activeTab.path,
        request: "校正してください。",
      },
    });

    const status = screen.getByRole("status");

    expect(status.textContent).toContain("Hazakura Local Assist が生成中です");
    expect(status.textContent).toContain(
      "本文は表示できますが、編集は一時停止しています。",
    );
  });

  it("shows a themed restore loading surface before restored tabs are ready", () => {
    const { container } = renderEditorMainPane({
      activeContents: "",
      activeTab: null,
      documentKey: "restore-pending",
      restoreComplete: false,
      workspaceRootPath: null,
    });

    expect(screen.queryByTestId("start-panel")).toBeNull();
    expect(screen.queryByTestId("mock-editor-pane")).toBeNull();
    expect(container.querySelector(".editor-restore-loading")).toBeTruthy();
  });
});
