import { isJapaneseMenuLanguage, type MenuLanguage } from "../../types";
import { isKanaStyle } from "./_helpers";

export type CommandPaletteCategoryId =
  | "file"
  | "edit"
  | "view"
  | "review"
  | "agent"
  | "writingCompanion"
  | "settings"
  | "help";

export type CommandPaletteEntryCopy = {
  label: string;
  /** Extra locale-specific keywords for discoverability. */
  keywords?: readonly string[];
};

export type CommandPaletteCopy = {
  categories: Record<CommandPaletteCategoryId, string>;
  /** Localized reasons when a command cannot run (stay visible, not runnable). */
  disabledReasons: {
    needActiveDocument: string;
    /** Disk review / path-backed compare needs a saved path, not a pathless draft. */
    needSavedDocument: string;
    needWorkspace: string;
  };
  commands: {
    "file.new": CommandPaletteEntryCopy;
    "file.open": CommandPaletteEntryCopy;
    "file.importPdfImageDraft": CommandPaletteEntryCopy;
    "file.openReference": CommandPaletteEntryCopy;
    "file.openWorkspace": CommandPaletteEntryCopy;
    "file.quickOpen": CommandPaletteEntryCopy;
    "file.save": CommandPaletteEntryCopy;
    "file.saveAs": CommandPaletteEntryCopy;
    "file.closeTab": CommandPaletteEntryCopy;
    "file.closeWindow": CommandPaletteEntryCopy;
    "file.exportHtml": CommandPaletteEntryCopy;
    "file.exportEpubBeta": CommandPaletteEntryCopy;
    "file.exportPdf": CommandPaletteEntryCopy;
    "file.pinExternalImages": CommandPaletteEntryCopy;
    "file.restoreBackup": CommandPaletteEntryCopy;
    "edit.find": CommandPaletteEntryCopy;
    "edit.findInFiles": CommandPaletteEntryCopy;
    "view.preview": CommandPaletteEntryCopy;
    "view.wrap": CommandPaletteEntryCopy;
    "view.invisibles": CommandPaletteEntryCopy;
    "view.outline": CommandPaletteEntryCopy;
    "view.diff": CommandPaletteEntryCopy;
    "view.nextTab": CommandPaletteEntryCopy;
    "view.prevTab": CommandPaletteEntryCopy;
    "review.tabAgainstDisk": CommandPaletteEntryCopy;
    "review.okfDraftCompatibility": CommandPaletteEntryCopy;
    "file.okfScaffoldMinimal": CommandPaletteEntryCopy;
    "file.okfScaffoldBookLike": CommandPaletteEntryCopy;
    "agent.open": CommandPaletteEntryCopy;
    "agent.sendSelection": CommandPaletteEntryCopy;
    "agent.preferences": CommandPaletteEntryCopy;
    "apple-assist.openWindow": CommandPaletteEntryCopy;
    "assist.preferences": CommandPaletteEntryCopy;
    "settings.open": CommandPaletteEntryCopy;
    "help.localDataDisclosure": CommandPaletteEntryCopy;
    "help.supportDiagnostics": CommandPaletteEntryCopy;
    "help.privacyPolicy": CommandPaletteEntryCopy;
    "help.openSourceAcknowledgements": CommandPaletteEntryCopy;
    "help.about": CommandPaletteEntryCopy;
  };
};

