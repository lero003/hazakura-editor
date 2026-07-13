import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppTopChrome } from "./AppTopChrome";
import {
  getLModeCopy,
  getRecoveryCopy,
  getSidePaneCopy,
} from "../../lib/locale";
import { defaultEditorSettings } from "../../lib/editorSettingsDefaults";
import type { EditorTab } from "../../types";

const windowMocks = vi.hoisted(() => ({
  startDragging: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    startDragging: windowMocks.startDragging,
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

function renderTopChrome(
  overrides: Partial<Parameters<typeof AppTopChrome>[0]> = {},
) {
  const onCloseSelectedImagePreview = vi.fn();
  const onEditorSettingsChange = vi.fn();
  const onToggleEbook = vi.fn();
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
      editorSettings={defaultEditorSettings()}
      lModeCopy={getLModeCopy("en")}
      lModeEnabled={false}
      menuLanguage="en"
      onCloseSelectedImagePreview={onCloseSelectedImagePreview}
      onCloseTab={vi.fn()}
      onEditorSettingsChange={onEditorSettingsChange}
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
      onToggleEbook={onToggleEbook}
      onToggleLMode={vi.fn()}
      onToggleOutline={vi.fn()}
      onTogglePreview={vi.fn()}
      onToggleReference={vi.fn()}
      openFileTabsLabel="Open file tabs"
      openFilesLabel="Open files"
      recoveryCopy={getRecoveryCopy("en")}
      shouldSuppressTabClick={() => false}
      selectedImage={null}
      sidePaneCopy={getSidePaneCopy("en")}
      sidePaneMode="preview"
      referencePaneVisible={false}
      tabs={[]}
      {...overrides}
    />,
  );

  return {
    onCloseSelectedImagePreview,
    onEditorSettingsChange,
    onToggleEbook,
  };
}

describe("AppTopChrome", () => {
  it("does not expose the tab-row plus button in edit chrome", () => {
    renderTopChrome();

    expect(screen.queryByRole("button", { name: "New File" })).toBeNull();
  });

  it("uses localized names for the tab row and tab list", () => {
    renderTopChrome({
      openFileTabsLabel: "開いているファイルの一覧",
      openFilesLabel: "開いているファイル",
    });

    expect(screen.getByLabelText("開いているファイル")).toBeTruthy();
    expect(
      screen.getByRole("tablist", { name: "開いているファイルの一覧" }),
    ).toBeTruthy();
  });

  it("marks top chrome gaps as Tauri drag regions without making tabs draggable", () => {
    const tab: EditorTab = {
      contents: "draft",
      encoding: "utf-8",
      error: null,
      externalFingerprint: null,
      fingerprint: "fp",
      ignoredExternalFingerprint: null,
      id: "/workspace/draft.md",
      sessionId: "session:draft",
      large_file_warning: false,
      lastSavedContents: "draft",
      lastSavedEncoding: "utf-8",
      lastSavedLineEnding: "lf",
      line_ending: "lf",
      modified_ms: null,
      name: "draft.md",
      path: "/workspace/draft.md",
      saveStatus: "idle",
      size: 10,
    };

    renderTopChrome({
      activeTabId: tab.id,
      tabs: [tab],
    });

    expect(
      document.querySelector(".tabs-row")?.getAttribute("data-tauri-drag-region"),
    ).toBe("deep");
    expect(
      document.querySelector(".tab-item")?.getAttribute("data-tauri-drag-region"),
    ).toBe("false");
    expect(
      screen.getByRole("tab", { name: "draft.md" }).getAttribute("data-tauri-drag-region"),
    ).toBeNull();
  });

  it("starts native window dragging from the dedicated titlebar strip", () => {
    renderTopChrome();

    const dragStrip = document.querySelector(".window-drag-strip") as HTMLElement | null;

    expect(dragStrip).toBeTruthy();
    expect(dragStrip?.getAttribute("data-tauri-drag-region")).toBe("true");

    fireEvent.mouseDown(dragStrip!, { button: 0 });

    expect(windowMocks.startDragging).toHaveBeenCalledTimes(1);
  });

  it("opens an editor quick settings menu from the top-left button", () => {
    renderTopChrome();

    fireEvent.click(screen.getByRole("button", { name: "Editor settings" }));

    expect(screen.getByRole("menu", { name: "Editor settings" })).toBeTruthy();
    expect(
      screen.getByRole("checkbox", { name: "Wrap lines" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("slider", { name: "Editor font size" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("slider", { name: "Preview font size" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("slider", { name: "Workspace font size" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("checkbox", { name: "Preview pane" }),
    ).toBeNull();
    expect(screen.queryByRole("slider", { name: "L Mode font size" })).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Theme" })).toBeNull();
  });

  it("hides editor quick settings from the L Mode chrome", () => {
    renderTopChrome({ lModeEnabled: true });

    expect(
      screen.queryByRole("button", { name: "Editor settings" }),
    ).toBeNull();
  });

  it("updates editor settings from the quick settings menu", () => {
    const { onEditorSettingsChange } = renderTopChrome();

    fireEvent.click(screen.getByRole("button", { name: "Editor settings" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Wrap lines" }));
    fireEvent.change(screen.getByRole("slider", { name: "Editor font size" }), {
      target: { value: "18" },
    });

    expect(onEditorSettingsChange).toHaveBeenCalledTimes(2);
    expect(onEditorSettingsChange).toHaveBeenNthCalledWith(1, expect.any(Function));
    expect(onEditorSettingsChange).toHaveBeenNthCalledWith(2, expect.any(Function));
    expect(onEditorSettingsChange.mock.calls[0][0](defaultEditorSettings())).toMatchObject({
      wrapLines: false,
    });
    expect(onEditorSettingsChange.mock.calls[1][0](defaultEditorSettings())).toMatchObject({
      editorFontSize: 18,
    });
  });

  it("does not expose the workspace sidebar toggle from top chrome", () => {
    renderTopChrome();

    expect(
      screen.queryByRole("button", { name: "Collapse workspace sidebar" }),
    ).toBeNull();
  });

  it("shows a Dev badge in the Developer / GitHub lane", () => {
    renderTopChrome();

    expect(screen.getByText("DEV")).toBeTruthy();
  });

  it("hides the Dev badge from the L Mode chrome", () => {
    renderTopChrome({ lModeEnabled: true });

    expect(screen.queryByText("DEV")).toBeNull();
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

  it("keeps the e-book toggle disabled while an image preview is active", () => {
    const textTab: EditorTab = {
      contents: "# Draft\n",
      encoding: "utf-8",
      error: null,
      externalFingerprint: null,
      fingerprint: "fp",
      ignoredExternalFingerprint: null,
      id: "/workspace/draft.md",
      sessionId: "session:draft",
      large_file_warning: false,
      lastSavedContents: "# Draft\n",
      lastSavedEncoding: "utf-8",
      lastSavedLineEnding: "lf",
      line_ending: "lf",
      modified_ms: null,
      name: "draft.md",
      path: "/workspace/draft.md",
      saveStatus: "idle",
      size: 8,
    };
    const { onToggleEbook } = renderTopChrome({
      activeTab: textTab,
      activeTabId: textTab.id,
      selectedImage: {
        name: "photo.png",
        path: "/workspace/assets/photo.png",
        size: 128,
        url: "data:image/png;base64,photo",
      },
      sidePaneMode: "ebook",
      tabs: [textTab],
    });

    const ebookButton = screen.getByRole("button", { name: "e-book" });

    expect((ebookButton as HTMLButtonElement).disabled).toBe(true);
    expect(ebookButton.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(ebookButton);
    expect(onToggleEbook).not.toHaveBeenCalled();
  });

  it("marks text and image tab close controls as x affordances", () => {
    const dirtyTab: EditorTab = {
      contents: "draft",
      encoding: "utf-8",
      error: null,
      externalFingerprint: null,
      fingerprint: "fp",
      ignoredExternalFingerprint: null,
      id: "/workspace/draft.md",
      sessionId: "session:draft",
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

    renderTopChrome({
      activeDirty: true,
      activeTabId: dirtyTab.id,
      selectedImage: {
        name: "photo.png",
        path: "/workspace/assets/photo.png",
        size: 128,
        url: "data:image/png;base64,photo",
      },
      tabs: [dirtyTab],
    });

    const textCloseButton = screen.getByRole("button", {
      name: "Close draft.md",
    });
    const imageCloseButton = screen.getByRole("button", {
      name: "Close photo.png",
    });

    expect(textCloseButton.getAttribute("data-close-affordance")).toBe("x");
    expect(imageCloseButton.getAttribute("data-close-affordance")).toBe("x");
    expect(textCloseButton.querySelector(".tab-close-icon")).toBeTruthy();
    expect(imageCloseButton.querySelector(".tab-close-icon")).toBeTruthy();
    expect(
      screen.getByRole("tab", { description: "unsaved", name: "draft.md" }),
    ).toBeTruthy();
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
      sessionId: "session:draft",
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

  // v0.18 UX polish — encoding-only dirty indication.
  // The shared `isDirty()` covers contents, line ending,
  // and encoding. TabBar's local dirty check must mirror
  // that, so an encoding-only change still surfaces the
  // dirty dot and the accessible "unsaved" description.

  it("exposes encoding-only dirty tabs as an accessible description", () => {
    const encodingDirtyTab: EditorTab = {
      contents: "saved",
      encoding: "shift-jis",
      error: null,
      externalFingerprint: null,
      fingerprint: "fp",
      ignoredExternalFingerprint: null,
      id: "/workspace/encoding-dirty.md",
      sessionId: "session:encoding",
      large_file_warning: false,
      lastSavedContents: "saved",
      lastSavedEncoding: "utf-8",
      lastSavedLineEnding: "lf",
      line_ending: "lf",
      modified_ms: null,
      name: "encoding-dirty.md",
      path: "/workspace/encoding-dirty.md",
      saveStatus: "idle",
      size: 5,
    };

    renderTopChrome({ tabs: [encodingDirtyTab], activeDirty: true });

    const tabButton = screen.getByRole("tab", {
      description: "unsaved",
      name: "encoding-dirty.md",
    });
    const describedById = tabButton.getAttribute("aria-describedby");
    expect(describedById).toBeTruthy();

    const description = document.getElementById(describedById!);
    expect(description?.textContent).toBe("unsaved");
  });

  // v0.17 app-store-quality: accessibility-smoke slice 3.2
  // — TabBar keyboard navigation (arrow keys / Home / End)
  // for `role="tablist"` compliance. The handler lives on
  // each `<button role="tab">`; arrow keys select + focus
  // the adjacent tab without needing a separate
  // activation step (the automatic-activation pattern
  // from WAI-ARIA).

  it("navigates to the next tab with ArrowRight", () => {
    const first: EditorTab = {
      contents: "a",
      encoding: "utf-8",
      error: null,
      externalFingerprint: null,
      fingerprint: "fp",
      ignoredExternalFingerprint: null,
      id: "/workspace/a.md",
      sessionId: "session:a",
      large_file_warning: false,
      lastSavedContents: "a",
      lastSavedEncoding: "utf-8",
      lastSavedLineEnding: "lf",
      line_ending: "lf",
      modified_ms: null,
      name: "a.md",
      path: "/workspace/a.md",
      saveStatus: "idle",
      size: 1,
    };
    const second: EditorTab = {
      ...first,
      contents: "b",
      id: "/workspace/b.md",
      sessionId: "session:b",
      lastSavedContents: "b",
      name: "b.md",
      path: "/workspace/b.md",
    };
    const onSelectTab = vi.fn();

    renderTopChrome({
      activeTabId: first.id,
      tabs: [first, second],
      onSelectTab,
    });

    const firstButton = screen.getByRole("tab", { name: /a\.md/ });
    firstButton.focus();
    fireEvent.keyDown(firstButton, { key: "ArrowRight" });

    // ArrowRight on the first tab must call onSelectTab
    // with the second tab's id (the actual selection is
    // owned by the controller, but we assert the callback
    // is wired correctly).
    expect(onSelectTab).toHaveBeenCalledWith(second.id);
  });

  it("navigates to the previous tab with ArrowLeft", () => {
    const first: EditorTab = {
      contents: "a",
      encoding: "utf-8",
      error: null,
      externalFingerprint: null,
      fingerprint: "fp",
      ignoredExternalFingerprint: null,
      id: "/workspace/a.md",
      sessionId: "session:a",
      large_file_warning: false,
      lastSavedContents: "a",
      lastSavedEncoding: "utf-8",
      lastSavedLineEnding: "lf",
      line_ending: "lf",
      modified_ms: null,
      name: "a.md",
      path: "/workspace/a.md",
      saveStatus: "idle",
      size: 1,
    };
    const second: EditorTab = { ...first, id: "/workspace/b.md", sessionId: "session:b", name: "b.md", path: "/workspace/b.md", contents: "b", lastSavedContents: "b" };
    const onSelectTab = vi.fn();

    renderTopChrome({
      activeTabId: second.id,
      tabs: [first, second],
      onSelectTab,
    });

    const secondButton = screen.getByRole("tab", { name: /b\.md/ });
    secondButton.focus();
    fireEvent.keyDown(secondButton, { key: "ArrowLeft" });

    expect(onSelectTab).toHaveBeenCalledWith(first.id);
  });

  it("jumps to the first tab with Home", () => {
    const tabs: EditorTab[] = [0, 1, 2].map((i) => ({
      contents: `${i}`,
      encoding: "utf-8" as const,
      error: null,
      externalFingerprint: null,
      fingerprint: "fp",
      ignoredExternalFingerprint: null,
      id: `/workspace/tab${i}.md`,
      sessionId: `session:tab${i}`,
      large_file_warning: false,
      lastSavedContents: `${i}`,
      lastSavedEncoding: "utf-8" as const,
      lastSavedLineEnding: "lf" as const,
      line_ending: "lf" as const,
      modified_ms: null,
      name: `tab${i}.md`,
      path: `/workspace/tab${i}.md`,
      saveStatus: "idle" as const,
      size: 1,
    }));
    const onSelectTab = vi.fn();

    renderTopChrome({
      activeTabId: tabs[2].id,
      tabs,
      onSelectTab,
    });

    const lastButton = screen.getByRole("tab", { name: /tab2/ });
    lastButton.focus();
    fireEvent.keyDown(lastButton, { key: "Home" });

    // Home from the last tab must jump directly to the
    // first tab, not step through every intermediate one.
    expect(onSelectTab).toHaveBeenCalledWith(tabs[0].id);
    expect(onSelectTab).toHaveBeenCalledTimes(1);
  });

  it("jumps to the last text tab with End (image tab excluded)", () => {
    const tabs: EditorTab[] = [0, 1, 2].map((i) => ({
      contents: `${i}`,
      encoding: "utf-8" as const,
      error: null,
      externalFingerprint: null,
      fingerprint: "fp",
      ignoredExternalFingerprint: null,
      id: `/workspace/tab${i}.md`,
      sessionId: `session:tab${i}`,
      large_file_warning: false,
      lastSavedContents: `${i}`,
      lastSavedEncoding: "utf-8" as const,
      lastSavedLineEnding: "lf" as const,
      line_ending: "lf" as const,
      modified_ms: null,
      name: `tab${i}.md`,
      path: `/workspace/tab${i}.md`,
      saveStatus: "idle" as const,
      size: 1,
    }));
    const onSelectTab = vi.fn();

    renderTopChrome({
      activeTabId: tabs[0].id,
      tabs,
      onSelectTab,
    });

    const firstButton = screen.getByRole("tab", { name: /tab0/ });
    firstButton.focus();
    fireEvent.keyDown(firstButton, { key: "End" });

    // End from the first tab must jump to the last text
    // tab (the image tab is a display-only companion slot
    // and is not a text-tab target for `onSelectTab`).
    expect(onSelectTab).toHaveBeenCalledWith(tabs[2].id);
    expect(onSelectTab).toHaveBeenCalledTimes(1);
  });

  it("does not wrap past the first tab with ArrowLeft", () => {
    const first: EditorTab = {
      contents: "a", encoding: "utf-8", error: null,
      externalFingerprint: null, fingerprint: "fp",
      ignoredExternalFingerprint: null,
      id: "/workspace/a.md", sessionId: "session:a", large_file_warning: false,
      lastSavedContents: "a", lastSavedEncoding: "utf-8",
      lastSavedLineEnding: "lf", line_ending: "lf",
      modified_ms: null, name: "a.md",
      path: "/workspace/a.md", saveStatus: "idle", size: 1,
    };
    const second: EditorTab = {
      ...first, id: "/workspace/b.md", name: "b.md",
      path: "/workspace/b.md", contents: "b", lastSavedContents: "b",
    };
    const onSelectTab = vi.fn();

    renderTopChrome({
      activeTabId: first.id,
      tabs: [first, second],
      onSelectTab,
    });

    const firstButton = screen.getByRole("tab", { name: /a\.md/ });
    firstButton.focus();
    fireEvent.keyDown(firstButton, { key: "ArrowLeft" });

    // WAI-ARIA does not mandate wrapping. ArrowLeft on the
    // first tab must be a no-op — no selection callback
    // must fire.
    expect(onSelectTab).not.toHaveBeenCalled();
  });

  it("does not wrap past the last text tab with ArrowRight", () => {
    const first: EditorTab = {
      contents: "a", encoding: "utf-8", error: null,
      externalFingerprint: null, fingerprint: "fp",
      ignoredExternalFingerprint: null,
      id: "/workspace/a.md", sessionId: "session:a", large_file_warning: false,
      lastSavedContents: "a", lastSavedEncoding: "utf-8",
      lastSavedLineEnding: "lf", line_ending: "lf",
      modified_ms: null, name: "a.md",
      path: "/workspace/a.md", saveStatus: "idle", size: 1,
    };
    const second: EditorTab = {
      ...first, id: "/workspace/b.md", name: "b.md",
      path: "/workspace/b.md", contents: "b", lastSavedContents: "b",
    };
    const onSelectTab = vi.fn();

    renderTopChrome({
      activeTabId: second.id,
      tabs: [first, second],
      onSelectTab,
    });

    const secondButton = screen.getByRole("tab", { name: /b\.md/ });
    secondButton.focus();
    fireEvent.keyDown(secondButton, { key: "ArrowRight" });

    // ArrowRight on the last text tab is a no-op. A future
    // image tab might live to the right, but without one
    // the key must not cycle back to the first tab.
    expect(onSelectTab).not.toHaveBeenCalled();
  });

  // v0.17 slice 3.3 — image tab keyboard nav. The image
  // preview tab shares the `role="tablist"` with text tabs
  // and must be reachable via arrow keys. Navigating to
  // the image tab focuses it (so the user can close it)
  // but does not call `onSelectTab` (the image tab is a
  // display-only companion slot, not a text document).

  it("navigates from the last text tab to the image tab with ArrowRight", () => {
    vi.useFakeTimers();
    try {
      const textTab: EditorTab = {
        contents: "a", encoding: "utf-8", error: null,
        externalFingerprint: null, fingerprint: "fp",
        ignoredExternalFingerprint: null,
        id: "/workspace/a.md", sessionId: "session:a", large_file_warning: false,
        lastSavedContents: "a", lastSavedEncoding: "utf-8",
        lastSavedLineEnding: "lf", line_ending: "lf",
        modified_ms: null, name: "a.md",
        path: "/workspace/a.md", saveStatus: "idle", size: 1,
      };
      const onSelectTab = vi.fn();

      renderTopChrome({
        activeTabId: textTab.id,
        tabs: [textTab],
        onSelectTab,
        selectedImage: {
          name: "photo.png",
          path: "/workspace/photo.png",
          size: 128,
          url: "data:image/png;base64,photo",
        },
      });

      const textButton = screen.getByRole("tab", { name: /a\.md/ });
      textButton.focus();
      fireEvent.keyDown(textButton, { key: "ArrowRight" });

      vi.advanceTimersByTime(20);

      expect(onSelectTab).not.toHaveBeenCalled();
      const imageButton = screen.getByRole("tab", { name: /photo/ });
      expect(document.activeElement).toBe(imageButton);
    } finally {
      vi.useRealTimers();
    }
  });

  it("navigates from the image tab back to the last text tab with ArrowLeft", () => {
    vi.useFakeTimers();
    try {
      const textTab: EditorTab = {
        contents: "a", encoding: "utf-8", error: null,
        externalFingerprint: null, fingerprint: "fp",
        ignoredExternalFingerprint: null,
        id: "/workspace/a.md", sessionId: "session:a", large_file_warning: false,
        lastSavedContents: "a", lastSavedEncoding: "utf-8",
        lastSavedLineEnding: "lf", line_ending: "lf",
        modified_ms: null, name: "a.md",
        path: "/workspace/a.md", saveStatus: "idle", size: 1,
      };
      const onSelectTab = vi.fn();

      renderTopChrome({
        activeTabId: textTab.id,
        tabs: [textTab],
        onSelectTab,
        selectedImage: {
          name: "photo.png",
          path: "/workspace/photo.png",
          size: 128,
          url: "data:image/png;base64,photo",
        },
      });

      const imageButton = screen.getByRole("tab", { name: /photo/ });
      imageButton.focus();
      fireEvent.keyDown(imageButton, { key: "ArrowLeft" });

      vi.advanceTimersByTime(20);

      expect(onSelectTab).toHaveBeenCalledWith(textTab.id);
      expect(onSelectTab).toHaveBeenCalledTimes(1);

      const textButton = screen.getByRole("tab", { name: /a\.md/ });
      expect(document.activeElement).toBe(textButton);
    } finally {
      vi.useRealTimers();
    }
  });
});
