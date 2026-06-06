import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppTopChrome } from "./AppTopChrome";
import { getLModeCopy, getRecoveryCopy, getSidePaneCopy } from "../../lib/locale";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

function renderTopChrome() {
  render(
    <AppTopChrome
      activeDirty={false}
      activeTab={null}
      activeTabId={null}
      agentWorkbenchAvailable
      assistSurfaceActive="external-cli"
      draggingTabId={null}
      dragOverTabId={null}
      emptyTabsLabel="No file open"
      lModeCopy={getLModeCopy("en")}
      lModeEnabled={false}
      onCloseTab={vi.fn()}
      onFinishTabPointerDrag={vi.fn()}
      onOpenAgentWindow={vi.fn()}
      onOpenAppleAssistWindow={vi.fn()}
      onPointerEnter={vi.fn()}
      onReviewChanges={vi.fn()}
      onSelectTab={vi.fn()}
      onTabContextMenu={vi.fn()}
      onTabPointerDown={vi.fn()}
      onTabPointerMove={vi.fn()}
      onToggleDiff={vi.fn()}
      onToggleLMode={vi.fn()}
      onToggleOutline={vi.fn()}
      onTogglePreview={vi.fn()}
      recoveryCopy={getRecoveryCopy("en")}
      shouldSuppressTabClick={() => false}
      sidePaneCopy={getSidePaneCopy("en")}
      sidePaneMode="preview"
      tabs={[]}
    />,
  );
}

describe("AppTopChrome", () => {
  it("shows a Dev badge in the Developer / GitHub lane", () => {
    renderTopChrome();

    expect(screen.getByText("DEV")).toBeTruthy();
  });

  it("hides the Dev badge in the App Store lane", () => {
    vi.stubEnv("VITE_HAZAKURA_DISTRIBUTION_LANE", "app-store");

    renderTopChrome();

    expect(screen.queryByText("DEV")).toBeNull();
  });
});
