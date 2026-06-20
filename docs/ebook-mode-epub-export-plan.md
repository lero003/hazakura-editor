# e-book Mode And EPUB Export Plan

Status: Proposal
Scope: v0.21+ authoring and export planning
Authority: Medium
Last reviewed: 2026-06-20

## Summary

**e-bookモード** は、Markdown原稿を「本」として読み、日常の
執筆面として扱いやすくするための表示モードである。EPUB に近い
読み上がり確認は、その中心的な用途の一つとして扱う。

価値の芯は、綺麗なPreviewではなく **読んで直す** 体験に置く。
長いMarkdown原稿を章・ページ・見開きに近い単位で読み、違和感を
見つけた箇所からMarkdown sourceへ戻り、必要に応じてDiff / Reviewへ
接続できることを優先する。

作業上の通称は **いーモード** または **びーモード** とする。
正式名称とUI表記は未決定。

これは高度なWYSIWYG編集面ではない。Markdown source remains the
truth. えるモード / L Mode と同じく、保存される本文はMarkdownのまま
保ち、表示だけをEPUB向けに近似する。将来のWYSIWYG-tier編集は、
Preview DOMを直接編集する方向ではなく、L Mode / CodeMirror
decorations 系の Visual Markdown として別スパイクで扱う。

将来の関連機能として、画像と基本スタイルを含めた **EPUB
エクスポート** を検討する。ただし、最初の実装では表示モードと
エクスポートを一体化しすぎない。まず「本として読む」体験を先に
安定させる。

## Product Fit

この構想は `Hazakura Editor` の方向性と相性がよい。

- Markdown-first authoring の延長である。
- Safe Editor の「読む・書く・確認する」体験を強められる。
- L Mode の文書集中体験と近いが、目的を「出版前の見え方確認」に
  分けられる。
- HTML export / Print to PDF の次に自然な authoring export として
  位置付けられる。

一方で、次の線は越えない。

- Preview DOM editing や `contenteditable` を導入しない。
- EPUBを保存中の別ドキュメントモデルにしない。
- Markdown本文を保存時に自動整形・自動変換しない。
- Kindle / EPUB の完全再現を初期目標にしない。
- 外部コマンド実行や Calibre / EPUBCheck の自動起動をSafe Editor
  本体に入れない。

## Relationship To L Mode

L Mode は、日常の読み書きを静かにする Live Source writing surface
である。

e-bookモードは、本として読む・章として眺める・EPUB export 前に
構造を確認し、必要ならMarkdown sourceへ戻って直す book reading /
book review / EPUB simulation surface として扱う。

```txt
Normal Mode: safe Markdown editing and review
L Mode: calm Live Source writing
e-book Mode: book-like reading and EPUB simulation while editing
EPUB Export: explicit file generation from Markdown source
```

共通原則は同じである。

- Markdown source is canonical.
- 表示は保存内容を暗黙に変えない。
- Preview / Diff / Review / Export は、表示装飾ではなくMarkdown source
  から再生成する。
- 画像、リンク、外部参照は既存の workspace boundary に従う。

v0.21 PoC では、L Mode の CodeMirror decorations / widgets / CSS を
どれだけ再利用できるかを調べる。判断は次の三択に分ける。

- **統合**: e-book Mode が L Mode の発展形として自然に実装できる。
- **共存**: L Mode は Live Source writing、e-book Mode は book
  preview として別モードのまま残す方が分かりやすい。
- **進化系**: 既存L Mode資産を一部使い、新しい book-oriented
  surface として設計し直す。

## User Experience Target

ユーザーは、原稿を書きながら次を確認できる。

- EPUB化した時の本文幅、余白、行間、見出しの強さ
- 横書きと縦書きの読み心地
- 画像が本文内でどの程度重く、どの位置に見えるか
- 改ページ、章区切り、表紙候補、目次候補のざっくりした状態
- EPUB export に進む前に直したいMarkdown構造

このモードは「紙面編集」ではなく「EPUBシミュレーション」である。
細かな端末差やKindle側の変換差は、初期段階では警告付きの近似として
扱う。

## Proposed Phases

### v0.21: PoC And Reuse Audit

- `lero003/kindle-epub-tool` を参照し、EPUB生成・画像解決・追加CSS・
  テストの再利用可能性を調査する。
- 既存の `useDocumentExport` / `renderMarkdown` /
  Markdown preview CSS と、EPUB向けHTML生成を分けるべき箇所を決める。
- 表示専用PoCの土台は、まず CodeMirror decorations ではなく既存の
  `renderMarkdown` / Preview HTML pipeline を優先して検証する。これに
  より sanitize、workspace image boundary、Preview / Export 系の既存
  安全境界を流用しやすくする。
- `src/features/editor/lMode/` の CodeMirror decorations / widgets /
  parser helpers / CSS は、PoCの主経路ではなく、後続の統合 / 共存 /
  進化系判断のための参考資産として軽く監査する。
