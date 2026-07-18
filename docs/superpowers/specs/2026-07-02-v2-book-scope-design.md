# v2 Book Scope Design

Status: Review — Book Scope Alpha + explicit chapter suggestions implemented
Scope: v2.0 Book Workspace Alpha と構造型 Markdown の方向・境界・未解決の UI 問い
Last reviewed: 2026-07-18 (explicit chapter suggestion draft implemented; whole-book reading next)

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

本ドキュメントは v2 Book Scope の設計参照点である。最初の実装契約はここから
短いスライス契約として切り出す。境界は固定する。

**2026-07-18:** v2 開発フェーズは開始済み（`docs/roadmap.md`）。橋渡し条件の
多くは満た済み。次の運用ルール:

- v1.10 単一文書 structure / v1.11 OKF preview / v1.12 scaffold は入力として使う。
- 広範な配布版総合テスト行列や pre-dev の multi-file 価値エッセイは **着手ブロッカーにしない**。
- UI は候補 A/B から **最初の方向を選んでスライスで反復**する（完璧な収束を待たない）。
- OKF base 互換と Hazakura Book semantics は実装中も分離する。
- **Help / 機能説明の拡充**は、OKF multi-file の使い心地が ship できる水準になった
  **出荷 polish** で行う。

## First Alpha Slice Contract

2026-07-18 の最初の実装スライスは次で固定する。

- UI は既存左 sidebar 内の **ファイル / 本** 切替。Book view は明示選択した
  Markdown 章と順序だけを表示し、右側は既存の単一編集bufferを使う。
- scope は app-private localStorage に workspace root ごとの相対path列として保存する。
  workspace内manifest、Markdown source、OKF metadataは書き換えない。
- Rust `resolve_book_scope` が main-window、100章、Markdown拡張子、相対path、
  canonical workspace containment、regular text file、symlink拒否を検証する。
- 欠損・外部移動・読取不能の章はscopeから黙って消さず、利用不能として表示し、
  再確認または明示削除を待つ。アプリ内rename / move / Trashはscopeへ追従する。
- 選択編集は保存 / キャンセル付き。並べ替えはdisk上のfile moveではなく、
  app-privateな解釈順だけを上下する。
- 全編読書、book export、manifest共有、OKF Book semantics、AI構造編集は次slice以降。

## Explicit Chapter Suggestion Contract

最初の spine に続く OKF multi-file feel のスライスとして、Book view から
**「ワークスペースから候補を作る」**を明示実行できる。

- 既存の main-window-only OKF disk snapshot を再利用する。一回限り、停止可能、
  最大200 `.md`、walk 2,000 entry、1 file 10 MiB、合計32 MiB、深さ16まで。
- root `index.md` の安全に解決できる内部 Markdown link 順を先頭にし、残りの
  読取可能な本文 `.md` を安定した相対path順で末尾へ置く。`index.md` / `log.md`
  と読取不能fileは候補から外す。
- 結果は **Hazakura Book Scope の候補順**であり、OKF準拠やOKF book orderを
  意味しない。候補は選択画面のdraftへ入るだけで、自動保存しない。
- ユーザーはcheckboxで調整し、「保存」で初めてworkspaceのBook Scopeへ反映する。
  走査打切り・100章上限はdraft上で明示する。
- 起動時走査、background indexing、watcher、永続scan cache、source/manifestの
  書換えは追加しない。`.markdown` / `.mdx` 等は従来の手動選択で追加できる。

## Current Direction

### Workspace As Book

`docs/archive/planning/post-v0.25-product-refinement-plan.md` の Workspace As Book 節が今日の
出発点である。要点は次の通り。

- 選択した workspace を、ユーザーが求めた時だけ book context として提示
  する。常に本形式で表示するわけではない。
- Markdown ファイルを章候補として扱う。
- 目次の生成・編集は明示的かつ可逆な操作にする。
- 仮 workspace / temporary workspace は、no-workspace 執筆の recovery UX
  としてのみ検討し、後から実際のフォルダへ関連付けられる形にする。

Avoid automatic folder semantics, background indexing, and hidden
workspace-wide structure detection. この制約は v2 でも維持する。

### OKF Compatibility As An Input

OKF (Open Knowledge Format) v0.1 Draft を、構造型 Markdown を読むための
互換inputとして検討する。v1.11では、明示的に選択したbundleを読み取り、
compatibility summaryと助言を示すところまでを実証する。v1.12では同じ pin の
starter scaffold を明示操作で書ける。Contract:
`docs/v1.11-okf-draft-preview-design.md`, `docs/v1.12-okf-scaffold-design.md`.
Living pin / upgrade process: `docs/okf-spec-pin.md`.

- OKF base specはMarkdown concept、frontmatter、`index.md` / `log.md`、
  標準Markdown linkの最小互換規約を定義する。
