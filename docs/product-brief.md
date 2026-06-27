# Product Brief

Status: Canonical
Scope: Product direction and non-goals
Authority: High
Last reviewed: 2026-06-28 (v1 product message)

## Concept

`Hazakura Editor` は、Markdownで文章を書き、電子書籍のように読み返し、必要な部分だけをローカルAIと整えられるmacOS向け執筆エディタである。

外向きの主コピーは「Markdownで書き、本として読み、ローカルAIで整える。」とする。「メモ帳より賢く、IDEより静か」は製品の性格を表す副コピーとして残す。

IDEやDTPを置き換えるのではなく、Markdown sourceを正本に、書く、読む、戻って直す、AI提案を差分で確認する、明示的に書き出す流れをひとつの静かな作業場にまとめる。中の思想としては、信頼しきれないテキストや候補を安全に読み、比べ、明示的に採用するためのSafe Review Editorとして扱う。

## Core Value

- Markdownを通常編集とL Modeで静かに書ける
- 電子書籍モードと見開き表示で本として読み返せる
- 読んで気づいた位置からMarkdown編集へ戻れる
- 基本的なテキストファイルを安全に閲覧・編集できる
- 拡張機能に依存しない
- 任意コード実行をしない
- ローカルAIや手作業による修正版を差分で確認できる
- HTML、PDF、EPUBへ明示的に書き出せる
- 小さく、速く、壊れにくい

## Target Users

- Markdownで記事、エッセイ、企画書、メモを書く人
- 長い文章を本のように読み返しながら直したい人
- 単一のMarkdown原稿をEPUBやPDFへ書き出したい人
- VSCode拡張機能の安全性に不安がある人
- AI生成物やAI修正版を人間の目で確認したい人
- 信頼しきれないプロジェクト内のファイルを安全に開きたい人
- LSPや補完よりも、軽さと安全性を重視する人

## Non-Goals

Safe Editor Mode では、以下を目指さない。

- VSCode互換
- 拡張機能マーケットプレイス
- LSP対応
- コード補完
- デバッガ
- ターミナル統合
- Gitクライアント機能
- リモート開発
- AIエージェント統合
- プロジェクトビルド
- パッケージ管理
- 任意コマンド実行

Optional Agent Workbench Mode は、Safe Editor Mode の置き換えにはしない。
CLI-agent連携は [Agent Workbench Boundary](agent-workbench-boundary.md) を満たす別 trust boundary として扱い、汎用ターミナル、任意コマンド実行、Gitクライアント、自動適用フローへ広げない。

## Assist Direction

AI支援は、Safe Editor本体に混ぜ込まず、明示的に開く補助面として扱う。

[Assist Surface Strategy](assist-surface-strategy.md) は、既存のExternal Agent Workbenchを分離可能な境界に置き、Apple Foundation ModelsベースのHazakura Local Assistへ切り替えられるようにするための設計方針である。App Store build / developer build の分離方針は [Hazakura Local Assist And Distribution Plan](apple-local-assist-distribution-plan.md) に置く。Hazakura Local Assist の体験像は [Hazakura Local Assist Writing Companion Plan](apple-local-assist-writing-companion-plan.md) を優先する。

Hazakura Local Assistは、対応Mac上のオンデバイスモデルを使う、利用可否のあるプレビュー機能である。汎用AI platform、provider plugin、任意コマンド実行、agent自動適用ではない。L Mode / Safe Editorでの執筆を補助する外出しWriting Companionとして扱い、明示的なユーザー依頼、AI edit transaction、Diff / change historyでの確認、no auto-save、no network fallbackを守る。

## Product Principle

判断に迷った場合は、便利さよりも以下を優先する。

1. 実行しない
2. 補完しすぎない
3. 勝手に変えない
4. 差分で確認する