- 単一長文MarkdownをATX見出しで章分割し、横書きの表示専用PoCを作る。
- 複数Markdownを一冊の章構造として俯瞰するUI基礎を調べる。
- L Mode との関係を「統合」「共存」「進化系」のどれで進めるか
  決めるための判断材料を残す。
- 依存追加が必要な場合は、ライセンス、bundle size、App Store lane
  影響を先に確認する。

`kindle-epub-tool` の現在確認できた特徴:

- Next.js / React ベースのブラウザアプリ。
- `JSZip` と `marked` を使い、MarkdownからEPUBを生成する。
- 書名、著者名、言語コード、追加CSSを扱う。
- 画像アップロード、先頭画像の表紙採用、Markdown画像参照との
  ファイル名一致を扱う。
- GFM table、blockquote、page break、UUID付与、画像解決テストを持つ。
- EPUBCheck による提出前検証を推奨している。

この既存ツールは有望だが、そのまま統合する前に Hazakura 側の
workspace boundary、画像サイズ上限、sanitize方針、export UI と
合わせて見直す。

### v0.21 PoC Slice 0 (実装済み / 2026-06-18)

最初の表示専用PoCスライス。範囲は最小限。

- 章分割: `src/features/editor/ebookChapters.ts` がATX見出し
  (`#`〜`######`) ベースで単一Markdownを章セグメントに分割する。
  fenced code block 内の `#` は章境界にしない。Setextは扱わない。
  各章の `source` は元のMarkdownの verbatim 部分文字列であり、
  並び順や内容を一切書き換えない。
- 表示面: `src/components/editor/preview/EBookPane.tsx` が章ごとに
  `renderMarkdown()` + `inlineWorkspaceAssetImages()` を呼び、
  DOMPurify / workspace image / 外部参照の既存安全境界をそのまま
  再利用する。編集要素・`contenteditable` は持たない（表示専用）。
- 導線: `RightPaneMode` に `"ebook"` を追加し、Preview / Outline /
  Diff と同じサイドペイントグルから開ける。`useSidePaneState` /
  `useSidePaneToggles` / `SidePane` / `RightPaneToggleControls` /
  `DocumentMetaBar` / `AppTopChrome` を経由。L Mode 時は非表示。
- CSS: `src/styles/preview.css` 末尾に章ベースの reading surface
  スタイル。章は「ページのメタファー」であり、本物のページネーション
  ではない（長い章はスクロール、短い章は1ブロック）。

判断記録:

- **Path Y（描画HTML）を選んだ理由**: 表示専用なら CodeMirror
  decoration である必要がない。`renderMarkdown` 経由なら sanitize・
  workspace image boundary・Preview/Export の安全パイプラインを
  丸ごと再利用でき、caret / IME / selection の Live Source リスクを
  扱わずに済む。L Mode 資産の再利用監査は PoC のブロッカーにしない。
- **L Mode 統合を保留した理由**: Path Y で組むと L Mode（CodeMirror系）
  とは物理的に別レイヤーになる。「統合 / 共存 / 進化系」の判断材料は
  PoC を見てから揃うため、現時点では明示的に共存とする。

検証:

- `ebookChapters.test.ts`（11件）: 章分割・fence無視・preamble・
  Setext 非境界・verbatim 部分文字列。
- `EBookPane.test.tsx`（7件）: 章レンダリング・`<script>` 除去・
  外部画像 block・`javascript:` リンク無害化・リンクルーティング。
- `npm run build:vite` 成功、`npm run test` 822件全通過（既存
  Preview / Diff / L Mode / Export / Editor 各テストは不変）。

PoCスコープ外（明示的に今回やらない）:

- EPUB 生成、縦書き、複数ファイル章構造、保存設定。
- 本物のページネーション（行/画像高さ計算・左右ページ同期）。
- L Mode 資産の再利用監査本体（別スライスで実施）。
- 見開きレイアウト（別相談で一度外した）。

### v0.21 PoC Slice 1/2 (実装済み / 2026-06-18)

Slice 0 の Path Y 土台を、v0.21 の完了線である「本として読む入口を
評価できる状態」まで整えた。範囲は引き続き表示専用であり、
Markdown source、Preview、Diff、Export HTML、L Mode の編集面は
変更しない。

- 本風 reading surface: `EBookPane` の章ごとに page sheet / cover /
  front matter の class を付与し、`src/styles/preview.css` の e-book
  block だけで紙面風の余白、本文幅、serif typography、章間の
  オーナメント、blocked image note を調整した。これはページの
  メタファーであり、本物のページネーションではない。
- 章ナビ: e-book pane 内の上部に薄い章ナビを追加した。章タイトルは
  `splitMarkdownIntoChapters()` の `headingText` / `headingLevel` 由来で、
  preamble は「前付」、見出しなし文書は「本文」として扱う。クリックは
  該当章への scroll に留まり、Markdown source や outline state は
  変更しない。
