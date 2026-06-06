import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useCommandPaletteController } from "./useCommandPaletteController";
import { getAppleAssistCopy, getLModeCopy } from "../../lib/locale";

afterEach(() => {
  vi.unstubAllEnvs();
});

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
          invokeAppleAssist: vi.fn(),
          openAgentWindow: vi.fn(),
          openAppleAssistWindow: vi.fn(),
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
        },
        activeTab: null,
        activeTabId: null,
        appleAssistAvailability: { kind: "unsupported" },
        appleAssistCopy: getAppleAssistCopy("en"),
        editorPaneRef: { current: null },
        lModeCopy: getLModeCopy("en"),
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
          invokeAppleAssist: vi.fn(),
          openAgentWindow: vi.fn(),
          openAppleAssistWindow: vi.fn(),
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
        },
        activeTab: null,
        activeTabId: null,
        appleAssistAvailability: { kind: "unsupported" },
        appleAssistCopy: getAppleAssistCopy("ja"),
        editorPaneRef: { current: null },
        lModeCopy: getLModeCopy("ja"),
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

    const commandIds = result.current.filteredCommands.map((command) => command.id);
    expect(commandIds).not.toContain("review.open");
    expect(commandIds).toContain("review.tabAgainstDisk");
  });

  it("hides Apple Local Assist commands when availability is not `available`", () => {
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
          invokeAppleAssist: vi.fn(),
          openAgentWindow: vi.fn(),
          openAppleAssistWindow: vi.fn(),
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
        },
        activeTab: null,
        activeTabId: null,
        appleAssistAvailability: { kind: "unsupported" },
        appleAssistCopy: getAppleAssistCopy("en"),
        editorPaneRef: { current: null },
        lModeCopy: getLModeCopy("en"),
        setStatus: vi.fn(),
        themePreference: "light",
        workspaceRootPath: null,
      }),
    );

    act(() => {
      result.current.openCommandPalette();
    });

    const summarize = result.current.filteredCommands.find(
      (command) => command.id === "appleAssist.summarize",
    );
    const rephrase = result.current.filteredCommands.find(
      (command) => command.id === "appleAssist.rephrase",
    );
    expect(summarize).toBeUndefined();
    expect(rephrase).toBeUndefined();
  });

  it("exposes Apple Local Assist commands when availability is `available`", () => {
    const invokeAppleAssist = vi.fn();
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
          invokeAppleAssist,
          openAgentWindow: vi.fn(),
          openAppleAssistWindow: vi.fn(),
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
        },
        activeTab: null,
        activeTabId: null,
        appleAssistAvailability: { kind: "available" },
        appleAssistCopy: getAppleAssistCopy("en"),
        editorPaneRef: {
          current: {
            getSelectionText: () => "hello",
          } as unknown as Parameters<
            typeof useCommandPaletteController
          >[0]["editorPaneRef"]["current"],
        },
        lModeCopy: getLModeCopy("en"),
        setStatus: vi.fn(),
        themePreference: "light",
        workspaceRootPath: null,
      }),
    );

    act(() => {
      result.current.openCommandPalette();
    });

    const summarize = result.current.filteredCommands.find(
      (command) => command.id === "appleAssist.summarize",
    );
    const rephrase = result.current.filteredCommands.find(
      (command) => command.id === "appleAssist.rephrase",
    );
    expect(summarize).toBeDefined();
    expect(summarize?.category).toBe("Apple Local Assist");
    expect(summarize?.label).toBe("Summarize selection");
    expect(rephrase).toBeDefined();
    expect(rephrase?.label).toBe("Rephrase selection");

    // Running the command should pass the editor's current
    // selection text to `invokeAppleAssist`.
    act(() => {
      summarize?.run();
    });
    expect(invokeAppleAssist).toHaveBeenCalledWith("summarize", "hello");
  });

  it("hides Agent commands in the App Store distribution lane", () => {
    vi.stubEnv("VITE_HAZAKURA_DISTRIBUTION_LANE", "app-store");

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
          invokeAppleAssist: vi.fn(),
          openAgentWindow: vi.fn(),
          openAppleAssistWindow: vi.fn(),
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
        },
        activeTab: null,
        activeTabId: null,
        appleAssistAvailability: { kind: "available" },
        appleAssistCopy: getAppleAssistCopy("en"),
        editorPaneRef: { current: null },
        lModeCopy: getLModeCopy("en"),
        setStatus: vi.fn(),
        themePreference: "light",
        workspaceRootPath: null,
      }),
    );

    act(() => {
      result.current.openCommandPalette();
    });

    expect(
      result.current.filteredCommands.find((command) => command.id === "agent.open"),
    ).toBeUndefined();
    expect(
      result.current.filteredCommands.find(
        (command) => command.id === "agent.sendSelection",
      ),
    ).toBeUndefined();
    const appleAssistWindowCommand = result.current.filteredCommands.find(
      (command) => command.id === "apple-assist.openWindow",
    );
    expect(appleAssistWindowCommand?.label).toBe(
      "Open Apple Local Assist Window",
    );
    const assistSettingsCommand = result.current.filteredCommands.find(
      (command) => command.id === "agent.preferences",
    );
    expect(assistSettingsCommand?.label).toBe("Assist Settings…");
  });
});
