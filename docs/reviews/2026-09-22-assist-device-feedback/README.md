# Local Assist 実機フィードバックへの対応

Status: UI verified locally / E4B quality unresolved
Scope: Detached Local Assist typography, model availability, E4B reproduction
Authority: Evidence
Last reviewed: 2026-09-22

## UI変更

- 本文15→14px、補助表示14→13px。ボタンの最小高さ32px、依頼ボタン36pxは維持。
- 「再確認」ボタンと入力欄の専用状態領域を撤去。モデル選択時は自動probeし、上部toolbarに
  spinner付きの短い状態を表示する。ready時は表示も占有領域もなくなる。
- 同一モデルの選び直しではselection IPCを呼ばず再probeする。会話・入力は保持。
- 失敗時は上部に復帰方法を残し、詳細は既存の「使い方・利用条件」に表示する。
  入力欄の`aria-describedby`は上部状態に結びつける。Developer overrideのread-only境界は維持。
- モデル選択処理中とprobe完了前の依頼禁止、別窓変更の追従、遅延応答の競合対策は維持。

## UI検証

- テスト先行で5件の失敗を確認し、最小修正後にgreen。
- frontend 298 files / 2,686 tests、scripts 24 tests、App Store surface 132 tests、typecheck、
  Vite build、`git diff --check`成功。Viteの既存chunk-size warningは残る。
- Playwrightで実コンポーネントと表示用native mockを使用。420×560のlightで初回確認・ready・
  E4B切替、640×720のdarkでreadyを撮影し、文字の重なりや横方向のはみ出しがないことを目視確認。
  probe中は入力disabled、完了時に状態表示が消えることをブラウザー操作でも確認した。
- 撮影後の画像はignoredの`.hazakura/reviews/2026-09-22-assist-device-feedback/playwright/`へ保存。
  これはnative実生成・VoiceOver・IMEの証拠ではない。
- App Store previewを再ビルドし、distribution probe成功。起動確認用のad-hoc・非sandbox appで、
  App Store署名pkg / TestFlightの受入とは別。既存の署名pkg（build 146）は更新していない。

## E4B再現結果

ユーザー文書を使わず、既存の`local-assist-evaluation.json`をproduction helperへ渡した。
通常GPU実行、backend=`core_ai`、model=`apple:core-ai:gemma-4-e4b-it-int4-v1`、
resource version=`2026.09.20.1`、macOS / SDK 27.0、fixtureVersion=2、repeats=1。

| 項目 | 値 |
| --- | --- |
| checkout | `d845bef1ec965a42324c9a80d99797ce4ebd3b92`、dirty（既存build counter。UI作業と並行） |
| 今回helper SHA-256 | `b2280d347be42ad01259bb6124eeeeb8bea551b45ca89462778a57eb01cd95ff` |
| 今回report SHA-256 | `b3981f8ce21a7aa37f39db94b090c70b068c5981e678fabb0169209bdb8265e3` |
| 比較元checkout | `894ab769d0e3072439cba8ef9981916184865530` |
| 比較元helper SHA-256 | `16a994896a34c464f8c515fc4e58c9c4931cae35209141004116d881bd614747` |
| 比較元report SHA-256 | `8a96f0d715d016d24c2f120a037321b43f28ff859faad2dd994cbc28b5eefac8` |
| 実効生成設定 | greedy、maximumResponseTokens=2048 |
| 結果 | 18/18完了、機械的チェック15/18成功。品質受入ではない |
| 比較 | 全18件のid / phase対応でrawCandidateTextとcandidateが前回保存結果と完全一致 |

報告名は今回`e4b-current-20260922.json`、比較元`eos-baseline.json`。全文はローカル一時証跡。
比較元を今回再実行したA/Bではない。helperの再ビルドやモデル書き換えも行っていない。

生出力と整形後candidateは今回18/18で一致する。たとえば以下は表示後処理より前に存在する。

| fixture | 生出力の抜粋 | 機械的チェック |
| --- | --- | --- |
| shorten | `水曜日は機器点検のため休休。` | 全項目成功 |
| markdown-link | `持ち物: 筆記具具` | 全項目成功 |
| proofread-no-request | `資料は三部用意しきてらい` | 全項目成功 |
| follow-up（初回） | `始るよるさえお！` | preserved失敗 |
| quote | `焦パらず` | preserved失敗 |

**「15/18成功」を自然な日本語の品質合格と解釈してはいけない。** 機械チェックは数値・引用・
リンク等の保持、プロトコル、マーカーを検査するもので、自然さを保証しない。

この固定fixture群では直近のC-3 / cache / UI変更による悪化は確認できなかった。
一方、ユーザーが比較している以前の版・入力・モデル資源は未確認であり、体感上の退行を否定する証拠ではない。

## 未解決と次の比較

`rawCandidateText`はCoreAIKit / FoundationModelsによる文字列化の後、Hazakuraの
`CandidateFormatting`より前の値であり、生のtoken列ではない。
したがって「モデルそのものが悪い」とはまだ断定しない。

1. ユーザーの元文章・依頼・出力例と、以前の版 / モデルを固定して比較する。
2. pinned CoreAIKitの`StreamingDetokenizer`による逐次decodeと、同じ生成token列の全体decodeを
   比較し、文字列化段階を切り分ける。今は原因仮説であり、不具合確定ではない。
3. E4Bの`GemmaPromptRenderer`は独自turn形式を使う。`AssistPrompt.buildLive`の境界表現を変えた
   隔離実験を行い、同じ資源 / 実効samplingで比較する。既に不変と分かったEOS変更は繰り返さない。

配布用payload、Tokenizer、model lock、生成設定、依存pinは変更していない。
E4B品質受入、VoiceOver、sandbox / TestFlight、低メモリ検証は引き続き別ゲート。