- 軽い遅延表示: e-book pane の source 入力だけ `useDeferredValue` で
  低優先表示にし、長文や画像混在文書で通常エディタ入力を優先する。
  明示的なms debounce、idle scheduler、dirty section rebuild は
  入れていない。
- L Mode との関係: 引き続き共存。L Mode の CodeMirror decorations /
  widgets は Live Source writing surface の資産として残し、e-book
  Mode の主経路には使わない。統合 / 進化系判断は、v0.21 の運用と
  v0.22 MVP検討の入力にする。

検証:

- `EBookPane.test.tsx`: 章レンダリング、cover/front matter class、
  章ナビ表示、章ナビ scroll、sanitize、workspace画像解決、blocked
  image、link routing。
- `previewCss.test.ts`: Previewカード継承リセット、cover H1 の下線解除、
  e-book章ナビのスコープ。
- 追加の実機 smoke 項目: e-book toggle、章ナビ移動、workspace内画像、
  light/dark表示、長文入力時の体感。

### v0.22: e-book Mode Chapter Reader MVP (実装済み / 2026-06-19)

v0.21 の連続スクロール型PoCを、章送りの読書面へ作り替えた。
目的は EPUB 完全再現ではなく、「綺麗なPreview」から「章をめくる
読書面」へ体感を変えられるか評価することである。

- `EBookPane` は `activeChapterIndex` を内部stateで持ち、DOMに出す
  `.ebook-chapter` は常に1つだけにした。`documentPath` 変更時は
  先頭章へ戻し、source編集で章数が減った場合は index を有効範囲へ
  clampする。
- `useDeferredValue(source)` は外した。章送りでは全章レンダリングを
  やめ、表示中の1章だけを `renderMarkdown()` +
  `inlineWorkspaceAssetImages()` に通すため、遅延表示より source と
  章stateの同期を優先した。
- 章送りUIは `前の章` / `次の章`、章タイトル、`n / total` の最小
  reader chrome とした。`SidePane` から `menuLanguage` を渡し、
  ja / en / kana の短いcopyを切り替える。
- キーボード操作は reader root にフォーカスがある時だけ
  `ArrowLeft` / `ArrowRight` を扱う。window/global listener は使わず、
  リンク、ボタン、検索、パレット等の Arrow 操作を奪わない。
- 章扉仕様は MVP では「A: 章の冒頭ヘッダ」。見出しは active chapter
  内で中央寄せ/強調するが、独立ページには分けない。本文は下に続き、
  章内スクロールでヘッダが流れることを許容する。
- CSSは e-book block 内で作り直した。複数 page sheet、章間
  オーナメント、横スクロール章ナビは撤去し、`.ebook-pane` を紙面
  キャンバス、`.ebook-reader-*` を reader chrome、`.ebook-chapter`
  を active chapter 本文として扱う。

検証:

- `EBookPane.test.tsx`: active chapterのみのDOM、前/次ボタン、
  端のdisabled、root focus限定の左右キー、`documentPath` reset、
  source shrink clamp、preamble / heading-less label、ja/en/kana copy、
  workspace画像解決、blocked image、sanitize、link routing。
- `previewCss.test.ts`: e-book reader chrome と章ヘッダCSSのスコープ、
  Previewカード継承リセット、cover H1下線解除、旧page sheet /
  章間オーナメント / 横ナビ依存の撤去。

MVPで扱わないもの:

- CSS columns 擬似ページネーション。
- 本物のページ計算、見開き、縦書き。
- 細かな組版UI、画像トリミングやレイアウト編集。
- EPUBファイル生成。
- 複数ファイルの章順保存。
- L Mode統合。共存を継続する。

### v0.23: CSS Columns Pseudo Pagination Spike

v0.22 の章送りMVPで「章をめくる」体感は得られた。次の確認対象は、
章内の本文を実際の読書端末に近い単位で「ページをめくる」体感へ
寄せられるかである。

ここでいう擬似ページネーションは、Markdown sourceを文字数で分割する
機能ではない。読書端末と同じく、ページ境界はフォント、本文幅、
表示高さ、行間、画像、見出し、表、コードブロックによって変わる。
そのため、まずは描画済みHTMLをCSS columnsで横方向に流し、ブラウザの
layout結果を端末シミュレーションとして扱う。

#### Simulation Device Policy

初期の e-book Mode は、特定の実機Kindle / Apple Books / Koboを完全に
再現しない。代わりに、アプリ内で次の **固定シミュレーション端末** を
定義して検証する。

- writing preview device: 現在の右ペイン幅を基準にした可変プレビュー。
  執筆中の軽い確認向け。ウィンドウ幅に応じてページ数は変わってよい。
- reference reader device: 後続で1つだけ固定サイズを決める基準端末。
  例: 文庫相当の本文幅、横書き、serif / 明朝系、固定行間。手動smokeや
  回帰確認ではこの端末を基準にする。

