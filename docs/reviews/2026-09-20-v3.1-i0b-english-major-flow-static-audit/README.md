# v3.1 I-0b 英語主要導線の静的棚卸し

Status: Implemented — source / test inspection only
Scope: English UI copy for the main Safe Editor workflows
Date: 2026-09-20

## 結論

英語表示の主要導線をソースと既存テストから画面単位で確認した。開始画面、編集クローム、
保存・終了・衝突・復旧、設定、Help、Reader、EPUB / PDF / HTML出力、Local Assist、診断には
英語コピーまたは英語固定Help本文がある。致命的フロントエラー時の復旧画面だけが、
英語UIでも日本語を主表示する漏れだったため修正した。

これは実表示、レイアウト、nativeメニュー、VoiceOver読み上げ、署名候補、App Storeの
言語宣言を合格にした証跡ではない。

## 画面単位の確認

| 画面 | 静的な確認先 | 判定 |
|---|---|---|
| 初回・開始・編集クローム | `src/lib/locale/safeEditor.ts`, `src/lib/locale/editorChrome.ts`, `src/appEntryLanguage.test.tsx` | `en`コピーと初回描画前の言語同期あり |
| 保存・終了・衝突・復旧 | `src/components/app/CloseDialogs.tsx`, `src/components/app/SaveConflictDialog.tsx`, `src/lib/locale/recovery.ts` | `en`分岐あり |
| 設定 | `src/lib/locale/preferences.ts`, `src/components/app/SettingsPreferencesPane.test.tsx` | 英語設定面のテストあり |
| Help・診断 | `src/components/app/helpDocs/en/`, `src/lib/locale/diagnostics.ts` | Help本文は英語固定、診断chromeは表示言語へ追従 |
| Reader | `src/components/editor/preview/EBookPane.tsx`, `src/components/editor/preview/EBookPane.test.tsx` | 英語操作ラベルのテストあり |
| EPUB / PDF / HTML出力 | `src/components/app/*Export*.tsx`, 各対応テスト | 範囲・preflight・保存先を含む英語分岐あり |
| Local Assist | `src/lib/locale/appleAssist.ts`, `src/components/appleAssist/AppleAssistWindowApp.tsx`, 各対応テスト | 英語会話・状態・候補レビューあり |
| 致命的フロントエラー | `src/components/app/RootErrorRecovery.tsx` | 日本語固定を修正 |

## 実装修正

- `RootErrorRecovery` は `<html lang>` が `en` なら英語、`ja` なら日本語の復旧文言を表示する。
- エラー発生状態とcatch値を分離し、`null` などfalsyな値がthrowされても復旧面を維持する。
- catch値は `unknown` として扱い、任意objectの変換メソッドを呼ばず、表示不能時は `Unknown error` に閉じる。
- 技術由来の `error.message` とcomponent stackは `lang=""` とし、UI言語を誤って継承させない。
- 英語UIで日本語主文＋英語補足を重ねる旧構造と、その専用CSSを削除した。
- `RootErrorRecovery.test.tsx` で英語・日本語の見出し／操作と技術本文の言語境界を固定した。

## 検証

- red: `npm test -- src/components/app/RootErrorRecovery.test.tsx`
  - 英語時に英語見出しが見つからず失敗。
- green: 同コマンド — 3 tests passed（英語、日本語、falsy throw）。
- `npm test` — 293 files / 2,602 tests passed。
- `npm run build:vite` — typecheck + Vite build passed。既知の500 kB超chunk警告あり。
- `npm run smoke:app-store-surface` — 10 files / 125 tests passed。
- `python3 docs/international-launch/validate_metadata.py` — copy checks passed。
- `git diff --check` — passed。

外部レビューでは、初回固定SHAに「falsyな値をthrowすると復旧面へ入らない」P2が1件あった。
`hasError`の分離と上記回帰テストで修正し、再レビューを行う。

## 未確認・次段階

- built appでの英語起動、言語切替後の再起動、長い英語ラベルの欠け。
- nativeメニューとmacOS標準ダイアログの英語表示。
- Help本文の実表示、VoiceOverの読み上げ、IME。
- 署名済み同一候補のInfo.plist、同梱localization、App Store言語表示。
- Connect上の地域・価格・契約・公開URL。これらはソース棚卸しから推定しない。
