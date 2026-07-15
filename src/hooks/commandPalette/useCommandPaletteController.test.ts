import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useCommandPaletteController } from "./useCommandPaletteController";
import type { GlobalSearchRow } from "../globalSearch/useGlobalSearch";
import type { EditorPaneHandle } from "../../components/editor/EditorPane";
import { getLModeCopy } from "../../lib/locale";
import { useEditorCommands } from "../editor/useEditorCommands";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("useCommandPaletteController", () => {
  it("returns the command palette + global search surface", () => {
    const openOkfReview = vi.fn();
    const createOkfScaffold = vi.fn();
    const { result } = renderHook(() =>
      useCommandPaletteController({
        actions: {
          applyActiveMarkdownFormat: vi.fn(),
          createNewFile: vi.fn(),
          importSourceAsMarkdownDraft: vi.fn(),
          openReferenceFile: vi.fn(),
          exportEpubBeta: vi.fn(),
          exportHtml: vi.fn(),
          exportPdf: vi.fn(),
          focusAdjacentTab: vi.fn(),
          handleSendSelectionToAgent: vi.fn(),
          insertTable: vi.fn(),
          openAgentWindow: vi.fn(),
          openAppleAssistWindow: vi.fn(),
          openFile: vi.fn(),
          openWorkspace: vi.fn(),
          openOkfReview,
          createOkfScaffold,
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
        appleLocalAssistAllowed: true,
        assistSurfaceActive: "none",
        editorPaneRef: { current: null },
        lModeCopy: getLModeCopy("en"),
        menuLanguage: "en",
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

    act(() => {
      result.current.openCommandPalette();
    });
    const okfCommand = result.current.filteredCommands.find(
      (command) => command.id === "review.okfDraftCompatibility",
    );
    expect(okfCommand?.label).toBe("Review knowledge folder (OKF)");
    act(() => {
      okfCommand?.run();
    });
    expect(openOkfReview).toHaveBeenCalledTimes(1);
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
          importSourceAsMarkdownDraft: vi.fn(),
          openReferenceFile: vi.fn(),
          exportEpubBeta: vi.fn(),
          exportHtml: vi.fn(),
          exportPdf: vi.fn(),
          focusAdjacentTab: vi.fn(),
          handleSendSelectionToAgent: vi.fn(),
          insertTable: vi.fn(),
          openAgentWindow: vi.fn(),
          openAppleAssistWindow: vi.fn(),
          openFile: vi.fn(),
          openWorkspace: vi.fn(),
          openOkfReview: vi.fn(),
          createOkfScaffold: vi.fn(),
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
        appleLocalAssistAllowed: true,
        assistSurfaceActive: "none",
        editorPaneRef: { current: editorPane },
        lModeCopy: getLModeCopy("en"),
        menuLanguage: "en",
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

  it("exposes the L Mode toggle command in the purpose-led View category", () => {
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
          importSourceAsMarkdownDraft: vi.fn(),
          openReferenceFile: vi.fn(),
          exportEpubBeta: vi.fn(),
          exportHtml: vi.fn(),
          exportPdf: vi.fn(),
          focusAdjacentTab: vi.fn(),
          handleSendSelectionToAgent: vi.fn(),
          insertTable: vi.fn(),
          openAgentWindow: vi.fn(),
          openAppleAssistWindow: vi.fn(),
          openFile: vi.fn(),
          openWorkspace: vi.fn(),
          openOkfReview: vi.fn(),
          createOkfScaffold: vi.fn(),
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
        appleLocalAssistAllowed: true,
        assistSurfaceActive: "none",
        editorPaneRef: { current: null },
        lModeCopy: getLModeCopy("ja"),
        menuLanguage: "ja",
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
    expect(lModeCommand?.category).toBe("読む");
    expect(lModeCommand?.label).toBe("えるモード切替");
    expect(lModeCommand?.shortcut).toBe("⇧⌘L");

    const commandIds = result.current.filteredCommands.map((command) => command.id);
    expect(commandIds).not.toContain("review.open");
    expect(commandIds).toContain("review.tabAgainstDisk");
  });

  it("runs the EPUB export command from the command palette", () => {
    const exportEpubBeta = vi.fn(async () => {});
    const { result } = renderHook(() =>
      useCommandPaletteController({
        actions: {
          applyActiveMarkdownFormat: vi.fn(),
          createNewFile: vi.fn(),
          importSourceAsMarkdownDraft: vi.fn(),
          openReferenceFile: vi.fn(),
          exportEpubBeta,
          exportHtml: vi.fn(),
          exportPdf: vi.fn(),
          focusAdjacentTab: vi.fn(),
          handleSendSelectionToAgent: vi.fn(),
          insertTable: vi.fn(),
          openAgentWindow: vi.fn(),
          openAppleAssistWindow: vi.fn(),
          openFile: vi.fn(),
          openWorkspace: vi.fn(),
          openOkfReview: vi.fn(),
          createOkfScaffold: vi.fn(),
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
        appleLocalAssistAllowed: true,
        assistSurfaceActive: "none",
        editorPaneRef: { current: null },
        lModeCopy: getLModeCopy("en"),
        menuLanguage: "en",
        setStatus: vi.fn(),
        themePreference: "light",
        workspaceRootPath: null,
      }),
    );

    act(() => {
      result.current.openCommandPalette();
      result.current.setCommandPaletteQuery("epub");
    });

    const command = result.current.filteredCommands.find(
      (item) => item.id === "file.exportEpubBeta",
    );
    expect(command?.label).toBe("Export EPUB…");

    act(() => {
      command?.run();
    });

    expect(exportEpubBeta).toHaveBeenCalledTimes(1);
  });

  it("does not expose retired selected-text Hazakura Local Assist commands", () => {
    const { result } = renderHook(() =>
      useCommandPaletteController({
        actions: {
          applyActiveMarkdownFormat: vi.fn(),
          createNewFile: vi.fn(),
          importSourceAsMarkdownDraft: vi.fn(),
          openReferenceFile: vi.fn(),
          exportEpubBeta: vi.fn(),
          exportHtml: vi.fn(),
          exportPdf: vi.fn(),
          focusAdjacentTab: vi.fn(),
          handleSendSelectionToAgent: vi.fn(),
          insertTable: vi.fn(),
          openAgentWindow: vi.fn(),
          openAppleAssistWindow: vi.fn(),
          openFile: vi.fn(),
          openWorkspace: vi.fn(),
          openOkfReview: vi.fn(),
          createOkfScaffold: vi.fn(),
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
        appleLocalAssistAllowed: true,
        assistSurfaceActive: "none",
        editorPaneRef: { current: null },
        lModeCopy: getLModeCopy("en"),
        menuLanguage: "en",
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

  it("exposes the Hazakura Local Assist window command when active", () => {
    const openAppleAssistWindow = vi.fn();
    const { result } = renderHook(() =>
      useCommandPaletteController({
        actions: {
          applyActiveMarkdownFormat: vi.fn(),
          createNewFile: vi.fn(),
          importSourceAsMarkdownDraft: vi.fn(),
          openReferenceFile: vi.fn(),
          exportEpubBeta: vi.fn(),
          exportHtml: vi.fn(),
          exportPdf: vi.fn(),
          focusAdjacentTab: vi.fn(),
          handleSendSelectionToAgent: vi.fn(),
          insertTable: vi.fn(),
          openAgentWindow: vi.fn(),
          openAppleAssistWindow,
          openFile: vi.fn(),
          openWorkspace: vi.fn(),
          openOkfReview: vi.fn(),
          createOkfScaffold: vi.fn(),
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
        appleLocalAssistAllowed: true,
        assistSurfaceActive: "apple-local",
        editorPaneRef: {
          current: {
            getSelectionText: () => "hello",
          } as unknown as Parameters<
            typeof useCommandPaletteController
          >[0]["editorPaneRef"]["current"],
        },
        lModeCopy: getLModeCopy("en"),
        menuLanguage: "en",
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
    const openWindow = result.current.filteredCommands.find(
      (command) => command.id === "apple-assist.openWindow",
    );

    expect(summarize).toBeUndefined();
    expect(rephrase).toBeUndefined();
    expect(openWindow?.category).toBe("Writing Companion");
    expect(openWindow?.label).toBe("Open Hazakura Local Assist Window");
    act(() => {
      openWindow?.run();
    });
    expect(openAppleAssistWindow).toHaveBeenCalledWith("light");
  });

  it("hides the Hazakura Local Assist window command while the surface is off", () => {
    const openAppleAssistWindow = vi.fn();
    const { result } = renderHook(() =>
      useCommandPaletteController({
        actions: {
          applyActiveMarkdownFormat: vi.fn(),
          createNewFile: vi.fn(),
          importSourceAsMarkdownDraft: vi.fn(),
          openReferenceFile: vi.fn(),
          exportEpubBeta: vi.fn(),
          exportHtml: vi.fn(),
          exportPdf: vi.fn(),
          focusAdjacentTab: vi.fn(),
          handleSendSelectionToAgent: vi.fn(),
          insertTable: vi.fn(),
          openAgentWindow: vi.fn(),
          openAppleAssistWindow,
          openFile: vi.fn(),
          openWorkspace: vi.fn(),
          openOkfReview: vi.fn(),
          createOkfScaffold: vi.fn(),
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
        appleLocalAssistAllowed: true,
        assistSurfaceActive: "none",
        editorPaneRef: { current: null },
        lModeCopy: getLModeCopy("en"),
        menuLanguage: "en",
        setStatus: vi.fn(),
        themePreference: "light",
        workspaceRootPath: null,
      }),
    );

    act(() => {
      result.current.openCommandPalette();
    });

    expect(
      result.current.filteredCommands.find(
        (command) => command.id === "apple-assist.openWindow",
      ),
    ).toBeUndefined();
  });

  it("hides external Agent commands but exposes Hazakura Local Assist when active in the App Store distribution lane", () => {
    vi.stubEnv("VITE_HAZAKURA_DISTRIBUTION_LANE", "app-store");
    const openAppleAssistWindow = vi.fn();
    const setPreferencesDialogMode = vi.fn();

    const { result } = renderHook(() =>
      useCommandPaletteController({
        actions: {
          applyActiveMarkdownFormat: vi.fn(),
          createNewFile: vi.fn(),
          importSourceAsMarkdownDraft: vi.fn(),
          openReferenceFile: vi.fn(),
          exportEpubBeta: vi.fn(),
          exportHtml: vi.fn(),
          exportPdf: vi.fn(),
          focusAdjacentTab: vi.fn(),
          handleSendSelectionToAgent: vi.fn(),
          insertTable: vi.fn(),
          openAgentWindow: vi.fn(),
          openAppleAssistWindow,
          openFile: vi.fn(),
          openWorkspace: vi.fn(),
          openOkfReview: vi.fn(),
          createOkfScaffold: vi.fn(),
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
        appleLocalAssistAllowed: true,
        assistSurfaceActive: "apple-local",
        editorPaneRef: { current: null },
        lModeCopy: getLModeCopy("en"),
        menuLanguage: "en",
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
    expect(commandLabels.join("\n")).not.toMatch(/Agent|CLI Agent/);

    const openWindow = result.current.filteredCommands.find(
      (command) => command.id === "apple-assist.openWindow",
    );
    expect(openWindow?.label).toBe("Open Hazakura Local Assist Window");
    act(() => {
      openWindow?.run();
    });
    expect(openAppleAssistWindow).toHaveBeenCalledWith("light");

    const assistSettings = result.current.filteredCommands.find(
      (command) => command.id === "assist.preferences",
    );
    expect(assistSettings?.label).toBe("Assist Settings…");
    act(() => {
      assistSettings?.run();
    });
    expect(setPreferencesDialogMode).toHaveBeenCalledWith("agent");
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
          importSourceAsMarkdownDraft: vi.fn(),
          openReferenceFile: vi.fn(),
          exportEpubBeta: vi.fn(),
          exportHtml: vi.fn(),
          exportPdf: vi.fn(),
          focusAdjacentTab: vi.fn(),
          handleSendSelectionToAgent: vi.fn(),
          insertTable: vi.fn(),
          openAgentWindow: vi.fn(),
          openAppleAssistWindow: vi.fn(),
          openFile: vi.fn(),
          openWorkspace: vi.fn(),
          openOkfReview: vi.fn(),
          createOkfScaffold: vi.fn(),
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
        appleLocalAssistAllowed: true,
        assistSurfaceActive: "none",
        editorPaneRef: { current: null },
        lModeCopy: getLModeCopy("en"),
        menuLanguage: "en",
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
          importSourceAsMarkdownDraft: vi.fn(),
          openReferenceFile: vi.fn(),
          exportEpubBeta: vi.fn(),
          exportHtml: vi.fn(),
          exportPdf: vi.fn(),
          focusAdjacentTab: vi.fn(),
          handleSendSelectionToAgent: vi.fn(),
          insertTable: vi.fn(),
          openAgentWindow: vi.fn(),
          openAppleAssistWindow: vi.fn(),
          openFile: vi.fn(),
          openWorkspace: vi.fn(),
          openOkfReview: vi.fn(),
          createOkfScaffold: vi.fn(),
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
        appleLocalAssistAllowed: true,
        assistSurfaceActive: "none",
        editorPaneRef: { current: null },
        lModeCopy: getLModeCopy("en"),
        menuLanguage: "en",
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

  it("aligns the palette Markdown commands with the slash menu safe actions", () => {
    // v1.2 command discovery: the command palette (Cmd+Shift+P) and
    // the right-click slash menu must expose the same set of safe
    // Markdown actions. The palette previously carried only
    // bold / italic / inline-code / link / table; this asserts the
    // headline/list/quote/code-block/divider/image/strikethrough/date/time
    // actions are now reachable from the palette too.
    const insertText = vi.fn();
    const insertTable = vi.fn();
    const editorPaneRef = {
      current: {
        insertTable,
        insertText,
      } as unknown as EditorPaneHandle,
    };
    const { result } = renderHook(() => {
      const { slashCommands } = useEditorCommands({
        activeDraft: null,
        activeTab: null,
        activeTabId: null,
        agentWorkbenchActive: false,
        editorPaneRef,
        handleSendSelectionToAgent: vi.fn(),
        menuLanguage: "kana",
        requestReviewDraftAgainstDisk: vi.fn(),
        requestReviewTabAgainstDisk: vi.fn(),
        setStatus: vi.fn(),
        setTabs: vi.fn(),
      });

      const controller = useCommandPaletteController({
        actions: {
          applyActiveMarkdownFormat: vi.fn(),
          createNewFile: vi.fn(),
          importSourceAsMarkdownDraft: vi.fn(),
          openReferenceFile: vi.fn(),
          exportEpubBeta: vi.fn(),
          exportHtml: vi.fn(),
          exportPdf: vi.fn(),
          focusAdjacentTab: vi.fn(),
          handleSendSelectionToAgent: vi.fn(),
          insertTable,
          openAgentWindow: vi.fn(),
          openAppleAssistWindow: vi.fn(),
          openFile: vi.fn(),
          openWorkspace: vi.fn(),
          openOkfReview: vi.fn(),
          createOkfScaffold: vi.fn(),
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
        appleLocalAssistAllowed: false,
        assistSurfaceActive: "none",
        editorPaneRef,
        lModeCopy: getLModeCopy("en"),
        menuLanguage: "en",
        setStatus: vi.fn(),
        slashCommands,
        themePreference: "light",
        workspaceRootPath: null,
      });
      return { ...controller, slashCommands };
    });

    act(() => {
      result.current.openCommandPalette();
    });

    const expectedIdBySlashId: Record<string, string> = {
      "heading-1": "insert.heading1",
      "heading-2": "insert.heading2",
      "heading-3": "insert.heading3",
      "bullet-list": "insert.bulletList",
      "numbered-list": "insert.numberedList",
      "task-list": "insert.taskList",
      quote: "insert.quote",
      "code-block": "insert.codeBlock",
      divider: "insert.divider",
      table: "edit.insertTable",
      link: "edit.link",
      image: "edit.image",
      bold: "edit.bold",
      italic: "edit.italic",
      "inline-code": "edit.code",
      strikethrough: "edit.strikethrough",
      "today-date": "insert.todayDate",
      "now-time": "insert.nowTime",
    };
    const slashMarkdownIds = result.current.slashCommands
      .filter((command) => command.category === "markdown")
      .map((command) => command.id);
    expect(new Set(slashMarkdownIds)).toEqual(
      new Set(Object.keys(expectedIdBySlashId)),
    );
    const commandIds = result.current.filteredCommands.map(
      (command) => command.id,
    );
    for (const slashId of slashMarkdownIds) {
      expect(commandIds).toContain(expectedIdBySlashId[slashId]);
    }

    const heading = result.current.filteredCommands.find(
      (command) => command.id === "insert.heading1",
    );
    // Palette labels follow the localized slash menu (test uses kana).
    expect(heading?.label).toBe("みだし 1");
    act(() => {
      heading?.run();
    });
    expect(insertText).toHaveBeenCalledWith("# ");

    const table = result.current.filteredCommands.find(
      (command) => command.id === "edit.insertTable",
    );
    act(() => {
      table?.run();
    });
    expect(insertText).toHaveBeenCalledWith(
      "| れつ1 | れつ2 | れつ3 |\n| --- | --- | --- |\n|     |     |     |\n",
    );
    expect(insertTable).not.toHaveBeenCalled();

    const today = result.current.filteredCommands.find(
      (command) => command.id === "insert.todayDate",
    );
    act(() => {
      today?.run();
    });
    expect(insertText).toHaveBeenCalledWith(
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    );

    act(() => {
      result.current.setCommandPaletteQuery("みだし");
    });
    const localizedHeading = result.current.filteredCommands.find(
      (command) => command.id === "insert.heading1",
    );
    expect(localizedHeading?.label).toBe("みだし 1");
  });
});