この方針により、e-book Mode のページ数は **実際のEPUBリーダーでの
最終ページ数を保証しない**。保証するのは、同じsourceと同じ
シミュレーション設定の中で、章内の読み進み、画像の収まり、見出しの
強さ、長文の読書感を評価できることである。

#### Spike Scope

- active chapter reader は維持し、章内本文だけを CSS columns で
  横方向の擬似ページにする。
- 左右キーはまず章内ページ送りに使い、章末 / 章頭で必要なら章送りへ
  接続する。
- reader chrome は `章 n / total` と `ページ n / total` を分けて表示する。
- 画像、表、コードブロックは `break-inside: avoid` や `max-height` を
  使い、ページ分割の破綻を観測する。
- `---` は Markdown の水平線として維持する。将来の明示改ページ記法に
  昇格するかは、CSS columns Spike 後に判断する。

#### v0.23 Spike Slice (実装済み / 2026-06-19)

最初の疑似ページ送りSpike。目的は、e-book Mode が通常Previewより
「本として読む」体感を持てるかを最小実装で見ることである。

- DOM: `section.ebook-chapter > .ebook-page-viewport >
  .ebook-page-flow` に分け、CSS Columns は `.ebook-page-flow` のみに
  適用した。reader chrome は列レイアウトに巻き込まない。
- Columns: `.ebook-page-viewport` を文庫相当の固定シミュレーション枠にし、
  `.ebook-page-flow` は viewport と同じ高さで `column-width` /
  `column-gap` / `column-fill: auto` を使う。`column-fill: balance` は
  空ページ化リスクがあるため採用しない。
- 操作: 前後ボタンと reader root の左右キーは、まず章内ページを送る。
  章末 / 章頭では次章 / 前章へ接続する。1ページだけの章も次ページ操作で
  次章へ進む。
- 計測: `ebookPagination.ts` にページ数と `translateX` offset のhelperを
  分離した。測定不能時は1ページとして扱う。レビュー後、offsetは
  render中に `flowRef.current` を読まず、layout後にstateへ反映する形へ
  調整した。
- 再測定: active HTML 差し替え、workspace image の非同期インライン完了、
  `.ebook-page-viewport` resize、root `style` / `data-theme` 変更を
  再測定トリガにした。
- 長いcode block: `pre` はページ高の一部に収め、はみ出す場合は
  code block 内スクロールに逃がす。これは真の組版ではなく、Spike中の
  破綻抑制である。

検証:

- `EBookPane.test.tsx`: 本文コンテナだけのページDOM、ページ表示、ページ送り、
  章境界接続、1ページ章、前章最終ページ復帰、reset / clamp、画像インライン後
  再測定、既存の sanitize / image boundary / link routing。
- `previewCss.test.ts`: `.ebook-page-flow` への columns 限定、
  `column-fill: auto`、viewport clipping、長い `pre` の高さ制限、
  Preview / chrome への漏れ防止。
- `npm run test -- src/components/editor/preview/EBookPane.test.tsx
  src/styles/previewCss.test.ts`
- `npm run build:vite`
- `npm run test`

残る評価:

- 実機で、長い章・画像入り章・表 / 長いcode block・Tab focus・
  light/dark theme / font size変更後のページ数追従を確認する。
- 読書感がPreviewとの差として十分かを見てから、次の短いスライスでは
  右ペイン内で成立する単ページ固定感を深める。右ペイン内2-upは
  幅不足で価値が出にくいため、今回の後続には含めない。

#### v0.24 Follow-up: Single-page Reading Surface Polish

v0.23 の manual smoke では単ページでも読書感が少し出た。一方で、
右ペイン内の見開きは、2ページ分の幅を確保すると編集エリアを大きく
潰すため、次スライスの主軸にしない。

最初の範囲:

- 既存の active chapter / CSS Columns 疑似ページ送りを維持する。
- `.ebook-page-flow` は本文だけの columns flow として維持し、reader
  footer は flow 外の固定chromeとして置く。
- footer は章タイトルと章内 `n / total` を表示する。本全体の通しページ
  番号は、全章の事前計測が必要になるため扱わない。
- ページ高、幅、gap、余白、footer height は実装後に
  `previewCss.test.ts` で固定し、意図せず戻らないようにする。
- 右ペイン内2-up toggle、横スクロール、幅による自動見開き化、
  `RightPaneMode` 追加は入れない。

Decision record:

- 右ペイン内2-upは、ページ幅430px前後を2枚とgapで並べるため
  約900pxが必要になる。通常の右ペイン幅ではほぼ単ページfallbackに
  なり、最大化しても編集エリアを潰しやすい。
- 見開きは破棄ではなく、将来の e-book occupied reading mode
  （compare mode のように編集エリアを一時的に隠す読書面）の候補として
  扱う。

#### Spike Non-goals

