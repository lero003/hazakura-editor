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
import type { LModeCopy } from "../../lib/locale";
import { isExternalCliAssistSurfaceAllowed } from "../../lib/distributionLane";
import type {
  AssistSurfacePreference,
  EditorSettings,
  EditorTab,
  PreferencesDialogMode,
  ThemePreference,
} from "../../types";
import type { SlashCommand } from "../../types/slash";
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
  importSourceAsMarkdownDraft: () => Promise<void>;
  insertTable: () => void;
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
  appleLocalAssistAllowed: boolean;
  assistSurfaceActive: AssistSurfacePreference;
  editorPaneRef: RefObject<EditorPaneHandle | null>;
  lModeCopy: LModeCopy;
  setStatus: Dispatch<SetStateAction<string>>;
  slashCommands?: readonly SlashCommand[];
  themePreference: ThemePreference;
  workspaceRootPath: string | null;
};

type MarkdownPaletteCommandSpec = Omit<Command, "run"> & {
  sourceId: string;
};

const MARKDOWN_PALETTE_COMMAND_SPECS: readonly MarkdownPaletteCommandSpec[] = [
  {
    category: "Edit",
    id: "edit.bold",
    keywords: ["bold", "strong", "format", "markdown"],
    label: "Apply Bold",
    shortcut: "⌘B",
    sourceId: "bold",
  },
  {
    category: "Edit",
    id: "edit.italic",
    keywords: ["italic", "emphasis", "format", "markdown"],
    label: "Apply Italic",
    shortcut: "⌘I",
    sourceId: "italic",
  },
  {
    category: "Edit",
    id: "edit.code",
    keywords: ["code", "inline", "format", "markdown"],
    label: "Apply Inline Code",
    shortcut: "⌘E",
    sourceId: "inline-code",
  },
  {
    category: "Edit",
    id: "edit.link",
    keywords: ["link", "url", "format", "markdown"],
    label: "Apply Link",
    shortcut: "⌘K",
    sourceId: "link",
  },
  {
    category: "Edit",
    id: "edit.image",
    keywords: ["image", "picture", "insert", "markdown"],
    label: "Insert Image",
    sourceId: "image",
  },
  {
    category: "Edit",
    id: "edit.strikethrough",
    keywords: ["strikethrough", "strike", "format", "markdown"],
    label: "Apply Strikethrough",
    sourceId: "strikethrough",
  },
  {
    category: "Insert",
    id: "insert.heading1",
    keywords: ["heading", "h1", "markdown", "insert"],
    label: "Insert Heading 1",
    sourceId: "heading-1",
  },
  {
    category: "Insert",
    id: "insert.heading2",
    keywords: ["heading", "h2", "markdown", "insert"],
    label: "Insert Heading 2",
    sourceId: "heading-2",
  },
  {
    category: "Insert",
    id: "insert.heading3",
    keywords: ["heading", "h3", "markdown", "insert"],
    label: "Insert Heading 3",
    sourceId: "heading-3",
  },
  {
    category: "Insert",
    id: "insert.bulletList",
    keywords: ["bullet", "list", "unordered", "markdown", "insert"],
    label: "Insert Bullet List",
    sourceId: "bullet-list",
  },
  {
    category: "Insert",
    id: "insert.numberedList",
    keywords: ["numbered", "ordered", "list", "markdown", "insert"],
    label: "Insert Numbered List",
    sourceId: "numbered-list",
  },
  {
    category: "Insert",
    id: "insert.taskList",
    keywords: ["task", "todo", "checklist", "markdown", "insert"],
    label: "Insert Task List",
    sourceId: "task-list",
  },
  {
    category: "Insert",
    id: "insert.quote",
    keywords: ["quote", "blockquote", "markdown", "insert"],
    label: "Insert Quote",
    sourceId: "quote",
  },
  {
    category: "Insert",
    id: "insert.codeBlock",
    keywords: ["code", "block", "fence", "markdown", "insert"],
    label: "Insert Code Block",
    sourceId: "code-block",
  },
  {
    category: "Insert",
    id: "insert.divider",
    keywords: ["divider", "horizontal", "rule", "markdown", "insert"],
    label: "Insert Divider",
    sourceId: "divider",
  },
  {
    category: "Insert",
    description:
      "Insert a 3-column Markdown table skeleton. Edit cells manually — no row, column, or alignment commands yet.",
    id: "edit.insertTable",
    keywords: ["table", "insert", "grid", "3", "columns"],
    label: "Insert 3-Column Table",
    shortcut: "⇧⌘T",
    sourceId: "table",
  },
  {
    category: "Insert",
    id: "insert.todayDate",
    keywords: ["date", "today", "now", "markdown", "insert"],
    label: "Insert Today's Date",
    sourceId: "today-date",
  },
  {
    category: "Insert",
    id: "insert.nowTime",
    keywords: ["time", "now", "timestamp", "markdown", "insert"],
    label: "Insert Current Time",
    sourceId: "now-time",
  },
];

function buildMarkdownPaletteCommands(
  slashCommands: readonly SlashCommand[],
  editorPaneRef: RefObject<EditorPaneHandle | null>,
): Command[] {
  const commandsById = new Map(
    slashCommands
      .filter((command) => command.category === "markdown")
      .map((command) => [command.id, command]),
  );

  return MARKDOWN_PALETTE_COMMAND_SPECS.flatMap(
    ({ sourceId, ...paletteCommand }) => {
      const sourceCommand = commandsById.get(sourceId);
      if (!sourceCommand) {
        return [];
      }
      return [
        {
          ...paletteCommand,
          keywords: Array.from(
            new Set([
              ...(paletteCommand.keywords ?? []),
              sourceCommand.label,
              ...sourceCommand.searchKeys,
            ]),
          ),
          run: () => {
            if ("insertText" in sourceCommand) {
              editorPaneRef.current?.insertText(sourceCommand.insertText);
              return;
            }
            sourceCommand.action();
          },
        },
      ];
    },
  );
}

export function useCommandPaletteController({
  actions,
  activeTab,
  activeTabId,
  appleLocalAssistAllowed,
  assistSurfaceActive,
  editorPaneRef,
  lModeCopy,
  setStatus,
  slashCommands = [],
  themePreference,
  workspaceRootPath,
}: UseCommandPaletteControllerOptions) {
  const externalCliAllowed = isExternalCliAssistSurfaceAllowed();
  const appleLocalAssistActive =
    appleLocalAssistAllowed && assistSurfaceActive === "apple-local";
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
  const markdownPaletteCommands = useMemo(
    () => buildMarkdownPaletteCommands(slashCommands, editorPaneRef),
    [editorPaneRef, slashCommands],
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
        id: "file.importPdfImageDraft",
        keywords: [
          "import",
          "pdf",
          "image",
          "ocr",
          "vision",
          "markdown",
          "draft",
          "scan",
        ],
        label: "PDF / 画像を Markdown 下書きとして取り込む…",
        run: () => {
          void actions.importSourceAsMarkdownDraft();
        },
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
        keywords: ["export", "epub", "book"],
        label: "Export EPUB…",
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
      ...markdownPaletteCommands,
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
      ...(appleLocalAssistActive
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
                "hazakura",
              ],
              label: "Open Hazakura Local Assist Window",
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
              id: externalCliAllowed ? "agent.preferences" : "assist.preferences",
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
    ],
    [
      actions,
      activeTab,
      activeTabId,
      appleLocalAssistActive,
      appleLocalAssistAllowed,
      assistSurfaceActive,
      editorPaneRef,
      externalCliAllowed,
      lModeCopy,
      markdownPaletteCommands,
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
