# App Store向け 外部エージェント依頼テンプレートまとめ

Last updated: 2026-06-09
Scope: app-store-quality ワークの依頼文を store向けに一括保管
Status: Draft collection for operational reuse

このファイルは、App Store向け品質改善で外部エージェントに渡す依頼文を同一トーンで再利用しやすくするための定型です。
内容は実装範囲を最小化し、Safe Editor 中心・Agent Workbench分離・未確認断言回避を前提にしています。

---

## 依頼テンプレート：`app-store-quality: save-restore-regression`

```text
依頼タイトル: app-store-quality: save-restore-regression

背景:
App Store向けレビュー準備の次は、保存・復元・外部変更衝突でのデータ保全を最小スコープで固めます。
ここは審査でも見落としが起こりやすい領域なので、再現可能な回帰証拠を優先します。

依頼内容:
`app-store-quality: save-restore-regression` として、保存・復元の安全性を検証し、必要最小修正をお願いします。実装変更よりテスト追加＋既存挙動の境界明確化を優先します。

対象範囲（優先順）:
1. Save / Save As の安全性
- 既存ファイル上書き拒否が意図どおりか確認
- Save As の上書きガードと失敗時メッセージの妥当性を確認

2. 外部変更による衝突
- 外部プロセス変更後の保存エラー/競合導線
- リカバリーフローへの遷移条件を再現

3. 復元・権限再取得
- 移動/削除/権限失効時の復元試行
- 失敗時は再認可導線へ進むこと（無言で再開しない）

4. テキスト保存の基礎回帰
- LF/CRLF、末尾改行、必要なら文字コード扱い（実装範囲）
- 保存後再読込時の破壊や誤変換がないこと

5. 主要スモーク
- Open Folder → Edit → Save / Save As → 再起動/再開 → Restore
  で編集内容が安全に扱われること

6. App Store境界整合
- Safe Editor主軸を崩さず、Agent Workbench・外部実行系は巻き込まない

提出物:
- 変更ファイル（実装/テスト）
- 実施した検証コマンド
- スキップした検証と理由
- 未検証部分は `要確認`

除外:
- App Store Connect / App Store提出 / 証明書 / provisioning / notarization / DMG
- 依存・lockfile 変更
- 大規模UI刷新
```

---

## 依頼テンプレート：`app-store-quality: markdown-preview-export-security`

```text
依頼タイトル: app-store-quality: markdown-preview-export-security

背景:
保存復元の安全性後は、表示・出力系の危険経路をまとめて潰します。App Store審査で引っかかりやすい項目です。

依頼内容:
`markdown-preview-export-security` として、Markdownプレビューと HTML export の安全経路を最小スコープで検証・修正してください。

対象範囲（優先順）:
1. Markdownプレビュー安全
- `<script>`/イベント属性/危険URL系の流れを確認
- `javascript:` URL が実行に繋がらないことを確認

2. 相対・外部資産扱い
- `iframe`/`object`/`embed`/`data:` の処理
- 外部画像取得が自動実行されないこと
- workspace外絶対パスの想定外解決が起きないこと

3. HTML export
- 外部や不正な資産が混入しないこと
- exportで保存用ソースが変更されないこと

4. スモーク
- Open Folder → Markdown open → Preview → Export HTML → 再読込 を実行

提出物:
- 変更ファイル
- 実行コマンド
- 未実施項目と理由
- 未検証は `要確認`

除外:
- App Store Connect / 証明書 / provisioning / notarization / DMG
- 依存・lockfile 変更
```

---

## 依頼テンプレート：`app-store-quality: accessibility-smoke`

