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

function renderControls(
  overrides: Partial<Parameters<typeof RightPaneToggleControls>[0]> = {},
) {
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
      onToggleDiff={onToggleDiff}
      onToggleEbook={onToggleEbook}
      onToggleOutline={onToggleOutline}
      onTogglePreview={vi.fn()}
      outlineActive={false}
      outlineAvailable
      previewActive={false}
      referenceActive={false}
      onToggleReference={vi.fn()}
      {...overrides}
    />,
  );

  return {
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

  it("never puts a second review entry beside the reading controls", () => {
    // 二段目（表示ツールバー）の「確認」は外した。上部ナビのグローバル「確認」が
    // レビュー対象を選ぶので、同じ文言・同じ行き先の導線を二本置かない（実機指摘）。
    renderControls();

    expect(screen.queryByRole("button", { name: "Review" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Review Desk" })).toBeNull();
    expect(
      screen.getAllByRole("button").map((button) => button.textContent),
    ).toEqual(["Preview", "e-book", "Outline", "Reference", "Diff"]);
  });

  it("keeps Diff and Outline controls available when relevant", () => {
    const { onToggleDiff, onToggleOutline } = renderControls();

    const diffButton = screen.getByRole("button", { name: "Diff" });
    const outlineButton = screen.getByRole("button", { name: "Outline" });

    expect(diffButton.getAttribute("aria-pressed")).toBe("false");
    diffButton.click();
    expect(onToggleDiff).toHaveBeenCalledTimes(1);

    expect(outlineButton.getAttribute("aria-pressed")).toBe("false");
    outlineButton.click();
    expect(onToggleOutline).toHaveBeenCalledTimes(1);
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
        onToggleDiff={vi.fn()}
        onToggleEbook={vi.fn()}
        onToggleOutline={vi.fn()}
        onTogglePreview={vi.fn()}
        outlineActive={false}
        outlineAvailable
        previewActive={false}
        referenceActive={false}
        referenceLoaded
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
