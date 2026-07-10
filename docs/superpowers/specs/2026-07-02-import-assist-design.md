# Hazakura Import Assist Design

Status: Proposal
Scope: PDF / 画像から Markdown 文書を生成するローカル OCR 取り込み機能
Last reviewed: 2026-07-02

## Goal

Hazakura Editor に、PDF や画像から Markdown 文書を生成する取り込み機能を
追加する。単なる OCR アプリではなく、OCR 結果を Hazakura の編集体験に接続
し、原稿・資料・論文・スキャン文書を「編集可能な Markdown 文書」へ育てる
作業台として提供する。

本機能は「完全自動変換」ではなく、**OCR 下書きを生成し、人間が Hazakura 上
で直せること**を価値にする。

> PDFを変換するのではなく、PDFから“編集できる原稿の下書き”を作る。

Hazakura Editor はあくまで作業台であり、完成品を一発生成する魔法の OCR では
ない。OCR で荒く取り込み、Markdown として構造化し、人間が確認・修正しながら
本や記事へ整えるためのツールにする。

## Position In The Roadmap

Import Assist は v1 末端〜v2 にまたがる構想であり、現時点で実装契約では
ない。レーン位置は次の通り。

- **Phase 1（Vision OCR 基盤）** は、v1.x の Safe Editor 境界を保った小さな
  スライスとして、v1.x durability and quality lane の候補になりうる。ただし
  v1.3 リリースレーンの安定後かつ境界審査を通った場合のみ。
- **Book Project 生成** は、v2.0 Book Scope（`docs/superpowers/specs/
  2026-07-02-v2-book-scope-design.md`）と接続する。単一 Markdown 文書への
  インポートは Phase 1 で扱うが、章ごとのファイル分割・`hazakura.import.json`
  によるページ対応追跡は Book Scope の構造的前提に載る。
- **MCP サーバー化・OS27+ Core AI / .aimodel 拡張** は、v2 以降の別レーンと
  し、本設計の必須範囲には含めない。

v1 の App Store lane における位置付けは、Vision framework がオンデバイスで
動く点で Hazakura の「ローカル・外部送信なし」思想と合致する。ただし App
Store lane への持ち込みは、別途審査と境界確認を要する。

## Core Concept

Vision framework は画像内テキスト認識をオンデバイスで提供し、外部サーバーへ
文書を送らずに処理できる。この点が Hazakura の思想と合う。OCR 精度は入力
品質に大きく依存するため、本機能は「OCR 下書きを生成し、人間が Hazakura 上
で直せる」ことを価値にする。

狙いは、次の流れをローカルで完結させることである。

```text
PDF / 画像
↓
テキスト抽出 / OCR（Vision, on-device）
↓
Markdown 整形
↓
章・見出し・ページ単位で整理
↓
Hazakura 文書（単一 Markdown、または Book Project）
↓
人間がレビュー・修正
↓
HTML / EPUB / PDF export
```

PDF の場合は、まず埋め込みテキストを PDFKit 等で抽出し、テキストが存在しない
ページまたは抽出品質が低いページだけを OCR 対象にする。これにより全ページ
OCR より軽く、精度も安定しやすい。

## Boundary

Import Assist は v1 の Safe Editor 境界を継承する。

- **オンデバイス処理のみ。** Vision / PDFKit を使い、クラウド OCR への自動
  送信を行わない。外部通信を伴う OCR サービスへ接続しない。
- **OCR 結果は編集前提。** 自動保存・自動適用しない。取り込み結果は未保存の
  Markdown 下書きとして提示し、ユーザーが明示的に確認・修正してから保存
  する。
- **Markdown source が正本。** OCR 結果は Markdown に正規化して提示するが、
  保存形式を新設しない。`hazakura.import.json` はページ対応や OCR メタ情報
  の追跡用であり、正本ではない。
- **境界を広げない。** Git、LSP、terminal、任意コマンド、plugin、project-wide
  indexing、外部 AI/API provider、generic chat、auto-apply / auto-save を追加
  しない。Phase 2 の Local Assist 連携も、既存の明示的・review 可能な
  トランザクション境界に載せる。
- **著作権・DRM 尊重。** DRM 付き電子書籍の全文抽出、他人の商業書籍の無断
  Markdown 化、OCR 結果の再配布を前提とした変換を行わない。アプリの見せ方
  は「自分の文書・権利のある文書・公開資料・研究資料・スキャンメモを取り込む」
  方向に寄せる。

## Intended Users

- 自分の原稿 PDF を Markdown 化したい人
- スキャンした資料を編集可能な文書にしたい人
- 論文 PDF や仕様書を Markdown メモ化したい人
- 紙のノート、配布資料、講義資料をローカルで整理したい人
- AI に投げる前に、資料を安全に Markdown 化したい人
- 長文コンテンツを Hazakura 文書として管理したい人

