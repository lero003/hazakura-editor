import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useCommandPaletteController } from "./useCommandPaletteController";
import type { GlobalSearchRow } from "../globalSearch/useGlobalSearch";
import type { EditorPaneHandle } from "../../components/editor/EditorPane";
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
        appleLocalAssistAllowed: true,
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
    // global search (12)
    expect(result.current).toHaveProperty("closeGlobalSearch");
    expect(result.current).toHaveProperty("globalSearchActiveIndex");
    expect(result.current).toHaveProperty("globalSearchError");
    expect(result.current).toHaveProperty("globalSearchQuery");
    expect(result.current).toHaveProperty("globalSearchRows");
    expect(result.current).toHaveProperty("globalSearchSummary");
    expect(result.current).toHaveProperty("globalSearching");
    expect(result.current).toHaveProperty("globalSearchVisible");
    expect(result.current).toHaveProperty("openGlobalSearch");
    expect(result.current).toHaveProperty("runGlobalSearchMatch");
    expect(result.current).toHaveProperty("setGlobalSearchActiveIndex");
    expect(result.current).toHaveProperty("setGlobalSearchQuery");
  });

  it("opens the selected global search match and jumps to its line", async () => {
    vi.useFakeTimers();
    const openWorkspaceFile = vi.fn(async () => {});
    const goToLine = vi.fn();
    const editorPane = { goToLine } as unknown as EditorPaneHandle;
    const setStatus = vi.fn();
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
          openWorkspaceFile,
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
        appleLocalAssistAllowed: true,
        appleAssistCopy: getAppleAssistCopy("en"),
        editorPaneRef: { current: editorPane },
        lModeCopy: getLModeCopy("en"),
        setStatus,
        themePreference: "light",
        workspaceRootPath: "/workspace",
      }),
    );
    const row: GlobalSearchRow = {
      fileIndex: 0,
      matchIndex: 0,
      file: {
        matches: [{ column: 4, line: 12, text: "hello match" }],
        path: "/workspace/docs/note.md",
        relativePath: "docs/note.md",
        truncated: false,
      },
      match: { column: 4, line: 12, text: "hello match" },
    };
    const surface = result.current as typeof result.current & {
      runGlobalSearchMatch: (match: GlobalSearchRow) => void;
    };

    act(() => {
      surface.runGlobalSearchMatch(row);
    });
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      vi.runAllTimers();
    });

    expect(openWorkspaceFile).toHaveBeenCalledWith("/workspace/docs/note.md");
    expect(goToLine).toHaveBeenCalledWith(12);
    expect(setStatus).toHaveBeenCalledWith("Opened docs/note.md:12");
    vi.useRealTimers();
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
        appleLocalAssistAllowed: true,
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
        appleLocalAssistAllowed: true,
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
        appleLocalAssistAllowed: true,
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

  it("hides assist commands in the App Store distribution lane", () => {
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
        appleLocalAssistAllowed: false,
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

    const commandIds = result.current.filteredCommands.map(
      (command) => command.id,
    );
    const commandLabels = result.current.filteredCommands.map(
      (command) => command.label,
    );
    expect(commandIds.some((id) => id.startsWith("agent."))).toBe(false);
    expect(commandIds.some((id) => id.startsWith("appleAssist."))).toBe(false);
    expect(
      result.current.filteredCommands.find(
        (command) => command.id === "apple-assist.openWindow",
      ),
    ).toBeUndefined();
    expect(
      result.current.filteredCommands.find(
        (command) => command.id === "agent.preferences",
      ),
    ).toBeUndefined();
    expect(
      result.current.filteredCommands.find((command) =>
        command.label.includes("Assist Settings"),
      ),
    ).toBeUndefined();
    expect(commandLabels.join("\n")).not.toMatch(
      /Agent|Apple Local Assist|CLI Agent/,
    );
  });

  it("exposes a Local Data Disclosure command in the Developer / GitHub lane", () => {
    // The v0.16 app-store-quality: privacy-local-data slice
    // adds a `help.localDataDisclosure` command that opens
    // the Local Data Disclosure preferences pane. The
    // Developer / GitHub lane renders it as a Help-category
    // command that fires `setPreferencesDialogMode("privacy")`.
    vi.stubEnv("VITE_HAZAKURA_DISTRIBUTION_LANE", "developer");
    const setPreferencesDialogMode = vi.fn();
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
          setPreferencesDialogMode,
          setPreviewVisible: vi.fn(),
          toggleDiffPane: vi.fn(),
          toggleLMode: vi.fn(),
          toggleOutlinePane: vi.fn(),
          toggleQuickOpen: vi.fn(),
        },
        activeTab: null,
        activeTabId: null,
        appleAssistAvailability: { kind: "available" },
        appleLocalAssistAllowed: true,
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

    const privacy = result.current.filteredCommands.find(
      (command) => command.id === "help.localDataDisclosure",
    );
    expect(privacy?.category).toBe("Help");
    expect(privacy?.label).toBe("Local Data Disclosure…");
    expect(
      result.current.filteredCommands.find(
        (command) => command.id === "help.privacyPolicy",
      )?.label,
    ).toBe("Privacy Policy…");
    expect(
      result.current.filteredCommands.find(
        (command) => command.id === "help.openSourceAcknowledgements",
      )?.label,
    ).toBe("Open Source Acknowledgements…");
    expect(
      result.current.filteredCommands.find(
        (command) => command.id === "help.about",
      )?.label,
    ).toBe("About Hazakura Editor…");

    act(() => {
      privacy?.run();
    });
    expect(setPreferencesDialogMode).toHaveBeenCalledWith("privacy");
    vi.unstubAllEnvs();
  });

  it("exposes a Local Data Disclosure command in the App Store lane", () => {
    // The App Store lane must keep the Privacy disclosure
    // route reachable so App Review can find it without
    // enabling Agent Workbench. The env stub is applied
    // BEFORE `renderHook` so the hook reads the correct
    // lane value at construction time.
    vi.stubEnv("VITE_HAZAKURA_DISTRIBUTION_LANE", "app-store");
    const setPreferencesDialogMode = vi.fn();
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
          setPreferencesDialogMode,
          setPreviewVisible: vi.fn(),
          toggleDiffPane: vi.fn(),
          toggleLMode: vi.fn(),
          toggleOutlinePane: vi.fn(),
          toggleQuickOpen: vi.fn(),
        },
        activeTab: null,
        activeTabId: null,
        appleAssistAvailability: { kind: "available" },
        appleLocalAssistAllowed: true,
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

    const privacy = result.current.filteredCommands.find(
      (command) => command.id === "help.localDataDisclosure",
    );
    expect(privacy?.label).toBe("Local Data Disclosure…");
    const privacyPolicy = result.current.filteredCommands.find(
      (command) => command.id === "help.privacyPolicy",
    );
    const openSource = result.current.filteredCommands.find(
      (command) => command.id === "help.openSourceAcknowledgements",
    );
    const about = result.current.filteredCommands.find(
      (command) => command.id === "help.about",
    );
    expect(privacyPolicy?.category).toBe("Help");
    expect(openSource?.category).toBe("Help");
    expect(about?.category).toBe("Help");

    act(() => {
      privacy?.run();
    });
    expect(setPreferencesDialogMode).toHaveBeenCalledWith("privacy");
    act(() => {
      privacyPolicy?.run();
    });
    expect(setPreferencesDialogMode).toHaveBeenCalledWith("privacy-policy");
    act(() => {
      openSource?.run();
    });
    expect(setPreferencesDialogMode).toHaveBeenCalledWith(
      "open-source-acknowledgements",
    );
    act(() => {
      about?.run();
    });
    expect(setPreferencesDialogMode).toHaveBeenCalledWith("about");
    vi.unstubAllEnvs();
  });
});
