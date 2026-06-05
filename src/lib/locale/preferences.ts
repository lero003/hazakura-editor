import { isJapaneseMenuLanguage, type MenuLanguage } from "../../types";
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
  previewPane: string;
  sakura: string;
  yakou: string;
  shokou: string;
  settingsTitle: string;
  showInvisibles: string;
  tabSize: string;
  theme: string;
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
      ambientIntensityDramatic: "はなやか",
      ambientIntensityHint: "きせつのいろあひにてはたらきます。",
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
        ambientIntensityDramatic: "派手",
        ambientIntensityHint: "季節テーマで有効です。",
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
        ambientIntensityDramatic: "Dramatic",
        ambientIntensityHint: "Applies to seasonal themes.",
      };
}
