import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import {
  RightPaneToggleControls,
  type RightPaneToggleCopy,
} from "./RightPaneToggleControls";

afterEach(cleanup);

const copy: RightPaneToggleCopy = {
  agentWindow: "Agent",
  agentWindowTitle: "Open Agent Window",
  appleAssistWindow: "Apple Local Assist",
  appleAssistWindowTitle: "Open Apple Local Assist Window",
  diffTab: "Diff",
  diffTabTitle: "Open Diff",
  ebookTab: "e-book",
  ebookTabTitle: "Open e-book",
  outlineTab: "Outline",
  outlineTabTitle: "Open Outline",
  previewTab: "Preview",
  previewTabTitle: "Open Preview",
  reviewMenu: "Review",
  reviewMenuTitle: "Open review tools",
  sidePaneMode: "Side pane",
};

function renderControls(lModeActive = false) {
  render(
    <RightPaneToggleControls
      copy={copy}
      diffActive={false}
      diffAvailable
      ebookActive={false}
      ebookAvailable
      lModeActive={lModeActive}
      lModeLabel="L Mode"
      lModeTitle="Toggle L Mode"
      onReviewChanges={vi.fn()}
      onToggleDiff={vi.fn()}
      onToggleEbook={vi.fn()}
      onToggleLMode={vi.fn()}
      onToggleOutline={vi.fn()}
      onTogglePreview={vi.fn()}
      outlineActive={false}
      outlineAvailable
      previewActive={false}
      reviewChangesAvailable={false}
      reviewChangesLabel="Review changes"
    />,
  );
}

describe("RightPaneToggleControls", () => {
  it("reflects L Mode active state on the L Mode toggle", () => {
    renderControls(true);

    const lModeButton = screen.getByRole("button", { name: "L Mode" });

    expect(lModeButton.getAttribute("aria-pressed")).toBe("true");
    expect(lModeButton.className).toContain("active");
  });
});
