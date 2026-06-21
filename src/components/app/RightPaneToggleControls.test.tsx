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
  const onOpenReviewDesk = vi.fn();
  const onReviewChanges = vi.fn();
  const onToggleDiff = vi.fn();
  const onToggleEbook = vi.fn();
  const onToggleOutline = vi.fn();
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
      onOpenReviewDesk={onOpenReviewDesk}
      onReviewChanges={onReviewChanges}
      onToggleDiff={onToggleDiff}
      onToggleEbook={onToggleEbook}
      onToggleLMode={vi.fn()}
      onToggleOutline={onToggleOutline}
      onTogglePreview={vi.fn()}
      outlineActive={false}
      outlineAvailable
      previewActive={false}
      reviewChangesAvailable={false}
      reviewChangesLabel="Review changes"
      reviewDeskActive={false}
      reviewDeskAvailable
      reviewDeskLabel="Review Desk"
      reviewDeskTitle="Open Review Desk"
      {...overrides}
    />,
  );

  return {
    onOpenReviewDesk,
    onReviewChanges,
    onToggleDiff,
    onToggleEbook,
    onToggleOutline,
  };
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

  it("keeps review changes hidden until dirty review is available", () => {
    renderControls();

    expect(screen.queryByRole("button", { name: "Review" })).toBeNull();
    expect(screen.getByRole("button", { name: "Review Desk" })).toBeTruthy();
  });

  it("keeps review, Diff, and Outline controls available when relevant", () => {
    const {
      onOpenReviewDesk,
      onReviewChanges,
      onToggleDiff,
      onToggleOutline,
    } = renderControls({
      reviewChangesAvailable: true,
    });

    const reviewDeskButton = screen.getByRole("button", { name: "Review Desk" });
    const reviewButton = screen.getByRole("button", { name: "Review" });
    const diffButton = screen.getByRole("button", { name: "Diff" });
    const outlineButton = screen.getByRole("button", { name: "Outline" });

    expect(reviewDeskButton.getAttribute("aria-pressed")).toBe("false");
    reviewDeskButton.click();
    expect(onOpenReviewDesk).toHaveBeenCalledTimes(1);

    expect(reviewButton.getAttribute("aria-pressed")).toBeNull();
    reviewButton.click();
    expect(onReviewChanges).toHaveBeenCalledTimes(1);

    expect(diffButton.getAttribute("aria-pressed")).toBe("false");
    diffButton.click();
    expect(onToggleDiff).toHaveBeenCalledTimes(1);

    expect(outlineButton.getAttribute("aria-pressed")).toBe("false");
    outlineButton.click();
    expect(onToggleOutline).toHaveBeenCalledTimes(1);
  });

  it("keeps review separated to the left of stable mode controls", () => {
    renderControls({ reviewChangesAvailable: true });

    expect(
      screen.getAllByRole("button").map((button) => button.textContent),
    ).toEqual([
      "Review Desk",
      "Review",
      "Preview",
      "L Mode",
      "e-book",
      "Outline",
      "Diff",
    ]);
  });

  it("keeps Review Desk while hiding dirty review when review changes are unavailable", () => {
    renderControls();

    expect(
      screen.getAllByRole("button").map((button) => button.textContent),
    ).toEqual(["Review Desk", "Preview", "L Mode", "e-book", "Outline", "Diff"]);
  });
});
