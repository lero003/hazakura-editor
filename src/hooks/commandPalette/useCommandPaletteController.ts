// `useCommandPaletteController` is the v0.9
// `useAppShellController` Slice E-1 domain composer. It bundles
// `useCommandPalette` (9 fields), `useGlobalSearch` (11
// fields), and a search-result runner into a single typed
// surface (~21 fields), and moves
// the inline command list and the `handleOpenSearchMatch`
// callback out of the orchestrator into the new hook.
//
// The composition is real (not a rename) because the search
// hook's `onOpenMatch` callback is what the orchestrator used
// to call `openWorkspaceFile` + `editorPaneRef.current.goToLine`
// + `setStatus` — folding that callback into the new controller
// removes a chunk of cross-section glue from the orchestrator.
// The two bundled hooks are independent state machines
// (palette owns its own query/visible/activeIndex, search owns
// its own rows/summary/searching), so the new section is a
// pure bundler plus the command-list local.
//
// The hook owns no new state of its own — the command list is
// pure derived memo over the `actions` object. The
// `actions`-namespaced arg shape keeps the call site readable
// (the orchestrator builds a single `actions` object from the
// many leaf callbacks it already plumbs, instead of passing 25
// flat args).

import { useCallback, useMemo } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import type {
  EditorPaneHandle,
  MarkdownFormat,
} from "../../components/editor/EditorPane";
import type { AppleAssistCopy, LModeCopy } from "../../lib/locale";
import type {
  AppleAssistAvailability,
  AppleAssistOperation,
} from "../../lib/tauri";
import { isExternalCliAssistSurfaceAllowed } from "../../lib/distributionLane";
import type {
  EditorSettings,
  EditorTab,
  PreferencesDialogMode,
  ThemePreference,
} from "../../types";
import { useCommandPalette, type Command } from "./useCommandPalette";
import {
  useGlobalSearch,
  type GlobalSearchRow,
} from "../globalSearch/useGlobalSearch";

type UseCommandPaletteControllerActions = {
  applyActiveMarkdownFormat: (kind: MarkdownFormat) => void;
  createNewFile: () => Promise<void>;
  exportEpubBeta: () => Promise<void>;
  exportHtml: () => Promise<void>;
  exportPdf: () => Promise<void>;
  focusAdjacentTab: (direction: "next" | "previous") => void;
  handleSendSelectionToAgent: (text: string) => void;
  insertTable: () => void;
  invokeAppleAssist: (
    operation: AppleAssistOperation,
    selectedText: string,
  ) => void;
  openAgentWindow: (themePreference: ThemePreference) => void;
  openAppleAssistWindow: (themePreference: ThemePreference) => void;
  openFile: () => Promise<void>;
  openWorkspace: () => Promise<void>;
  openWorkspaceFile: (path: string) => Promise<void>;
  requestCloseTab: (id: string) => void;
  requestRestoreFromBackup: () => void;
  requestReviewTabAgainstDisk: (tab: EditorTab) => void;
  requestWindowClose: () => void;
  saveActiveTab: () => Promise<void>;
  saveActiveTabAs: () => Promise<void>;
  setEditorSettings: Dispatch<SetStateAction<EditorSettings>>;
  setFindVisible: Dispatch<SetStateAction<boolean>>;
  setPreferencesDialogMode: Dispatch<
    SetStateAction<PreferencesDialogMode | null>
  >;
  setPreviewVisible: Dispatch<SetStateAction<boolean>>;
  toggleDiffPane: () => void;
  toggleLMode: () => void;
  toggleOutlinePane: () => void;
  toggleQuickOpen: () => void;
};

type UseCommandPaletteControllerOptions = {
  actions: UseCommandPaletteControllerActions;
  activeTab: EditorTab | null;
  activeTabId: string | null;
  appleAssistAvailability: AppleAssistAvailability;
  appleLocalAssistAllowed: boolean;
  appleAssistCopy: AppleAssistCopy;
  editorPaneRef: RefObject<EditorPaneHandle | null>;
  lModeCopy: LModeCopy;
  setStatus: Dispatch<SetStateAction<string>>;
  themePreference: ThemePreference;
  workspaceRootPath: string | null;
};

