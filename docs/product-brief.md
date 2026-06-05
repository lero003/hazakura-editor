# Product Brief

Status: Canonical
Scope: Product direction and non-goals
Authority: High
Last reviewed: 2026-06-02

## Concept

`hazakura editor` は、AI時代のメモ帳です。

IDEを置き換えるのではなく、開発プロジェクト内のテキストファイルを実行せずに開き、必要な範囲だけ編集し、AIや外部ツールが出した候補を差分で確認できる場を作ります。

外向きには「メモ帳より賢く、IDEより静か」。中の思想としては、信頼しきれないテキストや候補を安全に読み、比べ、明示的に採用するための Safe Review Editor として扱う。

## Core Value

- Markdownを軽く書ける
- 基本的なテキストファイルを安全に閲覧・編集できる
- 拡張機能に依存しない
- 任意コード実行をしない
- AIや手作業による修正版を差分で確認できる
- 小さく、速く、壊れにくい

## Target Users

- Markdownで記事、企画書、メモを書く人
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

将来のAI支援は、Safe Editor本体に混ぜ込まず、明示的に開く補助面として扱う。

[Assist Surface Strategy](assist-surface-strategy.md) は、既存のExternal Agent Workbenchを分離可能な境界に置き、Apple Foundation ModelsベースのApple Local Assistへ切り替え・併存できるようにするための設計方針である。App Store build / developer build の分離方針は [Apple Local Assist And Distribution Plan](apple-local-assist-distribution-plan.md) に置く。

ただし、これは汎用AI platform、provider plugin、任意コマンド実行、agent自動適用への承認ではない。Apple Local Assistを入れる場合も、まずは選択範囲や文書断片から候補を生成し、Review DeskまたはDiffで確認してからユーザーが明示的に適用する形に限定する。

## Product Principle

判断に迷った場合は、便利さよりも以下を優先する。

1. 実行しない
2. 補完しすぎない
3. 勝手に変えない
4. 差分で確認する
