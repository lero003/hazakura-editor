import { cleanup, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditorMainPane } from "./EditorMainPane";
import {
  getLModeCopy,
  getSafeEditorCopy,
  getSlashMenuCopy,
} from "../../lib/locale";
import type { EditorPaneHandle } from "./EditorPane";
import type { EditorSettings, EditorTab } from "../../types";

vi.mock("./EditorPane", () => ({
  default: () => <div data-testid="mock-editor-pane" />,
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

const activeTab: EditorTab = {
  contents: "# Draft",
  encoding: "utf-8",
  error: null,
  externalFingerprint: null,
  fingerprint: "fp",
  ignoredExternalFingerprint: null,
  id: "/workspace/docs/draft.md",
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
  overrides: Partial<Parameters<typeof EditorMainPane>[0]> = {},
) {
  render(
    <EditorMainPane
      activeContents="# Draft"
      activeDocumentLineCount={1}
      activeSearchMatchIndex={-1}
      activeTab={activeTab}
      copy={getSafeEditorCopy("en")}
      documentKey={activeTab.path}
      editorPaneRef={createRef<EditorPaneHandle | null>()}
      editorSettings={editorSettings}
      editorTheme="light"
      imagePreviewTitle="Image preview"
      lModeCopy={getLModeCopy("en")}
      menuLanguage="en"
      onChange={vi.fn()}
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
      {...overrides}
    />,
  );
}

describe("EditorMainPane", () => {
  it("shows the active file name and workspace-relative path above the editor", () => {
    renderEditorMainPane();

    expect(screen.getByText("draft.md")).toBeTruthy();
    expect(screen.getByText("docs/draft.md")).toBeTruthy();
    expect(screen.getByTestId("mock-editor-pane")).toBeTruthy();
  });

  it("does not duplicate the file name when the workspace-relative path is the same", () => {
    renderEditorMainPane({
      activeTab: {
        ...activeTab,
        id: "/workspace/root.md",
        name: "root.md",
        path: "/workspace/root.md",
      },
      documentKey: "/workspace/root.md",
    });

    expect(screen.getAllByText("root.md")).toHaveLength(1);
  });

  it("hides the normal document header in L Mode", () => {
    renderEditorMainPane({
      editorSettings: {
        ...editorSettings,
        lModeEnabled: true,
      },
    });

    expect(screen.queryByText("draft.md")).toBeNull();
    expect(screen.queryByText("docs/draft.md")).toBeNull();
    expect(screen.getByTestId("mock-editor-pane")).toBeTruthy();
  });
});
