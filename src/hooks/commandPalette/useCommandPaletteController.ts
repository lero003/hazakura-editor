// Command palette and folder search share existing editor operations.
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import type { EditorPaneHandle } from "../../components/editor/EditorPane";
import {
  getCommandPaletteCopy,
  type LModeCopy,
} from "../../lib/locale";
import { isExternalCliAssistSurfaceAllowed } from "../../lib/distributionLane";
import { openedSearchMatchStatus } from "../../lib/statusMessages";
import type {
  AssistSurfacePreference,
  EditorTab,
  MenuLanguage,
  ThemePreference,
} from "../../types";
import type { SlashCommand } from "../../types/slash";
import { useCommandPalette, type Command } from "./useCommandPalette";
import {
  buildCommandCommands,
  type CommandPaletteActions,
} from "./commandPaletteEntries";
import {
  useGlobalSearch,
  type GlobalSearchRow,
} from "../globalSearch/useGlobalSearch";


type UseCommandPaletteControllerOptions = {
  actions: CommandPaletteActions;
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
  options: {
    editCategory: string;
    insertCategory: string;
    tableDescription: string;
  },
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
      const category =
        paletteCommand.category === "Insert"
          ? options.insertCategory
          : options.editCategory;
      return [
        {
          ...paletteCommand,
          category,
          // Prefer the localized slash-command label so palette matches `/` menu.
          label: sourceCommand.label,
          description:
            paletteCommand.id === "edit.insertTable"
              ? options.tableDescription
              : paletteCommand.description,
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
  const searchNavigationRef = useRef(0);
  const activeSearchTabRef = useRef(activeTab);
  activeSearchTabRef.current = activeTab;
  const handleOpenSearchMatch = useCallback(
    (row: GlobalSearchRow) => {
      const attempt = ++searchNavigationRef.current;
      void actions.openWorkspaceFile(row.file.path, { isCurrent: () => attempt === searchNavigationRef.current }).then((opened) => {
        if (!opened) return;
        setTimeout(() => {
          const current = activeSearchTabRef.current;
          if (attempt !== searchNavigationRef.current ||
              current?.sessionId !== opened.sessionId || current?.path !== row.file.path) return;
          editorPaneRef.current?.goToLine(row.match.line, { focus: false });
          setStatus(
            openedSearchMatchStatus(
              row.file.relativePath,
              row.match.line,
              menuLanguage,
            ),
          );
        }, 50);
      });
    },
    [actions, editorPaneRef, menuLanguage, setStatus],
  );
  const markdownPaletteCommands = useMemo(() => {
    const insertCategory =
      menuLanguage === "kana"
        ? "そうにゅう"
        : menuLanguage === "ja"
          ? "挿入"
          : "Insert";
    const tableDescription =
      menuLanguage === "kana"
        ? "3 れつの Markdown てーぶるを いれます。セルは へんしゅうがめんで かえてください。"
        : menuLanguage === "ja"
          ? "3 列の Markdown テーブルを挿入します。セルはエディタで編集してください。"
          : "Insert a 3-column Markdown table. Edit cells in the editor.";
    return buildMarkdownPaletteCommands(slashCommands, editorPaneRef, {
      editCategory: paletteCopy.categories.edit,
      insertCategory,
      tableDescription,
    });
  }, [editorPaneRef, menuLanguage, paletteCopy.categories.edit, slashCommands]);

  const commandCommands = useMemo<Command[]>(
    () =>
      buildCommandCommands({
        actions,
        activeTab,
        activeTabId,
        appleLocalAssistActive,
        appleLocalAssistAllowed,
        editorPaneRef,
        externalCliAllowed,
        lModeCopy,
        markdownPaletteCommands,
        paletteCopy,
        themePreference,
        workspaceRootPath,
        openGlobalSearch: () => openGlobalSearch(),
      }),
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
      workspaceRootPath,
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

  useEffect(() => {
    ++searchNavigationRef.current;
    return () => { ++searchNavigationRef.current; };
  }, [globalSearchVisible, globalSearchQuery, workspaceRootPath]);

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
