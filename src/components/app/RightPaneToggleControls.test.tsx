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

function renderControls(
  overrides: Partial<Parameters<typeof RightPaneToggleControls>[0]> = {},
) {
  const onToggleEbook = vi.fn();
  render(
    <RightPaneToggleControls
      copy={copy}
      diffActive={false}
      diffAvailable
      ebookActive={false}
      ebookAvailable
      lModeActive={false}
      lModeLabel="L Mode"
      lModeTitle="Toggle L Mode"
      onReviewChanges={vi.fn()}
      onToggleDiff={vi.fn()}
      onToggleEbook={onToggleEbook}
      onToggleLMode={vi.fn()}
      onToggleOutline={vi.fn()}
      onTogglePreview={vi.fn()}
      outlineActive={false}
      outlineAvailable
      previewActive={false}
      reviewChangesAvailable={false}
      reviewChangesLabel="Review changes"
      {...overrides}
    />,
  );

  return { onToggleEbook };
}

describe("RightPaneToggleControls", () => {
  it("reflects L Mode active state on the L Mode toggle", () => {
    renderControls({ lModeActive: true });

    const lModeButton = screen.getByRole("button", { name: "L Mode" });

    expect(lModeButton.getAttribute("aria-pressed")).toBe("true");
    expect(lModeButton.className).toContain("active");
  });

  it("keeps the e-book toggle visible but disabled when e-book is unavailable", () => {
    const { onToggleEbook } = renderControls({ ebookAvailable: false });

    const ebookButton = screen.getByRole("button", { name: "e-book" });

    expect((ebookButton as HTMLButtonElement).disabled).toBe(true);
    expect(ebookButton.getAttribute("aria-pressed")).toBe("false");

    ebookButton.click();
    expect(onToggleEbook).not.toHaveBeenCalled();
  });
});