## Out Of Scope

以下は明確に対象外とする。

- Kindle 等 DRM付き電子書籍の全文抽出
- 他人の商業書籍の無断 Markdown 化
- OCR 結果の再配布を前提にした変換
- 著作権侵害を助長するワークフロー
- クラウド OCR への自動送信
- 完璧な OCR の保証（縦書き、ルビ、表、数式、手書きは苦手領域として扱う）

## Accuracy Posture

OCR 精度は入力品質に大きく依存する。過度に「高精度 OCR」とは言わない。

得意: 横書きの印刷文字、きれいな PDF スキャン、スクリーンショット、論文や
仕様書の本文、英数字混じりの技術文書、余白が整った単段組。

苦手: 縦書き日本語、ルビ、旧字体、古い本のスキャン、手書きメモ、表、数式、
脚注、二段組、傾き・歪み・影のある写真、小さい文字。

プロダクト上の表現は次のように寄せる。

```text
PDFや画像からMarkdownの下書きを作成します。
OCR結果は編集前提です。
Hazakura上で元ページと見比べながら、文章を整えられます。
```

## MVP Scope (Phase 1: Vision OCR Foundation)

最初は欲張らない。現行 macOS の Vision OCR で、画像→Markdown の基盤を
作る。

- PDF / 画像インポート（PDF, PNG, JPEG, TIFF, HEIC）
- PDF ページ画像化と、テキスト抽出優先／OCR の切り分け
- Vision OCR（認識言語 ja-JP / en-US、処理モード fast / accurate、ページ
  範囲指定、画像解像度）
- Markdown 整形（不自然な改行整理、ページ番号・ヘッダー／フッター除去候補、
  空行正規化、見出し・箇条書き・引用ブロック候補の推定、OCR 信頼度が低い
  箇所のマーク）
- レビュー UI（元ページ／画像と OCR 後 Markdown の左右表示、低信頼度箇所へ
  のジャンプ、ページ単位確認、再 OCR / スキップ）
- 出力：単一 Markdown 文書として新規文書に挿入

AI 補正は Phase 1 では必須にしない。まず「OCR して Markdown 化する」基盤を
完成させる。

## Markdown Normalization

OCR 結果はそのまま出すのではなく、Markdown として扱いやすい形に整える。
低信頼度箇所は Hazakura 独自の警告コメントで保持し、レビューUI で検出
できるようにする例:

```markdown
<!-- hazakura:ocr-warning confidence=0.42 page=12 -->
認識が怪しい文章
```

警告コメントは allowlisted・reversible・source-preserving であり、ユーザーが
自由に削除できる。隠しデータや保存形式の拡張ではない。

## Review UI

OCR 結果は必ずレビュー前提にする。**v1.7 Reference Compare の正規レイアウト**
（編集主・参照は右のプレビュー扱い。Diff ではない）:

```text
中央: OCR後Markdown（編集可・下書き）
右:   元PDFページ / 画像（読み取り専用の参照プレビュー）
```

詳細・境界は `docs/v1.7-reference-compare-design.md` を正とする。

できる操作: ページ単位で確認、要確認箇所へジャンプ、原画像と Markdown の
見比べ、ページ番号・ヘッダー・フッターの一括除去、ページの再 OCR、
ページのスキップ。Hazakura の価値は OCR エンジンそのものより、「直す場所を
見つけやすい」「原稿にしやすい」ことに置く。

## Book Project Generation (Phase 1.5 / Connects To v2)

Book Project 生成は v2 Book Scope と接続する。出力形式の例:

```text
book/
  book.md
  chapters/
    001.md
    002.md
    003.md
  assets/
    page-001.png
    page-002.png
  hazakura.import.json
```

`hazakura.import.json` はページ対応・OCR メタ情報を保存し、後から「この
Markdown は元 PDF の何ページ由来か」を追跡できるようにする。この機能は
v2 Book Scope の構造的前提（ディレクトリ構造を持った原稿を一つの本として
扱う）に載るため、v2 設計（`docs/superpowers/specs/
2026-07-02-v2-book-scope-design.md`）の進捗と協調する。単一 Markdown への
インポートは Phase 1 で扱うが、章ごとのファイル分割は Book Scope 着手後と
する。

## Phased Roadmap

### Phase 1: Vision OCR Foundation（現行 macOS）

今すぐ使える OCR 取り込み基盤を作る。PDFKit ＋ Vision OCR ＋ Markdown
Normalizer ＋ Review UI。AI 補正は必須にしない。

実装の小段階:

