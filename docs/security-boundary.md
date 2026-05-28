# Security Boundary

Status: Canonical
Scope: Safety constraints for implementation
Authority: High
Last reviewed: 2026-05-29

## Core Rule

`hazakura-note` は、選択されたテキストファイルを読む・書く・比べるためのアプリです。

プロジェクトを実行するためのアプリではありません。

この境界は、既定の Safe Editor Mode に適用する。
Optional Agent Workbench Mode はこの境界を置き換えない。allowlistされたlocal TUI agent CLIだけを起動する別 trust boundary として [Agent Workbench Boundary](agent-workbench-boundary.md) を満たす必要がある。

## Forbidden Product Behaviors

Safe Editor Mode のアプリ本体に以下の機能を入れない。

- 任意コマンド実行
- ターミナル
- ビルド実行
- パッケージマネージャ実行
- LSP起動
- デバッガ起動
- Git操作
- 拡張機能実行
- 起動時のワークスペース自動解析
- ユーザー操作なしの外部通信

## File Access

- ユーザーが選択したファイルまたはフォルダだけを扱う
- ホームディレクトリ全体を勝手に走査しない
- `.env` などのテキストファイルは開けてもよいが、特別扱いして外部送信しない
- バイナリ判定されたファイルは編集対象にしない
- 大容量ファイルは警告し、ログビューア化しない

## Markdown Preview

Markdownプレビューを実装する場合は、初期状態で安全側に倒す。

- HTMLは無効化またはsanitizeする
- `script` は実行しない
- 外部リンクを勝手に開かない
- 外部画像を勝手に読み込まない
- ローカルファイル参照の扱いをUI上で明示する

## Diff

Diffは2つのテキストを比較する機能に限定する。

Gitの状態、ブランチ、stage、commit、push、pullは扱わない。

## AI Assistance

AI支援を入れる場合も、常時補完や自動書き換えにはしない。

許容される形は以下に限定する。

1. ユーザーが範囲を選ぶ
2. 候補を生成する
3. Diffで確認する
4. ユーザーが明示的に適用する

Agent Workbench Mode はこの AI Assistance 方針とは別の任意モードである。`hazakura-note` は汎用 shell prompt や任意コマンド欄を提供せず、直接起動できるのは allowlist された agent CLI だけに限定する。CLI 内部で何ができるかは CLI 側仕様とユーザー操作に依存するため、ユーザー責任と既存の external-change / conflict handling を明示する。
