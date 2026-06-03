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
  TextEncoding,
} from "../../types";
import { isJapaneseMenuLanguage } from "../../types";
import { isKanaStyle } from "../../lib/locale/_helpers";
import type { SlashCommand } from "../../types/slash";
import { normalizeTextLineEndings } from "../../lib/utils";
import { formatLineEndingKind } from "../../lib/format";
import { markdownFormatStatus } from "../../lib/statusMessages";

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatTodayIsoDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

function formatNowTime(): string {
  const now = new Date();
  return `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
}

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

  const convertActiveEncoding = useCallback(
    (encoding: TextEncoding) => {
      if (!activeTab) {
        setStatus("No active tab to convert");
        return;
      }

      // Encoding conversion mirrors the line-ending selector: the
      // in-memory buffer stays a plain JS string, and the tab's
      // `encoding` field is flipped to drive the save-time
      // re-encoding in src-tauri/src/util.rs (encode_text). The
      // actual byte rewrite happens on the next save.
      setTabs((currentTabs) =>
        currentTabs.map((tab) =>
          tab.id === activeTab.id
            ? {
                ...tab,
                encoding,
                saveStatus: "idle",
                error: null,
              }
            : tab,
        ),
      );
      setStatus(`Encoding set to ${encoding}`);
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
    const loc = (kana: string, japanese: string, english: string) => {
      if (isKanaStyle(menuLanguage)) return kana;
      if (isJapaneseMenuLanguage(menuLanguage)) return japanese;
      return english;
    };
    const commands: SlashCommand[] = [
      {
        category: "markdown",
        hint: "h1, #",
        id: "heading-1",
        insertText: "# ",
        label: loc("みだし 1", "見出し 1", "Heading 1"),
        searchKeys: ["h1", "heading-1", "heading 1", "#", "見出し1", "見出し 1"],
      },
      {
        category: "markdown",
        hint: "h2, ##",
        id: "heading-2",
        insertText: "## ",
        label: loc("みだし 2", "見出し 2", "Heading 2"),
        searchKeys: ["h2", "heading-2", "heading 2", "##", "見出し2", "見出し 2"],
      },
      {
        category: "markdown",
        hint: "h3, ###",
        id: "heading-3",
        insertText: "### ",
        label: loc("みだし 3", "見出し 3", "Heading 3"),
        searchKeys: ["h3", "heading-3", "heading 3", "###", "見出し3", "見出し 3"],
      },
      {
        category: "markdown",
        hint: "ul, -",
        id: "bullet-list",
        insertText: "- ",
        label: loc("かじょが き", "箇条書き", "Bullet list"),
        searchKeys: ["ul", "bullet", "list", "-", "箇条書き", "リスト"],
      },
      {
        category: "markdown",
        hint: "ol, 1.",
        id: "numbered-list",
        insertText: "1. ",
        label: loc("ばんごうつき りすと", "番号付きリスト", "Numbered list"),
        searchKeys: ["ol", "numbered", "1.", "番号", "番号付き"],
      },
      {
        category: "markdown",
        hint: "task, [ ]",
        id: "task-list",
        insertText: "- [ ] ",
        label: loc("たすく りすと", "タスクリスト", "Task list"),
        searchKeys: ["task", "todo", "[]", "[ ]", "タスク", "チェック"],
      },
      {
        category: "markdown",
        hint: ">",
        id: "quote",
        insertText: "> ",
        label: loc("いんよう", "引用", "Quote"),
        searchKeys: ["quote", "blockquote", ">", "引用"],
      },
      {
        category: "markdown",
        hint: "```",
        id: "code-block",
        insertText: "```\n\n```\n",
        label: loc("こーど ぶろっく", "コードブロック", "Code block"),
        searchKeys: ["code", "codeblock", "fence", "```", "コード"],
      },
      {
        category: "markdown",
        hint: "---",
        id: "divider",
        insertText: "\n---\n",
        label: loc("くぎり せん", "区切り線", "Divider"),
        searchKeys: ["divider", "hr", "horizontal rule", "---", "区切り"],
      },
      {
        category: "markdown",
        hint: "tbl",
        id: "table",
        insertText: "| Col 1 | Col 2 | Col 3 |\n| --- | --- | --- |\n|     |     |     |\n",
        label: loc("てーぶる", "テーブル", "Table"),
        searchKeys: ["table", "tbl", "テーブル", "表"],
      },
      {
        category: "markdown",
        hint: "Cmd+K",
        id: "link",
        label: loc("りんく", "リンク", "Link"),
        searchKeys: ["link", "url", "href", "リンク", "つなぎ"],
        action: () => {
          applyActiveMarkdownFormat("link");
        },
      },
      {
        category: "markdown",
        hint: "![]()",
        id: "image",
        label: loc("がぞう", "画像", "Image"),
        searchKeys: ["image", "img", "picture", "画像", "イメージ"],
        action: () => {
          applyActiveMarkdownFormat("image");
        },
      },
      {
        category: "markdown",
        hint: "Cmd+B",
        id: "bold",
        label: loc("ふとじ", "太字", "Bold"),
        searchKeys: ["bold", "strong", "**", "太字", "ふとじ"],
        action: () => {
          applyActiveMarkdownFormat("bold");
        },
      },
      {
        category: "markdown",
        hint: "Cmd+I",
        id: "italic",
        label: loc("しゃたい", "斜体", "Italic"),
        searchKeys: ["italic", "emphasis", "*", "斜体", "ななめ"],
        action: () => {
          applyActiveMarkdownFormat("italic");
        },
      },
      {
        category: "markdown",
        hint: "Cmd+E",
        id: "inline-code",
        label: loc("いんらいん こーど", "インラインコード", "Inline code"),
        searchKeys: ["code", "inline-code", "inline", "`", "コード"],
        action: () => {
          applyActiveMarkdownFormat("code");
        },
      },
      {
        category: "markdown",
        hint: "~~",
        id: "strikethrough",
        label: loc("うちけし せん", "打ち消し線", "Strikethrough"),
        searchKeys: [
          "strikethrough",
          "strike",
          "~~",
          "打ち消し",
          "とりけし",
        ],
        action: () => {
          applyActiveMarkdownFormat("strikethrough");
        },
      },
      {
        category: "markdown",
        hint: "YYYY-MM-DD",
        id: "today-date",
        label: loc("きょうの ひづけ", "今日の日付", "Today's date"),
        searchKeys: ["date", "today", "now", "日付", "今日"],
        action: () => {
          insertMarkdownAtCursor(formatTodayIsoDate());
        },
      },
      {
        category: "markdown",
        hint: "HH:MM",
        id: "now-time",
        label: loc("げんざい じこく", "現在時刻", "Now timestamp"),
        searchKeys: ["time", "now", "timestamp", "時刻", "時間"],
        action: () => {
          insertMarkdownAtCursor(formatNowTime());
        },
      },
      {
        category: "shortcut",
        hint: loc("ちかみち", "shortcut", "shortcuts"),
        id: "shortcut-list",
        insertText: loc(
          "## ちかみち\n\n- Cmd+Shift+R: Review Desk を ひらく\n- Cmd+Shift+T: てーぶるを そうにゅう\n- Cmd+B / Cmd+I / Cmd+E / Cmd+K: ふとじ / しゃたい / いんらいん こーど / りんく\n- Cmd+F: けんさく\n- Cmd+P: くいっく おーぷん\n",
          "## ショートカット\n\n- Cmd+Shift+R: Review Desk を開く\n- Cmd+Shift+T: テーブルを挿入\n- Cmd+B / Cmd+I / Cmd+E / Cmd+K: 太字 / 斜体 / インラインコード / リンク\n- Cmd+F: 検索\n- Cmd+P: クイックオープン\n",
          "## Shortcuts\n\n- Cmd+Shift+R: Open Review Desk\n- Cmd+Shift+T: Insert table\n- Cmd+B / Cmd+I / Cmd+E / Cmd+K: Bold / Italic / Inline code / Link\n- Cmd+F: Find\n- Cmd+P: Quick Open\n",
        ),
        label: loc("ちかみち いちらん", "ショートカット一覧", "Shortcut list"),
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
        label: loc("Review Desk を ひらく", "Review Desk を開く", "Open Review Desk"),
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
          setStatus(loc("Review Desk を ひらきました", "Review Desk を開きました", "Review Desk opened"));
        },
      },
      {
        category: "review",
        hint: "review, diff",
        id: "review-changes",
        label: loc("へんこうを かくにん (でぃすく)", "変更を確認 (ディスク)", "Review changes vs disk"),
        searchKeys: ["review", "review-changes", "diff", "変更", "確認"],
        action: () => {
          if (!activeTab) {
            setStatus(loc("ひかく たいしょうの たぶが ありません", "比較対象のタブがありません", "No active tab to review"));
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
        label: loc("したがきを れびゅー", "下書きをレビュー", "Review unsaved draft"),
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
        label: loc("せんたくはんいを Agent に そうしん", "選択範囲を Agent に送信", "Send selection to Agent"),
        searchKeys: ["agent", "send", "send-to-agent", "エージェント", "送信"],
        action: () => {
          const text = editorPaneRef.current?.getSelectionText() ?? "";
          if (!text.trim()) {
            setStatus(
              loc(
                "Agent に おくる もじを せんたく して ください",
                "Agent に送るテキストを選択してください",
                "Select text to send to the Agent",
              ),
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
    applyActiveMarkdownFormat,
    editorPaneRef,
    handleSendSelectionToAgent,
    insertMarkdownAtCursor,
    menuLanguage,
    openReviewDesk,
    requestReviewDraftAgainstDisk,
    requestReviewTabAgainstDisk,
    setStatus,
  ]);

  return {
    applyActiveMarkdownFormat,
    convertActiveEncoding,
    convertActiveLineEnding,
    handleEditorChange,
    insertMarkdownAtCursor,
    insertTable,
    jumpToHeading,
    slashCommands,
  };
}