- v0.1: 画像1枚を Vision OCR（ja-JP / en-US）し、Markdown として新規文書に
  挿入
- v0.2: PDF をページ画像化し、ページごとに OCR、1つの Markdown にまとめる
- v0.3: PDFKit による埋め込みテキスト抽出、テキストがないページだけ OCR、
  ページ番号コメント付与
- v0.4: Book Project 生成（chapters/ 分割、assets/ 保存）※ v2 Book Scope と
  協調
- v0.5: OCR レビュー UI（原画像と Markdown の左右表示、低信頼度マーキング）

### Phase 2: Local Assist Integration

OCR 後の整形を Hazakura Local Assist で支援する。OCR エンジンを変えるの
ではなく、OCR 後処理を AI で強化する: OCR ノイズ修正、不自然な改行修正、
見出し候補の提案、章分割の提案、本文と注釈の分離、要確認箇所の説明。既存の
明示的・review 可能・auto-save しない Local Assist トランザクション境界に
載せる。

### Phase 3: OS27+ Core AI / .aimodel（長期）

Vision OCR では難しい文書に対して、オープンウェイトモデルを追加できるよう
にする。.aimodel OCR 補正モデル、文書レイアウト理解、表構造復元、OCR 後処理
専用 LLM、日本語向け Post-OCR Correction。ただし初期から OCR モデル自体を
自前で抱える必要はなく、Vision OCR で取り込んだ後の「精度改善」「文書構造
理解」「特殊文書対応」の拡張として扱う。

### MCP Server（v2 以降・別レーン）

Hazakura 本体とは別に MCP サーバーを用意し、外部エージェント向けの入口と
する。v1 では必須にせず、アプリ内機能として実装し、安定した後に MCP 化する。
これは v2 以降の別レーンであり、本設計の必須範囲ではない。

## Risks And Mitigations

1. **OCR 精度への過剰期待** → 「OCR 下書き」と表現、レビュー UI を必ず用意、
   confidence を表示する。
2. **著作権・DRM** → Kindle 抽出を機能にしない、DRM 回避を扱わない、
   インポート時に権利確認の注意を出す、自分の文書・権利のある資料向けと明記
   する。
3. **PDF 処理の重さ** → ページ範囲指定、バックグラウンド処理、キャンセル
   可能、進捗表示、画像解像度選択を設ける。
4. **縦書き日本語** → 初期版では正式対応扱いにせず experimental とし、将来
   .aimodel / 専用モデルで改善する。縦書き対応は v1.x の別 candidate
   （`docs/current-work.md` Active UX Queue）であり、本機能の前提ではない。

## Evaluation

OCR 精度は主観で見ない。小さいテストセットを作る。

テスト資料: 横書き日本語 PDF、英語論文 PDF、スキャンした紙資料、画像
スクリーンショット、縦書き日本語ページ、表を含むページ、ルビを含むページ。

評価項目: 文字化け率、改行崩れ、見出し推定の成功率、ページ順序の維持、
Markdown として編集しやすいか、修正にかかる時間、OCR 後に原稿として読めるか。

成功基準: きれいな横書き PDF なら、手修正前提の Markdown 下書きとして実用
になる。縦書き・表・古い本は、要レビューとして正しく扱える。

## Relationship To Existing Layers

- **Safe Editor / Markdown source**: OCR 結果は Markdown に正規化して未保存
  下書きとして提示する。source 正本の原則は維持する。
- **e-book Mode / Preview**: 取り込んだ Markdown は、既存の e-book Mode /
  Preview / export レイヤーでそのまま読める・書き出せる。
- **Diff / Recovery / Local Assist**: Phase 2 の Local Assist 連携は、既存の
  明示的・review 可能なトランザクション境界に載せる。auto-apply / auto-save
  しない。
- **v2 Book Scope**: Book Project 生成は v2 の構造的前提に接続する。
- **縦書き**: Import Assist の前提ではなく、v1.x の別 candidate。縦書き OCR
  精度は Phase 3 で改善する。

## What Import Assist Is Not

- DRM 回避や違法複製を助長するツールではない。
- 完璧な OCR を一発で出す魔法の変換器ではない。
- クラウド OCR への自動送信を行うシステムではない。
- AI による自動構造化・自動章分割・自動保存を行うシステムではない。
- Preview DOM 編集や、隠れたリッチテキスト保存モデルを採用するものではない。
- MCP サーバーや外部エージェント連携を Phase 1 の必須とするものではない。

## Source

本設計は、ユーザーから提供された「企画案：Hazakura Import Assist」構想
（リポジトリ外）を、Hazakura の設計ドキュメント形式へ整理したものである。
構想の原本はリポジトリに取り込まず、本設計書が Import Assist の単一参照点
となる。
