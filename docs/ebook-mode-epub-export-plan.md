# e-book Mode And EPUB Export Plan

Status: Proposal
Scope: v0.21+ authoring and export planning
Authority: Medium
Last reviewed: 2026-06-15

## Summary

**e-bookモード** は、Markdown原稿を編集しながら EPUB に近い
読み上がりを確認するための表示モードである。

作業上の通称は **いーモード** または **びーモード** とする。
正式名称とUI表記は未決定。

これは高度なWYSIWYG編集面ではない。Markdown source remains the
truth. えるモード / L Mode と同じく、保存される本文はMarkdownのまま
保ち、表示だけをEPUB向けに近似する。

将来の関連機能として、画像と基本スタイルを含めた **EPUB
エクスポート** を検討する。ただし、最初の実装では表示モードと
エクスポートを一体化しすぎない。

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

e-bookモードは、出版・配布前の見た目を確認する EPUB simulation
surface として扱う。

```txt
Normal Mode: safe Markdown editing and review
L Mode: calm Live Source writing
e-book Mode: EPUB-like simulation while editing
EPUB Export: explicit file generation from Markdown source
```

共通原則は同じである。

- Markdown source is canonical.
- 表示は保存内容を暗黙に変えない。
- Preview / Diff / Review / Export は、表示装飾ではなくMarkdown source
  から再生成する。
- 画像、リンク、外部参照は既存の workspace boundary に従う。

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

### Phase 0: Planning And Reuse Audit

- `lero003/kindle-epub-tool` を参照し、EPUB生成・画像解決・追加CSS・
  テストの再利用可能性を調査する。
- 既存の `useDocumentExport` / `renderMarkdown` /
  Markdown preview CSS と、EPUB向けHTML生成を分けるべき箇所を決める。
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

### Phase 1: e-book Mode MVP

最初は「編集しながら雰囲気を確認する」ことだけに絞る。

- 既存のモード切り替え導線から e-bookモードへ入る。
- Markdown source は同じタブの本文として保持する。
- 表示は EPUB-like page preview を横に出す、または一時的な
  one-pane preview とする。
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

### Phase 2: Style Simulation

MVPが重くなければ、限定的なスタイル調整を追加する。

- 横書き / 縦書きの切り替え
- font scale
- line height
- page width / margin
- chapter heading style
- image fit policy
- theme-independent EPUB preview palette

設定は document-local に保存するか、アプリ設定にするかを後で決める。
初期は保存しない一時設定でもよい。

### Phase 3: EPUB Export

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
- 縦書きは v0.21+ の初回に入れるか、横書きMVPの後に分けるか。
- EPUB style settings を一時設定にするか、workspace / document に
  保存するか。
- 章分割は見出しベースにするか、改ページ記法ベースにするか。
- 表紙画像はユーザー指定にするか、最初の画像を候補にするか。
- EPUB export の依存は `JSZip` / `marked` 系を再利用するか、
  Tauri/Rust側で組み立てるか。

## Recommendation

v0.21以降の候補として残す価値がある。

最初の勝ち筋は、**e-bookモードMVPを表示専用シミュレーションとして
実装し、EPUB export は後続に分ける** ことである。

この順なら、L Mode の source-preserving 原則を守りながら、出版前の
見え方確認という新しい価値を試せる。重ければ表示モードだけで止められ、
うまくいけば EPUB export に自然につなげられる。