- 文字数ベースの分割。日本語、画像、リスト、表、コードで破綻しやすく、
  実際の読書端末のページ境界とも一致しない。
- 本物のページ計算エンジン。行高、禁則、画像高、表分割を自前で計算する
  実装はこのSpikeでは扱わない。
- 複数端末プリセット、端末選択UI、縦書き、右ペイン内見開き。
- EPUB export のページ数保証。

### Later: Book Structure Overview

複数Markdownファイルを「一冊の本の章」として眺める。これは
ファイルマネージャではなく、章構造化表示である。

- 選択中ワークスペース内のMarkdownを章候補として並べる。
- 章順管理と目次候補を表示する。
- 目次生成や章順保存は明示的なユーザー操作だけで行う。
- 保存場所は PoC 後に決める: frontmatter、`index.md`、
  専用目次ファイル、またはアプリ設定。

OKF の `index.md` 規約に近い形へ寄せられる可能性はあるが、OKF
自体はまだ提案段階として扱い、v0.23 の実装契約にはしない。

### v0.26: EPUB Export First Slice

v0.26 では、いくつかの authoring polish と合わせて EPUB export の
初期版を扱う。これは v1.0 完成版ではなく、「Markdown source から
明示的に `.epub` を書き出せる」ことを確認する first slice である。

実装状態: File メニューとコマンドパレットの `Export EPUB (Beta)...`
経由で、active Markdown source を最小の `.epub` archive として書き出す
経路は実装済み（`src/features/document/epubExport.ts` の
`buildEpubBetaArchive`、`src/hooks/document/useDocumentExport.ts` の
`exportEpubBeta`、Rust 側 `save_binary_file_as` の base64 IPC 経由保存）。
2026-06-20 の follow-up Slice 1 で、workspace-local images の取り込み、
小さな `data:image` の EPUB resource 化、扱えない画像の warning 化、
Preview 専用マークアップ除去、frontmatter 認識、heading parser 統一は
実装済み。残る beta follow-up は、手動 EPUBCheck 証拠化、metadata 設定
UI、page-break marker である。

Scope:

- active Markdown source から `.epub` archive を生成する。
- save dialog を通じた明示的な export action にする。
- ATX headings から章 / navigation / table of contents の初期構造を作る。
- title / language / identifier は安全な初期値を使う。ただし、標準的な
  export UI としては title / author / language を専用入力として扱う
  必要がある。
- XHTML content と stylesheet は Markdown source から生成する。
- workspace-local images は既存の workspace image boundary とサイズ
  方針を再確認して取り込む。扱えない画像は warning にする。
- standalone / no-workspace document は、まず Save As で実ファイルに
  した後の export を dependable path とする。未保存sourceからの export
  は可能でも、相対画像解決に制限があることを明示する。

Do not include:

- external EPUBCheck / Calibre launch;
- App Store lane 外部通信やアップロード;
- vertical writing;
- advanced metadata / cover editor;
- reader-perfect pagination or EPUB-reader page-count claims;
- saved EPUB as a second editable document model.

Verification direction:

- source text is not mutated by export;
- generated archive is deterministic enough for regression tests;
- unresolved / blocked images produce warnings instead of unsafe reads;
- Preview / e-book Mode / HTML export behavior remains unchanged;
- manual EPUBCheck remains documentation guidance, not an in-app command.

#### EPUB metadata and export settings

EPUB package metadata の標準側で最低限必要なものは、Package Document
内の `dc:title`、`dc:identifier`、`dc:language`、および
`meta property="dcterms:modified"` である。`dc:creator` / Author は
EPUB の最小必須項目ではないが、Kindle 向けの実用フローや一般的な
書籍 export UI では first-class field として扱う。したがって
Hazakura の次スライスでも、利用者に見える入力はまず次の3項目に
絞る。

References:

- W3C EPUB Packages 3.2, DCMES required elements:
  `https://www.w3.org/publishing/epub32/epub-packages.html`
- Reference tool UI and guide:
  `https://kindle-epub-tool.pages.dev/`

- `Title`: 書名。初期値は最初の H1、なければファイル名 stem、さらに
  なければ `Untitled`。
- `Author`: 著者名。初期値は空欄。Markdown source から推測しない。
- `Language`: 言語。初期値は `ja`。将来は BCP 47 風の言語コードとして
  検証する。

実装上は、これらを editor tab や Markdown 本文へ混ぜず、export 専用の
draft state として持つ。

```ts
type EpubExportSettings = {
  title: string;
  author: string;
  language: string;
  identifier: string;
  pageBreakMode: "manual-markers";
};
```

- `identifier` は UI に最初から出さなくてよいが、export ごとに UUID
  などで生成し、固定値を使い回さない。
- `dcterms:modified` は export 実行時刻から生成する。ユーザー入力には
  しない。
- `author` が空なら beta では `dc:creator` を出さない、または保存前に
  入力を求める。どちらにするかは UI slice で決める。
