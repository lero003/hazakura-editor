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
import {
  commandPaletteEntry,
  getCommandPaletteCopy,
  type LModeCopy,
} from "../../lib/locale";
import { isExternalCliAssistSurfaceAllowed } from "../../lib/distributionLane";
import type {
  AssistSurfacePreference,
  EditorSettings,
  EditorTab,
  MenuLanguage,
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
  openReferenceFile: () => Promise<void>;
  openWorkspace: () => Promise<void>;
  openWorkspaceFile: (path: string) => Promise<void>;
  openOkfReview: (bundleRoot?: string | null) => void;
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
  menuLanguage: MenuLanguage;
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
  menuLanguage,
  setStatus,
  slashCommands = [],
  themePreference,
  workspaceRootPath,
}: UseCommandPaletteControllerOptions) {
  const externalCliAllowed = isExternalCliAssistSurfaceAllowed();
  const appleLocalAssistActive =
    appleLocalAssistAllowed && assistSurfaceActive === "apple-local";
  const paletteCopy = useMemo(
    () => getCommandPaletteCopy(menuLanguage),
    [menuLanguage],
  );
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
        category: paletteCopy.categories.file,
        id: "file.new",
        ...commandPaletteEntry(paletteCopy, "file.new", [
          "create",
          "new",
          "tab",
        ]),
        run: () => {
          void actions.createNewFile();
        },
        shortcut: "⌘N",
      },
      {
        category: paletteCopy.categories.file,
        id: "file.open",
        ...commandPaletteEntry(paletteCopy, "file.open", [
          "open",
          "file",
          "load",
        ]),
        run: () => {
          void actions.openFile();
        },
        shortcut: "⌘O",
      },
      {
        category: paletteCopy.categories.file,
        id: "file.importPdfImageDraft",
        ...commandPaletteEntry(paletteCopy, "file.importPdfImageDraft", [
          "import",
          "pdf",
          "image",
          "ocr",
          "vision",
          "markdown",
          "draft",
          "scan",
        ]),
        run: () => {
          void actions.importSourceAsMarkdownDraft();
        },
      },
      {
        category: paletteCopy.categories.file,
        id: "file.openReference",
        ...commandPaletteEntry(paletteCopy, "file.openReference", [
          "reference",
          "compare",
          "side-by-side",
          "readonly",
        ]),
        run: () => {
          void actions.openReferenceFile();
        },
      },
      {
        category: paletteCopy.categories.file,
        id: "file.openWorkspace",
        ...commandPaletteEntry(paletteCopy, "file.openWorkspace", [
          "workspace",
          "folder",
          "directory",
          "open",
        ]),
        run: () => {
          void actions.openWorkspace();
        },
        shortcut: "⇧⌘O",
      },
      {
        category: paletteCopy.categories.file,
        id: "file.quickOpen",
        ...commandPaletteEntry(paletteCopy, "file.quickOpen", [
          "quick",
          "open",
          "file",
          "search",
        ]),
        run: () => {
          actions.toggleQuickOpen();
        },
        shortcut: "⌘P",
      },
      {
        category: paletteCopy.categories.file,
        id: "file.save",
        ...commandPaletteEntry(paletteCopy, "file.save", ["save", "write"]),
        run: () => {
          void actions.saveActiveTab();
        },
        shortcut: "⌘S",
      },
      {
        category: paletteCopy.categories.file,
        id: "file.saveAs",
        ...commandPaletteEntry(paletteCopy, "file.saveAs", [
          "save",
          "as",
          "duplicate",
        ]),
        run: () => {
          void actions.saveActiveTabAs();
        },
        shortcut: "⇧⌘S",
      },
      {
        category: paletteCopy.categories.file,
        id: "file.closeTab",
        ...commandPaletteEntry(paletteCopy, "file.closeTab", ["close", "tab"]),
        run: () => {
          if (activeTabId) {
            actions.requestCloseTab(activeTabId);
          }
        },
        shortcut: "⌘W",
      },
      {
        category: paletteCopy.categories.file,
        id: "file.closeWindow",
        ...commandPaletteEntry(paletteCopy, "file.closeWindow", [
          "close",
          "window",
          "quit",
        ]),
        run: () => {
          void actions.requestWindowClose();
        },
        shortcut: "⇧⌘W",
      },
      {
        category: paletteCopy.categories.file,
        id: "file.exportHtml",
        ...commandPaletteEntry(paletteCopy, "file.exportHtml", [
          "export",
          "html",
        ]),
        run: () => {
          void actions.exportHtml();
        },
      },
      {
        category: paletteCopy.categories.file,
        id: "file.exportEpubBeta",
        ...commandPaletteEntry(paletteCopy, "file.exportEpubBeta", [
          "export",
          "epub",
          "book",
        ]),
        run: () => {
          void actions.exportEpubBeta();
        },
      },
      {
        category: paletteCopy.categories.file,
        id: "file.exportPdf",
        ...commandPaletteEntry(paletteCopy, "file.exportPdf", [
          "export",
          "pdf",
        ]),
        run: () => {
          void actions.exportPdf();
        },
      },
      {
        category: paletteCopy.categories.file,
        id: "file.restoreBackup",
        ...commandPaletteEntry(paletteCopy, "file.restoreBackup", [
          "restore",
          "backup",
          "auto",
          "snapshot",
          "recover",
        ]),
        run: () => {
          actions.requestRestoreFromBackup();
        },
      },
      {
        category: paletteCopy.categories.edit,
        id: "edit.find",
        ...commandPaletteEntry(paletteCopy, "edit.find", [
          "find",
          "search",
          "match",
        ]),
        run: () => {
          actions.setFindVisible(true);
        },
        shortcut: "⌘F",
      },
      {
        category: paletteCopy.categories.edit,
        id: "edit.findInFiles",
        ...commandPaletteEntry(paletteCopy, "edit.findInFiles", [
          "find",
          "search",
          "files",
          "workspace",
          "grep",
        ]),
        run: () => {
          openGlobalSearch();
        },
        shortcut: "⇧⌘F",
      },
      ...markdownPaletteCommands,
      {
        category: paletteCopy.categories.view,
        id: "view.preview",
        ...commandPaletteEntry(paletteCopy, "view.preview", [
          "preview",
          "view",
          "render",
        ]),
        run: () => {
          actions.setPreviewVisible((current) => !current);
        },
        shortcut: "⌥⌘P",
      },
      {
        category: paletteCopy.categories.view,
        id: "view.wrap",
        ...commandPaletteEntry(paletteCopy, "view.wrap", [
          "wrap",
          "word",
          "line",
        ]),
        run: () => {
          actions.setEditorSettings((current) => ({
            ...current,
            wrapLines: !current.wrapLines,
          }));
        },
        shortcut: "⌥⌘W",
      },
      {
        category: paletteCopy.categories.view,
        id: "view.invisibles",
        ...commandPaletteEntry(paletteCopy, "view.invisibles", [
          "invisible",
          "whitespace",
          "characters",
        ]),
        run: () => {
          actions.setEditorSettings((current) => ({
            ...current,
            showInvisibles: !current.showInvisibles,
          }));
        },
        shortcut: "⌥⌘I",
      },
      {
        category: paletteCopy.categories.view,
        id: "view.outline",
        ...commandPaletteEntry(paletteCopy, "view.outline", [
          "outline",
          "headings",
          "navigation",
        ]),
        run: () => {
          actions.toggleOutlinePane();
        },
      },
      {
        category: paletteCopy.categories.view,
        id: "view.diff",
        ...commandPaletteEntry(paletteCopy, "view.diff", ["diff", "compare"]),
        run: () => {
          actions.toggleDiffPane();
        },
      },
      {
        category: paletteCopy.categories.view,
        id: "view.nextTab",
        ...commandPaletteEntry(paletteCopy, "view.nextTab", [
          "tab",
          "next",
          "focus",
        ]),
        run: () => {
          actions.focusAdjacentTab("next");
        },
        shortcut: "⌥⌘→",
      },
      {
        category: paletteCopy.categories.view,
        id: "view.prevTab",
        ...commandPaletteEntry(paletteCopy, "view.prevTab", [
          "tab",
          "previous",
          "focus",
        ]),
        run: () => {
          actions.focusAdjacentTab("previous");
        },
        shortcut: "⌥⌘←",
      },
      {
        category: paletteCopy.categories.view,
        id: "view.toggleLMode",
        keywords: ["l", "mode", "focus", "zen", "える", "エル", "reading"],
        label: lModeCopy.paletteCommand,
        run: () => {
          actions.toggleLMode();
        },
        shortcut: "⇧⌘L",
      },
      {
        category: paletteCopy.categories.review,
        id: "review.tabAgainstDisk",
        ...commandPaletteEntry(paletteCopy, "review.tabAgainstDisk", [
          "review",
          "diff",
          "disk",
        ]),
        run: () => {
          if (activeTab) {
            actions.requestReviewTabAgainstDisk(activeTab);
          }
        },
      },
      {
        category: paletteCopy.categories.review,
        id: "review.okfDraftCompatibility",
        ...commandPaletteEntry(paletteCopy, "review.okfDraftCompatibility", [
          "okf",
          "compatibility",
          "bundle",
          "frontmatter",
          "review",
        ]),
        run: () => {
          actions.openOkfReview();
        },
      },
      ...(externalCliAllowed
        ? [
            {
              category: paletteCopy.categories.agent,
              id: "agent.open",
              ...commandPaletteEntry(paletteCopy, "agent.open", [
                "agent",
                "claude",
                "codex",
                "opencode",
                "pi",
                "workbench",
              ]),
              run: () => {
                void actions.openAgentWindow(themePreference);
              },
            },
          ]
        : []),
      ...(appleLocalAssistActive
        ? [
            {
              category: paletteCopy.categories.writingCompanion,
              id: "apple-assist.openWindow",
              ...commandPaletteEntry(paletteCopy, "apple-assist.openWindow", [
                "apple",
                "local",
                "assist",
                "writing",
                "companion",
                "foundation",
                "models",
                "hazakura",
              ]),
              run: () => {
                void actions.openAppleAssistWindow(themePreference);
              },
            },
          ]
        : []),
      ...(externalCliAllowed
        ? [
            {
              category: paletteCopy.categories.agent,
              id: "agent.sendSelection",
              ...commandPaletteEntry(paletteCopy, "agent.sendSelection", [
                "agent",
                "send",
                "selection",
              ]),
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
              category: externalCliAllowed
                ? paletteCopy.categories.agent
                : paletteCopy.categories.settings,
              id: externalCliAllowed
                ? "agent.preferences"
                : "assist.preferences",
              ...commandPaletteEntry(
                paletteCopy,
                externalCliAllowed
                  ? "agent.preferences"
                  : "assist.preferences",
                externalCliAllowed
                  ? ["agent", "preferences", "settings", "workbench"]
                  : ["assist", "apple", "local", "preferences", "settings"],
              ),
              run: () => {
                actions.setPreferencesDialogMode("agent");
              },
            },
          ]
        : []),
      {
        category: paletteCopy.categories.settings,
        id: "settings.open",
        ...commandPaletteEntry(paletteCopy, "settings.open", [
          "settings",
          "preferences",
        ]),
        run: () => {
          actions.setPreferencesDialogMode("settings");
        },
        shortcut: "⌘,",
      },
      {
        category: paletteCopy.categories.help,
        id: "help.localDataDisclosure",
        ...commandPaletteEntry(paletteCopy, "help.localDataDisclosure", [
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
        ]),
        run: () => {
          actions.setPreferencesDialogMode("privacy");
        },
      },
      {
        category: paletteCopy.categories.help,
        id: "help.supportDiagnostics",
        ...commandPaletteEntry(paletteCopy, "help.supportDiagnostics", [
          "support",
          "diagnostics",
          "diagnostic",
          "snapshot",
          "json",
          "redacted",
          "share",
          "copy",
        ]),
        run: () => {
          actions.setPreferencesDialogMode("diagnostics");
        },
      },
      {
        category: paletteCopy.categories.help,
        id: "help.privacyPolicy",
        ...commandPaletteEntry(paletteCopy, "help.privacyPolicy", [
          "privacy",
          "policy",
          "app",
          "store",
          "metadata",
          "local",
          "data",
        ]),
        run: () => {
          actions.setPreferencesDialogMode("privacy-policy");
        },
      },
      {
        category: paletteCopy.categories.help,
        id: "help.openSourceAcknowledgements",
        ...commandPaletteEntry(paletteCopy, "help.openSourceAcknowledgements", [
          "open",
          "source",
          "license",
          "licenses",
          "acknowledgements",
          "dependencies",
          "third-party",
        ]),
        run: () => {
          actions.setPreferencesDialogMode("open-source-acknowledgements");
        },
      },
      {
        category: paletteCopy.categories.help,
        id: "help.about",
        ...commandPaletteEntry(paletteCopy, "help.about", [
          "about",
          "version",
          "support",
          "hazakura",
          "editor",
          "lane",
        ]),
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
      paletteCopy,
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
