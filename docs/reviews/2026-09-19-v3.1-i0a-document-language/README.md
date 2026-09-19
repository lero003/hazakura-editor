# v3.1 I-0a — HTML文書言語の同期

Status: Implemented — source / automated test evidence only
Scope: メイン窓とLocal Assist分離窓のHTML `lang`
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
- `EBookPane` はレビュー案の `<article>` ではなく**紙の中身**（flow）へ付けた。
  `<article>` は読書面の操作帯・章名・ページ送りというUI文言も包んでおり、そこまで
  「不明」にすると今度はUI側が不明になる。境界は「本文を描く箱」に置く方を選んだ。

回帰テストは「日本語UI + 英語本文」を本文面ごとに固定した（`EditorPane`・`PreviewPane`・
`EBookPane`・Local Assist入力/生成途中）。実装前は本文面の4ファイルで4件が落ちること
（境界を外すと `lang` が `ja` になる）を確認した。エントリ順序の2件は下のP3で別に取る。

### P3 — 初回描画前の同期

`index.html` / `apple-assist.html` の既定は `en` で、保存済み `ja` でも
「HTMLロード → React初回描画 → effect → `lang=ja`」の瞬間があったため、
`main.tsx` / `appleAssistEntry.tsx` がReactを描く**前**に保存済み表示言語を反映する。
`src/appEntryLanguage.test.tsx` が `createRoot(...).render` の呼び出し時点の
`document.documentElement.lang` を記録し、順序そのものを固定する。

あわせて、分離窓とメイン窓で重複していた保存値の読み取り（`readStoredMenuLanguage`）と
`isMenuLanguage` を `documentLanguage.ts` へ寄せた。挙動は変えない。

### 既知の残件（今回は触らない）

Help・設定・診断・差分/候補レビュー・会話一覧は、UI文言と本文が同じ枠に同居している。
本文側だけを切り出すには表示の作り直しが要るので、今回の境界には含めず残件として記録する。

## 自動検証

- `npm run typecheck`
- `npm test` — 290 files / 2,581 tests passed
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
