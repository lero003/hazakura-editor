# Core AI モデル配布 UX バックログ

Status: Backlog（実装済み項目と未着手候補。未着手項目は着手の約束ではない）
Scope: Core AI モデルのダウンロード・管理まわりの UX 候補
Authority: Low（現行ルールの正本ではない。採否は `current-work.md` で決める）
Last reviewed: 2026-09-22

E4B の Apple-hosted asset pack と build 145 が通り、実機疎通（CDN → 検証 → helper load）とは
別に「あるとよい」項目をここへ溜める。着手時は `docs/core-ai-production-models.md` の
activation gate と `docs/assist-surface-strategy.md` の境界を先に確認する。

## 1. マシンスペックの事前警告

**2026-09-22 実装済み:** lockの`acceptanceMemoryGB`（E4B 16 / 12B 32）を固定catalogへ写し、
Rustが`sysctl hw.memsize`で物理メモリを読む。rendererへはGiB数値だけを渡す。推奨値未満は
一覧で注意し、download開始前に確認するが、利用を禁止しない。起動時スキャンや自動downloadは
追加していない。

## 2. モデル管理を独立した設定画面にする（本人要望 2026-09-21）

**2026-09-21 実装済み（一部残り）:** Preferences ダイアログの `models` ページとして独立させた。
ダウンロード（開始 / 進捗 / 再開 / 取消）、保存先の説明、削除、サイズ、バージョン、
選択中モデルの切替（System 含む）と削除時の System 退避、直近の生成記録を1ページに置く。
設定本文には入口だけを残し、**自動ダウンロードや起動時スキャンは足していない**。
**設定から独立したシステムメニューの入口**（macOS はアプリメニュー、他 OS は File）から
設定本文を経由せず直接開ける。
[証跡](reviews/2026-09-21-on-device-models-page/README.md)。

2026-09-22にlicense要約（Apache-2.0、12Bは変換元license原文同梱）と展開後使用量も追加。
残りはpayload内notice本文を開くUI。

## 3. 保存先（ダウンロード先）の扱い

- Apple-hosted asset pack は**保存先を選べない**。`AssetPackManager` がプロセス単位の URL を
  返し、実体はシステム管理（アプリコンテナ配下）。ここに指定 UI を作っても効かない
- 現実的な代替:
  - ~~保存先がシステム管理であること、使用量を表示する~~ **実装済み**
  - ダウンロード開始前に空き容量不足を警告する
  - 削除（既存の delete → System 切替）を維持し、削除時に解放サイズを示す
- Developer レーンのローカル配置にはディレクトリ指定の余地があるが、いまは対象外

## 4. 編集品質（ハーネス）の改善

実機で編集結果が崩れるという報告への調査は
[Core AI編集品質（ハーネス）調査メモ](core-ai-harness-quality.md) に分離した。
`maximumResponseTokens = 128` と greedy / temperature 0、Qwen 用 prompt の流用が候補。

## 5. その他（現状の実装状況つき）

- **失敗理由の表示**: いまは phase / error をそのまま出す。`BA` のエラーを人間向け文言へ寄せる
- **進捗の粒度**: `BA` が渡すのは `fractionCompleted` のみ。残り時間や速度は出せない前提で設計する
- **回線への配慮**: 従量制・低速回線向けの「Wi-Fi のときだけ」や「後で」トグルの余地
- **ライセンス本文**: 要約は実装済み。payloadの`THIRD_PARTY_MODEL_NOTICE.md`と
  `LICENSE-APACHE-2.0.txt`（12Bは`UPSTREAM-CONVERSION-LICENSE.txt`も）を設定画面から
  開くUIは未実装
- **12B catalog接続**: 2026-09-22にApp Storeレーンへ接続済み。Developerレーンは空のまま。
  archive upload / processing、CDN materialization、32 GB対象機TestFlightは未実施
