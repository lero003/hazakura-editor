import { isJapaneseMenuLanguage, type MenuLanguage } from "../types";
import { EXTERNAL_CHANGE_CONFLICT_MESSAGE } from "../types";

// ── Helpers ──

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}/${month}/${day} ${hours}:${minutes}`;
}

function formatSaveFailureMessage(): string {
  return (
    "Save failed. Your edits are still in the editor. " +
    "Fix the file or folder issue, then try saving again."
  );
}

function isKanaStyle(lang: MenuLanguage): boolean {
  return lang === "kana";
}

// ── Copy Types ──

export type SafeEditorCopy = {
  emptyTabs: string;
  newFile: string;
  noFileOpen: string;
  noFolderOpen: string;
  openFile: string;
  openFolder: string;
  openWorkspaceFolder: string;
  recentFiles: string;
  startHeading: string;
  startActions: string;
  workspace: string;
  workspaceFileTree: string;
};

export type SidePaneCopy = {
  agentTab: string;
  agentTabTitle: string;
  agentWorkbench: string;
  diffTab: string;
  diffTabTitle: string;
  fileComparison: string;
  imagePreview: string;
  markdownPreview: string;
  outlineEmpty: string;
  outlineTab: string;
  outlineTabTitle: string;
  outlineTruncated: string;
  documentOutline: string;
  openTextFileToPreview: string;
  previewDisabled: string;
  previewTab: string;
  previewTabTitle: string;
  previewUnavailable: string;
  resizeColumns: string;
  resizeColumnsTitle: string;
  sidePaneMode: string;
};

export type EditorChromeCopy = {
  caseSensitive: string;
  closeSearch: string;
  find: string;
  findInActiveFile: string;
  findOptions: string;
  go: string;
  goToLine: string;
  inlineCode: string;
  inlineCodeTitle: string;
  invalidRegex: string;
  italic: string;
  italicTitle: string;
  line: string;
  lineEnding: string;
  lineEndings: string;
  link: string;
  linkTitle: string;
  markdownHelpers: string;
  next: string;
  noMatches: string;
  noSearch: string;
  previous: string;
  regex: string;
  replace: string;
  replacePlaceholder: string;
  replaceOne: string;
  replaceAll: string;
  searchActiveFile: string;
  strong: string;
  strongTitle: string;
  word: string;
};

export type RecoveryCopy = {
  closeWithoutSaving: string;
  conflictActions: string;
  conflictDetail: string;
  conflictHeading: string;
  discardDraft: string;
  draftActions: string;
  draftAvailable: (name: string) => string;
  keepEditing: string;
  reopenFromDisk: string;
  reviewChanges: string;
  restoreDraft: string;
  saveErrorActions: string;
  saveFailure: string;
  savedLocally: (timestamp: number) => string;
  trySaveAgain: string;
};

export type SlashMenuCopy = {
  agentBadge: string;
  categoryAgent: string;
  categoryMarkdown: string;
  categoryReview: string;
  categoryShortcut: string;
  empty: string;
  markdownBadge: string;
  reviewBadge: string;
  shortcutBadge: string;
};

export type PreferencesCopy = {
  ambientIntensity: string;
  ambientIntensityOff: string;
  ambientIntensitySubtle: string;
  ambientIntensityNormal: string;
  ambientIntensityDramatic: string;
  ambientIntensityHint: string;
  application: string;
  autoBackup: string;
  dark: string;
  editor: string;
  editorDisplay: string;
  fontSize: string;
  fontSizeControl: string;
  light: string;
  closeDialog: string;
  menuLanguage: string;
  previewPane: string;
  sakura: string;
  yakou: string;
  shokou: string;
  kouyou: string;
  settingsTitle: string;
  showInvisibles: string;
  tabSize: string;
  theme: string;
  wrapLines: string;
};

export type AgentWorkbenchCopy = {
  title: string;
  modeHeading: string;
  modeSectionLabel: string;
  sessionHeading: string;
  sessionSectionLabel: string;
  boundaryHeading: string;
  boundarySectionLabel: string;
  enableAfterRestart: string;
  activeSessionMode: string;
  safeSessionMode: string;
  restartRequired: string;
  restartNow: string;
  restarting: string;
  provider: string;
  session: string;
  workspace: string;
  noWorkspace: string;
  providerControl: string;
  boundaryItems: string[];
  consent: string;
  modeBadgeActive: string;
  modeBadgePending: string;
  modeBadgeTitle: string;
};

export type ReviewDeskCopy = {
  candidateApplyButton: string;
  candidateApplyButtonTitle: string;
  candidateApplyDisabledHint: string;
  candidateApplyWillMarkUnsaved: string;
  candidateClearButton: string;
  candidateClearButtonTitle: string;
  candidateColumnLeft: string;
  candidateColumnRight: string;
  candidateCompareButton: string;
  candidateCompareButtonTitle: string;
  candidateCompareDisabledHint: string;
  candidateEmptyHeading: string;
  candidateEmptyHint: string;
  candidateInputHint: string;
  candidateInputLabel: string;
  candidateInputPlaceholder: string;
  candidatePreviewBufferAtCompareLabel: string;
  candidatePreviewBufferAtCompareText: (lines: number, chars: number) => string;
  candidatePreviewCandidateSizeLabel: string;
  candidatePreviewCandidateSizeText: (lines: number, chars: number) => string;
  candidatePreviewComparedAtLabel: string;
  candidatePreviewEmpty: string;
  candidatePreviewTargetLabel: string;
  candidatePreviewTitle: string;
  candidateSourceManual: string;
  candidateStaleActionReCompare: string;
  candidateStaleHeading: string;
  candidateStaleReasonBufferEdited: string;
  candidateStaleReasonNoActiveTab: string;
  candidateStaleReasonTabSwitched: (label: string | null) => string;
  close: string;
  closeTitle: string;
  emptyBody: string;
  emptyIntro: string;
  entryButton: string;
  entryButtonTitle: string;
  futureSlotHint: string;
  surfaceLabel: string;
  title: string;
};

// ── Accessors ──

export function getSafeEditorCopy(lang: MenuLanguage): SafeEditorCopy {
  if (isKanaStyle(lang)) {
    return {
      emptyTabs: "ふみなし",
      newFile: "あたらしきふみ",
      noFileOpen: "ふみなし",
      noFolderOpen: "ふぉるだなし",
      openFile: "ふみをひらく",
      openFolder: "ふぉるだをひらく",
      openWorkspaceFolder: "ところをひらく",
      recentFiles: "このごろのふみ",
      startHeading: "しづかにかきはじめる",
      startActions: "はじめのわざ",
      workspace: "ところ",
      workspaceFileTree: "ところのふみならび",
    };
  }

  return isJapaneseMenuLanguage(lang)
    ? {
        emptyTabs: "ファイル未選択",
        newFile: "新規ファイル",
        noFileOpen: "ファイル未選択",
        noFolderOpen: "フォルダ未選択",
        openFile: "ファイルを開く",
        openFolder: "フォルダを開く",
        openWorkspaceFolder: "ワークスペースフォルダを開く",
        recentFiles: "最近使ったファイル",
        startHeading: "静かに書き始める",
        startActions: "開始操作",
        workspace: "ワークスペース",
        workspaceFileTree: "ワークスペースのファイルツリー",
      }
    : {
        emptyTabs: "No open files",
        newFile: "New File",
        noFileOpen: "No file open",
        noFolderOpen: "No folder open",
        openFile: "Open File",
        openFolder: "Open Folder",
        openWorkspaceFolder: "Open workspace folder",
        recentFiles: "Recent files",
        startHeading: "Start writing quietly",
        startActions: "Start actions",
        workspace: "Workspace",
        workspaceFileTree: "Workspace file tree",
      };
}

export function getSidePaneCopy(lang: MenuLanguage): SidePaneCopy {
  if (isKanaStyle(lang)) {
    return {
      agentTab: "えーじぇんと",
      agentTabTitle: "えーじぇんとのまどをひらく",
      agentWorkbench: "えーじぇんとのつくゑ",
      diffTab: "ちがひ",
      diffTabTitle: "ちがひのまどをひらく",
      fileComparison: "ふみくらべ",
      imagePreview: "ゑのしたみ",
      markdownPreview: "Markdown したみ",
      outlineEmpty: "このふみに Markdown のみだしはありません。",
      outlineTab: "みだし",
      outlineTabTitle: "みだしをしめす",
      outlineTruncated: "みだしがおほいため、はじめの200件までしめします。",
      documentOutline: "ふみのみだし",
      openTextFileToPreview:
        "Markdown したみをしめすには、てきすとのふみをひらいてください。",
      previewDisabled: "したみのまどは、おこのみにて無効です。",
      previewTab: "したみ",
      previewTabTitle: "したみのまどをしめす",
      previewUnavailable: "したみをしめせません",
      resizeColumns: "えでぃたとよこのまどのはばをかへる",
      resizeColumnsTitle: "ひきて、えでぃたとよこのまどのはばをかへます",
      sidePaneMode: "よこのまど",
    };
  }

  return isJapaneseMenuLanguage(lang)
    ? {
        agentTab: "エージェント",
        agentTabTitle: "エージェントペインを表示",
        agentWorkbench: "エージェントワークベンチ",
        diffTab: "差分",
        diffTabTitle: "差分ペインを表示",
        fileComparison: "ファイル比較",
        imagePreview: "画像プレビュー",
        markdownPreview: "Markdown プレビュー",
        outlineEmpty: "このファイルに Markdown 見出しはありません。",
        outlineTab: "アウトライン",
        outlineTabTitle: "アウトラインを表示",
        outlineTruncated: "見出しが多いため、最初の200件まで表示しています。",
        documentOutline: "文書アウトライン",
        openTextFileToPreview:
          "Markdown プレビューを表示するにはテキストファイルを開いてください。",
        previewDisabled: "プレビューは設定で無効です。",
        previewTab: "プレビュー",
        previewTabTitle: "プレビューペインを表示",
        previewUnavailable: "プレビューを表示できません",
        resizeColumns: "エディタとサイドペインの幅を変更",
        resizeColumnsTitle:
          "ドラッグしてエディタとサイドペインの幅を変更",
        sidePaneMode: "サイドペイン表示",
      }
    : {
        agentTab: "Agent",
        agentTabTitle: "Show agent pane",
        agentWorkbench: "Agent Workbench",
        diffTab: "Diff",
        diffTabTitle: "Show diff pane",
        fileComparison: "File comparison",
        imagePreview: "Image Preview",
        markdownPreview: "Markdown preview",
        outlineEmpty: "This file has no Markdown headings.",
        outlineTab: "Outline",
        outlineTabTitle: "Show outline pane",
        outlineTruncated:
          "Showing the first 200 headings because this file has more.",
        documentOutline: "Document outline",
        openTextFileToPreview: "Open a text file to show Markdown preview.",
        previewDisabled: "Preview pane is disabled in Preferences.",
        previewTab: "Preview",
        previewTabTitle: "Show preview pane",
        previewUnavailable: "Preview unavailable",
        resizeColumns: "Resize editor and side pane columns",
        resizeColumnsTitle: "Drag to resize editor and side pane",
        sidePaneMode: "Side pane mode",
      };
}

export function getSlashMenuCopy(lang: MenuLanguage): SlashMenuCopy {
  if (isKanaStyle(lang)) {
    return {
      agentBadge: "Agent",
      categoryAgent: "えーじぇんとのわざ",
      categoryMarkdown: "Markdown のかたまり",
      categoryReview: "れびゅーのつくゑ",
      categoryShortcut: "ちかみち",
      empty: "あふすらっしゅこまんどはありません",
      markdownBadge: "Md",
      reviewBadge: "みる",
      shortcutBadge: "Key",
    };
  }

  return isJapaneseMenuLanguage(lang)
    ? {
        agentBadge: "Agent",
        categoryAgent: "エージェントコマンド",
        categoryMarkdown: "Markdown ブロック",
        categoryReview: "レビューデスク",
        categoryShortcut: "ショートカット",
        empty: "一致するスラッシュコマンドがありません",
        markdownBadge: "Md",
        reviewBadge: "確認",
        shortcutBadge: "Key",
      }
    : {
        agentBadge: "Agent",
        categoryAgent: "Agent commands",
        categoryMarkdown: "Markdown blocks",
        categoryReview: "Review Desk",
        categoryShortcut: "Shortcuts",
        empty: "No matching slash command",
        markdownBadge: "Md",
        reviewBadge: "Rv",
        shortcutBadge: "Key",
      };
}

export function getEditorChromeCopy(lang: MenuLanguage): EditorChromeCopy {
  if (isKanaStyle(lang)) {
    return {
      caseSensitive: "おほもじ",
      closeSearch: "さがしをとぢる",
      find: "さがす",
      findInActiveFile: "いまのふみをさがす",
      findOptions: "さがしのおこのみ",
      go: "ゆく",
      goToLine: "くだりへゆく",
      inlineCode: "こーど",
      inlineCodeTitle: "こーど (Command+E)",
      invalidRegex: "正規表現がただしくありません",
      italic: "ななめ",
      italicTitle: "ななめ (Command+I)",
      line: "くだり",
      lineEnding: "かへり",
      lineEndings: "かへりのしるし",
      link: "つなぎ",
      linkTitle: "つなぎ (Command+K)",
      markdownHelpers: "Markdown たすけ",
      next: "つぎへ",
      noMatches: "あたりなし",
      noSearch: "さがしなし",
      previous: "まへへ",
      regex: "正規表現",
      replace: "おきかへ",
      replacePlaceholder: "おきかへるもじ",
      replaceOne: "おきかへ",
      replaceAll: "すべておきかへ",
      searchActiveFile: "いまのふみをさがす",
      strong: "ふとじ",
      strongTitle: "ふとじ (Command+B)",
      word: "ことば",
    };
  }

  return isJapaneseMenuLanguage(lang)
    ? {
        caseSensitive: "大文字",
        closeSearch: "検索を閉じる",
        find: "検索",
        findInActiveFile: "アクティブファイル内を検索",
        findOptions: "検索オプション",
        go: "移動",
        goToLine: "指定行へ移動",
        inlineCode: "インラインコード",
        inlineCodeTitle: "インラインコード (Command+E)",
        invalidRegex: "正規表現が無効です",
        italic: "斜体",
        italicTitle: "斜体 (Command+I)",
        line: "行",
        lineEnding: "改行",
        lineEndings: "改行コード",
        link: "リンク",
        linkTitle: "リンク (Command+K)",
        markdownHelpers: "Markdown 補助",
        next: "次へ",
        noMatches: "一致なし",
        noSearch: "検索なし",
        previous: "前へ",
        regex: "正規表現",
        replace: "置換",
        replacePlaceholder: "置換する文字列",
        replaceOne: "置換",
        replaceAll: "すべて置換",
        searchActiveFile: "アクティブファイルを検索",
        strong: "太字",
        strongTitle: "太字 (Command+B)",
        word: "単語",
      }
    : {
        caseSensitive: "Case",
        closeSearch: "Close search",
        find: "Find",
        findInActiveFile: "Find in active file",
        findOptions: "Find options",
        go: "Go",
        goToLine: "Go to line",
        inlineCode: "Inline code",
        inlineCodeTitle: "Inline code (Command+E)",
        invalidRegex: "Invalid regex",
        italic: "Italic",
        italicTitle: "Italic (Command+I)",
        line: "Line",
        lineEnding: "Line",
        lineEndings: "Line endings",
        link: "Link",
        linkTitle: "Link (Command+K)",
        markdownHelpers: "Markdown helpers",
        next: "Next",
        noMatches: "No matches",
        noSearch: "No search",
        previous: "Prev",
        regex: "Regex",
        replace: "Replace",
        replacePlaceholder: "Replace with",
        replaceOne: "Replace",
        replaceAll: "Replace all",
        searchActiveFile: "Search active file",
        strong: "Bold",
        strongTitle: "Bold (Command+B)",
        word: "Word",
      };
}

export function getRecoveryCopy(lang: MenuLanguage): RecoveryCopy {
  return isJapaneseMenuLanguage(lang)
    ? {
        closeWithoutSaving: "保存せず閉じる",
        conflictActions: "外部変更の操作",
        conflictDetail:
          "ディスク上のファイルが別のアプリまたは Agent provider によって変更された可能性があります。続行方法を選ぶまで保存は停止されます。",
        conflictHeading: "ファイルが外部で変更されました",
        discardDraft: "下書きを破棄",
        draftActions: "下書きの操作",
        draftAvailable: (name: string) => `${name} の未保存下書きがあります。`,
        keepEditing: "編集を続ける",
        reopenFromDisk: "ディスクから再読み込み",
        reviewChanges: "変更を確認",
        restoreDraft: "下書きを復元",
        saveErrorActions: "保存エラーの操作",
        saveFailure:
          "保存に失敗しました。編集内容はエディタ内に残っています。ファイルやフォルダの問題を確認してから、もう一度保存してください。",
        savedLocally: (timestamp: number) =>
          `ローカル保存: ${formatTimestamp(timestamp)}`,
        trySaveAgain: "もう一度保存",
      }
    : {
        closeWithoutSaving: "Close without saving",
        conflictActions: "Conflict actions",
        conflictDetail: EXTERNAL_CHANGE_CONFLICT_MESSAGE,
        conflictHeading: "File changed outside hazakura",
        discardDraft: "Discard draft",
        draftActions: "Draft actions",
        draftAvailable: (name: string) =>
          `Unsaved draft available for ${name}.`,
        keepEditing: "Keep editing",
        reopenFromDisk: "Reopen from disk",
        reviewChanges: "Review changes",
        restoreDraft: "Restore draft",
        saveErrorActions: "Save error actions",
        saveFailure: formatSaveFailureMessage(),
        savedLocally: (timestamp: number) =>
          `Saved locally ${formatTimestamp(timestamp)}.`,
        trySaveAgain: "Try save again",
      };
}

export function getPreferencesCopy(lang: MenuLanguage): PreferencesCopy {
  if (isKanaStyle(lang)) {
    return {
      application: "あぷり",
      autoBackup: "うつしのこし",
      dark: "やみ",
      editor: "えでぃた",
      editorDisplay: "えでぃたのながめ",
      fontSize: "もじのおおきさ",
      fontSizeControl: "えでぃたのもじのおおきさ",
      light: "ひかり",
      closeDialog: "といをとぢる",
      menuLanguage: "ことば",
      previewPane: "したみのまど",
      sakura: "さくら",
      yakou: "よるひかり",
      shokou: "あけぼのひかり",
      kouyou: "もみぢ",
      settingsTitle: "おこのみ",
      showInvisibles: "みえぬもじをしめす",
      tabSize: "たぶのはば",
      theme: "いろあひ",
      wrapLines: "くだりををる",
      ambientIntensity: "うつろひ",
      ambientIntensityOff: "なし",
      ambientIntensitySubtle: "ほのか",
      ambientIntensityNormal: "つね",
      ambientIntensityDramatic: "はなやか",
      ambientIntensityHint: "きせつのいろあひにてはたらきます。",
    };
  }

  return isJapaneseMenuLanguage(lang)
    ? {
        application: "アプリケーション",
        autoBackup: "自動バックアップ",
        dark: "ダーク",
        editor: "エディタ",
        editorDisplay: "エディタ表示",
        fontSize: "フォントサイズ",
        fontSizeControl: "エディタのフォントサイズ",
        light: "ライト",
        closeDialog: "ダイアログ゙を閉じる",
        menuLanguage: "メニュー言語",
        previewPane: "プレビュー表示",
        sakura: "桜",
        yakou: "夜光",
        shokou: "曙光",
        kouyou: "紅葉",
        settingsTitle: "設定",
        showInvisibles: "不可視文字を表示",
        tabSize: "タブ幅",
        theme: "テーマ",
        wrapLines: "行を折り返す",
        ambientIntensity: "アンビエント演出",
        ambientIntensityOff: "オフ",
        ambientIntensitySubtle: "控えめ",
        ambientIntensityNormal: "標準",
        ambientIntensityDramatic: "派手",
        ambientIntensityHint: "季節テーマで有効です。",
      }
    : {
        application: "Application",
        autoBackup: "Auto-backup",
        dark: "Dark",
        editor: "Editor",
        editorDisplay: "Editor display",
        fontSize: "Font size",
        fontSizeControl: "Editor font size",
        light: "Light",
        closeDialog: "Close dialog",
        menuLanguage: "Menu language",
        previewPane: "Preview pane",
        sakura: "Sakura",
        yakou: "Yakou",
        shokou: "Shokou",
        kouyou: "Kouyou",
        settingsTitle: "Preferences",
        showInvisibles: "Show invisibles",
        tabSize: "Tab size",
        theme: "Theme",
        wrapLines: "Wrap lines",
        ambientIntensity: "Ambient effects",
        ambientIntensityOff: "Off",
        ambientIntensitySubtle: "Subtle",
        ambientIntensityNormal: "Normal",
        ambientIntensityDramatic: "Dramatic",
        ambientIntensityHint: "Applies to seasonal themes.",
      };
}

export function getAgentWorkbenchCopy(lang: MenuLanguage): AgentWorkbenchCopy {
  return isJapaneseMenuLanguage(lang)
    ? {
        title: "エージェントワークベンチ",
        modeHeading: "モード",
        modeSectionLabel: "エージェントモード",
        sessionHeading: "セッション",
        sessionSectionLabel: "エージェントセッション",
        boundaryHeading: "責任境界",
        boundarySectionLabel: "エージェントの責任境界",
        enableAfterRestart: "再起動後にエージェントワークベンチを有効化",
        activeSessionMode:
          "このアプリセッションではエージェントワークベンチが有効です。",
        safeSessionMode:
          "このアプリセッションでは Safe Editor モードが有効です。",
        restartRequired:
          "エージェント画面と CLI 起動の有効状態を切り替えるには、hazakura editor の再起動が必要です。",
        restartNow: "今すぐ再起動",
        restarting: "再起動中...",
        provider: "プロバイダー",
        session: "セッション",
        workspace: "ワークスペース",
        noWorkspace: "ワークスペース未選択",
        providerControl: "エージェントワークベンチのプロバイダー",
        boundaryItems: [
          "hazakura は汎用 shell prompt を提供しません。",
          "hazakura が直接起動できるのは許可リスト済みの agent CLI だけです。",
          "起動した CLI の挙動は CLI 側仕様とユーザー操作に依存します。",
          "エージェントワークベンチは信頼できる workspace でだけ使ってください。",
          "CLI が作った変更を採用するかはユーザーが判断します。",
        ],
        consent: "エージェントワークベンチの責任境界を理解しました。",
        modeBadgeActive: "エージェントモード",
        modeBadgePending: "エージェントモード: 再起動待ち",
        modeBadgeTitle:
          "エージェントワークベンチは Safe Editor モードとは別の trust boundary です。",
      }
    : {
        title: "Agent Workbench",
        modeHeading: "Mode",
        modeSectionLabel: "Agent mode",
        sessionHeading: "Session",
        sessionSectionLabel: "Agent session",
        boundaryHeading: "Boundary",
        boundarySectionLabel: "Agent responsibility boundary",
        enableAfterRestart: "Enable Agent Workbench after restart",
        activeSessionMode:
          "Agent Workbench mode is active for this app session.",
        safeSessionMode: "Safe Editor Mode is active for this app session.",
        restartRequired:
          "Restart hazakura editor before Agent Workbench UI or backend launch commands change.",
        restartNow: "Restart now",
        restarting: "Restarting...",
        provider: "Provider",
        session: "Session",
        workspace: "Workspace",
        noWorkspace: "No workspace selected",
        providerControl: "Agent Workbench provider",
        boundaryItems: [
          "hazakura does not provide a general-purpose shell prompt.",
          "hazakura can directly launch only allowlisted agent CLIs.",
          "The launched CLI behavior depends on the CLI and your actions inside it.",
          "Use Agent Workbench only in trusted workspaces.",
          "You review and decide what to do with CLI-made changes.",
        ],
        consent: "I understand the Agent Workbench responsibility boundary.",
        modeBadgeActive: "Agent Mode",
        modeBadgePending: "Agent Mode: restart pending",
        modeBadgeTitle:
          "Agent Workbench is a separate trust boundary from Safe Editor Mode.",
      };
}

export function getReviewDeskCopy(lang: MenuLanguage): ReviewDeskCopy {
  if (isKanaStyle(lang)) {
    return {
      candidateApplyButton: "うつす",
      candidateApplyButtonTitle: "手動候補をいまのたぶへうつす",
      candidateApplyDisabledHint:
        "うつすには、えでぃたたぶと候補のしたみが必要です。",
      candidateApplyWillMarkUnsaved:
        "うつすと、いまのふみが候補におきかえられ、ほぞんするまでは未保存です。",
      candidateClearButton: "けす",
      candidateClearButtonTitle: "候補入力としたみをけす",
      candidateColumnLeft: "いまのふみ",
      candidateColumnRight: "候補",
      candidateCompareButton: "くらべる",
      candidateCompareButtonTitle: "いまのふみと候補をくらべる",
      candidateCompareDisabledHint:
        "くらべるには、えでぃたでてきすとをひらき、候補を入れてください。",
      candidateEmptyHeading: "くらべるふみがありません",
      candidateEmptyHint:
        "れびゅーのつくゑは、えでぃたでてきすとをひらいているときだけ使えます。",
      candidateInputHint:
        "くらべたい候補てきすとをここへ貼り付けます。",
      candidateInputLabel: "候補てきすと",
      candidateInputPlaceholder: "ここへ候補てきすとを貼り付けてください…",
      candidatePreviewBufferAtCompareLabel: "くらべたときのふみ",
      candidatePreviewBufferAtCompareText: (lines, chars) =>
        `${lines} くだり / ${chars} もじ`,
      candidatePreviewCandidateSizeLabel: "候補のおおきさ",
      candidatePreviewCandidateSizeText: (lines, chars) =>
        `${lines} くだり / ${chars} もじ`,
      candidatePreviewComparedAtLabel: "くらべたじこく",
      candidatePreviewEmpty:
        "くらべるを押すと、いまのふみと候補のちがひをここにしめします。",
      candidatePreviewTargetLabel: "あたらしいふみ",
      candidatePreviewTitle: "候補のしたみ",
      candidateSourceManual: "手で貼り付け",
      candidateStaleActionReCompare: "もういちどくらべる",
      candidateStaleHeading: "したみがふるくなっています",
      candidateStaleReasonBufferEdited:
        "くらべたあと、いまのふみがかきかえられたため、したみが今とあっていません。",
      candidateStaleReasonNoActiveTab:
        "くらべたふみがとぢられたため、したみはもうつかえません。",
      candidateStaleReasonTabSwitched: (label) =>
        label !== null
          ? `いまは「${label}」がひらいています。いまのふみで、もういちどくらべてください。`
          : "別のふみがひらいています。いまのふみで、もういちどくらべてください。",
      close: "とぢる",
      closeTitle: "れびゅーのつくゑをとぢる",
      emptyBody:
        "いまは候補てきすとを貼り付け、ひらいているえでぃた内容とくらべられます。",
      emptyIntro:
        "れびゅーのつくゑは、候補てきすとを保存前にたしかめるところです。",
      entryButton: "れびゅー",
      entryButtonTitle: "れびゅーのつくゑをひらく (Cmd+Shift+R)",
      futureSlotHint:
        "AI 候補などの前に、まず手動候補を明示的にくらべます。",
      surfaceLabel: "れびゅーのつくゑ",
      title: "れびゅーのつくゑ",
    };
  }

  return isJapaneseMenuLanguage(lang)
    ? {
        candidateApplyButton: "候補を適用",
        candidateApplyButtonTitle:
          "手動候補を現在のタブのバッファへ適用",
        candidateApplyDisabledHint:
          "適用するには、エディタタブと候補プレビューが必要です。",
        candidateApplyWillMarkUnsaved:
          "適用すると現在のバッファが置き換えられ、保存するまで未保存です。",
        candidateClearButton: "クリア",
        candidateClearButtonTitle: "候補入力とプレビューを消去",
        candidateColumnLeft: "現在のバッファ",
        candidateColumnRight: "手動候補",
        candidateCompareButton: "比較",
        candidateCompareButtonTitle: "現在のバッファと手動候補を比較",
        candidateCompareDisabledHint:
          "比較するには、エディタでテキストファイルを開き、候補テキストを入力してください。",
        candidateEmptyHeading: "比較できるエディタタブがありません",
        candidateEmptyHint:
          "レビューデスクの手動候補レビューは、エディタでテキストを開いているときだけ使えます。",
        candidateInputHint:
          "比較したい候補テキスト（AI 出力、レビューメモ、別バージョンなど）をここに貼り付けます。",
        candidateInputLabel: "手動候補テキスト",
        candidateInputPlaceholder:
          "ここに候補テキストを貼り付けてください…",
        candidatePreviewBufferAtCompareLabel: "比較時点のバッファ",
        candidatePreviewBufferAtCompareText: (lines, chars) =>
          `${lines} 行 / ${chars} 文字`,
        candidatePreviewCandidateSizeLabel: "候補サイズ",
        candidatePreviewCandidateSizeText: (lines, chars) =>
          `${lines} 行 / ${chars} 文字`,
        candidatePreviewComparedAtLabel: "比較時刻",
        candidatePreviewEmpty:
          "比較ボタンを押すと、現在のバッファと手動候補の差分プレビューがここに表示されます。",
        candidatePreviewTargetLabel: "保存先",
        candidatePreviewTitle: "手動候補プレビュー",
        candidateSourceManual: "手動貼り付け",
        candidateStaleActionReCompare: "再比較",
        candidateStaleHeading: "プレビューが古くなっています",
        candidateStaleReasonBufferEdited:
          "比較後にバッファが編集されたため、プレビューが現在の状態と一致していません。",
        candidateStaleReasonNoActiveTab:
          "比較したタブが閉じられたため、プレビューはもう使えません。",
        candidateStaleReasonTabSwitched: (label) =>
          label !== null
            ? `現在は「${label}」が開かれています。現在のタブに対して再比較してください。`
            : "別のタブが開かれています。現在のタブに対して再比較してください。",
        close: "閉じる",
        closeTitle: "レビューデスクを閉じる",
        emptyBody:
          "現在は手動候補テキストを貼り付けて、開いているエディタ内容と比較できます。ファイル比較やディスクとの差分確認は、引き続き差分 / 変更確認の既存ルートから使います。",
        emptyIntro:
          "レビューデスクは、候補テキストを保存前に確認してからバッファへ適用するためのレビュー画面です。",
        entryButton: "レビューデスク",
        entryButtonTitle: "レビューデスクを開く (Cmd+Shift+R)",
        futureSlotHint:
          "AI 候補や他のレビュー経路を扱う前に、まず手動貼り付け候補を明示的に比較・適用します。",
        surfaceLabel: "レビューデスク",
        title: "レビューデスク",
      }
    : {
        candidateApplyButton: "Apply candidate",
        candidateApplyButtonTitle:
          "Apply the manual candidate to the current tab buffer",
        candidateApplyDisabledHint:
          "Open an editor tab and render a candidate preview to enable Apply.",
        candidateApplyWillMarkUnsaved:
          "Apply replaces the current buffer; the file remains unsaved until you save it.",
        candidateClearButton: "Clear",
        candidateClearButtonTitle: "Discard candidate input and preview",
        candidateColumnLeft: "Current buffer",
        candidateColumnRight: "Manual candidate",
        candidateCompareButton: "Compare",
        candidateCompareButtonTitle:
          "Compare the current buffer with the manual candidate",
        candidateCompareDisabledHint:
          "Open a text file in the editor and paste a candidate to enable Compare.",
        candidateEmptyHeading: "No editor tab is open to compare",
        candidateEmptyHint:
          "The Review Desk manual candidate review is only available while a text file is open in the editor.",
        candidateInputHint:
          "Paste a candidate snapshot (AI output, review notes, an alternate draft) to compare against the current buffer.",
        candidateInputLabel: "Manual candidate text",
        candidateInputPlaceholder: "Paste candidate text here…",
        candidatePreviewBufferAtCompareLabel: "Buffer at compare",
        candidatePreviewBufferAtCompareText: (lines, chars) =>
          `${lines} lines / ${chars} chars`,
        candidatePreviewCandidateSizeLabel: "Candidate size",
        candidatePreviewCandidateSizeText: (lines, chars) =>
          `${lines} lines / ${chars} chars`,
        candidatePreviewComparedAtLabel: "Compared at",
        candidatePreviewEmpty:
          "Press Compare to render a diff preview of the current buffer and the manual candidate here.",
        candidatePreviewTargetLabel: "Target",
        candidatePreviewTitle: "Manual candidate preview",
        candidateSourceManual: "Manual paste",
        candidateStaleActionReCompare: "Re-run Compare",
        candidateStaleHeading: "Preview is out of date",
        candidateStaleReasonBufferEdited:
          "The buffer was edited after Compare, so the preview no longer matches the current state.",
        candidateStaleReasonNoActiveTab:
          "The compared tab is no longer open, so the preview can no longer be applied.",
        candidateStaleReasonTabSwitched: (label) =>
          label !== null
            ? `The active tab is now "${label}". Re-run Compare to refresh the preview for the active tab.`
            : "A different tab is active. Re-run Compare to refresh the preview for the active tab.",
        close: "Close",
        closeTitle: "Close Review Desk",
        emptyBody:
          "For now, paste manual candidate text here to compare it with the open editor buffer. File comparisons and disk-change reviews still use the existing Diff / Review changes routes.",
        emptyIntro:
          "Review Desk is a review surface for checking candidate text before applying it to the buffer.",
        entryButton: "Review Desk",
        entryButtonTitle: "Open Review Desk (Cmd+Shift+R)",
        futureSlotHint:
          "Manual pasted candidates are explicit first; AI candidates and other review routes can connect later without bypassing review.",
        surfaceLabel: "Review Desk",
        title: "Review Desk",
      };
}
