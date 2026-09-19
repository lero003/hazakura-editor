# v3.1 I-0a — HTML文書言語の同期

Status: Implemented — source / automated test evidence only
Scope: UI chromeの `lang` 同期と、本文を描く領域の言語境界
Last reviewed: 2026-09-19

## 結論

表示言語が日本語またはかな表記でも、HTMLルートの `lang` が初期値 `en` のままになる
不整合を修正した。メイン窓とLocal Assist分離窓の両方で、表示言語 `en` は `en`、
`ja` と `kana` は `ja` に対応する。

外部レビュー（固定SHA `3cfb04e6`）のP2・P3を受け、ルートの同期は**UI chrome**の
ためだけのものとし、本文を描く領域には言語の境界を置いた。日本語UIで英語原稿を書く
場合でも、本文が `ja` として読まれることはない。

これは補助技術へ表示文言の言語を伝えるための小修正であり、bundleの対応言語宣言、
英語翻訳の完了、VoiceOver受け入れ、海外販売開始を意味しない。

## 変更境界

- `documentLanguageForMenuLanguage` に対応規則を集約した。
- メイン窓は `useAppPreferences` の表示言語変更時に `document.documentElement.lang` を同期する。
- Local Assist分離窓も保存済み表示言語から同じ規則で同期する。
- Markdown source、保存、生成、Assist能力判定、App Store / Developerレーン分離は変更しない。
- 新しい言語、依存、bundle localization、ストア設定は追加しない。

## TDD証跡

実装前に次の2ケースを追加し、いずれも期待値 `ja` に対して既存値（メイン窓は `en`、
分離窓は空文字）となる失敗を確認した。

1. 保存済み `ja` の初期反映、`kana` の `ja`対応、`en`への再切替。
2. Local Assist分離窓で保存済み `ja` を反映し、別窓からの `en` / `kana` 変更へ追随。

実装後のfocused test:

```text
Test Files  2 passed (2)
Tests       22 passed (22)
```

## 内部レビュー

初回レビューでは、`en` 以外を一括で `ja` にすると将来の言語追加を誤分類するとのP3指摘が
あった。`switch` と `never` の網羅性チェックへ変更し、新しい `MenuLanguage` を追加した際は
対応規則を明示しない限りtypecheckで止まるようにした。Local Assistの `storage` event追随も
テストへ追加した。再レビューはfindingなし。

## 外部レビュー対応（P2・P3）

### P2 — UI言語と文書言語を分ける

`lang` は子要素へ継承され、支援技術の発音選択にも使われる。ルートへ入れたUI言語を本文が
そのまま継承すると、日本語UIで英語原稿を書いたときに本文まで日本語として扱われる。
「日本語UIなのに `lang=en`」を直した代わりに、UI言語と文書言語という別概念を
一つにしてしまっていた。

- `src/features/app/documentLanguage.ts` に `DOCUMENT_CONTENT_LANG = ""` を追加した。
  空文字はHTMLが定義する「言語不明」で、ルートの言語を継承させず、誤った言語も宣言しない。
  将来 文書言語設定を持つなら、この値の代わりにその言語を入れる。
- 本文側へ境界を置いた: `EditorPane` の CodeMirror content DOM、`PreviewPane` の
  `<article>`、`EBookPane` の `ebook-page-flow` と `ebook-next-chapter-preview-flow`。
- Local Assistは依頼入力の `textarea` と、生成途中の本文
  （`apple-assist-stream-preview-body`）。
- 候補レビューも生成された本文そのものなので境界を置いた: 全文ビューの
  `.local-assist-proposal-review-text` と、`DiffBody` が描く行（差分の本文列）。
  `DiffBody` は2ファイル比較でも同じ本文列を出すため、ここで一括して切る。
- 参照面（`ReferenceTextPane` の `.reference-text-surface`）と、Local Assistサイドバーの
  固定した対象の抜粋（`<pre>`）・依頼入力（`textarea`）にも同じ境界を置いた。
- `EBookPane` はレビュー案の `<article>` ではなく**紙の中身**（flow）へ付けた。
  `<article>` は読書面の操作帯・章名・ページ送りというUI文言も包んでおり、そこまで
  「不明」にすると今度はUI側が不明になる。境界は「本文を描く箱」に置く方を選んだ。
- 同じ理由で、差分のセクション行（「変更位置: § 見出し」）と候補レビューのヘッダ行は
  UI文言を含むため境界を付けない。境界は**本文が入る箱**にだけ置く。

回帰テストは本文面ごとに「日本語UI + 英語本文」「英語UI + 日本語本文」の両方向を固定した
（`EditorPane`・`PreviewPane`・`EBookPane`・Local Assist入力/生成途中・候補レビュー・
参照面・サイドバー）。境界の値を誤らせると、本文面8ファイルで12件が落ちる
（`lang` が `ja` になる／`null` のまま）。境界の値そのものを固定している
`documentLanguage.test.ts` の1件を足すと、9ファイル13件。

