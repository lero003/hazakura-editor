# v2 Book Scope Design

Status: Proposal
Scope: v2.0 Book Workspace Alpha と構造型 Markdown の方向・境界・未解決の UI 問い
Last reviewed: 2026-07-02

## Goal

v2.0 では、単一 Markdown 文書を前提とする v1 Safe Editor の足場を保った
まま、ユーザーが明示的に選んだ「構造的に関連する Markdown ファイル群」を
一冊の本として扱えるようにする。本ドキュメントはその設計の単一参照点と
なり、現在分散している Book / Workspace As Book / OKF / 構造的 Markdown
の各記述を一箇所に整理する。

v1 までの姿は「書く・読む・整える・書き出す」一本の Markdown を複数の
レイヤーで扱うことで実現してきた。v2 はこの軸を保ちながら、対象を一つの
ファイルから「ディレクトリ構造を持った原稿全体」へ拡張する。

> Markdownで書き、本として読み、ローカルAIで整える。

この North star は v2 でも変わらない。変わるのは「Markdown」が単一ファイル
から構造を持ったファイル群へ広がる点だけである。

## Source of Truth

本ドキュメントは v2 Book Scope の設計参照点である。実装契約ではない。
既存の方向を集約し、未解決の問いを明示し、境界を固定する。v2.0 の実装に
着手するのは、以下の全てが揃った後のみとする。

- v1.x durability and quality lane で耐久性・観測性の足場が確認できている。
- v1.3 以降のリリースレーンが安定している。
- 本ドキュメントの UI 方針が、少なくとも一つの候補へ収束している。
- OKF 仕様を改めて再確認し、実装契約として採用できるか判断している。

## Current Direction

### Workspace As Book

`post-v0.25-product-refinement-plan.md` の Workspace As Book 節が今日の
出発点である。要点は次の通り。

- 選択した workspace を、ユーザーが求めた時だけ book context として提示
  する。常に本形式で表示するわけではない。
- Markdown ファイルを章候補として扱う。
- 目次の生成・編集は明示的かつ可逆な操作にする。
- 仮 workspace / temporary workspace は、no-workspace 執筆の recovery UX
  としてのみ検討し、後から実際のフォルダへ関連付けられる形にする。

Avoid automatic folder semantics, background indexing, and hidden
workspace-wide structure detection. この制約は v2 でも維持する。

### OKF as a Structural Foundation

OKF (Open Kana Format の提案仕様) を、構造型 Markdown の構造的基盤と
して検討する。`ebook-mode-epub-export-plan.md` が記す v1.x の方向は、
v2 への自然な橋渡しになる。

- OKF bundle を本として読む: frontmatter の可読化、`index.md` / `log.md`
  対応、簡易リンクグラフ。
- ディレクトリ構造を持った原稿を、単一のe-book的読書体験として扱う。

ただし、`roadmap.md` が記す通り:

> OKF remains a proposal-stage dependency. Re-check the latest OKF shape
> before treating it as an implementation contract.

OKF の仕様は提案段階であり、v2.0 の実装契約ではない。着手前に改めて
最新の OKF 仕様を確認し、採用範囲（全面採用・部分採用・独自拡張・不採用）
を判断する。OKF を採用しない場合でも、ディレクトリ構造を持った
Markdown を本として扱う方向自体は維持する。

### Structured Markdown

「構造型 Markdown」とは、本プロジェクトでは次を指す。

- 複数の Markdown ファイルが、ディレクトリ構造を通じて章・節の関係を
  持つ。
- ファイル間のリンク、frontmatter、見出し階層が、本の構造情報として
  扱われる。
- 個々のファイルは v1 と同じ Markdown source のままであり、新しい
  保存形式や暗黙の変換を導入しない。

構造型 Markdown は新しいファイル形式ではなく、既存の Markdown と
ディレクトリ構造への解釈レイヤーである。source は常に個々の
Markdown ファイルのままである。

## Boundary

