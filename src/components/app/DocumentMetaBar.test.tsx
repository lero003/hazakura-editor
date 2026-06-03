import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { DocumentMetaBar } from "./DocumentMetaBar";
import type { EditorTab } from "../../types";
import type { RightPaneToggleCopy } from "./RightPaneToggleControls";

afterEach(cleanup);

const sidePaneCopy: RightPaneToggleCopy = {
  agentWindow: "Agent",
  agentWindowTitle: "Open Agent Window",
  diffTab: "Diff",
  diffTabTitle: "Open Diff",
  outlineTab: "Outline",
  outlineTabTitle: "Open Outline",
  previewTab: "Preview",
  previewTabTitle: "Open Preview",
  sidePaneMode: "Side pane",
};

const activeTab: EditorTab = {
  contents: "# Note\n",
  encoding: "utf-8",
  error: null,
  externalFingerprint: null,
  fingerprint: "fp",
  ignoredExternalFingerprint: null,
  id: "/workspace/note.md",
  large_file_warning: false,
  lastSavedContents: "# Note\n",
  lastSavedEncoding: "utf-8",
  lastSavedLineEnding: "lf",
  line_ending: "lf",
  modified_ms: null,
  name: "note.md",
  path: "/workspace/note.md",
  saveStatus: "idle",
  size: 10,
};

function renderMeta(lModeEnabled: boolean) {
  render(
    <DocumentMetaBar
      activeDirty
      activeTab={activeTab}
      agentWorkbenchAvailable
      diffPaneActive={false}
      lModeEnabled={lModeEnabled}
      onOpenAgentWindow={vi.fn()}
      onReviewChanges={vi.fn()}
      onToggleDiff={vi.fn()}
      onToggleOutline={vi.fn()}
      onTogglePreview={vi.fn()}
      outlinePaneActive={false}
      previewPaneActive={false}
      recoveryReviewChangesLabel="変更を確認"
      sidePaneCopy={sidePaneCopy}
    />,
  );
}

describe("DocumentMetaBar", () => {
  it("hides review and Agent controls in L Mode", () => {
    renderMeta(true);

    expect(screen.queryByRole("button", { name: "変更を確認" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Open Agent Window" }),
    ).toBeNull();
  });

  it("keeps review and Agent controls available outside L Mode", () => {
    renderMeta(false);

    expect(screen.getByRole("button", { name: "変更を確認" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open Agent Window" })).toBeTruthy();
  });
});
