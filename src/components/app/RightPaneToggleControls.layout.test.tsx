import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RightPaneToggleControls, type RightPaneToggleCopy } from "./RightPaneToggleControls";

afterEach(cleanup);
const copy: RightPaneToggleCopy = {
  agentWindow: "Agent", agentWindowTitle: "Open Agent",
  appleAssistWindow: "Local Assist", appleAssistWindowTitle: "Open Local Assist",
  appleAssistUnavailableSession: "Unavailable", appleAssistUnsupportedMac: "Unsupported",
  diffTab: "Diff", diffTabTitle: "Open Diff", diffTabTitleHide: "Hide Diff",
  ebookTab: "e-book", ebookTabTitle: "Open e-book", ebookTabTitleHide: "Hide e-book",
  outlineTab: "Outline", outlineTabTitle: "Open Outline", outlineTabTitleHide: "Hide Outline",
  previewTab: "Preview", previewTabTitle: "Open Preview", previewTabTitleHide: "Hide Preview",
  referenceTab: "Reference", referenceTabTitle: "Open Reference",
  referenceTabTitleHide: "Hide Reference", referenceTabTitleRetained: "Show retained Reference",
  sidePaneMode: "Side pane",
};
function props() {
  return {
    copy, diffActive: false, diffAvailable: true, ebookActive: false, ebookAvailable: true,
    outlineActive: false, outlineAvailable: true, previewActive: true, referenceActive: false,
    onToggleDiff: vi.fn(), onToggleEbook: vi.fn(),
    onToggleOutline: vi.fn(), onTogglePreview: vi.fn(), onToggleReference: vi.fn(),
  };
}

describe("reading control layout contract", () => {
  it("groups reading modes before reference and diff with named icon-only controls", () => {
    render(<RightPaneToggleControls {...props()} />);
    expect(screen.getAllByRole("button").map((button) => button.getAttribute("aria-label")))
      .toEqual(["Preview", "e-book", "Outline", "Reference", "Diff"]);
    expect(screen.getByRole("button", { name: "Preview" }).getAttribute("aria-pressed")).toBe("true");
  });
  it("does not reserve a second review slot at all", () => {
    // 二段目の「確認」を外した（上部ナビのグローバル「確認」へ一本化）。
    // 隠すだけの枠を残すと、同じ導線が二本ある状態に戻る。
    const p = props();
    const view = render(<RightPaneToggleControls {...p} />);
    expect(view.container.querySelector(".pane-review-action")).toBeNull();
    expect(screen.queryByRole("button", { name: "Review" })).toBeNull();
    const modes = [...view.container.querySelectorAll(".pane-toggles button")];
    expect(modes).toHaveLength(5);
    view.rerender(<RightPaneToggleControls {...p} diffActive />);
    expect([...view.container.querySelectorAll(".pane-toggles button")]).toEqual(modes);
  });
  it("retains a hidden Reference session's accessible name and marker", () => {
    render(<RightPaneToggleControls {...props()} referenceLoaded />);
    const reference = screen.getByRole("button", { name: "Show retained Reference" });
    expect(reference.getAttribute("data-retained")).toBe("true");
    expect(reference.getAttribute("aria-pressed")).toBe("false");
  });
});
