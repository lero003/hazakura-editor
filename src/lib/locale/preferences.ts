import {
  isJapaneseMenuLanguage,
  type MenuLanguage,
  type ThemePreference,
} from "../../types";
import { isKanaStyle } from "./_helpers";

export type PreferencesCopy = {
  ambientIntensity: string;
  ambientIntensityOff: string;
  ambientIntensitySubtle: string;
  ambientIntensityNormal: string;
  ambientIntensityDramatic: string;
  ambientIntensityHint: string;
  application: string;
  appearanceAndWriting: string;
  appleAssistDiffInitiallyOpen: string;
  appleAssistDiffInitiallyOpenHint: string;
  appleAssistStatusLabel: string;
  appleAssistStatusAvailable: string;
  appleAssistStatusUnavailable: (reason: string) => string;
  appleAssistStatusDisabled: string;
  appleAssistStatusUnsupported: string;
  autoBackup: string;
  autoBackupHint: string;
  dark: string;
  editor: string;
  editorDisplay: string;
  // Per-surface font size labels. Each label is used both
  // as the visible row text and the `aria-label` of its
  // number input on the preferences pane.
  editorFontSize: string;
  previewFontSize: string;
  workspaceFontSize: string;
  lModeFontSize: string;
  light: string;
  closeDialog: string;
  menuLanguage: string;
  menuLanguageHint: string;
  previewPane: string;
  edohigan: string;
  yakou: string;
  shokou: string;
  crt: string;
  shinkai: string;
  settingsTitle: string;
  showInvisibles: string;
  // スペルチェックトグル。エディタ Quick Settings にも同じ設定があるが、
  // 設定ペインからも切り替えられるように表示/編集系の設定を一箇所に集約する。
  spellcheck: string;
  tabSize: string;
  theme: string;
  themeHint: (theme: ThemePreference) => string;
  wrapLines: string;
  // Theme G — display & media (images)
  mediaAndDisplay: string;
  outsideImages: string;
  outsideImagesAsk: string;
  outsideImagesAllow: string;
  outsideImagesHint: string;
  loadRemoteImages: string;
  loadRemoteImagesHint: string;
  materializeImagesOnExport: string;
  materializeImagesOnExportHint: string;
  // Local Data Disclosure used to expose its chrome and
  // bodies through this copy map. The v0.16 pane now
  // reads a bundled English `.md` file
  // (`src/components/app/helpDocs/en/local-data-disclosure.md`)
  // and renders it through `renderMarkdown()`. The Help
  // surface is English-only by request (2026-06-09), and
  // the chrome (kicker / boundary note / footer) lives on
  // the `HelpDoc` object in `helpDocs/index.ts` rather
  // than in the localized `PreferencesCopy`. No
  // `privacy*` keys remain here.
};

