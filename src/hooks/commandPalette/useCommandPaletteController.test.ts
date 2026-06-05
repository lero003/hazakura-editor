import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useCommandPaletteController } from "./useCommandPaletteController";
import { getAppleAssistCopy } from "../../lib/locale";

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
          toggleReviewDesk: vi.fn(),
        },
        activeTab: null,
        activeTabId: null,
        appleAssistAvailability: { kind: "unsupported" },
        appleAssistCopy: getAppleAssistCopy("en"),
        editorPaneRef: { current: null },
        lModeCopy: {
          preferenceLabel: "L Mode",
          preferenceHint: "Hide the workspace chrome for focused reading.",
          featureDescription: "A quieter place to write.",
          typewriterPreferenceLabel: "Typewriter mode",
          typewriterPreferenceHint:
            "Keep the active line near the vertical center of the viewport as you type.",
          paletteCommand: "Toggle L Mode",
          exitPillLabel: "Exit L Mode",
          exitPillTitle: "Close L Mode",
          actionRailLabel: "L Mode actions",
          statusBarReviewChangesLabel: "Review changes",
          statusBarWorkspaceLabel: "Open workspace",
          statusBarAppleAssistLabel: "Apple Assist",
          statusBarAppleAssistTitle: "Open the Apple Assist window",
          statusBarReviewChangesTitle: "Exit L Mode and open the diff against disk",
          statusBarWorkspaceTitle: "Exit L Mode and return to the workspace",
          appleAssistReviewBarLabel: "Apple Assist changed your text",
          appleAssistReviewBarTitle: "Review or discard the pending AI edit",
          appleAssistReviewBarOpenDiffLabel: "Open diff",
          appleAssistReviewBarCloseDiffLabel: "Close diff",
          appleAssistReviewBarDiscardLabel: "Discard",
          appleAssistReviewBarDiscardTitle: "Revert the buffer and clear the review",
          appleAssistReviewBarCloseLabel: "Close",
          appleAssistReviewBarCloseTitle: "Keep the edit and dismiss the review",
          appleAssistReviewBarEmptyDiffLabel: "No diff to show",
          emptyPlaceholderText: "Start writing…",
          emptyPlaceholderHint: "Press Cmd+Shift+L to return to normal mode",
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
          toggleReviewDesk: vi.fn(),
        },
        activeTab: null,
        activeTabId: null,
        appleAssistAvailability: { kind: "unsupported" },
        appleAssistCopy: getAppleAssistCopy("ja"),
        editorPaneRef: { current: null },
        lModeCopy: {
          preferenceLabel: "えるモード",
          preferenceHint: "周辺UIを隠して本文に集中します。",
          featureDescription: "書くための、静かな時間。",
          typewriterPreferenceLabel: "タイプライターモード",
          typewriterPreferenceHint:
            "カーソル行を縦方向中央付近に保ち、書きながら視線を動かさないようにします。",
          paletteCommand: "えるモード切替",
          exitPillLabel: "えるモード終了",
          exitPillTitle: "えるモードを閉じる",
          actionRailLabel: "えるモードの導線",
          statusBarReviewChangesLabel: "変更を確認",
          statusBarWorkspaceLabel: "ワークスペースへ",
          statusBarAppleAssistLabel: "Apple Assist",
          statusBarAppleAssistTitle: "Apple Assist ウィンドウを開く",
          statusBarReviewChangesTitle: "えるモードを閉じてディスクとの差分を開く",
          statusBarWorkspaceTitle: "えるモードを閉じてワークスペースに戻る",
          appleAssistReviewBarLabel: "Apple Assist が本文を変更しました",
          appleAssistReviewBarTitle: "差分を確認するか取り消すか選んでください",
          appleAssistReviewBarOpenDiffLabel: "差分を開く",
          appleAssistReviewBarCloseDiffLabel: "差分を閉じる",
          appleAssistReviewBarDiscardLabel: "取り消す",
          appleAssistReviewBarDiscardTitle: "変更を元に戻して取り消します",
          appleAssistReviewBarCloseLabel: "閉じる",
          appleAssistReviewBarCloseTitle: "変更は残してこの通知を閉じます",
          appleAssistReviewBarEmptyDiffLabel: "差分がありません",
          emptyPlaceholderText: "書き始める…",
          emptyPlaceholderHint: "Cmd+Shift+L で通常モードへ戻ります",
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

  it("hides Apple Assist commands when availability is not `available`", () => {
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
          toggleReviewDesk: vi.fn(),
        },
        activeTab: null,
        activeTabId: null,
        appleAssistAvailability: { kind: "unsupported" },
        appleAssistCopy: getAppleAssistCopy("en"),
        editorPaneRef: { current: null },
        lModeCopy: {
          preferenceLabel: "L Mode",
          preferenceHint: "Hide the workspace chrome for focused reading.",
          featureDescription: "A quieter place to write.",
          typewriterPreferenceLabel: "Typewriter mode",
          typewriterPreferenceHint:
            "Keep the active line near the vertical center of the viewport as you type.",
          paletteCommand: "Toggle L Mode",
          exitPillLabel: "Exit L Mode",
          exitPillTitle: "Close L Mode",
          actionRailLabel: "L Mode actions",
          statusBarReviewChangesLabel: "Review changes",
          statusBarWorkspaceLabel: "Open workspace",
          statusBarAppleAssistLabel: "Apple Assist",
          statusBarAppleAssistTitle: "Open the Apple Assist window",
          statusBarReviewChangesTitle:
            "Exit L Mode and open the diff against disk",
          statusBarWorkspaceTitle:
            "Exit L Mode and return to the workspace",
          appleAssistReviewBarLabel: "Apple Assist changed your text",
          appleAssistReviewBarTitle: "Review or discard the pending AI edit",
          appleAssistReviewBarOpenDiffLabel: "Open diff",
          appleAssistReviewBarCloseDiffLabel: "Close diff",
          appleAssistReviewBarDiscardLabel: "Discard",
          appleAssistReviewBarDiscardTitle: "Revert the buffer and clear the review",
          appleAssistReviewBarCloseLabel: "Close",
          appleAssistReviewBarCloseTitle: "Keep the edit and dismiss the review",
          appleAssistReviewBarEmptyDiffLabel: "No diff to show",
          emptyPlaceholderText: "Start writing…",
          emptyPlaceholderHint:
            "Press Cmd+Shift+L to return to normal mode",
        },
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

  it("exposes Apple Assist commands when availability is `available`", () => {
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
          toggleReviewDesk: vi.fn(),
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
        lModeCopy: {
          preferenceLabel: "L Mode",
          preferenceHint: "Hide the workspace chrome for focused reading.",
          featureDescription: "A quieter place to write.",
          typewriterPreferenceLabel: "Typewriter mode",
          typewriterPreferenceHint:
            "Keep the active line near the vertical center of the viewport as you type.",
          paletteCommand: "Toggle L Mode",
          exitPillLabel: "Exit L Mode",
          exitPillTitle: "Close L Mode",
          actionRailLabel: "L Mode actions",
          statusBarReviewChangesLabel: "Review changes",
          statusBarWorkspaceLabel: "Open workspace",
          statusBarAppleAssistLabel: "Apple Assist",
          statusBarAppleAssistTitle: "Open the Apple Assist window",
          statusBarReviewChangesTitle:
            "Exit L Mode and open the diff against disk",
          statusBarWorkspaceTitle:
            "Exit L Mode and return to the workspace",
          appleAssistReviewBarLabel: "Apple Assist changed your text",
          appleAssistReviewBarTitle: "Review or discard the pending AI edit",
          appleAssistReviewBarOpenDiffLabel: "Open diff",
          appleAssistReviewBarCloseDiffLabel: "Close diff",
          appleAssistReviewBarDiscardLabel: "Discard",
          appleAssistReviewBarDiscardTitle: "Revert the buffer and clear the review",
          appleAssistReviewBarCloseLabel: "Close",
          appleAssistReviewBarCloseTitle: "Keep the edit and dismiss the review",
          appleAssistReviewBarEmptyDiffLabel: "No diff to show",
          emptyPlaceholderText: "Start writing…",
          emptyPlaceholderHint:
            "Press Cmd+Shift+L to return to normal mode",
        },
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
    expect(summarize?.category).toBe("Apple Assist");
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
});
