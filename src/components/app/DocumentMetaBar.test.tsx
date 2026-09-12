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
    onToggleDiff: vi.fn(),
    onToggleEbook: vi.fn(),
    onToggleLMode: vi.fn(),
    onToggleOutline: vi.fn(),
    onTogglePreview: vi.fn(),
    onToggleReference: vi.fn(),
  };
  render(
    <DocumentMetaBar
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
      onToggleDiff={actions.onToggleDiff}
      onToggleEbook={actions.onToggleEbook}
      onToggleLMode={actions.onToggleLMode}
      onToggleOutline={actions.onToggleOutline}
      onTogglePreview={actions.onTogglePreview}
      onToggleReference={actions.onToggleReference}
      outlinePaneActive={false}
      previewPaneActive={false}
      referencePaneActive={false}
      sidePaneCopy={sidePaneCopy}
      {...overrides}
    />,
  );
  return actions;
}

describe("DocumentMetaBar", () => {
  it("shows the document's location as a breadcrumb next to the display tools", () => {
    // 実機/モック: 「散文集 / chapters / 02_朝の余白.md」のように、いま開いている文書の
    // 場所を示す。長い絶対パスは出さず、末尾2要素だけ。
    renderMeta(false);

    const breadcrumb = screen.getByTitle("/workspace/note.md");

    expect(breadcrumb.textContent?.replace(/\s+/g, "")).toBe("workspace/note.md");
  });

  it("does not invent a location for a document that has none", () => {
    // 未保存の文書では出さない。
    renderMeta(false, "external-cli", {
      activeTab: { ...activeTab, path: "" },
    });

    expect(screen.queryByTitle("/workspace/note.md")).toBeNull();
  });

  it("hides the display tools and Agent controls in L Mode", () => {
    renderMeta(true);

    expect(screen.queryByRole("button", { name: "Review" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Review Desk" })).toBeNull();
    expect(screen.queryByRole("button", { name: "e-book" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Open Agent Window" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Open Hazakura Local Assist Window" }),
    ).toBeNull();
  });

  it("keeps the display tools and Agent controls available outside L Mode", () => {
    renderMeta(false);

    expect(screen.queryByRole("button", { name: "Review Desk" })).toBeNull();
    // 二段目の「確認」は置かない（上部ナビのグローバル「確認」へ一本化）。
    expect(screen.queryByRole("button", { name: "Review" })).toBeNull();
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

  it("routes the display controls to their pane actions", () => {
    const actions = renderMeta(false);

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

  it("keeps the companion title neutral before an explicit availability probe", () => {
    renderMeta(false, "apple-local", {
      appleAssistAvailability: { kind: "unsupported" },
      appleAssistAvailabilityProbed: false,
    });

    const button = screen.getByRole("button", {
      name: "Open Hazakura Local Assist Window",
    });
    expect(button.className).not.toContain(
      "open-agent-window-button-unavailable",
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
