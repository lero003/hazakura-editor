# モデル設定・切替の自己レビュー

Status: Fixed and ready for device review
Scope: 設定のモデル一覧、Local Assistモデル切替、状態更新、選択後のキーボード操作
Review base: `208e244d`
Date: 2026-09-22

## 修正した指摘

| 優先度 | 再現条件と問題 | 修正 |
|---|---|---|
| P2 | 設定で選択できるローカルmodelがAssist pickerでは無効。`ready`だけを見る旧条件が残り、矢印移動も対象外 | `isCoreAiModelSelectable`を両画面で共有し、localの`detected`とApple-hostedの`ready`を区別。local選択、初期focus、通知後のfocus維持を固定 |
| P2 | 選択中local folderが一覧から消えると、Developer override用の一覧外表示に入りSystemへの切替も隠れる | 消失localの選択中表示を無効行として残し、native catalog内のSystem等へ切替可能にする。Developer overrideの扱いは維持 |
| P2 | 設定でキーボードから「使う」を押すと、そのボタンの消失でfocusがbodyへ落ちる | モデル行を名前付きgroupとfocus受け皿にし、focusを失った場合だけ同じ行へ戻す。ユーザーが別の設定へ移動済みなら奪わない |
| P3 | 保存先・未配布時の説明がApple配布専用の旧契約のまま | 日本語・英語・かなでCustom Modelsと外部folder登録未対応を反映 |

## 確認範囲

- 設定入口、モデル一覧の選択条件、download / cancel / resume / deleteの表示、低メモリ確認、削除確認。
- 購読開始と初期snapshot、通知と遅い操作応答の順序、2画面間のモデル更新。
- Rustの選択永続化・保存失敗時の旧backend維持・再起動復元・生成中切替拒否をsourceと既存testで追跡。
- Assist windowの実componentとavailability hookを使う統合testをlocalにも拡張し、切替からprobe完了まで二重操作と送信を拒否し、入力文を保持することを確認。

pickerの追加3テストと設定選択後focusのテストは修正前に失敗、修正後に成功した。
今回のsource / 自動test確認範囲で、上記修正後に実機レビューを止める未解決の指摘は見つかっていない。

## 検証結果

- `npm run typecheck`: success。
- `npm test`: 298 files / 2,682 tests、scripts 24 tests success。
- 文言最終調整後の設定関連focused tests: 3 files / 21 tests success。
- `npm run smoke:app-store-surface`: 10 files / 132 tests success。
- `npm run build`: App Store preview、Vite、production Core AI / System / import helper、Background Download extension成功。
- `npm run probe:macos-distribution`: 3 helper、extension、notice、Background Assets設定、deep / strict署名検証を確認。
- `git diff --check`: success。

生成物は3.1.0のローカルad-hoc preview（アプリ本体の`CFBundleVersion`も3.1.0）。アプリ本体のApp Sandbox entitlementと
App Store署名の受入は対象外であり、Gatekeeper評価も配布受入には使わない。
今回Rust / Swift sourceは変更せず、native unit testは再実行していない。

## 実機で確認する操作

1. 設定から「オンデバイスモデル」を開き、Tab / Shift+Tabで移動。各モデルの「使う」の後も操作位置が残る。
2. 設定とAssist窓でSystem / Apple-hosted / 有効なlocal bundleを切り替え、選択表示が一致する。
3. 選択後のavailability確認中は再選択・送信が止まり、確認完了後に操作できる。入力中の依頼は消えない。
4. 再起動後の選択復元、local bundle破損・消失の表示とSystemへの復帰を確認する。
5. 日本語 / 英語 / かな、狭いウィンドウ、キーボード、VoiceOverでモデル名・状態・操作が読み取れる。
6. 実モデル生成、モデル変更後の再ロード、memory / swapを確認する。

外部folderのbookmark登録、Custom Modelsフォルダを開く・作成・明示再スキャンするUIは未接続。
実Background Assets配信、sandbox下の受入、TestFlightは別ゲートである。
