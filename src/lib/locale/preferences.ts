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
  sakura: string;
  yakou: string;
  shokou: string;
  crt: string;
  settingsTitle: string;
  showInvisibles: string;
  tabSize: string;
  theme: string;
  themeHint: (theme: ThemePreference) => string;
  wrapLines: string;
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
      autoBackup: "うつしのこし",
      autoBackupHint:
        "じぶんで ON にした ときだけ、未保存の へんこうを 30びょう ごとに .bak として のこします。",
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
      sakura: "さくら",
      yakou: "よるひかり",
      shokou: "あけぼのひかり",
      crt: "しびえる",
      settingsTitle: "おこのみ",
      showInvisibles: "みえぬもじをしめす",
      tabSize: "いんでんとはば",
      theme: "いろあひ",
      wrapLines: "くだりををる",
      ambientIntensity: "うつろひ",
      ambientIntensityOff: "なし",
      ambientIntensitySubtle: "ほのか",
      ambientIntensityNormal: "つね",
      ambientIntensityDramatic: "あざやか",
      ambientIntensityHint: "さくら / よるひかり / あけぼのひかり / しびれる の いろあひ で つかへます。",
      menuLanguageHint: "あぷり の ひょうじ げんご を きりかへ る。かなふみ は ひらがな ちゅうしん の やさしい ひょうき。",
      themeHint: (theme) => {
        if (theme === "light") {
          return "ひるま や いんさつ むけの あかるい きほん いろあひ。";
        }
        if (theme === "dark") {
          return "よるや ひくい しど むけの おちついた きほん いろあひ。";
        }
        if (theme === "sakura") {
          return "はるらしい あわい さくらいろ の きせつ いろあひ。";
        }
        if (theme === "yakou") {
          return "よるの よさめ むけ。ふかめの いろ と うごき の ある きせつ いろあひ。";
        }
        if (theme === "crt") {
          return "むかしの でんしき ぶらうんかん の よう な えんしゅつ。あえて よみにく い じょうけ ん て ま す。";
        }
        return "あけがた の そら を 思わせる あけぼのいろ。えんしゅつ やや つよめ の きせつ いろあひ。";
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
        sakura: "桜",
        yakou: "夜光",
        shokou: "曙光",
        crt: "CRT（お遊び）",
        settingsTitle: "設定",
        showInvisibles: "不可視文字を表示",
        tabSize: "インデント幅",
        theme: "テーマ",
        wrapLines: "行を折り返す",
        ambientIntensity: "アンビエント演出",
        ambientIntensityOff: "オフ",
        ambientIntensitySubtle: "控えめ",
        ambientIntensityNormal: "標準",
        ambientIntensityDramatic: "鮮やか",
        ambientIntensityHint: "sakura / yakou / shokou / crt テーマの時に有効です。",
        themeHint: (theme) => {
          if (theme === "light") {
            return "日中や印刷向けの明るい基本テーマ。";
          }
          if (theme === "dark") {
            return "夜間や低照度向けの落ち着いた基本テーマ。";
          }
          if (theme === "sakura") {
            return "春らしい淡い桜色のアンビエントテーマ。";
          }
          if (theme === "yakou") {
            return "夜長向け。深めの配色と、動きのある演出のアンビエントテーマ。";
          }
          if (theme === "crt") {
            return "旧式ブラウン管のような演出。あえて読みにくい冗談テーマです。";
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
        sakura: "Sakura",
        yakou: "Yakou",
        shokou: "Shokou",
        crt: "CRT (joke)",
        settingsTitle: "Preferences",
        showInvisibles: "Show invisibles",
        tabSize: "Indent size",
        theme: "Theme",
        wrapLines: "Wrap lines",
        ambientIntensity: "Ambient effects",
        ambientIntensityOff: "Off",
        ambientIntensitySubtle: "Subtle",
        ambientIntensityNormal: "Normal",
        ambientIntensityDramatic: "Vivid",
        ambientIntensityHint: "Applies when using sakura, yakou, shokou, or crt themes.",
        themeHint: (theme) => {
          if (theme === "light") {
            return "Bright, neutral base theme for daytime and print.";
          }
          if (theme === "dark") {
            return "Calm, low-light base theme for nighttime use.";
          }
          if (theme === "sakura") {
            return "Soft cherry-blossom seasonal ambient theme.";
          }
          if (theme === "yakou") {
            return "Deeper palette with animated effects. Late-evening seasonal theme.";
          }
          if (theme === "crt") {
            return "Old-school CRT look. A deliberately hard-to-read joke theme.";
          }
          return "Dawn pastels with stronger ambient effects. Early-morning seasonal theme.";
        },
      };
}
