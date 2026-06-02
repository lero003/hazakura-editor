import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
  useMemo,
} from "react";
import type {
  EditorPaneHandle,
  MarkdownFormat,
} from "../../components/editor/EditorPane";
import type {
  DraftRecord,
  EditableLineEnding,
  EditorTab,
  MarkdownHeading,
  MenuLanguage,
} from "../../types";
import type { SlashCommand } from "../../types/slash";
import { normalizeTextLineEndings } from "../../lib/utils";
import { formatLineEndingKind } from "../document/useDocumentStatus";
import { markdownFormatStatus } from "../../lib/statusMessages";

type UseEditorCommandsOptions = {
  activeDraft: DraftRecord | null;
  activeTab: EditorTab | null;
  activeTabId: string | null;
  agentWorkbenchActive: boolean;
  editorPaneRef: RefObject<EditorPaneHandle | null>;
  handleSendSelectionToAgent: (text: string) => void;
  menuLanguage: MenuLanguage;
  openReviewDesk: () => void;
  requestReviewDraftAgainstDisk: (tab: EditorTab, draft: DraftRecord) => void;
  requestReviewTabAgainstDisk: (tab: EditorTab) => void;
  setStatus: (message: string) => void;
  setTabs: Dispatch<SetStateAction<EditorTab[]>>;
};

