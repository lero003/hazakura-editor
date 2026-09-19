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
- `EBookPane` はレビュー案の `<article>` ではなく**紙の中身**（flow）へ付けた。
  `<article>` は読書面の操作帯・章名・ページ送りというUI文言も包んでおり、そこまで
  「不明」にすると今度はUI側が不明になる。境界は「本文を描く箱」に置く方を選んだ。

回帰テストは本文面ごとに「日本語UI + 英語本文」「英語UI + 日本語本文」の両方向を固定した
（`EditorPane`・`PreviewPane`・`EBookPane`・Local Assist入力/生成途中・候補レビュー）。
境界を外すと本文面4ファイルで4件が落ちる（`lang` が `ja` になる／`null` のまま）。

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

Help・設定・診断・会話一覧は、UI文言と本文が同じ枠に同居している。本文側だけを切り出すには
表示の作り直しが要るので、今回の境界には含めず残件として記録する。

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

## 自動検証

- `npm run typecheck`
- `npm test` — 290 files / 2,587 tests passed
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