- 初期実装では dialog / modal scoped state に留め、完了後の
  localStorage 保存や last-used author は後続判断にする。
- Markdown frontmatter への自動書き込み、隠し workspace metadata、
  EPUB を別の編集対象として保持することはしない。

現在の beta は、2026-06-20 の Slice 3 で Title / Author / Language を
dialog scoped draft state として入力できるようになった。Title は最初の
見出しまたはファイル名から初期化し、Author は空欄、Language は `ja` を
初期値にする。identifier は export ごとに UUID 生成、`dcterms:modified`
は export 実行時刻から生成する。Markdown frontmatter への自動書き込み、
localStorage 保存、last-used author の持ち越しはしない。

#### Structure and page-break semantics

見出しと改ページは別の意味として扱う。この整理は EPUB export だけでなく、
e-book Mode / preview-style reading surface の表示にも関わる。

- `h1` - `h6`: navigation / table of contents / anchor の構造を作る。
  すべての見出しを自動で物理ページ区切りにしない。
- standalone line の `---` または `===`: 将来の explicit page break
  marker 候補。空行で挟まれた単独行だけを対象にし、通常の水平線との
  互換性リスクを UI / docs で明示する。
- e-book Mode が page-break marker を visual cue として表示する場合も、
  Markdown source は書き換えず、export と同じ parser helper を使って
  semantics がずれないようにする。
- v0.26 beta follow-up では single `content.xhtml` の中に
  `.page-break` class を挿入する程度に留める。`h1` ごとの
  `chapter-001.xhtml` 分割や spine 分割は後続の互換性確認後に扱う。
- page break は「読書システムへの希望」であり、Kindle / Apple Books
  など各リーダーで同じページ数になる保証ではない。

次の実装スライスで追加すべき検証:

- Title / Author / Language の初期値と escaping。
- export ごとに identifier が固定値にならないこと。
- `dcterms:modified` が export 時刻由来で生成されること。
- `---` / `===` の page-break marker が fenced code block 内や通常本文を
  壊さないこと。
- e-book Mode / preview-side visual cue と EPUB export の page-break 判定が
  同じ helper に基づくこと。
- metadata settings を変更しても Markdown source が変わらないこと。

#### Beta 実装の未達スコープと乖離

first slice の beta 実装は導線と最小 archive 生成を満たしていたが、本節の
Scope と既存 helper の構造の間に 5 点の乖離があった。1〜4 は
2026-06-20 の Slice 1 で実装済み。5 は同日の Slice 2 で証拠化済み。

1. **画像取り込みの不在**: `buildEpubBetaArchive` は `renderMarkdown()`
   を呼ぶが `inlineWorkspaceAssetImages()` を呼んでいない。workspace 画像は
   `data-hazakura-image-path` 属性付きの透明 GIF のまま XHTML に入り、
   EPUB リーダーで壊れた画像になる。Scope の「workspace-local images を
   取り込む。扱えない画像は warning にする」を未達成。
2. **Preview 専用マークアップの XHTML 混入**: `renderMarkdown()` が付与する
   `.markdown-table-frame`（table ラッパー）、`.markdown-task-checkbox`
   （`☑` / `☐` の span）、`.blocked-image`（span）がそのまま XHTML content
   に入る。`epubCss()` に対応スタイルがなく、表紙崩れや意味の変質を招く。
3. **frontmatter と `---` 改ページの衝突**: Markdown frontmatter（YAML）
   の開始・終了 `---` を page-break や章境界に誤認するリスクがある。
   `splitMarkdownIntoChapters`（e-book Mode）も `collectMarkdownHeadings`
   （EPUB export）も frontmatter を認識しない。
4. **parser helper の二重実装**: e-book Mode の章分割は
   `splitMarkdownIntoChapters`、EPUB export の見出し収集は
   `collectMarkdownHeadings`（`parseMarkdownHeadingLine`）と別実装で
   ある。fenced code block 内の `#` 扱いや Setextの扱いが既にずれて
   おり、検証項目「同じ helper に基づくこと」を構造的に満たさない。
5. **EPUBCheck 検証マイルストーンの不在**: beta 出力が手動 EPUBCheck を
   通るかの確認マイルストーンが計画のどこにもなかった。Slice 2 で
   placeholder `dc:identifier` 警告を修正し、`test02.epub` の 0 warnings
   通過を確認済み。

これらのうち 1〜4 は「beta の出力品質」、5 は「beta の検証証拠」に分類
する。metadata 設定 UI と page-break 記法は frontmatter / parser 統一に
依存するため、beta 出力品質を先に固める順序にした。

#### v0.26 Follow-up Slice 構成（4 分解）

beta の未達スコープを小さく独立して検証できる 4 スライスに分ける。
各スライスは Markdown source を保存内容として維持し、Preview / e-book
Mode / HTML export の既存挙動を壊さない。

##### Slice 1: EPUB content 品質（画像・マークアップ・parser 統一）

