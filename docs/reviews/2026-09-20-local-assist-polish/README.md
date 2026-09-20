# Local Assist companion の表示整理

Status: Evidence
Scope: detached Local Assist window presentation
Date: 2026-09-20

依頼: 冗長な説明、文字と枠のバランスを整理し、普段の操作を小さくまとめる。
既存テーマと日本語中心の静かなツール窓を維持する。画像追加ではなく情報量・余白・階層を改善した。

## 変更

- 対象カードはファイル名・範囲・文字数に集約。本文抜粋は展開時だけ表示する。
- 会話中の対象固定は小さな表示にし、「新しい会話」は上部へ置く。
- よく使う依頼は常時見えるチップへ。選択で入力欄へ入るだけで、送信しない。
- 入力欄・送信・停止を一つの枠に統合。本文15px、補助14px。
- 利用条件は折りたたみ、利用不可時の対処は入力欄に一度だけ表示する。
- 生成中の説明を短縮。提案完了後の「差分を確認」は会話のすぐ下へ移す。
- このMac内で処理・外部AI送信なし・明示反映・自動保存なしの説明を保持。

## 文言の追加整理

利用者の指示で、常時表示していた「このMac内で処理」「差分を確認してから反映」と
空状態の見出し・依頼案内を削除した。空の上部ツールバーも場所を取らない。
日本語・英語・かな表記に共通の変更。処理・反映・保存の説明は展開したヘルプ内に保持。
最新は [補助文を除いた画面](09-after-minimal-copy.png)（520×720）。以下の03〜08は追加整理前の記録。
追加整理後はtypecheck、関連5 files / 142 tests、Vite build、ブラウザー実表示、diff checkを確認。

## 画像と操作確認

全てブラウザーで本物のReact componentを描画したもの。`fixture.tsx` はIPCと生成イベントを
模擬する表示専用fixtureであり、モデル推論、本文保存、本体Diffの表示は行わない。
Vite起動後にこのフォルダーの `fixture.html` を開く。`theme` / `lang` / `state`、
`long`（長い文書名）/ `empty`（対象なし）/ `fail`（生成失敗）をqueryで指定できる。

| 画像 | 状態・寸法 |
|---|---|
| [変更前・準備完了](02-before-ready.png) / [変更後・準備完了](03-after-ready.png) | 日本語・light、520×720 |
| [変更前・利用不可](01-before-unavailable.png) | 日本語・light、520×720 |
| [生成中](04-after-generating.png) / [提案完了](05-after-completed.png) | 日本語・light、480×800 |
| [英語・長い文書名](06-after-dark-narrow-en.png) | dark、最小420×560 |
| [利用不可](07-after-unavailable-narrow.png) | edohigan、最小420×560 |
| [標準サイズ](08-after-default-size.png) | 日本語・light、480×800 |

チップ→入力→送信、生成中→停止→再入力、完了→差分確認失敗の案内、新しい会話、
対象カードのクリック展開／Enterでの折りたたみを確認した。
最小サイズ・英語・長い文書名・ヘルプ展開時もページ420×560に収まり、送信ボタン下端535px、
会話領域約117pxを確保した。light / dark / edohiganを目視確認。

## 自動検証

- `npm run typecheck`: pass
- `npm test`: 293 files / 2,616 tests pass
- `npm run build:vite`: pass（500kB超chunkの警告あり）
- `npm run smoke:app-store-surface`: 10 files / 125 tests pass
- 最後の対象ラベル調整後、render test 20件を再確認してpass
- `git diff --check`: pass

追加した回帰検証は、対象要約を残して詳細を畳むこと、チップから自動送信しないこと、
編集後にチップの選択表示が残らないこと、利用不可の入力欄と一つの対処案内の関連付け。
既存のキャンセル・対象固定・Diff誘導identity・IMEガード・全テーマのcontrastテストも通過。

## 残る確認

native WKWebView、実モデルの生成、VoiceOver、日本語IME、署名候補での本体Diff→Apply→Undoは
この表示fixtureでは未検証。製品のモデル接続・推論・保存仕様、配布状態は変更していない。

## モデル選択枠（2026-09-20追補）

送信ボタンの左隣に `Apple Intelligence` と開閉記号のチップを配置。
クリックすると上向きの小さな選択枠が開き、System 1件にチェックを表示する。
オーナー指示により1件でも開閉・選択できる。未接続のモデルや設定項目は追加しない。

- [標準サイズ・選択枠](10-model-picker-open.png): light / ja、480×800
- [最小サイズ・選択枠](11-model-picker-dark-narrow.png): dark / en、420×560
- クリックと矢印キーで開く、選択/Escapeで閉じてトリガーへ戻る、外側クリックで閉じる。
- Tabで送信ボタンへ移動することをブラウザーで確認。生成中は閉じて無効化する。
- 選択操作で依頼本文を変更・送信しないことを回帰テストで固定。
- このSystem再選択は表示操作のみ。Rustの `system_default` 生成経路・永続設定を変更しない。

検証: typecheck、全294 files / 2,620 tests、Vite build、App Store surface 125 tests、
`git diff --check` がpass。native WKWebView / VoiceOver / 日本語IMEはこの追補では未確認。

## 送信と停止の切り替え（2026-09-20追補）

送信ボタンを生成中は「生成を停止」、取消処理中は無効な「停止処理中…」に切り替える。
同じDOM要素を保ち、取消完了・生成完了後は「依頼する」に戻す。入力中の依頼は保持する。
並列表示していた無効な送信ボタンと別の停止ボタンは統合した。

[生成中の画面](12-send-stop-toggle.png)。ブラウザーfixtureの420×560で送信前／生成中とも
ボタンの位置・サイズが一致し、停止後に再依頼可能な表示へ戻ることを確認した。
回帰テストを先に失敗させ、同一要素での切替・取消中の無効化・request id・依頼保持を固定。
変更後のtypecheck、関連5 files / 143 tests、Vite build、diff checkはpass。

## P2-01: 取消統合テストの追従（2026-09-20）

レビュー対象と同じ `7c2b5f1e3a7adf3fb729ebd76077ab538faf8365` で、
`AppleAssistCancellation.integration.test.tsx` の2ケースが旧ラベル `Sending...` を探して
失敗することをローカル再現した。送信・停止統合後の関連143テストにはこの統合テストが
含まれていなかった。期待値を `Stopping…` へ更新し、生成／停止の片方だけが完了した
中間状態でも同ボタンが無効である検査を追加。本体コードの変更はない。

`generation-first` / `stop-first` の両方で、両処理が完了するまでのロック維持、
取消完了後の解除、遅いpartial/finalの不採用、次の依頼成功まで通過した。

修正後にローカルでCI frontend相当を最後まで実行:

- `npm run typecheck`: pass
- `npm test`: 294 files / 2,620 tests pass（取消統合2ケースを含む）
- `npm run build:vite`: pass（既存の500kB超chunk警告あり）
- `npm run smoke:app-store-surface`: 10 files / 125 tests pass
- `node --test scripts/local-assist-evaluation-checks.test.mjs`: 4 tests pass
- `git diff --check`: pass

GitHub CIの再実行・push、nativeジョブ、実機・VoiceOver・日本語IMEの受け入れは今回未実施。
