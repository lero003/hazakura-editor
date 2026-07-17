import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import {
  EditingModeControl,
  RightPaneToggleControls,
  type RightPaneToggleCopy,
} from "./RightPaneToggleControls";

afterEach(cleanup);

const copy: RightPaneToggleCopy = {
  agentWindow: "Agent",
  agentWindowTitle: "Open Agent Window",
  appleAssistWindow: "Hazakura Local Assist",
  appleAssistWindowTitle: "Open Hazakura Local Assist Window",
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

function renderControls(
  overrides: Partial<Parameters<typeof RightPaneToggleControls>[0]> = {},
) {
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
      onReviewChanges={onReviewChanges}
      onToggleDiff={onToggleDiff}
      onToggleEbook={onToggleEbook}
      onToggleOutline={onToggleOutline}
      onTogglePreview={vi.fn()}
      outlineActive={false}
      outlineAvailable
      previewActive={false}
      referenceActive={false}
      reviewChangesAvailable={false}
      reviewChangesLabel="Review changes"
      onToggleReference={vi.fn()}
      {...overrides}
    />,
  );

  return {
    onReviewChanges,
    onToggleDiff,
    onToggleEbook,
    onToggleOutline,
  };
}

describe("RightPaneToggleControls", () => {
  it("keeps L Mode in a separate editing-mode control", () => {
    render(
      <EditingModeControl
        active
        label="L Mode"
        onToggle={vi.fn()}
        title="Toggle L Mode"
      />,
    );

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
    expect(screen.queryByRole("button", { name: "Review Desk" })).toBeNull();
  });

  it("keeps dirty review, Diff, and Outline controls available when relevant", () => {
    const {
      onReviewChanges,
      onToggleDiff,
      onToggleOutline,
    } = renderControls({
      reviewChangesAvailable: true,
    });

    const reviewButton = screen.getByRole("button", { name: "Review" });
    const diffButton = screen.getByRole("button", { name: "Diff" });
    const outlineButton = screen.getByRole("button", { name: "Outline" });

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
      "Review",
      "Preview",
      "Reference",
      "e-book",
      "Outline",
      "Diff",
    ]);
  });

  it("hides dirty review when review changes are unavailable", () => {
    renderControls();

    expect(
      screen.getAllByRole("button").map((button) => button.textContent),
    ).toEqual(["Preview", "Reference", "e-book", "Outline", "Diff"]);
  });

  it("marks Reference as the active right pane", () => {
    renderControls({ referenceActive: true });

    expect(
      screen.getByRole("button", { name: "Reference" }).getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("uses retained and hide titles for Reference state", () => {
    const { unmount } = render(
      <RightPaneToggleControls
        copy={copy}
        diffActive={false}
        diffAvailable
        ebookActive={false}
        ebookAvailable
        onReviewChanges={vi.fn()}
        onToggleDiff={vi.fn()}
        onToggleEbook={vi.fn()}
        onToggleOutline={vi.fn()}
        onTogglePreview={vi.fn()}
        outlineActive={false}
        outlineAvailable
        previewActive={false}
        referenceActive={false}
        referenceLoaded
        reviewChangesAvailable={false}
        reviewChangesLabel="Review changes"
        onToggleReference={vi.fn()}
      />,
    );

    const retained = screen.getByRole("button", {
      name: "Show retained Reference",
    });
    expect(retained.getAttribute("title")).toBe("Show retained Reference");
    expect(retained.getAttribute("data-retained")).toBe("true");
    expect(retained.className).toContain("pane-toggle-retained");
    expect(retained.getAttribute("aria-pressed")).toBe("false");
    unmount();

    renderControls({ referenceActive: true, referenceLoaded: true });
    const active = screen.getByRole("button", { name: "Reference" });
    expect(active.getAttribute("title")).toBe("Hide Reference");
    expect(active.getAttribute("data-retained")).toBeNull();
    expect(active.className).not.toContain("pane-toggle-retained");
  });
});
