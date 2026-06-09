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
  settingsTitle: string;
  showInvisibles: string;
  tabSize: string;
  theme: string;
  themeHint: (theme: ThemePreference) => string;
  wrapLines: string;
  // Privacy & Local Data disclosure (v0.16 app-store-quality
  // privacy-local-data slice). Each label is rendered as a
  // short section heading or paragraph in
  // `PrivacyPreferencesPane`. The wording intentionally
  // mirrors what `docs/security-boundary.md` and
  // `docs/apple-local-assist-distribution-plan.md` allow us
  // to claim: what this app's code does and does not do, not
  // what the user's OS or third-party files might do.
  privacyTitle: string;
  privacyIntro: string;
  privacyOpenLink: string;
  privacyDocumentsHeading: string;
  privacyDocumentsBody: string;
  privacyBackupHeading: string;
  privacyBackupBody: string;
  privacyPreviewHeading: string;
  privacyPreviewBody: string;
  privacyAppleAssistHeading: string;
  privacyAppleAssistBody: string;
  privacyAppStoreLaneHeading: string;
  privacyAppStoreLaneBody: string;
  privacyNetworkHeading: string;
  privacyNetworkBody: string;
};

export function getPreferencesCopy(lang: MenuLanguage): PreferencesCopy {
  if (isKanaStyle(lang)) {
    return {
      application: "あぷり",
      appleAssistDiffInitiallyOpen: "Apple Local Assist の さぶんを ひらく",
      appleAssistDiffInitiallyOpenHint:
        "Apple Local Assist が ほんぶんを かへたら さぶんを すぐ みせます。",
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
      privacyTitle: "ぷらいばしー と ろーかる でーた",
      privacyIntro:
        "このあぷり の こーど が どういう しょり を するか の みじかい せつめい です。OS や がいぶ さーびす の どうさ は ここの せつめい の たいしょう では ありません。",
      privacyOpenLink: "ぷらいばしー と ろーかる でーた を ひらく",
      privacyDocumentsHeading: "えらんだ ふみ",
      privacyDocumentsBody:
        "このあぷり は、 macOS の ふぁいる / ふぉるだ えらぶ き を とおして えらんだ テキストふみ だけを ひらきます。 ふぁいる ぜんたい を こっそり しらべたり、 ほーむ でぃれくとり を そうさ したりは しません。",
      privacyBackupHeading: ".hazakura/backups/...",
      privacyBackupBody:
        "うつしのこし を じぶんで ON にした ときだけ、 えらんだ わーくすぺーす の した に .bak の すなっぷしょっと が ほぞん されます。 わーくすぺーす の がいぶ には むきません。",
      privacyPreviewHeading: "まどびゅー と えんぽーと",
      privacyPreviewBody:
        "まどびゅー は がいぶ 画像 と あぶない HTML / script / iframe / object / embed を ふせぎます。 まどびゅー の りんく くりっく は、 せんたくちゅう わーくすぺーす ない の workspace-relative な テキストふみ への ひらき だけに るーてぃんぐ されます。 がいぶ scheme の りんく ( http:、 https:、 mailto:、 tel: など ) と ぜったい ぱす は むし され、 status めっせーじ が しめされる の で、 くりっく で えでぃた から はなれる せんい は おこりません。 HTML えんぽーと の とき、 わーくすぺーす ない の 画像 は でーた URI に いないれ されます。",
      privacyAppleAssistHeading: "Apple Local Assist",
      privacyAppleAssistBody:
        "Apple Local Assist は Apple の おん・でばいす もでる を つかう じっけんてきな ほじょ です。 こーど は この Mac の うえで うごき、 めーる や さーばー には おくりません。 へんこう は すべて あくしょん れこーど として のこり、 ほぞん まえに Diff で かくにん できます。",
      privacyAppStoreLaneHeading: "App Store ばんの こうせい",
      privacyAppStoreLaneBody:
        "App Store ばん は Agent Workbench と CLI agent と にんい こまんど を もちません。 かんの ある めにゅー、 すいっち、 しょーと かっと も うごきません。",
      privacyNetworkHeading: "ねっとわーく と とうけい",
      privacyNetworkBody:
        "このあぷり の こーど に fetch / XHR / あならいてぃくす / てれめてり / くらっしゅ れぽーてぃんぐ の ような しゅう は ふくまれません。 Apple Local Assist は、 ゆうこう で しすてむ が つかえる とき bundled Apple Local Assist helper を つかう こと が あります。 Developer / GitHub ばん では、 ゆうこう に した Agent Workbench が allowlist された ぷろばいだ を うごかせます。 Finder で ひらく、 いんさつ、 ごみばこ いどう など の めいじ そうさ では、 macOS の きのう に えらんだ ぱす や いちじ ふぁいる を わたす こと が あります。",
    };
  }

  return isJapaneseMenuLanguage(lang)
    ? {
        application: "アプリケーション",
        appleAssistDiffInitiallyOpen: "Apple Local Assist の差分を自動で開く",
        appleAssistDiffInitiallyOpenHint:
          "Apple Local Assist が本文を変更したとき、確認用の小さな差分を最初から表示します。",
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
        privacyTitle: "プライバシーとローカルデータ",
        privacyIntro:
          "このアプリのコードが何をするかについての短い説明です。OS や外部サービスの動作は対象外です。",
        privacyOpenLink: "プライバシーとローカルデータを開く…",
        privacyDocumentsHeading: "選んだファイル",
        privacyDocumentsBody:
          "このアプリは macOS のファイル/フォルダピッカーを通して選んだテキストファイルだけを開きます。ファイル全体を勝手に走査したり、ホームディレクトリを操作したりはしません。",
        privacyBackupHeading: ".hazakura/backups/...",
        privacyBackupBody:
          "自動バックアップを自分で有効化した場合だけ、選んだワークスペースの下に .bak スナップショットが保存されます。ワークスペース外には書きません。",
        privacyPreviewHeading: "プレビューとエクスポート",
        privacyPreviewBody:
          "プレビューは外部画像と危険な HTML / script / iframe / object / embed を防ぎます。プレビューのリンククリックは、選択中ワークスペース内の workspace-relative なテキストファイルへのオープンだけにルーティングされます。外部 scheme のリンク（http:、https:、mailto:、tel: など）と絶対パスは無視され、status メッセージが表示されるので、クリックでエディタから離れる遷移は起こりません。HTML エクスポートのときは、ワークスペース内の画像がデータ URI として埋め込まれます。",
        privacyAppleAssistHeading: "Apple Local Assist",
        privacyAppleAssistBody:
          "Apple Local Assist は Apple のオンデバイスモデルを使う実験的な補助です。コードはこの Mac のうえで動き、メールやサーバーには送りません。変更はすべて明示操作として残り、保存前に Diff で確認できます。",
        privacyAppStoreLaneHeading: "App Store 版の構成",
        privacyAppStoreLaneBody:
          "App Store 版は Agent Workbench と CLI agent と任意コマンドを持ちません。関連するメニュー・スイッチ・ショートカットも動きません。",
        privacyNetworkHeading: "ネットワークと統計",
        privacyNetworkBody:
          "このアプリのコードに fetch / XHR / analytics / telemetry / crash reporting のような実装は含まれません。Apple Local Assist は、有効化されていてシステムが対応しているときに bundled 済み Apple Local Assist helper を使うことがあります。Developer / GitHub 版では、有効化した Agent Workbench が allowlist されたプロバイダを起動できます。Finderで表示、印刷、ゴミ箱移動などの明示操作では、macOS の機能に選択したパスや一時ファイルを渡すことがあります。",
      }
    : {
        application: "Application",
        appleAssistDiffInitiallyOpen: "Open Apple Local Assist diff automatically",
        appleAssistDiffInitiallyOpenHint:
          "Show the compact diff immediately after Apple Local Assist changes the text.",
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
        privacyTitle: "Privacy & Local Data",
        privacyIntro:
          "A short description of what this app's code does. It does not describe what the operating system or external services may do.",
        privacyOpenLink: "Open Privacy & Local Data…",
        privacyDocumentsHeading: "Files you choose",
        privacyDocumentsBody:
          "The app only opens text files you pick through the macOS file or folder picker. It does not scan files on its own or touch your home directory.",
        privacyBackupHeading: ".hazakura/backups/...",
        privacyBackupBody:
          "Only when you enable auto-backup, the app saves local .bak snapshots under a `.hazakura/backups/...` folder inside the selected workspace. Backups stay inside that workspace.",
        privacyPreviewHeading: "Preview and export",
        privacyPreviewBody:
          "The preview blocks external images and dangerous HTML, script, iframe, object, and embed tags. The preview only routes link clicks to workspace-relative text file opens inside the selected workspace; external scheme links (http:, https:, mailto:, tel:, etc.) and absolute paths are ignored with a status message, so the click never navigates away from the editor. HTML export inlines local workspace images as data URIs.",
        privacyAppleAssistHeading: "Apple Local Assist",
        privacyAppleAssistBody:
          "Apple Local Assist is an experimental on-device helper that uses Apple's on-device model. The code runs on this Mac and does not send anything to a mail service or a server. Every change is recorded as an explicit action and can be reviewed through a diff before you save.",
        privacyAppStoreLaneHeading: "App Store build",
        privacyAppStoreLaneBody:
          "The App Store build does not include Agent Workbench, a CLI agent, or an arbitrary command surface. Related menus, switches, and shortcuts are also disabled.",
        privacyNetworkHeading: "Network and analytics",
        privacyNetworkBody:
          "This app's code does not include fetch, XHR, analytics, telemetry, or crash reporting. Apple Local Assist may use the bundled Apple Local Assist helper when the user enables it and the system supports it. In the Developer / GitHub lane, enabled Agent Workbench can launch an allowlisted provider. Explicit actions such as Show in Finder, print handoff, and Move to Trash may pass the selected path or a temporary file to macOS utilities.",
      };
}
