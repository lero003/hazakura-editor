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
  appleAssistDiffInitiallyOpen: string;
  appleAssistDiffInitiallyOpenHint: string;
  autoBackup: string;
  dark: string;
  editor: string;
  editorDisplay: string;
  fontSize: string;
  fontSizeControl: string;
  light: string;
  closeDialog: string;
  menuLanguage: string;
  menuLanguageHint: string;
  previewPane: string;
  sakura: string;
  yakou: string;
  shokou: string;
  settingsTitle: string;
  showInvisibles: string;
  tabSize: string;
  theme: string;
  themeHint: (theme: ThemePreference) => string;
  wrapLines: string;
};

export function getPreferencesCopy(lang: MenuLanguage): PreferencesCopy {
  if (isKanaStyle(lang)) {
    return {
      application: "あぷり",
      appleAssistDiffInitiallyOpen: "Apple Local Assist の さぶんを ひらく",
      appleAssistDiffInitiallyOpenHint:
        "Apple Local Assist が ほんぶんを かへたら さぶんを すぐ みせます。",
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
      settingsTitle: "おこのみ",
      showInvisibles: "みえぬもじをしめす",
      tabSize: "たぶのはば",
      theme: "いろあひ",
      wrapLines: "くだりををる",
      ambientIntensity: "うつろひ",
      ambientIntensityOff: "なし",
      ambientIntensitySubtle: "ほのか",
      ambientIntensityNormal: "つね",
      ambientIntensityDramatic: "あざやか",
      ambientIntensityHint: "さくら / よるひかり / あけぼのひかり の いろあひ で つかへます。",
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
          return "よるの よさめ の あたたかい いろの きせつ いろあひ。";
        }
        return "あけがた の そら を 思わせる あけぼのいろ の きせつ いろあひ。";
      },
    };
  }

  return isJapaneseMenuLanguage(lang)
    ? {
        application: "アプリケーション",
        appleAssistDiffInitiallyOpen: "Apple Local Assist の差分を自動で開く",
        appleAssistDiffInitiallyOpenHint:
          "Apple Local Assist が本文を変更したとき、確認用の小さな差分を最初から表示します。",
        autoBackup: "自動バックアップ",
        dark: "ダーク",
        editor: "エディタ",
        editorDisplay: "エディタ表示",
        fontSize: "フォントサイズ",
        fontSizeControl: "エディタのフォントサイズ",
        light: "ライト",
        closeDialog: "ダイアログ゙を閉じる",
        menuLanguage: "メニュー言語",
        menuLanguageHint: "UI の表示言語を切り替えます。かなふみはひらがな中心のやさしい表記です。",
        previewPane: "プレビュー表示",
        sakura: "桜",
        yakou: "夜光",
        shokou: "曙光",
        settingsTitle: "設定",
        showInvisibles: "不可視文字を表示",
        tabSize: "タブ幅",
        theme: "テーマ",
        wrapLines: "行を折り返す",
        ambientIntensity: "アンビエント演出",
        ambientIntensityOff: "オフ",
        ambientIntensitySubtle: "控えめ",
        ambientIntensityNormal: "標準",
        ambientIntensityDramatic: "鮮やか",
        ambientIntensityHint: "sakura / yakou / shokou テーマの時に有効です。",
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
            return "夜長向けの深めの暖色アンビエントテーマ。";
          }
          return "明け方向けの曙色アンビエントテーマ。";
        },
      }
    : {
        application: "Application",
        appleAssistDiffInitiallyOpen: "Open Apple Local Assist diff automatically",
        appleAssistDiffInitiallyOpenHint:
          "Show the compact diff immediately after Apple Local Assist changes the text.",
        autoBackup: "Auto-backup",
        dark: "Dark",
        editor: "Editor",
        editorDisplay: "Editor display",
        fontSize: "Font size",
        fontSizeControl: "Editor font size",
        light: "Light",
        closeDialog: "Close dialog",
        menuLanguage: "Menu language",
        menuLanguageHint: "Switch the UI display language. Kana mode uses gentle hiragana-centered wording.",
        previewPane: "Preview pane",
        sakura: "Sakura",
        yakou: "Yakou",
        shokou: "Shokou",
        settingsTitle: "Preferences",
        showInvisibles: "Show invisibles",
        tabSize: "Tab size",
        theme: "Theme",
        wrapLines: "Wrap lines",
        ambientIntensity: "Ambient effects",
        ambientIntensityOff: "Off",
        ambientIntensitySubtle: "Subtle",
        ambientIntensityNormal: "Normal",
        ambientIntensityDramatic: "Vivid",
        ambientIntensityHint: "Applies when using sakura, yakou, or shokou themes.",
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
            return "Deeper warm seasonal theme for late evenings.";
          }
          return "Dawn-pastel seasonal theme for early mornings.";
        },
      };
}