### P3 — 初回描画前の同期

`index.html` / `apple-assist.html` の既定は `en` で、保存済み `ja` でも
「HTMLロード → React初回描画 → effect → `lang=ja`」の瞬間があったため、
`main.tsx` / `appleAssistEntry.tsx` / `agentEntry.tsx`（Developerレーン）が
Reactを描く**前**に保存済み表示言語を反映する。
`src/appEntryLanguage.test.tsx` が `createRoot(...).render` の呼び出し時点の
`document.documentElement.lang` を記録し、順序そのものを固定する。

あわせて、分離窓とメイン窓で重複していた保存値の読み取り（`readStoredMenuLanguage`）と
`isMenuLanguage` を `documentLanguage.ts` へ寄せた。挙動は変えない。

### 既知の残件（今回は触らない）

Help（`PrivacyPreferencesPane`）・設定・診断（`DiagnosticsPane`）はUI文言の面、会話ログ
（`AssistConversationMessages`）は依頼文・生成文と進行状況のUI文言が同じ枠に同居する面で、
本文側だけを切り出すには表示の作り直しが要る。今回の境界には含めず残件として記録する。
差分スイッチャのヘッダ行や各レビュー面の操作帯も、UI文言なのでUI言語のままにする。

## 内部レビュー2回目（コミット`d44b6341`）

実装の核（`lang=""`の選択、CodeMirrorでの保持、EBookPaneの境界位置、リファクタの同値性）は
指摘なしだった。変異テストでも、境界やエントリ同期を外すと追加テストが落ちることが
確認できた。以下は見つかった穴と対応。

- **P2（対応済み）** 候補レビューの全文ビューと差分の本文列が境界の外に残っていた。
  `LocalAssistProposalReview`の`<pre>`と`DiffBody`の行へ`DOCUMENT_CONTENT_LANG`を追加し、
  テストで固定した（外すと当該2件が落ちる）。
- **P3（対応済み）** `agent.html` / `agentEntry.tsx`（DeveloperレーンのAgent窓）だけ
  同期が無く、docsが「React初回描画の前」と無条件に書いていた。`agentEntry.tsx`にも
  同じ同期を入れ、エントリテストの対象を3エントリへ広げた。
- **P3（対応済み）** 本文面テストが日本語UI側しか見ていなかったため、両方向のループへ変更。
- **P3（対応・指摘の一部は誤り）** エントリテストが`clearMocks`に依存しているとの指摘は、
  ローカルで`render`呼び出しを外すと実際に落ちるため成立していない。ただし
  `createRoot`と`render`を別々に検証する形へ直し、暗黙依存を無くした。
- **P3（対応済み）** 差分で`AppleAssistWindowApp`の`storage`ハンドラのインデントが
  12スペースへずれていたので10スペースへ戻した（挙動は不変）。

## 内部レビュー3回目（コミット`3341102b`）

前回の指摘5件はいずれも閉じたことを変異テストで確認できた。新しい穴は2件。

- **P2（対応済み）** `DiffBody`のセクション行は「変更位置:」というUI文言と見出しの
  合成なのに、本文行と同じ境界を付けていた。UI文言を「言語不明」にしてしまうため
  セクション行からは外し、本文行にだけ残した。2ファイル比較のfixtureで固定。
- **P3（対応済み）** `ReferenceTextPane`の参照本文と、Local Assistサイドバーの固定対象
  （`<pre>`）・依頼入力（`textarea`）が境界の外に残っていた（メイン窓側のLocal Assist）。
  同じ規則で境界を置き、テストで固定した。
- **P3（対応済み）** 残件の「会話一覧」はコード上で面が特定できなかったため、
  「会話ログ（`AssistConversationMessages`）」と実名で書き直した。
- **P3（対応済み）** `current-status`の1行が長くなっていたので折り返し、他2ファイルと
  文面を揃えた。

## 自動検証

- `npm run typecheck`
- `npm test` — 291 files / 2,590 tests passed
- `npm run build:vite` — passed（既存の500 kB超chunk警告あり）
- `npm run smoke:app-store-surface` — 10 files / 125 tests passed
- `python3 docs/international-launch/validate_metadata.py --self-test` — 14 self-tests passed
- `git diff --check`

## 未確認・次工程

- 実機VoiceOverでの読み上げ、フォーカス順、切替直後のネイティブUIは未確認。
- 実機では「UI日本語 + 英語本文」「UI英語 + 日本語本文」の読み上げを確認する。
- 英語主要導線、Help、ネイティブメニューの全量監査は次のI-0スライス。
- bundleの言語宣言、署名済み候補、App Store Connect設定は未変更・未確認。
- 対象地域、価格、契約、税務、公開Support / Privacy URLはオーナー判断待ち。
