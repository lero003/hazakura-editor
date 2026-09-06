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
  reviewMenu: "Review", reviewMenuTitle: "Review changes", sidePaneMode: "Side pane",
};
function props() {
  return {
    copy, diffActive: false, diffAvailable: true, ebookActive: false, ebookAvailable: true,
    outlineActive: false, outlineAvailable: true, previewActive: true, referenceActive: false,
    reviewChangesAvailable: false, reviewChangesLabel: "Review changes",
    onReviewChanges: vi.fn(), onToggleDiff: vi.fn(), onToggleEbook: vi.fn(),
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
  it("reserves the review slot without exposing or activating it when unavailable", () => {
    const p = props();
    const view = render(<RightPaneToggleControls {...p} />);
    const review = view.container.querySelector<HTMLButtonElement>(".pane-review-action")!;
    expect(screen.queryByRole("button", { name: "Review" })).toBeNull();
    expect(review.disabled).toBe(true);
    expect(review.tabIndex).toBe(-1);
    fireEvent.click(review);
    expect(p.onReviewChanges).not.toHaveBeenCalled();
    const modes = [...view.container.querySelectorAll(".pane-toggles button")];
    view.rerender(<RightPaneToggleControls {...p} reviewChangesAvailable />);
    expect(view.container.querySelector(".pane-review-action")).toBe(review);
    expect([...view.container.querySelectorAll(".pane-toggles button")]).toEqual(modes);
    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(p.onReviewChanges).toHaveBeenCalledOnce();
  });
  it("retains a hidden Reference session's accessible name and marker", () => {
    render(<RightPaneToggleControls {...props()} referenceLoaded />);
    const reference = screen.getByRole("button", { name: "Show retained Reference" });
    expect(reference.getAttribute("data-retained")).toBe("true");
    expect(reference.getAttribute("aria-pressed")).toBe("false");
  });
});