Implemented locally as of 2026-06-20. beta 出力を読める品質にする
first slice の実質的な完成線。

- `buildEpubBetaArchive` に `inlineWorkspaceAssetImages()` 相当の画像
  解決を組み込む。workspace 画像は `OEBPS/images/` へリソース化
  （manifest `item` 追加、XHTML 側 `<img src>` を相対パスに書き換え）。
  既存の 20 MB local image boundary と preview/export の 2 MB data:image
  inline cap を再利用し、許可済み `data:image` も `OEBPS/images/` に
  リソース化する。扱えない画像は warning span にする。外部画像は
  取り込まない。
- EPUB 用クリーンアップ層を `renderMarkdown()` と `contentXhtml()` の間に
  挟む。`.markdown-table-frame` を外して `<table>` を戻す、task checkbox を
  テキスト表現に戻す、`.blocked-image` を warning にする。この層は
  Preview / HTML export のパスには影響させない。
- `collectMarkdownHeadings` を `splitMarkdownIntoChapters` と同じ見出し
  検出に統一する。あわせて frontmatter 認識を追加し、frontmatter 内の
  見出し風行や `---` を章境界・見出しにしない。
- IPC は引き続き base64 `save_binary_file_as` を使う。画像リソース化で
  archive が大きくなる場合は、計画文書の Performance Notes に沿って
  plugin-fs / temp-file handoff への移行候補として記録する。

検証:

- 既存 `epubExport.test.ts` の回帰、画像インライン後の manifest と
  `<img src>` の整合、Preview 専用 class が XHTML に入らないこと、
  frontmatter 内 `#` / `---` が章境界・見出しにならないこと、inline
  Markdown を含む見出しの後続 navigation が落ちないこと。
- `npm run test -- src/features/document/epubExport.test.ts
  src/features/editor/ebookChapters.test.ts
  src/hooks/document/useDocumentExport.test.tsx
  src/hooks/app/useAppMenuActionListener.test.tsx
  src/hooks/commandPalette/useCommandPaletteController.test.ts
  src/hooks/app/useAppShellSideEffectsController.test.tsx
  src/lib/diagnostics.test.ts`
- `npm run test`
- `npm run build:vite`

##### Slice 2: EPUBCheck 手動検証マイルストーン

2026-06-20 に実施済み。Slice 1 の出力を手動 EPUBCheck に通し、first
slice の「生成 EPUB は手動で EPUBCheck に通せる形を目標にする」を
証拠化した。

- App 内コマンド化はしない。外部 EPUBCheck / Calibre 起動は引き続き
  安全境界の外。
- 初回 `epubcheck test.epub` で placeholder `dc:identifier`
  (`urn:uuid:hazakura-epub-beta`) が不正 UUID として警告されたため、
  export ごとに valid UUID を生成する最小修正を入れた。
- follow-up の `epubcheck test02.epub` は EPUB 3.3 ルールで 0 fatal
  errors / 0 errors / 0 warnings / 0 info。
- App 内 validator、外部コマンド起動、Calibre / EPUBCheck 連携 UI は
  引き続き入れない。

##### Slice 3: metadata 設定 UI（`EpubExportSettings`）

2026-06-20 に実装済み。「EPUB metadata and export settings」節の契約を
dialog scoped draft state として実装した。

- Title / Author / Language の入力。identifier は export ごとに UUID 生成、
  `dcterms:modified` は export 実行時刻から生成する。author が空なら
  `dc:creator` を出さない。
- Markdown frontmatter への自動書き込み、localStorage 保存、last-used
  author の持ち越しはしない（既存方針維持）。
- Slice 1 で導入した frontmatter 認識と parser helper を再利用する。

検証:

- 設定変更で Markdown source が変わらないこと、identifier が固定値に
  ならないこと、`dcterms:modified` が実行時刻由来であること、metadata
  escaping。

##### Slice 4: page-break 記法（standalone `---` / `===`）

「Structure and page-break semantics」節の standalone 行 page-break
marker を実装する。Slice 1 の frontmatter 認識の上に載せる。

- 空行で挟まれた単独行 `---` / `===` を single `content.xhtml` 内の
  `.page-break` class にする。fenced code block 内や frontmatter を
  壊さないことをテストで証明してから導入する。
- 見出しは引き続き navigation のみで、自動改ページしない。
- e-book Mode が同じ helper で page-break を visual cue 表示する場合は、
  Markdown source を書き換えない。

検証:

- `---` / `===` が fenced code block / frontmatter / 通常水平線と衝突
  しないこと、通常水平線との互換性リスクを Help / docs で明示。

#### Help 文書の EPUB 説明追加

ユーザー向けに、EPUB export beta の説明を Help に足す。技術的開示の
位置づけで、`src/components/app/helpDocs/en/local-data-disclosure.md` の
「Preview and export」節を拡充する（UI 文言ではなく技術開示。Help は
英語のみという既存方針を維持）。

