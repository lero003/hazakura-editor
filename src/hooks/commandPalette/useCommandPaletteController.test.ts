import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useCommandPaletteController } from "./useCommandPaletteController";

describe("useCommandPaletteController", () => {
  it("returns the command palette + global search surface", () => {
    const { result } = renderHook(() =>
      useCommandPaletteController({
        actions: {
          applyActiveMarkdownFormat: vi.fn(),
          createNewFile: vi.fn(),
          exportHtml: vi.fn(),
          exportPdf: vi.fn(),
          focusAdjacentTab: vi.fn(),
          handleSendSelectionToAgent: vi.fn(),
          insertTable: vi.fn(),
          openAgentWindow: vi.fn(),
          openFile: vi.fn(),
          openWorkspace: vi.fn(),
          openWorkspaceFile: vi.fn(),
          requestCloseTab: vi.fn(),
          requestRestoreFromBackup: vi.fn(),
          requestReviewTabAgainstDisk: vi.fn(),
          requestWindowClose: vi.fn(),
          saveActiveTab: vi.fn(),
          saveActiveTabAs: vi.fn(),
          setEditorSettings: vi.fn(),
          setFindVisible: vi.fn(),
          setPreferencesDialogMode: vi.fn(),
          setPreviewVisible: vi.fn(),
          toggleDiffPane: vi.fn(),
          toggleLMode: vi.fn(),
          toggleOutlinePane: vi.fn(),
          toggleQuickOpen: vi.fn(),
          toggleReviewDesk: vi.fn(),
        },
        activeTab: null,
        activeTabId: null,
        editorPaneRef: { current: null },
        lModeCopy: {
          preferenceLabel: "L Mode",
          preferenceHint: "Hide the workspace chrome for focused reading.",
          paletteCommand: "Toggle L Mode",
          exitPillLabel: "Exit L Mode",
          exitPillTitle: "Close L Mode",
        },
        setStatus: vi.fn(),
        themePreference: "light",
        workspaceRootPath: null,
      }),
    );

    // command palette (9)
    expect(result.current).toHaveProperty("closeCommandPalette");
    expect(result.current).toHaveProperty("commandPaletteActiveIndex");
    expect(result.current).toHaveProperty("commandPaletteQuery");
    expect(result.current).toHaveProperty("commandPaletteVisible");
    expect(result.current).toHaveProperty("filteredCommands");
    expect(result.current).toHaveProperty("openCommandPalette");
    expect(result.current).toHaveProperty("runCommand");
    expect(result.current).toHaveProperty("setCommandPaletteActiveIndex");
    expect(result.current).toHaveProperty("setCommandPaletteQuery");
    // global search (11)
    expect(result.current).toHaveProperty("closeGlobalSearch");
    expect(result.current).toHaveProperty("globalSearchActiveIndex");
    expect(result.current).toHaveProperty("globalSearchError");
    expect(result.current).toHaveProperty("globalSearchQuery");
    expect(result.current).toHaveProperty("globalSearchRows");
    expect(result.current).toHaveProperty("globalSearchSummary");
    expect(result.current).toHaveProperty("globalSearching");
    expect(result.current).toHaveProperty("globalSearchVisible");
    expect(result.current).toHaveProperty("openGlobalSearch");
    expect(result.current).toHaveProperty("setGlobalSearchActiveIndex");
    expect(result.current).toHaveProperty("setGlobalSearchQuery");
  });

  it("exposes the L Mode toggle command in the View category", () => {
    // filteredCommands is empty while the palette is closed, so
    // the test must open the palette first to read the command
    // list. The label is the localized `lModeCopy.paletteCommand`
    // string — the test uses the kana variant to assert the
    // locale plumbs through to the command.
    const { result } = renderHook(() =>
      useCommandPaletteController({
        actions: {
          applyActiveMarkdownFormat: vi.fn(),
          createNewFile: vi.fn(),
          exportHtml: vi.fn(),
          exportPdf: vi.fn(),
          focusAdjacentTab: vi.fn(),
          handleSendSelectionToAgent: vi.fn(),
          insertTable: vi.fn(),
          openAgentWindow: vi.fn(),
          openFile: vi.fn(),
          openWorkspace: vi.fn(),
          openWorkspaceFile: vi.fn(),
          requestCloseTab: vi.fn(),
          requestRestoreFromBackup: vi.fn(),
          requestReviewTabAgainstDisk: vi.fn(),
          requestWindowClose: vi.fn(),
          saveActiveTab: vi.fn(),
          saveActiveTabAs: vi.fn(),
          setEditorSettings: vi.fn(),
          setFindVisible: vi.fn(),
          setPreferencesDialogMode: vi.fn(),
          setPreviewVisible: vi.fn(),
          toggleDiffPane: vi.fn(),
          toggleLMode: vi.fn(),
          toggleOutlinePane: vi.fn(),
          toggleQuickOpen: vi.fn(),
          toggleReviewDesk: vi.fn(),
        },
        activeTab: null,
        activeTabId: null,
        editorPaneRef: { current: null },
        lModeCopy: {
          preferenceLabel: "えるモード",
          preferenceHint: "周辺UIを隠して本文に集中します。",
          paletteCommand: "えるモード切替",
          exitPillLabel: "えるモード終了",
          exitPillTitle: "えるモードを閉じる",
        },
        setStatus: vi.fn(),
        themePreference: "light",
        workspaceRootPath: null,
      }),
    );

    act(() => {
      result.current.openCommandPalette();
    });

    const lModeCommand = result.current.filteredCommands.find(
      (command) => command.id === "view.toggleLMode",
    );
    expect(lModeCommand).toBeDefined();
    expect(lModeCommand?.category).toBe("View");
    expect(lModeCommand?.label).toBe("えるモード切替");
    expect(lModeCommand?.shortcut).toBe("⇧⌘L");
  });
});
