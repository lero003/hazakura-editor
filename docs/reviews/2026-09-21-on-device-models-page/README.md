# オンデバイスモデルの独立ページ

Status: Evidence（Vite fixture での実表示 + source / test）
Scope: Preferences ダイアログのモデル管理ページ
Authority: 検証記録
Last reviewed: 2026-09-21

依頼: ブランチを整えたうえで設定画面を作り込み、モデル管理は別ページにする。

## 変更

- Preferences ダイアログに `models` ページを追加した。設定本文に埋まっていた
  モデル一覧と生成設定を、独立した1ページへ移した。
- 設定本文（アプリケーション）には入口の1行だけを残す。押すと同じダイアログの
  モデルページへ切り替わる（ダイアログは閉じない、ヘルプ文書の枠へは化けない）。
- モデル行は状態に加えて **サイズと資産バージョン** を出す。選択中のモデルでも
  状態行の先頭に「選択中」を足すだけで、サイズ・バージョンを落とさない。
- 保存先は Apple-hosted asset pack がプロセス単位で決めるため、選ばせず
  「アプリ領域にだけ保存され、保存先は選べない」と説明する。
- 生成設定（直近の実行）は helper の `usage` を Rust が保持した記録のままで、
  このページでも表示だけを行う。自動ダウンロード・起動時スキャンは足していない。

## 見え方（Vite fixture、実コンポーネント）

`fixture.tsx` は本物の `PreferencesDialog` / `OnDeviceModelsPane` を描き、IPC だけを模擬する。
ダウンロード・モデル読み込み・本文保存は行わない。Vite 起動後にこのフォルダーの
`fixture.html` を開く。`theme` / `lang`、`empty`（未配布）/ `noprofile`（生成記録なし）を
query で指定できる。

| 画像 | 状態・寸法 |
|---|---|
| [モデルページ（日本語・light）](01-models-page-ja-light.png) | 1200×820、E4B 選択中・12B ダウンロード中・生成設定あり |
| [モデルページ（English・dark）](02-models-page-en-dark.png) | 1200×820、同じ内容を英語・ダークで |
| [未配布・未観測の空状態](03-models-page-ja-honest-empty.png) | 1200×820、配布前の説明と System 1件、生成記録なし |

## 確認したこと

- `npm test` — 297 files / 2,654 tests pass（+1 file / +5 tests）、`test:scripts` 24 pass。
- `npm run smoke:app-store-surface` — 130 tests pass（Preferences の変更を含む）。
- `npm run typecheck`、`npm run build:vite` — pass。
- `git diff --check` — clean。
- Rust は今回変更していない（前スライスから不変）。

## 未確認・残り

- built app（WKWebView）での表示、VoiceOver、最大 Dynamic Type は手動ゲート。
  fixture はブラウザー描画で、ダイアログの native 挙動を代替しない。
- ライセンス表示（payload の notice / Apache-2.0）とマシンスペックの事前警告、
  削除時の解放サイズ表示は未実装。`docs/core-ai-ux-backlog.md` に残す。
- 実 Core AI の観測は引き続き未実施（この環境は GPU を渡さない）。