v2 Book Scope は、v1 の Safe Editor 境界を継承し、構造へ広げる。次の
制約は v2 でも固定する。

- Markdown source は個々のファイルのままで正本。book manifest は解釈の
  手がかりであって、保存の正本ではない。
- バックグラウンドでの workspace indexing、Git 連携、自動構造検出、
  隠れた workspace 全体の書き換えを行わない。
- Preview DOM 編集、`contenteditable`、隠れた HTML / リッチテキストの
  保存モデルを追加しない。
- AI 自動適用、自動保存、自動リライト、Agent Workbench の App Store
  lane への持ち込みをしない。Hazakura Local Assist は引き続き明示的・
  オンデバイス・review 可能なトランザクションに限定する。
- ユーザーが選んでいないファイルを暗黙に読み込んだり、構造に組み込んだり
  しない。book context はユーザーの明示的な選択と操作で成り立つ。

これらは v1 境界の直接の継承である。詳細は `docs/product-brief.md`、
`docs/security-boundary.md`、`docs/agent-workbench-boundary.md` を参照。

## Open UI Questions

構造型 Markdown を UI に落とし込んだ先行アプリは少なく、現時点では
最適な見た目が確定していない。本節はその「未解決の状態」を明示的に
記録する。v2.0 の実装着手前に、少なくとも一つの候補へ収束させる必要が
ある。

問い:

- ディレクトリ構造とエディタを、どの画面構成で同居させるか。
- 章をまたぐ移動（次の章へ、目次から jump、cross-reference）をどう
  表現するか。
- 単一ファイル編集と構造全体の読書を、同じ画面で切り替えるか、別の
  モードにするか。
- v1 の AppWorkspace per-document view-state registry を、複数ファイルの
  構造へどう拡張するか。
- 構造の変更（章の並び替え、ファイル追加・削除）を、明示的かつ可逆な
  操作としてどう提示するか。

これらは実装の直前に決めるのではなく、v1.x の実装を通じて得た観察を
材料に、複数候補を比較しながら段階的に絞る。

## UI Candidates (Not Decided)

以下は探索方向の候補であり、いずれも決定ではない。各候補は v1 の
Safe Editor トーン（UI recedes、layered、not card-heavy）との整合を
前提に評価する。

### A. Tree Outline + Editor (dual-pane)

左側にディレクトリ / 目次ツリー、右側に現在の章のエディタ。

- 利点: 構造と執筆が同時に見える。ファイル操作の所在が明確。
- 課題: ツリーが chrome として前面に出るため、UI recedes の原則との
  緊張がある。狭い画面ではツリーとエディタの両立が難しい。
- v1 との関係: 既存の workspace tree を構造表示へ拡張する形に近い。

### B. Single-pane Chapter Switcher

単一ペインで章を切り替え、構造は目次ドロワーとして必要な時だけ出す。

- 利点: 執筆に集中できる画面を保てる。v1 の single-document 体感に近い。
- 課題: 構造全体の把握がドロワー開閉に依存する。章をまたぐ作業の
  効率が落ちうる。
- v1 との関係: Reading Focus の目次ドロワーを、編集時にも使える形へ
  広げることに近い。

### C. Node / Graph-based Structure

構造をノードとリンクのグラフとして扱い、個々のノードが一つの Markdown
ファイルに対応する。

- 利点: 非線形な構造、cross-reference、リンクグラフを自然に表現できる。
- 課題: 直線的な書き手にとって馴染みにくい。本としての線形的な読書体験
  との整合をどう保つかが難しい。UI recedes から最も遠くなりうる。
- v1 との関係: 現状の Safe Editor トーンから最も遠い。採用する場合は
  別の product surface として扱う必要がある。

### 評価の軸

どの候補を選ぶにしても、次の軸で比較する。