export function useCommandPaletteController({
  actions,
  activeTab,
  activeTabId,
  appleAssistAvailability,
  appleLocalAssistAllowed,
  appleAssistCopy,
  editorPaneRef,
  lModeCopy,
  setStatus,
  themePreference,
  workspaceRootPath,
}: UseCommandPaletteControllerOptions) {
  const externalCliAllowed = isExternalCliAssistSurfaceAllowed();
  const handleOpenSearchMatch = useCallback(
    (row: GlobalSearchRow) => {
      void actions.openWorkspaceFile(row.file.path).then(() => {
        setTimeout(() => {
          editorPaneRef.current?.goToLine(row.match.line);
        }, 50);
        setStatus(`Opened ${row.file.relativePath}:${row.match.line}`);
      });
    },
    [actions, editorPaneRef, setStatus],
  );

  const commandCommands = useMemo<Command[]>(
    () => [
      {
        category: "File",
        id: "file.new",
        keywords: ["create", "new", "tab"],
        label: "New File",
        run: () => {
          void actions.createNewFile();
        },
        shortcut: "⌘N",
      },
      {
        category: "File",
        id: "file.open",
        keywords: ["open", "file", "load"],
        label: "Open File…",
        run: () => {
          void actions.openFile();
        },
        shortcut: "⌘O",
      },
      {
        category: "File",
        id: "file.openWorkspace",
        keywords: ["workspace", "folder", "directory", "open"],
        label: "Open Workspace…",
        run: () => {
          void actions.openWorkspace();
        },
        shortcut: "⇧⌘O",
      },
      {
        category: "File",
        id: "file.quickOpen",
        keywords: ["quick", "open", "file", "search"],
        label: "Quick Open File",
        run: () => {
          actions.toggleQuickOpen();
        },
        shortcut: "⌘P",
      },
      {
        category: "File",
        id: "file.save",
        keywords: ["save", "write"],
        label: "Save",
        run: () => {
          void actions.saveActiveTab();
        },
        shortcut: "⌘S",
      },
      {
        category: "File",
        id: "file.saveAs",
        keywords: ["save", "as", "duplicate"],
        label: "Save As…",
        run: () => {
          void actions.saveActiveTabAs();
        },
        shortcut: "⇧⌘S",
      },
      {
        category: "File",
        id: "file.closeTab",
        keywords: ["close", "tab"],
        label: "Close Tab",
        run: () => {
          if (activeTabId) {
            actions.requestCloseTab(activeTabId);
          }
        },
        shortcut: "⌘W",
      },
      {
        category: "File",
        id: "file.closeWindow",
        keywords: ["close", "window", "quit"],
        label: "Close Window",
        run: () => {
          void actions.requestWindowClose();
        },
        shortcut: "⇧⌘W",
      },
      {
        category: "File",
        id: "file.exportHtml",
        keywords: ["export", "html"],
        label: "Export HTML…",
        run: () => {
          void actions.exportHtml();
        },
      },
      {
        category: "File",
        id: "file.exportEpubBeta",
        keywords: ["export", "epub", "beta", "book"],
        label: "Export EPUB (Beta)…",
        run: () => {
          void actions.exportEpubBeta();
        },
      },
      {
        category: "File",
        id: "file.exportPdf",
        keywords: ["export", "pdf"],
        label: "Export PDF…",
        run: () => {
          void actions.exportPdf();
        },
      },
      {
        category: "File",
        id: "file.restoreBackup",
        keywords: ["restore", "backup", "auto", "snapshot", "recover"],
        label: "Restore from Auto-Backup…",
        run: () => {
          actions.requestRestoreFromBackup();
        },
      },
      {
        category: "Edit",
        id: "edit.find",
        keywords: ["find", "search", "match"],
        label: "Find…",
        run: () => {
          actions.setFindVisible(true);
        },
        shortcut: "⌘F",
      },
      {
        category: "Edit",
        id: "edit.findInFiles",
        keywords: ["find", "search", "files", "workspace", "grep"],
        label: "Find in Files…",
        run: () => {
          openGlobalSearch();
        },
        shortcut: "⇧⌘F",
      },
      {
        category: "Edit",
        id: "edit.bold",
        keywords: ["bold", "strong", "format", "markdown"],
        label: "Apply Bold",
        run: () => {
          actions.applyActiveMarkdownFormat("bold");
        },
        shortcut: "⌘B",
      },
      {
        category: "Edit",
        id: "edit.italic",
        keywords: ["italic", "emphasis", "format", "markdown"],
        label: "Apply Italic",
        run: () => {
          actions.applyActiveMarkdownFormat("italic");
        },
        shortcut: "⌘I",
      },
      {
        category: "Edit",
        id: "edit.code",
        keywords: ["code", "inline", "format", "markdown"],
        label: "Apply Inline Code",
        run: () => {
          actions.applyActiveMarkdownFormat("code");
        },
        shortcut: "⌘E",
      },
      {
        category: "Edit",
        id: "edit.link",
        keywords: ["link", "url", "format", "markdown"],
        label: "Apply Link",
        run: () => {
          actions.applyActiveMarkdownFormat("link");
        },
        shortcut: "⌘K",
      },
      {
        category: "Edit",
        id: "edit.insertTable",
        keywords: ["table", "insert", "grid", "3", "columns"],
        // The current insertTable only emits a fixed 3-column
        // skeleton. The label names the column count so the user
        // does not assume a full WYSIWYG editor is behind the
        // command; row / column / alignment editing is not
        // implemented yet (see docs/current-work.md for the active queue).
        label: "Insert 3-Column Table",
        description:
          "Insert a 3-column Markdown table skeleton. Edit cells manually — no row, column, or alignment commands yet.",
        run: () => {
          actions.insertTable();
        },
        shortcut: "⇧⌘T",
      },
      {
        category: "View",
        id: "view.preview",
        keywords: ["preview", "view", "render"],
        label: "Toggle Preview Pane",
        run: () => {
          actions.setPreviewVisible((current) => !current);
        },
        shortcut: "⌥⌘P",
      },
      {
        category: "View",
        id: "view.wrap",
        keywords: ["wrap", "word", "line"],
        label: "Toggle Word Wrap",
        run: () => {
          actions.setEditorSettings((current) => ({
            ...current,
            wrapLines: !current.wrapLines,
          }));
        },
        shortcut: "⌥⌘W",
      },
      {
        category: "View",
        id: "view.invisibles",
        keywords: ["invisible", "whitespace", "characters"],
        label: "Toggle Invisible Characters",
        run: () => {
          actions.setEditorSettings((current) => ({
            ...current,
            showInvisibles: !current.showInvisibles,
          }));
        },
        shortcut: "⌥⌘I",
      },
      {
        category: "View",
        id: "view.outline",
        keywords: ["outline", "headings", "navigation"],
        label: "Toggle Outline Pane",
        run: () => {
          actions.toggleOutlinePane();
        },
      },
      {
        category: "View",
        id: "view.diff",
        keywords: ["diff", "compare"],
        label: "Toggle Diff Pane",
        run: () => {
          actions.toggleDiffPane();
        },
      },
      {
        category: "View",
        id: "view.nextTab",
        keywords: ["tab", "next", "focus"],
        label: "Focus Next Tab",
        run: () => {
          actions.focusAdjacentTab("next");
        },
        shortcut: "⌥⌘→",
      },
      {
        category: "View",
        id: "view.prevTab",
        keywords: ["tab", "previous", "focus"],
        label: "Focus Previous Tab",
        run: () => {
          actions.focusAdjacentTab("previous");
        },
        shortcut: "⌥⌘←",
      },
      {
        category: "View",
        id: "view.toggleLMode",
        keywords: ["l", "mode", "focus", "zen", "える", "エル", "reading"],
        label: lModeCopy.paletteCommand,
        run: () => {
          actions.toggleLMode();
        },
        shortcut: "⇧⌘L",
      },
      {
        category: "Review",
        id: "review.tabAgainstDisk",
        keywords: ["review", "diff", "disk"],
        label: "Review Tab Against Disk",
        run: () => {
          if (activeTab) {
            actions.requestReviewTabAgainstDisk(activeTab);
          }
        },
      },
      ...(externalCliAllowed
        ? [
            {
              category: "Agent",
              id: "agent.open",
              keywords: [
                "agent",
                "claude",
                "codex",
                "opencode",
                "pi",
                "workbench",
              ],
              label: "Open Agent Window",
              run: () => {
                void actions.openAgentWindow(themePreference);
              },
            },
          ]
        : []),
      ...(appleLocalAssistAllowed
        ? [
            {
              category: "Writing Companion",
              id: "apple-assist.openWindow",
              keywords: [
                "apple",
                "local",
                "assist",
                "writing",
                "companion",
                "foundation",
                "models",
              ],
              label: "Open Apple Local Assist Window",
              run: () => {
                void actions.openAppleAssistWindow(themePreference);
              },
            },
          ]
        : []),
      ...(externalCliAllowed
        ? [
            {
              category: "Agent",
              id: "agent.sendSelection",
              keywords: ["agent", "send", "selection"],
              label: "Send Selection to Agent",
              run: () => {
                const text = editorPaneRef.current?.getSelectionText() ?? "";
                actions.handleSendSelectionToAgent(text);
              },
            },
          ]
        : []),
      ...(externalCliAllowed || appleLocalAssistAllowed
        ? [
            {
              category: externalCliAllowed ? "Agent" : "Settings",
              id: "agent.preferences",
              keywords: externalCliAllowed
                ? ["agent", "preferences", "settings", "workbench"]
                : ["assist", "apple", "local", "preferences", "settings"],
              label: externalCliAllowed
                ? "Agent Workbench Preferences…"
                : "Assist Settings…",
              run: () => {
                actions.setPreferencesDialogMode("agent");
              },
            },
          ]
        : []),
      {
        category: "Settings",
        id: "settings.open",
        keywords: ["settings", "preferences"],
        label: "Settings…",
        run: () => {
          actions.setPreferencesDialogMode("settings");
        },
        shortcut: "⌘,",
      },
      {
        category: "Help",
        id: "help.localDataDisclosure",
        keywords: [
          "privacy",
          "local",
          "data",
          "policy",
          "disclosure",
          "telemetry",
          "analytics",
          "backup",
          "sync",
          "network",
        ],
        label: "Local Data Disclosure…",
        run: () => {
          actions.setPreferencesDialogMode("privacy");
        },
      },
      {
        category: "Help",
        id: "help.supportDiagnostics",
        keywords: [
          "support",
          "diagnostics",
          "diagnostic",
          "snapshot",
          "json",
          "redacted",
          "share",
          "copy",
        ],
        label: "Support Diagnostics…",
        run: () => {
          actions.setPreferencesDialogMode("diagnostics");
        },
      },
      {
        category: "Help",
        id: "help.privacyPolicy",
        keywords: [
          "privacy",
          "policy",
          "app",
          "store",
          "metadata",
          "local",
          "data",
        ],
        label: "Privacy Policy…",
        run: () => {
          actions.setPreferencesDialogMode("privacy-policy");
        },
      },
      {
        category: "Help",
        id: "help.openSourceAcknowledgements",
        keywords: [
          "open",
          "source",
          "license",
          "licenses",
          "acknowledgements",
          "dependencies",
          "third-party",
        ],
        label: "Open Source Acknowledgements…",
        run: () => {
          actions.setPreferencesDialogMode("open-source-acknowledgements");
        },
      },
      {
        category: "Help",
        id: "help.about",
        keywords: [
          "about",
          "version",
          "support",
          "hazakura",
          "editor",
          "lane",
        ],
        label: "About Hazakura Editor…",
        run: () => {
          actions.setPreferencesDialogMode("about");
        },
      },
      ...(appleLocalAssistAllowed && appleAssistAvailability.kind === "available"
        ? [
            {
              category: appleAssistCopy.commandCategory,
              id: "appleAssist.summarize",
              keywords: [
                "apple",
                "assist",
                "summarize",
                "selection",
                "あっぷる",
                "ようやく",
                "要約",
              ],
              label: appleAssistCopy.summarizeLabel,
              description: appleAssistCopy.summarizeHint,
              run: () => {
                const text =
                  editorPaneRef.current?.getSelectionText() ?? "";
                actions.invokeAppleAssist("summarize", text);
              },
            },
            {
              category: appleAssistCopy.commandCategory,
              id: "appleAssist.rephrase",
              keywords: [
                "apple",
                "assist",
                "rephrase",
                "selection",
                "あっぷる",
                "かきかえ",
                "言い換え",
              ],
              label: appleAssistCopy.rephraseLabel,
              description: appleAssistCopy.rephraseHint,
              run: () => {
                const text =
                  editorPaneRef.current?.getSelectionText() ?? "";
                actions.invokeAppleAssist("rephrase", text);
              },
            },
          ]
        : []),
    ],
    [
      actions,
      activeTab,
      activeTabId,
      appleAssistAvailability,
      appleLocalAssistAllowed,
      appleAssistCopy,
      editorPaneRef,
      externalCliAllowed,
      lModeCopy,
      themePreference,
    ],
  );
  const {
    activeIndex: commandPaletteActiveIndex,
    closeCommandPalette,
    commandPaletteVisible,
    filteredCommands,
    openCommandPalette,
    query: commandPaletteQuery,
    runCommand,
    setActiveIndex: setCommandPaletteActiveIndex,
    setQuery: setCommandPaletteQuery,
  } = useCommandPalette({ commands: commandCommands });

  const {
    activeIndex: globalSearchActiveIndex,
    closeGlobalSearch,
    globalSearchVisible,
    openGlobalSearch,
    query: globalSearchQuery,
    rows: globalSearchRows,
    searchError: globalSearchError,
    searching: globalSearching,
    setActiveIndex: setGlobalSearchActiveIndex,
    setQuery: setGlobalSearchQuery,
    summary: globalSearchSummary,
  } = useGlobalSearch({
    onOpenMatch: handleOpenSearchMatch,
    workspaceRoot: workspaceRootPath,
  });

  return {
    closeCommandPalette,
    closeGlobalSearch,
    commandPaletteActiveIndex,
    commandPaletteQuery,
    commandPaletteVisible,
    filteredCommands,
    globalSearchActiveIndex,
    globalSearchError,
    globalSearchQuery,
    globalSearchRows,
    globalSearchSummary,
    globalSearching,
    globalSearchVisible,
    openCommandPalette,
    openGlobalSearch,
    runCommand,
    runGlobalSearchMatch: handleOpenSearchMatch,
    setCommandPaletteActiveIndex,
    setCommandPaletteQuery,
    setGlobalSearchActiveIndex,
    setGlobalSearchQuery,
  };
}