export function getCommandPaletteCopy(lang: MenuLanguage): CommandPaletteCopy {
  if (isKanaStyle(lang)) {
    return {
      categories: {
        file: "ふぁいる",
        edit: "かく",
        view: "よむ",
        review: "たしかめる",
        agent: "Agent",
        writingCompanion: "Local Assist",
        settings: "せってい",
        help: "へるぷ",
      },
      disabledReasons: {
        needActiveDocument: "ドキュメントを ひらいてください",
        needSavedDocument: "いちど ほぞんしてください",
        needWorkspace: "ワークスペースを ひらいてください",
      },
      commands: {
        "file.new": {
          label: "あたらしき ふみ",
          keywords: ["しんき", "つくる", "かく"],
        },
        "file.open": {
          label: "ふみを ひらく…",
          keywords: ["ひらく", "よむ"],
        },
        "file.importPdfImageDraft": {
          label: "PDF / ゑ から したがきを つくる…",
          keywords: ["とりこみ", "したがき", "OCR", "かく"],
        },
        "file.openReference": {
          label: "さんしょう ふぁいるを よこに ひらく…",
          keywords: ["さんしょう", "みくらべ", "なおす"],
        },
        "file.openWorkspace": {
          label: "ところを ひらく…",
          keywords: ["ふぉるだ", "ところ"],
        },
        "file.quickOpen": {
          label: "ふみを すばやく ひらく",
          keywords: ["クイック", "けんさく"],
        },
        "file.save": {
          label: "ほぞん",
          keywords: ["かく", "セーブ"],
        },
        "file.saveAs": {
          label: "なまえをつけて ほぞん…",
          keywords: ["べつめい", "Save As"],
        },
        "file.closeTab": {
          label: "たぶを とぢる",
          keywords: ["とじる"],
        },
        "file.closeWindow": {
          label: "まどを とぢる",
          keywords: ["しゅうりょう"],
        },
        "file.exportHtml": {
          label: "HTML に かきだす…",
          keywords: ["ゆしゅつ", "とどける"],
        },
        "file.exportEpubBeta": {
          label: "EPUB に かきだす…",
          keywords: ["ほん", "ゆしゅつ"],
        },
        "file.exportPdf": {
          label: "PDF に かきだす…",
          keywords: ["ゆしゅつ", "いんさつ"],
        },
        "file.pinExternalImages": {
          label: "そとの がぞうを assets に こてい…",
          keywords: [
            "がぞう",
            "assets",
            "ピン",
            "かきかえ",
            "メディア",
            "pin",
          ],
        },
        "file.restoreBackup": {
          label: "じどう バックアップから もどす…",
          keywords: ["ふっきゅう", "たしかめる"],
        },
        "edit.find": {
          label: "さがす…",
          keywords: ["けんさく", "find"],
        },
        "edit.findInFiles": {
          label: "ところのなかを さがす…",
          keywords: ["ぜんたい", "grep"],
        },
        "view.preview": {
          label: "したみを ひらく / かくす",
          keywords: ["よむ", "みため", "プレビュー"],
        },
        "view.wrap": {
          label: "おりかえし ひょうじ",
          keywords: ["ワードラップ"],
        },
        "view.invisibles": {
          label: "みえない もじを ひょうじ",
          keywords: ["くうはく", "かいぎょう"],
        },
        "view.outline": {
          label: "みだしを ひらく / かくす",
          keywords: ["アウトライン", "いどう"],
        },
        "view.diff": {
          label: "さぶんを ひらく / かくす",
          keywords: ["くらべる", "たしかめる"],
        },
        "view.nextTab": {
          label: "つぎの たぶへ",
          keywords: ["フォーカス"],
        },
        "view.prevTab": {
          label: "まえの たぶへ",
          keywords: ["フォーカス"],
        },
        "review.tabAgainstDisk": {
          label: "ディスクと みくらべて たしかめる",
          keywords: ["さぶん", "がいぶ"],
        },
        "review.okfDraftCompatibility": {
          label: "ちしきフォルダ（OKF）を てんけん",
          keywords: [
            "OKF",
            "ごかん",
            "ちしき",
            "バンドル",
            "frontmatter",
            "てんけん",
            "Draft",
          ],
        },
        "file.okfScaffoldMinimal": {
          label: "ちしきフォルダの ひながたを つくる（さいしょう）",
          keywords: [
            "OKF",
            "ひながた",
            "テンプレ",
            "ちしき",
            "scaffold",
            "starter",
          ],
        },
        "file.okfScaffoldBookLike": {
          label: "ちしきフォルダの ひながたを つくる（ほんっぽい しょうだて）",
          keywords: [
            "OKF",
            "ひながた",
            "ほん",
            "しょう",
            "scaffold",
            "book",
          ],
        },
        "agent.open": {
          label: "Agent まどを ひらく",
          keywords: ["エージェント"],
        },
        "agent.sendSelection": {
          label: "せんたく はんいを Agent へ",
          keywords: ["そうしん"],
        },
        "agent.preferences": {
          label: "Agent Workbench のせってい…",
          keywords: ["せいのう", "consent"],
        },
        "apple-assist.openWindow": {
          label: "Hazakura Local Assist まどを ひらく",
          keywords: ["ローカル", "AI", "ととのえる"],
        },
        "assist.preferences": {
          label: "Assist のせってい…",
          keywords: ["ローカル"],
        },
        "settings.open": {
          label: "せってい…",
          keywords: ["環境設定", "preferences"],
        },
        "help.localDataDisclosure": {
          label: "ローカル データの せつめい…",
          keywords: ["プライバシー", "どういつ"],
        },
        "help.supportDiagnostics": {
          label: "サポート しんだん…",
          keywords: ["診断", "JSON"],
        },
        "help.privacyPolicy": {
          label: "プライバシー ポリシー…",
          keywords: ["個人情報"],
        },
        "help.openSourceAcknowledgements": {
          label: "オープンソース の しゃじ…",
          keywords: ["ライセンス", "依存"],
        },
        "help.about": {
          label: "Hazakura Editor について…",
          keywords: ["バージョン", "情報"],
        },
      },
    };
  }

  if (isJapaneseMenuLanguage(lang)) {
    return {
      categories: {
        file: "ファイル",
        edit: "書く",
        view: "読む",
        review: "確かめる",
        agent: "Agent",
        writingCompanion: "Local Assist",
        settings: "設定",
        help: "ヘルプ",
      },
      disabledReasons: {
        needActiveDocument: "ドキュメントを開いてください",
        needSavedDocument: "一度保存してください",
        needWorkspace: "ワークスペースを開いてください",
      },
      commands: {
        "file.new": {
          label: "新規ファイル",
          keywords: ["作成", "書く", "new"],
        },
        "file.open": {
          label: "ファイルを開く…",
          keywords: ["開く", "読む", "open"],
        },
        "file.importPdfImageDraft": {
          label: "PDF / 画像から下書きを作る…",
          keywords: ["取り込み", "下書き", "OCR", "書く"],
        },
        "file.openReference": {
          label: "参照ファイルを横に開く…",
          keywords: ["参照", "見比べ", "直す"],
        },
        "file.openWorkspace": {
          label: "ワークスペースを開く…",
          keywords: ["フォルダ", "場所"],
        },
        "file.quickOpen": {
          label: "ファイルをすばやく開く",
          keywords: ["クイックオープン", "検索"],
        },
        "file.save": {
          label: "保存",
          keywords: ["セーブ", "書く"],
        },
        "file.saveAs": {
          label: "名前を付けて保存…",
          keywords: ["別名", "Save As"],
        },
        "file.closeTab": {
          label: "タブを閉じる",
          keywords: ["閉じる"],
        },
        "file.closeWindow": {
          label: "ウィンドウを閉じる",
          keywords: ["終了"],
        },
        "file.exportHtml": {
          label: "HTML に書き出す…",
          keywords: ["エクスポート", "届ける"],
        },
        "file.exportEpubBeta": {
          label: "EPUB に書き出す…",
          keywords: ["本", "エクスポート"],
        },
        "file.exportPdf": {
          label: "PDF に書き出す…",
          keywords: ["エクスポート", "印刷"],
        },
        "file.pinExternalImages": {
          label: "外部画像を assets に固定…",
          keywords: [
            "画像",
            "assets",
            "ピン",
            "書き換え",
            "メディア",
            "pin",
            "import",
          ],
        },
        "file.restoreBackup": {
          label: "自動バックアップから復元…",
          keywords: ["復旧", "確かめる"],
        },
        "edit.find": {
          label: "検索…",
          keywords: ["探す", "find"],
        },
        "edit.findInFiles": {
          label: "ワークスペース内を検索…",
          keywords: ["全体", "grep"],
        },
        "view.preview": {
          label: "プレビューを表示 / 隠す",
          keywords: ["読む", "見た目", "確認"],
        },
        "view.wrap": {
          label: "折り返し表示",
          keywords: ["ワードラップ"],
        },
        "view.invisibles": {
          label: "不可視文字を表示",
          keywords: ["空白", "改行"],
        },
        "view.outline": {
          label: "アウトラインを表示 / 隠す",
          keywords: ["見出し", "移動"],
        },
        "view.diff": {
          label: "差分を表示 / 隠す",
          keywords: ["比較", "確かめる"],
        },
        "view.nextTab": {
          label: "次のタブへ",
          keywords: ["フォーカス"],
        },
        "view.prevTab": {
          label: "前のタブへ",
          keywords: ["フォーカス"],
        },
        "review.tabAgainstDisk": {
          label: "ディスクと見比べて確認",
          keywords: ["差分", "外部変更"],
        },
        "review.okfDraftCompatibility": {
          label: "知識フォルダ（OKF）を点検",
          keywords: [
            "OKF",
            "互換",
            "知識",
            "バンドル",
            "frontmatter",
            "点検",
            "Draft",
          ],
        },
        "file.okfScaffoldMinimal": {
          label: "知識フォルダのひな形を作成（最小）",
          keywords: [
            "OKF",
            "ひな形",
            "テンプレ",
            "知識",
            "scaffold",
            "starter",
          ],
        },
        "file.okfScaffoldBookLike": {
          label: "知識フォルダのひな形を作成（本っぽい章立て）",
          keywords: ["OKF", "ひな形", "本", "章", "scaffold", "book"],
        },
        "agent.open": {
          label: "Agent ウィンドウを開く",
          keywords: ["エージェント"],
        },
        "agent.sendSelection": {
          label: "選択範囲を Agent へ送る",
          keywords: ["送信"],
        },
        "agent.preferences": {
          label: "Agent Workbench の設定…",
          keywords: ["同意", "consent"],
        },
        "apple-assist.openWindow": {
          label: "Hazakura Local Assist を開く",
          keywords: ["ローカル", "AI", "整える"],
        },
        "assist.preferences": {
          label: "Assist の設定…",
          keywords: ["ローカル"],
        },
        "settings.open": {
          label: "設定…",
          keywords: ["環境設定", "preferences"],
        },
        "help.localDataDisclosure": {
          label: "ローカルデータの説明…",
          keywords: ["プライバシー", "開示"],
        },
        "help.supportDiagnostics": {
          label: "サポート診断…",
          keywords: ["診断", "JSON"],
        },
        "help.privacyPolicy": {
          label: "プライバシーポリシー…",
          keywords: ["個人情報"],
        },
        "help.openSourceAcknowledgements": {
          label: "オープンソースの謝辞…",
          keywords: ["ライセンス", "依存"],
        },
        "help.about": {
          label: "Hazakura Editor について…",
          keywords: ["バージョン", "情報"],
        },
      },
    };
  }

  return {
    categories: {
      file: "File",
      edit: "Edit",
      view: "View",
      review: "Review",
      agent: "Agent",
      writingCompanion: "Writing Companion",
      settings: "Settings",
      help: "Help",
    },
    disabledReasons: {
      needActiveDocument: "Open a document first.",
      needSavedDocument: "Save the document once first.",
      needWorkspace: "Open a workspace first.",
    },
    commands: {
      "file.new": { label: "New File", keywords: ["write", "create"] },
      "file.open": { label: "Open File…", keywords: ["read"] },
      "file.importPdfImageDraft": {
        label: "Create draft from PDF / image…",
        keywords: ["import", "OCR", "write"],
      },
      "file.openReference": {
        label: "Open reference beside editor…",
        keywords: ["compare", "side-by-side"],
      },
      "file.openWorkspace": { label: "Open Workspace…" },
      "file.quickOpen": { label: "Quick Open File" },
      "file.save": { label: "Save", keywords: ["write"] },
      "file.saveAs": { label: "Save As…" },
      "file.closeTab": { label: "Close Tab" },
      "file.closeWindow": { label: "Close Window" },
      "file.exportHtml": { label: "Export HTML…", keywords: ["deliver"] },
      "file.exportEpubBeta": { label: "Export EPUB…", keywords: ["book"] },
      "file.exportPdf": { label: "Export PDF…" },
      "file.pinExternalImages": {
        label: "Pin external images into assets…",
        keywords: ["image", "assets", "pin", "rewrite", "media", "import"],
      },
      "file.restoreBackup": {
        label: "Restore from Auto-Backup…",
        keywords: ["verify", "recover"],
      },
      "edit.find": { label: "Find…" },
      "edit.findInFiles": { label: "Find in Files…" },
      "view.preview": {
        label: "Show / hide Preview",
        keywords: ["read", "look"],
      },
      "view.wrap": { label: "Toggle Word Wrap" },
      "view.invisibles": { label: "Toggle Invisible Characters" },
      "view.outline": {
        label: "Show / hide Outline",
        keywords: ["jump", "headings"],
      },
      "view.diff": {
        label: "Show / hide Diff",
        keywords: ["verify", "compare"],
      },
      "view.nextTab": { label: "Focus Next Tab" },
      "view.prevTab": { label: "Focus Previous Tab" },
      "review.tabAgainstDisk": {
        label: "Review tab against disk",
        keywords: ["verify"],
      },
      "review.okfDraftCompatibility": {
        label: "Review knowledge folder (OKF)",
        keywords: [
          "OKF",
          "bundle",
          "frontmatter",
          "compatibility",
          "knowledge",
          "Draft",
        ],
      },
      "file.okfScaffoldMinimal": {
        label: "Create knowledge folder starter (minimal)",
        keywords: [
          "OKF",
          "scaffold",
          "template",
          "starter",
          "knowledge",
        ],
      },
      "file.okfScaffoldBookLike": {
        label: "Create knowledge folder starter (book-like)",
        keywords: ["OKF", "scaffold", "template", "book", "chapter"],
      },
      "agent.open": { label: "Open Agent Window" },
      "agent.sendSelection": { label: "Send Selection to Agent" },
      "agent.preferences": { label: "Agent Workbench Preferences…" },
      "apple-assist.openWindow": {
        label: "Open Hazakura Local Assist Window",
      },
      "assist.preferences": { label: "Assist Settings…" },
      "settings.open": { label: "Settings…" },
      "help.localDataDisclosure": { label: "Local Data Disclosure…" },
      "help.supportDiagnostics": { label: "Support Diagnostics…" },
      "help.privacyPolicy": { label: "Privacy Policy…" },
      "help.openSourceAcknowledgements": {
        label: "Open Source Acknowledgements…",
      },
      "help.about": { label: "About Hazakura Editor…" },
    },
  };
}

export function commandPaletteEntry(
  copy: CommandPaletteCopy,
  id: keyof CommandPaletteCopy["commands"],
  baseKeywords: readonly string[] = [],
): { label: string; keywords: string[] } {
  const entry = copy.commands[id];
  return {
    label: entry.label,
    keywords: [...baseKeywords, ...(entry.keywords ?? [])],
  };
}