- **執筆集中**: 単一ファイルの執筆体験を v1 から劣化させないか。
- **構造把握**: ディレクトリ全体の構造を、必要な時に把握できるか。
- **境界維持**: バックグラウンド indexing、Git、自動検出に踏み込まないか。
- **v1 延長性**: 既存の AppWorkspace / view-state registry / e-book Mode を
  構造へ自然に拡張できるか。
- **UI recedes**: chrome が前面に出ず、layered で callable か。

## Relationship To Existing Layers

v2 Book Scope は、v1 の source-preserving layers を構造へ広げるもので
あり、新しい product surface を追加するものではない。

- **e-book Mode**: 単一ファイルの読書面から、構造全体の読書面へ拡張する
  自然な候補。OKF bundle を本として読む方向と整合する。
- **Preview**: 単一ファイルの source-preserving preview を保ちつつ、
  構造全体のプレビューをどう提供するかは未解決の UI 問いの一つ。
- **Diff / Recovery / Local Assist**: 引き続き明示的・review 可能な
  トランザクションに限定する。構造全体へ広げる場合も、auto-apply /
  auto-save にはしない。
- **EPUB / PDF export**: 単一ファイルからの書き出しを保ちつつ、構造全体
  からの書き出しへの拡張を検討する。ただし v2.0 の必須範囲ではない。
- **Import Assist**: PDF / 画像から Markdown を生成する Import Assist
  （`docs/superpowers/specs/2026-07-02-import-assist-design.md`）の Book
  Project 生成は、本 v2 Book Scope の構造的前提に接続する。章ごとのファイル
  分割・`hazakura.import.json` によるページ対応追跡は、v2 Book Scope 着手後
  に協調して実装する。

## What v2.0 Is Not

- v2.0 は IDE、Git client、terminal、LSP host、plugin platform、project
  analyzer、general file manager ではない。
- 保存された book manifest を不変の正本とするシステムではない。manifest
  は解釈の手がかりであり、source は個々の Markdown ファイルである。
- 構造を自動検出・自動整理・自動書き換えするシステムではない。構造の
  扱いは常にユーザーの明示的操作による。
- AI による自動的な構造編成、章の自動生成、cross-reference の自動挿入を
  行うシステムではない。
- Preview DOM 編集や、隠れたリッチテキスト保存モデルを採用するものでは
  ない。

## Decision Path To v2.0

v2.0 の実装着手までに、次の順で問いを解いていく。

1. v1.x durability and quality lane の実装を通じて、複数ファイルを扱う
   ための耐久性・観測性の足場を確認する。
2. OKF の最新仕様を再確認し、構造型 Markdown の構造的基盤として採用
   できるか判断する。
3. Open UI Questions の各問いについて、UI Candidates の候補を比較し、
   少なくとも一つへ収束させる。
4. 収束した UI 方針で、v1 の AppWorkspace / view-state registry / e-book
   Mode を構造へ拡張する最小スライスを設計する。
5. 本ドキュメントの Status を Proposal から Review へ上げ、実装契約として
   確定できるか判断する。

各段階で、境界を広げず、スモールスライスを保ち、Safe Editor の足場を
壊さないことを確認する。

## Source Documents

本ドキュメントは次の既存記述を集約し、単一参照点とする。

- `docs/roadmap.md` — v2.0 Book Scope / Book Workspace Alpha (phase #13)、
  OKF proposal-stage dependency の位置付け。
- `docs/post-v0.25-product-refinement-plan.md` — Workspace As Book 節。
  今日の出発点となる information-architecture lens。
- `docs/ebook-mode-epub-export-plan.md` — v1.x: OKF, Vertical Writing, And
  Advanced EPUB 節。OKF bundle を本として読む方向。
- `docs/product-brief.md`、`docs/security-boundary.md`、
  `docs/agent-workbench-boundary.md` — v2 でも維持する Safe Editor 境界。

以降、Book Scope / 構造型 Markdown / OKF 採用に関する設計議論は、
分散した各ドキュメントではなく本ドキュメントを参照点とする。各ドキュ
メントは歴史的経緯として残し、本ドキュメントが現状の設計を反映する。
