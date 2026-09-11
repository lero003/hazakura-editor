import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppPrimaryToolbar } from "./AppPrimaryToolbar";
import type { RightPaneToggleCopy } from "./RightPaneToggleControls";
const { startDragging, toggleMaximize } = vi.hoisted(() => ({
  startDragging: vi.fn().mockResolvedValue(undefined),
  toggleMaximize: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: () => ({ startDragging, toggleMaximize }) }));
vi.mock("../../lib/distributionLane", () => ({ isDeveloperDistributionLane: () => false }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
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


const base = {
  documentName: "朝の余白.md", workspaceName: "随筆", menuLanguage: "ja" as const,
  navigation: { mode: "write" as const, canNavigate: true, documentName: "朝の余白.md", menuLanguage: "ja" as const,
    reviewTargets: [], onWrite: vi.fn(), onRead: vi.fn(), onReview: vi.fn() },
  canSave: true, saving: false, onSave: vi.fn(),
  assistSurfaceActive: "none" as const, agentWorkbenchAvailable: true, sidePaneCopy,
  onOpenAppleAssistWindow: vi.fn(), onOpenAgentWindow: vi.fn(),
};
describe("AppPrimaryToolbar", () => {
  it("uses the existing save action only when enabled", () => {
    const onSave = vi.fn();
    const view = render(<AppPrimaryToolbar {...base} canSave={false} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(onSave).not.toHaveBeenCalled();
    view.rerender(<AppPrimaryToolbar {...base} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(onSave).toHaveBeenCalledOnce();
  });
  it("never exposes the external agent on the App Store lane", () => {
    render(<AppPrimaryToolbar {...base} assistSurfaceActive="external-cli" />);
    expect(screen.queryByRole("button", { name: sidePaneCopy.agentWindowTitle })).toBeNull();
    expect(screen.queryByText("DEV")).toBeNull();
  });
  it("retains an unavailable Local Assist explanation and explicit entry", () => {
    const onOpenAppleAssistWindow = vi.fn();
    render(<AppPrimaryToolbar {...base} assistSurfaceActive="apple-local" appleAssistAvailability={{kind:"unsupported"}}
      onOpenAppleAssistWindow={onOpenAppleAssistWindow} />);
    fireEvent.click(screen.getByRole("button", { name: /not supported on this Mac/ }));
    expect(onOpenAppleAssistWindow).toHaveBeenCalledOnce();
  });
  it("does not repeat the product name as both the title and the subtitle", () => {
    render(<AppPrimaryToolbar {...base} documentName="Hazakura Editor" workspaceName="" />);
    // 無題＋フォルダ未選択のとき、上段と下段に同じ製品名を出さない。
    expect(screen.getAllByText("Hazakura Editor")).toHaveLength(1);
  });
  it("keeps the workspace name as the subtitle when one is open", () => {
    render(<AppPrimaryToolbar {...base} documentName="朝の余白.md" workspaceName="随筆" />);
    expect(screen.getByText("朝の余白.md")).toBeTruthy();
    expect(screen.getByText("随筆")).toBeTruthy();
  });
  it("does not turn an interactive control into a window drag", () => {
    const view = render(<AppPrimaryToolbar {...base} />);
    fireEvent.mouseDown(screen.getByRole("button", {name:"保存"}), {button:0});
    expect(startDragging).not.toHaveBeenCalled();
    fireEvent.mouseDown(view.container.querySelector("header")!, {button:0});
    expect(startDragging).toHaveBeenCalledOnce();
  });
  it("zooms (maximizes) the window on a double click in the drag area", () => {
    const view = render(<AppPrimaryToolbar {...base} />);
    fireEvent.doubleClick(screen.getByRole("button", {name:"保存"}));
    expect(toggleMaximize).not.toHaveBeenCalled();
    fireEvent.doubleClick(view.container.querySelector("header")!, {button:0});
    expect(toggleMaximize).toHaveBeenCalledOnce();
  });
  it("keeps the sidebar toggle off the toolbar", () => {
    // サイドバーの開閉はサイドバー自身（畳んだ後は左端のレール）が持つ。
    const view = render(<AppPrimaryToolbar {...base} />);
    expect(view.container.querySelector(".primary-sidebar-toggle")).toBeNull();
    expect(screen.queryByRole("button", { name: /サイドバーを切り替える|Toggle sidebar/ })).toBeNull();
  });
});