追加内容:

- beta であること、明示的な File メニュー / コマンドパレット操作で
  あること。保存は Save As ダイアログ経由であること。
- workspace 画像の取り扱い（Slice 1 後は取り込む、扱えない画像は
  warning）。外部画像は取り込まない。
- metadata の初期値（title は最初の H1 / ファイル名、language は `ja`、
  author は空）。外部送信しない。
- ページ数保証がないこと（リーダー依存）。
- 手動 EPUBCheck 検証はドキュメント案内のみ（App 内コマンドではない）。
- 縦書き・cover editor・外部 validator 起動は beta 範囲外であること。

Help 更新は Slice 1（画像取り込み）と Slice 3（metadata UI）の完了後、
2026-06-20 に実施済み。EPUB export は local Title / Author / Language
metadata dialog と Save As dialog を通る明示操作として説明している。

### Later: Style Simulation And Review Hooks

v0.24 は単ページ読書面 polish として閉じた。v0.26 で EPUB export の
初期版へ進む場合も、style simulation は最小限に留め、export の
安全境界と再現性を先に固める。

- font scale
- line height
- page width / margin
- chapter heading style
- image fit policy
- theme-independent EPUB preview palette
- AI提案取込や複数ファイルDiff / Reviewへつなげるための章・範囲
  メタデータ

設定は document-local に保存するか、アプリ設定にするかを後で決める。
初期は保存しない一時設定でもよい。

### v1.0 Candidate: EPUB Export

EPUB export は明示的な export action として実装する。

期待する出力:

- `.epub` archive
- metadata: title, author, language, identifier
- XHTML content generated from Markdown source
- stylesheet generated from selected EPUB style settings
- workspace-local images copied into EPUB assets
- cover image candidate
- navigation / table of contents
- warnings for unresolved images or unsupported constructs

生成はユーザー操作でのみ行い、外部アップロードや外部検証はしない。
EPUBCheck はドキュメント上の手動検証候補として扱う。

v1.0 candidate では、EPUB export は「初期実装」でよい。高度な
メタデータ編集、表紙管理、ナビゲーション調整、縦書き、OKF bundle
対応は v1.x 以降へ回す。

### v1.x: OKF, Vertical Writing, And Advanced EPUB

e-book Mode が日常執筆面として安定した後に扱う。

- OKF bundle を本として読む: frontmatter 可読化、`index.md` /
  `log.md` 対応、簡易リンクグラフ。
- 縦書き対応。
- EPUB export 高度化: metadata、cover、navigation、manual
  validation guidance。

OKF対応前には、その時点のOKF仕様を再確認する。

## Performance Notes

リアルタイム反映は慎重に扱う。

- 画像を含む長文では preview rebuild が重くなる可能性がある。
- 画像解決、data URI化、ZIP生成は editing loop から分離する。
- e-bookモード中は lightweight HTML preview を使い、EPUB archive
  生成は export 時だけ行う。
- preview更新は debounce / idle scheduling / dirty section rebuild を
  検討する。
- 既存の20 MB local image boundary と preview/export inline cap の
  どちらを使うかは、表示とEPUB生成で分けて明示する。

## Verification Direction

実装時は次を検証する。

- Markdown source がモード切り替えで変わらない。
- Normal Mode、L Mode、Preview、Diff、HTML export の既存挙動を壊さない。
- workspace外画像、外部画像、危険なHTMLやschemeを取り込まない。
- 大きい画像を含む文書で編集が極端に重くならない。
- EPUB export は同じMarkdownと同じ入力画像から再現可能に生成される。
- 生成EPUBは手動で EPUBCheck に通せる形を目標にする。

## Open Questions

- 正式名称は e-bookモード、いーモード、びーモードのどれにするか。
- 最初のUIは split preview と one-pane preview のどちらがよいか。
- L Mode と統合するか、共存させるか、進化系として再設計するか。
- EPUB style settings を一時設定にするか、workspace / document に
  保存するか。
- 章分割は見出しベースを初期値にし、改ページ記法を後で足すか。
- 複数ファイルの章順保存場所は frontmatter、`index.md`、専用目次
  ファイル、アプリ設定のどれがよいか。
- 表紙画像はユーザー指定にするか、最初の画像を候補にするか。
- EPUB export の依存は `JSZip` / `marked` 系を再利用するか、
  Tauri/Rust側で組み立てるか。

## Recommendation

v0.21以降の候補として残す価値がある。

最初の勝ち筋は、**v0.21で表示専用PoCとL Mode資産再利用調査を行い、
v0.22で横書きe-book Mode MVPへ進む** ことである。

この順なら、L Mode の source-preserving 原則を守りながら、出版前の
見え方確認と「本として読む」価値を試せる。重ければ表示モードだけで
止められ、うまくいけば複数ファイル俯瞰、AI提案取込、EPUB export に
自然につなげられる。
