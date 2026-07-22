import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DocumentMetaBar } from "./DocumentMetaBar";
import type { EditorTab } from "../../types";
import type { RightPaneToggleCopy } from "./RightPaneToggleControls";
import { getLModeCopy } from "../../lib/locale";

afterEach(cleanup);

const sidePaneCopy: RightPaneToggleCopy = {
  agentWindow: "Agent",
  agentWindowTitle: "Open Agent Window",
  appleAssistWindow: "Hazakura Local Assist",
  appleAssistWindowTitle: "Open Hazakura Local Assist Window",
  appleAssistUnavailableSession: "unavailable in this session",
  appleAssistUnsupportedMac: "not supported on this Mac",
  diffTab: "Diff",
  diffTabTitle: "Open Diff",
  diffTabTitleHide: "Hide Diff",
  ebookTab: "e-book",
  ebookTabTitle: "Open e-book",
  ebookTabTitleHide: "Hide e-book",
  outlineTab: "Outline",
  outlineTabTitle: "Open Outline",
  outlineTabTitleHide: "Hide Outline",
  previewTab: "Preview",
  previewTabTitle: "Open Preview",
  previewTabTitleHide: "Hide Preview",
  referenceTab: "Reference",
  referenceTabTitle: "Open Reference",
  referenceTabTitleHide: "Hide Reference",
  referenceTabTitleRetained: "Show retained Reference",
  reviewMenu: "Review",
  reviewMenuTitle: "Open review tools",
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
  sessionId: "/workspace/note.md",
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

function renderMeta(
  lModeEnabled: boolean,
  assistSurfacePreference: "apple-local" | "external-cli" | "none" =
    "external-cli",
  overrides: Partial<Parameters<typeof DocumentMetaBar>[0]> = {},
) {
  const actions = {
    onReviewChanges: vi.fn(),
    onToggleDiff: vi.fn(),
    onToggleEbook: vi.fn(),
    onToggleLMode: vi.fn(),
    onToggleOutline: vi.fn(),
    onTogglePreview: vi.fn(),
    onToggleReference: vi.fn(),
  };
  render(
    <DocumentMetaBar
      activeDirty
      activeTab={activeTab}
      agentWorkbenchAvailable
      appleAssistAvailability={{ kind: "available" }}
      assistSurfaceActive={assistSurfacePreference}
      diffPaneActive={false}
      ebookPaneActive={false}
      lModeCopy={getLModeCopy("en")}
      lModeEnabled={lModeEnabled}
      onOpenAgentWindow={vi.fn()}
      onOpenAppleAssistWindow={vi.fn()}
      onReviewChanges={actions.onReviewChanges}
      onToggleDiff={actions.onToggleDiff}
      onToggleEbook={actions.onToggleEbook}
      onToggleLMode={actions.onToggleLMode}
      onToggleOutline={actions.onToggleOutline}
      onTogglePreview={actions.onTogglePreview}
      onToggleReference={actions.onToggleReference}
      outlinePaneActive={false}
      previewPaneActive={false}
      referencePaneActive={false}
      recoveryReviewChangesLabel="変更を確認"
      sidePaneCopy={sidePaneCopy}
      {...overrides}
    />,
  );
  return actions;
}

describe("DocumentMetaBar", () => {
  it("hides review and Agent controls in L Mode", () => {
    renderMeta(true);

    expect(screen.queryByRole("button", { name: "Review" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Review Desk" })).toBeNull();
    expect(screen.queryByRole("button", { name: "e-book" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Open Agent Window" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Open Hazakura Local Assist Window" }),
    ).toBeNull();
  });

  it("keeps dirty review and Agent controls available outside L Mode", () => {
    renderMeta(false);

    expect(screen.queryByRole("button", { name: "Review Desk" })).toBeNull();
    expect(screen.getByRole("button", { name: "Review" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Diff" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Outline" })).toBeTruthy();
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByRole("button", { name: "Open Agent Window" })).toBeTruthy();
  });

  it("shows the L Mode switch outside L Mode", () => {
    const actions = renderMeta(false);

    fireEvent.click(screen.getByRole("button", { name: "L Mode" }));

    expect(actions.onToggleLMode).toHaveBeenCalledTimes(1);
  });

  it("keeps the e-book toggle visible but disabled when no document is active", () => {
    const actions = renderMeta(false, "external-cli", {
      activeDirty: false,
      activeTab: null,
      ebookPaneActive: true,
    });

    const ebookButton = screen.getByRole("button", { name: "e-book" });

    expect((ebookButton as HTMLButtonElement).disabled).toBe(true);
    expect(ebookButton.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(ebookButton);
    expect(actions.onToggleEbook).not.toHaveBeenCalled();
  });

  it("keeps the e-book toggle enabled for an active Markdown document", () => {
    const actions = renderMeta(false);

    const ebookButton = screen.getByRole("button", { name: "e-book" });

    expect((ebookButton as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(ebookButton);
    expect(actions.onToggleEbook).toHaveBeenCalledTimes(1);
  });

  it("routes dirty review controls to their pane actions", () => {
    const actions = renderMeta(false);

    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(actions.onReviewChanges).toHaveBeenCalledWith(activeTab);

    fireEvent.click(screen.getByRole("button", { name: "Diff" }));
    expect(actions.onToggleDiff).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Outline" }));
    expect(actions.onToggleOutline).toHaveBeenCalledTimes(1);
  });

  it("switches the companion button to Hazakura Local Assist", () => {
    renderMeta(false, "apple-local");

    expect(
      screen.getByRole("button", { name: "Open Hazakura Local Assist Window" }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Open Agent Window" })).toBeNull();
  });

  it("surfaces Local Assist unavailability on the companion button", () => {
    renderMeta(false, "apple-local", {
      appleAssistAvailability: {
        kind: "unavailable",
        reason: "Foundation Models unavailable",
      },
    });

    const button = screen.getByRole("button", {
      name: "Open Hazakura Local Assist Window — Foundation Models unavailable",
    });
    expect(button.className).toContain("open-agent-window-button-unavailable");
    expect(button.getAttribute("title")).toContain(
      "Foundation Models unavailable",
    );
  });

  it("localizes unsupported Local Assist titles from side-pane copy", () => {
    renderMeta(false, "apple-local", {
      appleAssistAvailability: { kind: "unsupported" },
      sidePaneCopy: {
        ...sidePaneCopy,
        appleAssistUnsupportedMac: "この Mac では利用できません",
      },
    });

    expect(
      screen.getByRole("button", {
        name: "Open Hazakura Local Assist Window — この Mac では利用できません",
      }),
    ).toBeTruthy();
  });

  it("hides the companion button when assist surface is off", () => {
    renderMeta(false, "none");

    expect(screen.queryByRole("button", { name: "Open Agent Window" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Open Hazakura Local Assist Window" }),
    ).toBeNull();
  });
});