- OKFはbook formatではなく、章順、Book manifest、whole-book reading/exportを
  定義しない。それらはv2のHazakura固有product contractである。
- v2はv1.11のcompatibility modelを入力として再利用してよいが、OKF準拠と
  Hazakura Book Scope準拠を別々に表示・検証する。
- upstream OKF の version 変更は、点検・fixture・scaffold をセットで更新する
  前提（`docs/okf-spec-pin.md`）。v2 着手時も pin を静かに main へ追従しない。

2026-07-15に確認した公式仕様はv0.1 Draftであり、v2.0のBook contractそのもの
ではない。実装時のsnapshotと一次情報は `docs/okf-spec-pin.md` と
`docs/v1.11-okf-draft-preview-design.md` に固定する。
v1.11 compatibility previewで実装した範囲を再確認し、v2着手時に最新版との
差分を確認する。OKFを採用しない、または一部互換に留める場合でも、明示的に
選択したMarkdown群を本として扱う方向自体は維持する。

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
記録する。最初の実装スライスでは候補 A または B から方向を一つ選び、
使い心地を見ながら収束させる（完璧な事前決定は要求しない）。

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
  自然な候補。OKF bundleのconcept/indexを入力にできるが、本としての順序と
  読書体験はHazakura側が明示的に定義する。
- **Preview**: 単一ファイルの source-preserving preview を保ちつつ、
  構造全体のプレビューをどう提供するかは未解決の UI 問いの一つ。
- **Diff / Recovery / Local Assist**: 引き続き明示的・review 可能な
  トランザクションに限定する。構造全体へ広げる場合も、auto-apply /
  auto-save にはしない。
- **EPUB / PDF export**: 単一ファイルからの書き出しを保ちつつ、構造全体
  からの書き出しへの拡張を検討する。ただし v2.0 の必須範囲ではない。
- **Import Assist**: PDF / 画像から Markdown を生成する Import Assist
  （`docs/archive/superpowers/specs/2026-07-02-import-assist-design.md`）の Book
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

ゲートと順序の正本は `docs/roadmap.md`（2026-07-18: **v2 開発開始**）。

| Step | Content | Status |
|------|---------|--------|
| 1 | v1.8 Daily Trust + v1.9 Writing Loop Clarity | **Done** |
| 2 | v1.10 single-document structure model + explicit Undo-able edits | **Done** |
| 3 | v1.11 OKF v0.1 Draft compatibility preview (bounded / read-only) | **Done** |
| 4 | v1.12 OKF starter scaffold (explicit, no auto-repair) | **Done** |
| 5 | Broad distribution-confidence matrix | **Parked** — not blocking development |
| 6 | Pre-dev multi-file value essay | **Deferred** — Help / feature copy at **v2 ship polish** |
| 7 | First UI direction (A tree / B single-pane preferred; C graph later) | **Active** — pick and iterate |
| 8 | Minimal slice design for scope selection / order / one edit buffer | **Active next** |
| 9 | AppWorkspace / view-state / e-book over multi-file structure | **Active next** |
| 10 | Implementation contracts (Proposal → Review per slice) | **Active** |
| 11 | Help expansion + other under-explained feature docs | **At ship** when OKF multi-file feel is ready |

v1 residual / evidence / optional Keep boxes: parked
(`docs/v1.13-plus-refinement-roadmap.md`, `docs/current-work.md`).

`v1.10` は v2 の番号を先取りするものではない。単一 source 内の構造解釈と
編集を証明する橋渡しであり、複数ファイル章順、Book scope、whole-book
reading は本ドキュメントの v2 境界に属する。

各スライスで、境界を広げず、Safe Editor の足場を壊さないことを確認する。

## Source Documents

本ドキュメントは次の既存記述を集約し、単一参照点とする。

- `docs/roadmap.md` — v2.0 Book Scope / Book Workspace Alpha (current phase #17)、
  v1.11 OKF compatibilityとv2 Book semanticsの位置付け。
- `docs/v1.11-okf-draft-preview-design.md` — OKF v0.1 Draft compatibilityの
  active contractとv2へ持ち越すBook semantics境界。
- `docs/archive/planning/post-v0.25-product-refinement-plan.md` — Workspace As Book 節。
  今日の出発点となる information-architecture lens。
- `docs/ebook-mode-epub-export-plan.md` — v1.x: OKF, Vertical Writing, And
  Advanced EPUB 節。OKF bundle を本として読む方向。
- `docs/product-brief.md`、`docs/security-boundary.md`、
  `docs/agent-workbench-boundary.md` — v2 でも維持する Safe Editor 境界。

以降、Book Scope / 構造型 Markdown / OKF 採用に関する設計議論は、
分散した各ドキュメントではなく本ドキュメントを参照点とする。各ドキュ
メントは歴史的経緯として残し、本ドキュメントが現状の設計を反映する。
