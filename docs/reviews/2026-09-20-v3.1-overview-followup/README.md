# v3.1 俯瞰レビューの修正

Status: Evidence
Scope: H31-01 / H31-02と単体Core AIテストモデル
Authority: Medium
Last reviewed: 2026-09-20

外部レビューの対象は `b4844a8b96ff82af2a2d8e26a58861403de70f35`。
指摘を現行コードと照合し、2件とも実際のエントリ／Markdown変換経路のテストで再現した。
レビュー文中のSystem-only先行案は採用決定ではない。v3.1のCore AI実利用＋海外展開を維持する。

## 修正

- **H31-01 / P2:** `localStorage` getterを含む言語読み取りをtry/catchで保護し、
  取得不能時は表示言語だけenへ戻す。保存値の削除なし、React初回描画前の同期を維持。
  getter/getItem例外、両entryでcreateRoot/render呼出しまで到達、別テストで復旧面の
  実マウントを確認。他の設定読み取りまでストレージ障害耐性が完成した意味ではない。
- **H31-02 / P3:** detached本文fragment内の最寄りの明示langを、ラッパー挿入前に
  すべての表について確保する。入れ子の表でも途中追加した英語UIラッパーを拾わない。
  指定なし、直接指定、祖先指定、近い祖先優先、明示空文字、入れ子を確認。
  元Markdownは変更しない。DOM属性の検証でありVoiceOver発音の実測ではない。

## 検証

- red: 修正前に6失敗（getter/getItem、両entry、祖先のfr/de）。
- green: 関連4ファイル56テスト成功（RootErrorRecovery実マウントと入れ子を含む）。
- 最終の `npm run typecheck`、フロント全293ファイル2,615テスト成功。
  入れ子1テストとen/ja/kana保存値の追加ケースを含む。
- `npm run build:vite` 成功。既存の大きいbundle警告あり。
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` 成功。
- `cargo test --locked --manifest-path src-tauri/Cargo.toml` 395成功、2 ignored。
- `npm run smoke:app-store-surface` 125成功。
- `bash -n scripts/smoke-coreai-test-model.sh` 成功。
- `git diff --check` 成功。既存treeは開始時clean、変更は未コミット。
- Core AI: 固定Qwen3-0.6Bを変換し実ロード・短文生成成功。ただし校正結果は不正確。
  [モデル、再実行手順、制約](../../core-ai-test-model.md)を参照。

## 未完了

- 画像ブロック案内（remote／workspace外許可／load-failed）の英語化と英語での復旧。
- 英語の正常・空・読込失敗・権限不足・取消・復旧を状態単位で実表示確認する。
- built app、ネイティブメニュー、Help、VoiceOver、IME、署名候補の受入は未実施。
- Core AIのC-1/C-2製品接続、配信/AOT、日本語bake-off、Connect設定は別ゲート。

全体レビューや静的テストの成功を、v3.1全体の完成・公開可へ繰り上げない。