export function getPreferencesCopy(lang: MenuLanguage): PreferencesCopy {
  if (isKanaStyle(lang)) {
    return {
      application: "あぷり",
      appearanceAndWriting: "みため と かくこと",
      appleAssistDiffInitiallyOpen: "Hazakura Local Assist の さぶんを ひらく",
      appleAssistDiffInitiallyOpenHint:
        "Hazakura Local Assist が ほんぶんを かへたら さぶんを すぐ みせます。",
      appleAssistStatusLabel: "Hazakura Local Assist の じょうたい",
      appleAssistStatusAvailable: "この Mac で つかえます。さぶんを みてから てきよう します。",
      appleAssistStatusUnavailable: (reason) =>
        `いま つかえません: ${reason}`,
      appleAssistStatusDisabled: "この せっしょんでは むこうです。",
      appleAssistStatusUnsupported: "この かんきょうでは つかえません。",
      autoBackup: "うつしのこし",
      autoBackupHint:
        "じぶんで ON にした ときだけ、ほぞんしていない へんこうを 30びょう ごとに .bak として のこします。",
      dark: "やみ",
      editor: "えでぃた",
      editorDisplay: "えでぃたのながめ",
      editorFontSize: "えでぃたのもじのおおきさ",
      previewFontSize: "したみのまどのもじのおおきさ",
      workspaceFontSize: "わーくすぺーすのもじのおおきさ",
      lModeFontSize: "えるもーどのもじのおおきさ",
      light: "ひかり",
      closeDialog: "といをとぢる",
      menuLanguage: "ことば",
      previewPane: "したみのまど",
      edohigan: "えどひがん（しじま）",
      yakou: "よるひかり",
      shokou: "あけぼのひかり",
      crt: "しびれる",
      shinkai: "しんかい",
      settingsTitle: "おこのみ",
      showInvisibles: "みえぬもじをしめす",
      spellcheck: "つづりを かくにん",
      tabSize: "いんでんとはば",
      theme: "いろあひ",
      wrapLines: "くだりををる",
      mediaAndDisplay: "ひょうじ と めでぃあ",
      outsideImages: "わーくすぺーす そと の がぞう",
      outsideImagesAsk: "きょか してから よむ",
      outsideImagesAllow: "すべて よむ（OS が きょかした はんい）",
      outsideImagesHint:
        "きてい は その ふみで ひつような おや フォルダだけ きょか。すべて よむ は ローカル がぞうを じどうで よみます。りもーと URL の きょかとは べつです。",
      loadRemoteImages: "Preview で りもーと がぞう を よむ",
      loadRemoteImagesHint:
        "https のみ。オン に すると サーバー に ようきゅう が とどきます。きてい は オフ。",
      materializeImagesOnExport: "かきだし に がぞう を ふくめる",
      materializeImagesOnExportHint:
        "よめる がぞう を HTML / PDF / EPUB に うめこみます。Markdown は かきかえません。",
      ambientIntensity: "うつろひ",
      ambientIntensityOff: "なし",
      ambientIntensitySubtle: "ほのか",
      ambientIntensityNormal: "つね",
      ambientIntensityDramatic: "あざやか",
      ambientIntensityHint: "えどひがん / よるひかり / あけぼのひかり / しびれる / しんかい の いろあひ で つかへます。",
      menuLanguageHint: "あぷり の ひょうじ げんご を きりかへ る。かなふみ は ひらがな ちゅうしん の やさしい ひょうき。",
      themeHint: (theme) => {
        if (theme === "light") {
          return "ひるま や いんさつ むけの あかるい きほん いろあひ。";
        }
        if (theme === "dark") {
          return "よるや ひくい しど むけの おちついた きほん いろあひ。";
        }
        if (theme === "edohigan") {
          return "はるの ひがん の ような、しずかで じょうひんな かく ば。えんしゅつ は ひかえめ、けいさん は おもい じょうだんてーまです。";
        }
        if (theme === "yakou") {
          return "よるの よさめ むけ。ふかめの いろ と うごき の ある きせつ いろあひ。";
        }
        if (theme === "crt") {
          return "むかしの でんしき ぶらうんかん の よう な えんしゅつ。あえて よみにくい じょうだんてーまです。";
        }
        if (theme === "shinkai") {
          return "すいちゅう の よう な えんしゅつ。ちり が ながれ に ただよい、て で かきまわす と みず が うごく じょうだんてーまです。";
        }
        return "あけがた の そら を おもわせる あけぼのいろ。えんしゅつ やや つよめ の きせつ いろあひ。";
      },
    };
  }

  return isJapaneseMenuLanguage(lang)
    ? {
        application: "アプリケーション",
        appearanceAndWriting: "見た目と書き心地",
        appleAssistDiffInitiallyOpen: "Hazakura Local Assist の差分を自動で開く",
        appleAssistDiffInitiallyOpenHint:
          "Hazakura Local Assist が本文を変更したとき、確認用の小さな差分を最初から表示します。",
        appleAssistStatusLabel: "Hazakura Local Assist の状態",
        appleAssistStatusAvailable:
          "この Mac で利用できます。提案は差分で確認してから明示的に適用します。",
        appleAssistStatusUnavailable: (reason) =>
          `現在は利用できません: ${reason}`,
        appleAssistStatusDisabled: "このアプリセッションでは無効です。",
        appleAssistStatusUnsupported: "この環境では利用できません。",
        autoBackup: "自動バックアップ",
        autoBackupHint:
          "自分で有効化した場合だけ、未保存の変更を30秒ごとに .bak として残します。",
        dark: "ダーク",
        editor: "エディタ",
        editorDisplay: "エディタ表示",
        editorFontSize: "エディタのフォントサイズ",
        previewFontSize: "プレビューのフォントサイズ",
        workspaceFontSize: "ワークスペースのフォントサイズ",
        lModeFontSize: "えるモードのフォントサイズ",
        light: "ライト",
        closeDialog: "ダイアログ゙を閉じる",
        menuLanguage: "メニュー言語",
        menuLanguageHint: "UI の表示言語を切り替えます。かなふみはひらがな中心のやさしい表記です。",
        previewPane: "プレビュー表示",
        edohigan: "江戸彼岸（静謐）",
        yakou: "夜光",
        shokou: "曙光",
        crt: "CRT（お遊び）",
        shinkai: "深海（お遊び）",
        settingsTitle: "設定",
        showInvisibles: "不可視文字を表示",
        spellcheck: "スペルチェック",
        tabSize: "インデント幅",
        theme: "テーマ",
        wrapLines: "行を折り返す",
        mediaAndDisplay: "表示とメディア",
        outsideImages: "ワークスペース外の画像",
        outsideImagesAsk: "許可してから読む",
        outsideImagesAllow: "すべて読む（OS が許可した範囲）",
        outsideImagesHint:
          "既定は現在の文書で必要な親フォルダだけを明示許可します。すべて読むはローカル画像を自動で読みます。リモート URL の許可とは別です。",
        loadRemoteImages: "Preview でリモート画像を読み込む",
        loadRemoteImagesHint:
          "https のみ。オンにすると画像ホストへリクエストが届きます。既定はオフです。",
        materializeImagesOnExport: "書き出しに画像を含める",
        materializeImagesOnExportHint:
          "読める画像を HTML / PDF / EPUB パッケージに埋め込みます。Markdown 本文は書き換えません。",
        ambientIntensity: "アンビエント演出",
        ambientIntensityOff: "オフ",
        ambientIntensitySubtle: "控えめ",
        ambientIntensityNormal: "標準",
        ambientIntensityDramatic: "鮮やか",
        ambientIntensityHint: "edohigan / yakou / shokou / crt / shinkai テーマの時に有効です。",
        themeHint: (theme) => {
          if (theme === "light") {
            return "日中や印刷向けの明るい基本テーマ。";
          }
          if (theme === "dark") {
            return "夜間や低照度向けの落ち着いた基本テーマ。";
          }
          if (theme === "edohigan") {
            return "春の彼岸のような、静かで上質な執筆空間。演出は控えめですが、計算は重い冗談テーマです。";
          }
          if (theme === "yakou") {
            return "夜長向け。深めの配色と、動きのある演出のアンビエントテーマ。";
          }
          if (theme === "crt") {
            return "旧式ブラウン管のような演出。あえて読みにくい冗談テーマです。";
          }
          if (theme === "shinkai") {
            return "水中のような演出。チリが流れに漂い、手でかき回すと水が動く冗談テーマです。";
          }
          return "明け方の空を思わせる曙色。演出やや強めのアンビエントテーマ。";
        },
      }
    : {
        application: "Application",
        appearanceAndWriting: "Appearance & Writing",
        appleAssistDiffInitiallyOpen: "Open Hazakura Local Assist diff automatically",
        appleAssistDiffInitiallyOpenHint:
          "Show the compact diff immediately after Hazakura Local Assist changes the text.",
        appleAssistStatusLabel: "Hazakura Local Assist status",
        appleAssistStatusAvailable:
          "Available on this Mac. Review the diff, then apply explicitly.",
        appleAssistStatusUnavailable: (reason) =>
          `Currently unavailable: ${reason}`,
        appleAssistStatusDisabled: "Disabled in this app session.",
        appleAssistStatusUnsupported: "Not supported in this environment.",
        autoBackup: "Auto-backup",
        autoBackupHint:
          "When you enable it, unsaved changes are written as .bak snapshots every 30 seconds.",
        dark: "Dark",
        editor: "Editor",
        editorDisplay: "Editor display",
        editorFontSize: "Editor font size",
        previewFontSize: "Preview font size",
        workspaceFontSize: "Workspace font size",
        lModeFontSize: "L Mode font size",
        light: "Light",
        closeDialog: "Close dialog",
        menuLanguage: "Menu language",
        menuLanguageHint: "Switch the UI display language. Kana mode uses gentle hiragana-centered wording.",
        previewPane: "Preview pane",
        edohigan: "Edohigan (Quietude)",
        yakou: "Yakou",
        shokou: "Shokou",
        crt: "CRT (joke)",
        shinkai: "Shinkai (joke)",
        settingsTitle: "Preferences",
        showInvisibles: "Show invisibles",
        spellcheck: "Spellcheck",
        tabSize: "Indent size",
        theme: "Theme",
        wrapLines: "Wrap lines",
        mediaAndDisplay: "Display & media",
        outsideImages: "Images outside the workspace",
        outsideImagesAsk: "Ask before loading",
        outsideImagesAllow: "Allow all (within OS access)",
        outsideImagesHint:
          "The default approves only the needed parent folder for the current document. Allow all loads local images automatically. Remote URL permission is separate.",
        loadRemoteImages: "Load remote images in Preview",
        loadRemoteImagesHint:
          "https only. When on, the image host receives a request. Default is off.",
        materializeImagesOnExport: "Include images in export packages",
        materializeImagesOnExportHint:
          "Embed readable images into HTML / PDF / EPUB. Does not rewrite Markdown source.",
        ambientIntensity: "Ambient effects",
        ambientIntensityOff: "Off",
        ambientIntensitySubtle: "Subtle",
        ambientIntensityNormal: "Normal",
        ambientIntensityDramatic: "Vivid",
        ambientIntensityHint: "Applies when using edohigan, yakou, shokou, crt, or shinkai themes.",
        themeHint: (theme) => {
          if (theme === "light") {
            return "Bright, neutral base theme for daytime and print.";
          }
          if (theme === "dark") {
            return "Calm, low-light base theme for nighttime use.";
          }
          if (theme === "edohigan") {
            return "A quiet, refined writing space like spring equinox light. Subtle ambience; a heavyweight joke theme.";
          }
          if (theme === "yakou") {
            return "Deeper palette with animated effects. Late-evening seasonal theme.";
          }
          if (theme === "crt") {
            return "Old-school CRT look. A deliberately hard-to-read joke theme.";
          }
          if (theme === "shinkai") {
            return "Underwater look. Drifting dust in gentle currents; stir the water with your cursor. Joke theme.";
          }
          return "Dawn pastels with stronger ambient effects. Early-morning seasonal theme.";
        },
      };
}
