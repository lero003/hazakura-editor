# Core AI モデル配布 UX バックログ

Status: Backlog（未着手の候補。着手の約束ではない）
Scope: Core AI モデルのダウンロード・管理まわりの UX 候補
Authority: Low（現行ルールの正本ではない。採否は `current-work.md` で決める）
Last reviewed: 2026-09-21

E4B の Apple-hosted asset pack と build 145 が通り、実機疎通（CDN → 検証 → helper load）とは
別に「あるとよい」項目をここへ溜める。着手時は `docs/core-ai-production-models.md` の
activation gate と `docs/assist-surface-strategy.md` の境界を先に確認する。

## 1. マシンスペックの事前警告

- lock には `acceptanceMemoryGB`（E4B 16 / 12B 32）と `minimumMacOS`（27.0）が既にあり、
  payload の `hazakura-model.json` にも入っている。**UI ではまだ一切出していない**
- 例: 物理メモリが `acceptanceMemoryGB` を下回るとき、`CoreAiModelManager` の
  ダウンロード前に注意を出す。止めるかは要判断（止めない方がよさそう）
- 判定は Rust 側（`sysctl hw.memsize` 相当）で行い、renderer へは数値だけ渡す。
  起動時スキャンや自動ダウンロードはしない

## 2. モデル管理を独立した設定画面にする（本人要望 2026-09-21）

**2026-09-21 実装済み（一部残り）:** Preferences ダイアログの `models` ページとして独立させた。
ダウンロード（開始 / 進捗 / 再開 / 取消）、保存先の説明、削除、サイズ、バージョン、
選択中モデルの切替（System 含む）と削除時の System 退避、生成設定（直近の実行）を1ページに置く。
設定本文には入口だけを残し、**自動ダウンロードや起動時スキャンは足していない**。
**設定から独立したシステムメニューの入口**（macOS はアプリメニュー、他 OS は File）から
設定本文を経由せず直接開ける。
[証跡](reviews/2026-09-21-on-device-models-page/README.md)。

残り: ライセンス表示（notice / Apache-2.0、12B は upstream conversion license）と
削除時の解放サイズ表示。

## 3. 保存先（ダウンロード先）の扱い

- Apple-hosted asset pack は**保存先を選べない**。`AssetPackManager` がプロセス単位の URL を
  返し、実体はシステム管理（アプリコンテナ配下）。ここに指定 UI を作っても効かない
- 現実的な代替:
  - 保存先がシステム管理であること、使用量（E4B は約 5.4 GB / 展開後 6.8 GB）を表示する
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
- **ライセンス表示**: payload の `THIRD_PARTY_MODEL_NOTICE.md` と `LICENSE-APACHE-2.0.txt`
  （12B は `UPSTREAM-CONVERSION-LICENSE.txt` も）を設定画面から読めるようにする
- **12B は catalog 未接続のまま**: asset pack record は作成済みだが、どの build からも参照しない。
  ライセンス確認が閉じるまで配布対象にしない
