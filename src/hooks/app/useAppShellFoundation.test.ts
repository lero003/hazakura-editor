import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAppShellFoundation } from "./useAppShellFoundation";

// `useAppPreferences` calls `window.matchMedia` at mount to read
// the system theme. jsdom does not provide `matchMedia`, so stub
// the minimum surface it touches (`matches`). Unmocked listeners
// are fine for this shape test — the foundation does not change
// theme in response to system media.
if (typeof window !== "undefined" && !window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
    writable: true,
  });
}

describe("useAppShellFoundation", () => {
  it("returns the foundation surface fields from all 17 dep-free leaf hooks", () => {
    const { result } = renderHook(() => useAppShellFoundation());

    // chrome dialog state
    expect(result.current).toHaveProperty("pendingAppClose");
    expect(result.current).toHaveProperty("pendingCloseTabId");
    expect(result.current).toHaveProperty("preferencesDialogMode");
    // chrome view state
    expect(result.current).toHaveProperty("rightPaneMode");
    expect(result.current).toHaveProperty("sidePaneOpen");
    expect(result.current).toHaveProperty("reviewSurface");
    // chrome feedback
    expect(result.current).toHaveProperty("globalError");
    expect(result.current).toHaveProperty("status");
    // app preferences
    expect(result.current).toHaveProperty("menuLanguage");
    expect(result.current).toHaveProperty("editorSettings");
    expect(result.current).toHaveProperty("previewVisible");
    // editor tabs + selection
    expect(result.current).toHaveProperty("tabs");
    expect(result.current).toHaveProperty("activeTabId");
    expect(result.current).toHaveProperty("selectionInfo");
    // diff state
    expect(result.current).toHaveProperty("compareAnchor");
    expect(result.current).toHaveProperty("compareTarget");
    expect(result.current).toHaveProperty("compareView");
    expect(result.current).toHaveProperty("getCompareCaseByKey");
    // workspace shell + recents + drafts
    expect(result.current).toHaveProperty("workspaceRootPath");
    expect(result.current).toHaveProperty("workspaceTree");
    expect(result.current).toHaveProperty("recentFiles");
    expect(result.current).toHaveProperty("recentFolders");
    expect(result.current).toHaveProperty("pendingDrafts");
    // agent workbench preferences + runtime + output + ui gate
    expect(result.current).toHaveProperty("agentWorkbenchActive");
    expect(result.current).toHaveProperty("agentWorkbenchPreference");
    expect(result.current).toHaveProperty("agentWorkbenchProvider");
    expect(result.current).toHaveProperty("activeAgentSession");
    expect(result.current).toHaveProperty("agentSession");
    expect(result.current).toHaveProperty("agentOutput");
    expect(result.current).toHaveProperty("agentUiSuspendedRef");
    // review desk
    expect(result.current).toHaveProperty("reviewDeskMode");
    expect(result.current).toHaveProperty("candidateInputText");
    // side
    expect(result.current).toHaveProperty("quickOpenVisible");
    expect(result.current).toHaveProperty("workspaceContextMenu");
    // save affirmation (the only derived field, renamed)
    expect(result.current).toHaveProperty("saveAffirmation");
    expect(result.current).toHaveProperty("saveAffirmationKey");
  });
});
