# App Store次依頼: app-store-quality: support-diagnostics

依頼タイトル: app-store-quality: support-diagnostics

背景:
保存・復元・プレビュー/エクスポート・アクセシビリティの基盤確認を進める方針の次段です。
次は、問い合わせ/再現時に必要な最小診断情報を整備し、サポート時の切り分け時間を短くしたいです。
ただし、収集は必要最小にとどめ、未検証領域を過大に主張しない状態でお願いします。

依頼内容:
`app-store-quality: support-diagnostics` として、診断情報の収集範囲と取得導線を最小で整える。
App StoreレーンとDeveloper/GitHubレーンを混在させず、Safe Editor の主軸を壊さないこと。

対象（優先順）:
1. 診断対象データの定義
- 収集許容:
  - app version / build 識別子
  - macOS バージョン / arch
  - 分配レーン（App Store プレビュー / Dev）
  - Hazakura Local Assist 可否と利用可否理由
  - サンドボックス / 再認可状態（成功・失敗・未試行）
  - 保存・復元・衝突・外部変更に関するエラー分類コード
  - 主要 feature flag（実装されている範囲）
- 非収集:
  - ドキュメント本文
  - workspace 全件一覧
  - provider や CLI の生ログ／トランスクリプト
  - 生の絶対パスなど、再識別リスクの高い値

2. 取得導線
- 設定/サポート導線から、ユーザー操作で1クリックで取得できること
- 表示は読み取り専用で、必要ならコピー可能な整形表示
- 共有は利用者確認の上で実施できるUIを優先

3. セキュリティ境界との整合
- Agent Workbench の起動内容や外部実行内容を診断対象に混ぜない
- 個人情報・文書内容・不要経路は収集しない
- 過剰な「自動診断送信」は入れない

必読:
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

提出物:
- 変更ファイル一覧
- 実行した検証コマンド（テスト/簡易導線）
- スキップ時は理由を明記
- 要確認事項は `要確認` 明示

除外（絶対）:
- App Store Connect メタ入力
- 証明書 / provisioning / notarization
- アップロード / DMG 作成
- 依存追加・lockfile変更
- 大規模画面再設計

補足:
- 「承認済み」「TestFlight提出済み」「審査通過済み」など、未検証の断定表現は避ける。

