import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppTopChrome } from "./AppTopChrome";
import { getLModeCopy, getRecoveryCopy, getSidePaneCopy } from "../../lib/locale";
import type { EditorTab } from "../../types";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

function renderTopChrome(
  overrides: Partial<Parameters<typeof AppTopChrome>[0]> = {},
) {
  const onCloseSelectedImagePreview = vi.fn();
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
      onCloseSelectedImagePreview={onCloseSelectedImagePreview}
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
      selectedImage={null}
      sidePaneCopy={getSidePaneCopy("en")}
      sidePaneMode="preview"
      tabs={[]}
      {...overrides}
    />,
  );

  return { onCloseSelectedImagePreview };
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

  it("shows the active image preview as a closeable tab", () => {
    const { onCloseSelectedImagePreview } = renderTopChrome({
      selectedImage: {
        name: "photo.png",
        path: "/workspace/assets/photo.png",
        size: 128,
        url: "data:image/png;base64,photo",
      },
    });

    expect(screen.getByRole("tab", { name: "photo.png" })).toBeTruthy();
    screen.getByRole("button", { name: "Close photo.png" }).click();

    expect(onCloseSelectedImagePreview).toHaveBeenCalledTimes(1);
  });

  it("exposes dirty tabs as an accessible description", () => {
    const dirtyTab: EditorTab = {
      contents: "draft",
      encoding: "utf-8",
      error: null,
      externalFingerprint: null,
      fingerprint: "fp",
      ignoredExternalFingerprint: null,
      id: "/workspace/draft.md",
      large_file_warning: false,
      lastSavedContents: "saved",
      lastSavedEncoding: "utf-8",
      lastSavedLineEnding: "lf",
      line_ending: "lf",
      modified_ms: null,
      name: "draft.md",
      path: "/workspace/draft.md",
      saveStatus: "idle",
      size: 10,
    };

    renderTopChrome({ tabs: [dirtyTab], activeDirty: true });

    const tabButton = screen.getByRole("tab", {
      description: "unsaved",
      name: "draft.md",
    });
    const describedById = tabButton.getAttribute("aria-describedby");
    expect(describedById).toBeTruthy();

    const description = document.getElementById(describedById!);
    expect(description?.textContent).toBe("unsaved");
  });
});
