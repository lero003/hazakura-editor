# e-book Mode And EPUB Export Plan

Status: Proposal
Scope: v0.21+ authoring and export planning
Authority: Medium
Last reviewed: 2026-06-17

## Summary

**e-bookモード** は、Markdown原稿を「本」として読み、日常の
執筆面として扱いやすくするための表示モードである。EPUB に近い
読み上がり確認は、その中心的な用途の一つとして扱う。

作業上の通称は **いーモード** または **びーモード** とする。
正式名称とUI表記は未決定。

これは高度なWYSIWYG編集面ではない。Markdown source remains the
truth. えるモード / L Mode と同じく、保存される本文はMarkdownのまま
保ち、表示だけをEPUB向けに近似する。

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
構造を確認する book reading / EPUB simulation surface として扱う。

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

### v0.22: e-book Mode MVP

最初は「編集しながら雰囲気を確認する」ことだけに絞る。

- 既存のモード切り替え導線から e-bookモードへ入る。
- Markdown source は同じタブの本文として保持する。
- 表示は横書き EPUB-like page preview を横に出す、または一時的な
  one-pane preview とする。
- 単一長文の章構造を見出しベースでレンダリングする。
- 横書きを先に実装し、縦書きは後続に分ける。
- 画像は既存の workspace image validation とサイズ上限に従う。
- リアルタイム反映は debounced preview とし、大きい画像や長文では
  更新頻度を落とす。
- スタイル調整は最初は固定プリセットに留める。

MVPで扱う候補:

- body width / line-height / font-size
- heading rhythm
- paragraph spacing
- blockquote / code / table の最低限の可読性
- page break marker
- unresolved image warning

MVPで扱わないもの:

- 完全なKindle端末再現
- 縦書きの確定実装
- 細かな組版UI
- 画像トリミングやレイアウト編集
- EPUBファイル生成
- 複数ファイルの章順保存

### v0.23: Book Structure Overview

複数Markdownファイルを「一冊の本の章」として眺める。これは
ファイルマネージャではなく、章構造化表示である。

- 選択中ワークスペース内のMarkdownを章候補として並べる。
- 章順管理と目次候補を表示する。
- 目次生成や章順保存は明示的なユーザー操作だけで行う。
- 保存場所は PoC 後に決める: frontmatter、`index.md`、
  専用目次ファイル、またはアプリ設定。

OKF の `index.md` 規約に近い形へ寄せられる可能性はあるが、OKF
自体はまだ提案段階として扱い、v0.23 の実装契約にはしない。

### v0.24: Style Simulation And Review Hooks

MVPが重くなければ、限定的なスタイル調整を追加する。

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