```text
依頼タイトル: app-store-quality: accessibility-smoke

背景:
ここまでの機能安全面に続き、編集・保存・復元導線の利用容易性を確認します。実装追加より「使える状態」を担保します。

依頼内容:
`accessibility-smoke` として主要操作のアクセシビリティを最小スコープで検証・必要最小修正してください。

対象範囲（優先順）:
1. 主要コントロールの到達性
- タブ・保存・設定・プレビュー・Export・Apple Local Assist 状態周りが
  キーボードで到達可能か

2. 状態視認性
- 未保存や競合、復元ブロックなどの状態通知が追えること

3. L Mode・主要編集
- L Modeトグル、チェックボックス、リスト/リンク/見出し操作のフォーカス

4. エラー導線
- Save / Save As / Restore reauth / 外部変更警告が読み上げ/キーボード操作で追えること

5. App Storeレーン前提
- Safe Editor主軸と、App Storeレーンの境界を崩さないこと

提出物:
- 変更ファイル
- 検証コマンド
- 未検証は `要確認`

除外:
- App Store Connect / 証明書 / provisioning / notarization / DMG
- 依存・lockfile 変更
- 大規模UI再設計
```

---

## 依頼テンプレート：`app-store-quality: support-diagnostics`

```text
依頼タイトル: app-store-quality: support-diagnostics

背景:
問い合わせや再現調査で使える最小診断情報を整備し、サポート時の無駄な行き違いを減らします。

依頼内容:
`support-diagnostics` として、診断情報の範囲と取得導線を最小限で実装してください。

対象範囲:
1. 診断スコープ定義
- 収集対象: app version / build / macOS情報 / lane / Apple Local Assist可否 / sandbox再認可状態 / 主要エラー分類
- 非収集対象: 文書本文 / workspace全体一覧 / provider生ログ / 機密な絶対パス

2. 取得導線
- 既存設定・コマンドからユーザー操作で1クリック取得
- 読み取り専用表示、コピー可能形式

3. App Store境界
- Agent Workbenchや外部実行内容を診断対象に混ぜない
- 過剰収集を避ける

提出物:
- 変更ファイル
- 検証コマンド
- 収集項目と除外項目の明記
- 未確認は `要確認`

除外:
- App Store Connect / 証明書 / provisioning / notarization / DMG
- 依存・lockfile 変更
```

---

## 依頼テンプレート：`app-store-quality: performance-bundle-baseline`

```text
依頼タイトル: app-store-quality: performance-bundle-baseline

背景:
最終的な提出準備に向け、最小限の計測でボトルネックを可視化します。過剰な最適化ではなく、実測に基づく判断を優先します。

依頼内容:
`performance-bundle-baseline` として、App Store向けに支障になりやすい性能基準を測定し、該当する場合は最小の改善候補だけ整理してください。

対象範囲:
1. バンドル基礎計測
- production chunk-size の寄与が大きい領域の可視化
- 主要画面（編集、Preview、Apple Local Assist、検索）の初期起動・操作時タイミング

2. 開く・編集・L Mode・スクロール
- 固定フィクスチャでの open/edit/L Mode切替/スクロールの比較
- まずは再現手順の標準化と結果保存

3. 改善判断
- 計測で根拠が取れた項目のみ最小修正案を提示
- リリースリスクを上げる大幅設計変更は行わない

提出物:
- 変更ファイル（必要最小）
- 測定結果と比較メモ（差分付き）
- 未実施の正当理由
- 未検証は `要確認`

除外:
- App Store Connect / 証明書 / provisioning / notarization / DMG
- 大規模最適化・L Mode再設計
```

---

## 運用メモ

- いずれの依頼も `docs/app-store-quality-agent-requests.md` の対応スコープ（P0/P1）と整合させる。
- 外部エージェントには実装開始前に以下必読させる（既存ルール同様）:
  - AGENTS.md
  - README.md
  - docs/README.md
  - docs/current-status.md
  - docs/roadmap.md
  - docs/development-automation.md
  - docs/external-agent-review-workflow.md
  - docs/security-boundary.md
  - docs/agent-workbench-boundary.md
  - docs/app-store-quality-agent-requests.md
- 事前に「App Store Connect / 証明書 / notarization / DMG / submission」を明示的に除外する文言を残す。