export function useEditorCommands({
  activeDraft,
  activeTab,
  activeTabId,
  agentWorkbenchActive,
  editorPaneRef,
  handleSendSelectionToAgent,
  menuLanguage,
  openReviewDesk,
  requestReviewDraftAgainstDisk,
  requestReviewTabAgainstDisk,
  setStatus,
  setTabs,
}: UseEditorCommandsOptions) {
  const handleEditorChange = useCallback(
    (nextValue: string) => {
      if (!activeTabId) {
        return;
      }

      setTabs((currentTabs) =>
        currentTabs.map((tab) =>
          tab.id === activeTabId
            ? {
                ...tab,
                contents: nextValue,
                saveStatus: "idle",
                error: null,
              }
            : tab,
        ),
      );
    },
    [activeTabId, setTabs],
  );

  const insertMarkdownAtCursor = useCallback(
    (markdown: string) => {
      editorPaneRef.current?.insertText(markdown);
    },
    [editorPaneRef],
  );

  const insertTable = useCallback(() => {
    editorPaneRef.current?.insertTable(3);
  }, [editorPaneRef]);

  const jumpToHeading = useCallback(
    (heading: MarkdownHeading) => {
      editorPaneRef.current?.goToLine(heading.line);
      setStatus(`Moved to line ${heading.line}`);
    },
    [editorPaneRef, setStatus],
  );

  const convertActiveLineEnding = useCallback(
    (lineEnding: EditableLineEnding) => {
      if (!activeTab) {
        setStatus("No active tab to convert");
        return;
      }

      const nextContents = normalizeTextLineEndings(
        activeTab.contents,
        "lf",
      );

      setTabs((currentTabs) =>
        currentTabs.map((tab) =>
          tab.id === activeTab.id
            ? {
                ...tab,
                contents: nextContents,
                line_ending: lineEnding,
                saveStatus: "idle",
                error: null,
              }
            : tab,
        ),
      );
      setStatus(`Line endings set to ${formatLineEndingKind(lineEnding)}`);
    },
    [activeTab, setStatus, setTabs],
  );

  const applyActiveMarkdownFormat = useCallback(
    (format: MarkdownFormat) => {
      if (!activeTab) {
        setStatus("No active tab to format");
        return;
      }

      editorPaneRef.current?.applyMarkdownFormat(format);
      setStatus(markdownFormatStatus(format));
    },
    [activeTab, editorPaneRef, setStatus],
  );

  const slashCommands = useMemo<SlashCommand[]>(() => {
    const ja = menuLanguage !== "en";
    const commands: SlashCommand[] = [
      {
        category: "markdown",
        hint: "h1, #",
        id: "heading-1",
        insertText: "# ",
        label: ja ? "見出し 1" : "Heading 1",
        searchKeys: ["h1", "heading-1", "heading 1", "#", "見出し1", "見出し 1"],
      },
      {
        category: "markdown",
        hint: "h2, ##",
        id: "heading-2",
        insertText: "## ",
        label: ja ? "見出し 2" : "Heading 2",
        searchKeys: ["h2", "heading-2", "heading 2", "##", "見出し2", "見出し 2"],
      },
      {
        category: "markdown",
        hint: "h3, ###",
        id: "heading-3",
        insertText: "### ",
        label: ja ? "見出し 3" : "Heading 3",
        searchKeys: ["h3", "heading-3", "heading 3", "###", "見出し3", "見出し 3"],
      },
      {
        category: "markdown",
        hint: "ul, -",
        id: "bullet-list",
        insertText: "- ",
        label: ja ? "箇条書き" : "Bullet list",
        searchKeys: ["ul", "bullet", "list", "-", "箇条書き", "リスト"],
      },
      {
        category: "markdown",
        hint: "ol, 1.",
        id: "numbered-list",
        insertText: "1. ",
        label: ja ? "番号付きリスト" : "Numbered list",
        searchKeys: ["ol", "numbered", "1.", "番号", "番号付き"],
      },
      {
        category: "markdown",
        hint: "task, [ ]",
        id: "task-list",
        insertText: "- [ ] ",
        label: ja ? "タスクリスト" : "Task list",
        searchKeys: ["task", "todo", "[]", "[ ]", "タスク", "チェック"],
      },
      {
        category: "markdown",
        hint: ">",
        id: "quote",
        insertText: "> ",
        label: ja ? "引用" : "Quote",
        searchKeys: ["quote", "blockquote", ">", "引用"],
      },
      {
        category: "markdown",
        hint: "```",
        id: "code-block",
        insertText: "```\n\n```\n",
        label: ja ? "コードブロック" : "Code block",
        searchKeys: ["code", "codeblock", "fence", "```", "コード"],
      },
      {
        category: "markdown",
        hint: "---",
        id: "divider",
        insertText: "\n---\n",
        label: ja ? "区切り線" : "Divider",
        searchKeys: ["divider", "hr", "horizontal rule", "---", "区切り"],
      },
      {
        category: "markdown",
        hint: "tbl",
        id: "table",
        insertText: "| Col 1 | Col 2 | Col 3 |\n| --- | --- | --- |\n|     |     |     |\n",
        label: ja ? "テーブル" : "Table",
        searchKeys: ["table", "tbl", "テーブル", "表"],
      },
      {
        category: "shortcut",
        hint: ja ? "shortcut" : "shortcuts",
        id: "shortcut-list",
        insertText: ja
          ? "## ショートカット\n\n- Cmd+Shift+R: Review Desk を開く\n- Cmd+Shift+T: テーブルを挿入\n- Cmd+B / Cmd+I / Cmd+E / Cmd+K: 太字 / 斜体 / インラインコード / リンク\n- Cmd+F: 検索\n- Cmd+P: クイックオープン\n"
          : "## Shortcuts\n\n- Cmd+Shift+R: Open Review Desk\n- Cmd+Shift+T: Insert table\n- Cmd+B / Cmd+I / Cmd+E / Cmd+K: Bold / Italic / Inline code / Link\n- Cmd+F: Find\n- Cmd+P: Quick Open\n",
        label: ja ? "ショートカット一覧" : "Shortcut list",
        searchKeys: [
          "shortcut",
          "shortcuts",
          "keybindings",
          "help",
          "ショートカット",
          "キー",
          "ヘルプ",
        ],
      },
      {
        category: "review",
        hint: "Cmd+Shift+R",
        id: "open-review-desk",
        label: ja ? "Review Desk を開く" : "Open Review Desk",
        searchKeys: [
          "review",
          "review-desk",
          "desk",
          "cmd-shift-r",
          "候補",
          "レビュー",
        ],
        action: () => {
          openReviewDesk();
          setStatus(ja ? "Review Desk を開きました" : "Review Desk opened");
        },
      },
      {
        category: "review",
        hint: "review, diff",
        id: "review-changes",
        label: ja ? "変更を確認 (ディスク)" : "Review changes vs disk",
        searchKeys: ["review", "review-changes", "diff", "変更", "確認"],
        action: () => {
          if (!activeTab) {
            setStatus(ja ? "比較対象のタブがありません" : "No active tab to review");
            return;
          }
          requestReviewTabAgainstDisk(activeTab);
        },
      },
    ];

    if (activeTab && activeDraft) {
      commands.push({
        category: "review",
        hint: "draft",
        id: "review-draft",
        label: ja ? "下書きをレビュー" : "Review unsaved draft",
        searchKeys: ["draft", "review-draft", "下書き", "復元"],
        action: () => {
          if (!activeTab || !activeDraft) return;
          requestReviewDraftAgainstDisk(activeTab, activeDraft);
        },
      });
    }

    if (agentWorkbenchActive) {
      commands.push({
        category: "agent",
        hint: "agent, send",
        id: "send-to-agent",
        label: ja ? "選択範囲を Agent に送信" : "Send selection to Agent",
        searchKeys: ["agent", "send", "send-to-agent", "エージェント", "送信"],
        action: () => {
          const text = editorPaneRef.current?.getSelectionText() ?? "";
          if (!text.trim()) {
            setStatus(
              ja
                ? "Agent に送るテキストを選択してください"
                : "Select text to send to the Agent",
            );
            return;
          }
          handleSendSelectionToAgent(text);
        },
      });
    }

    return commands;
  }, [
    activeDraft,
    activeTab,
    agentWorkbenchActive,
    editorPaneRef,
    handleSendSelectionToAgent,
    menuLanguage,
    openReviewDesk,
    requestReviewDraftAgainstDisk,
    requestReviewTabAgainstDisk,
    setStatus,
  ]);

  return {
    applyActiveMarkdownFormat,
    convertActiveLineEnding,
    handleEditorChange,
    insertMarkdownAtCursor,
    insertTable,
    jumpToHeading,
    slashCommands,
  };
}
