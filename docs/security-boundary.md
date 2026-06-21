# Security Boundary

Status: Canonical
Scope: Safety constraints for implementation
Authority: High
Last reviewed: 2026-06-10

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
- リンククリックでアプリ本体のWebViewをページ遷移させない
- 外部画像を勝手に読み込まない
- ローカルファイル参照の扱いをUI上で明示する

ユーザーが明示的にクリックしたリンクの扱いは、次の境界を守る。

- 選択中ワークスペース内の相対Markdownリンクで、対応テキストファイル
  だけをアプリ内タブで開いてよい
- `http:` / `https:` / `mailto:` / `tel:` などの外部URLは、同一
  WebViewでは開かず、OSの既定ブラウザまたは既定アプリの新規外部
  ウィンドウへ渡す
- 未対応ファイル、絶対パス、ワークスペース外パス、危険なschemeは、
  アプリ内遷移も外部起動もせず止める。Preview のように status 表示を
  持つ surface では、既存のステータスメッセージで止める
- in-app HelpのMarkdown文書も同じルールに従う。Help本文内のURL
  クリックでPreferences / Helpダイアログやメインアプリ全体をページ
  遷移させてはいけない

## OS Handoff

Safe Editor Mode は任意コマンド実行を持たない。ただし、ユーザーが
明示的に起動した固定用途の OS handoff は許容する。

許容される OS handoff は次に限定する。

- `http:` / `https:` / `mailto:` / `tel:` の明示外部URLを、OSの既定
  ブラウザまたは既定アプリへ渡す
- 既存の選択ファイルまたはフォルダを、OSのファイルマネージャで表示する
- アプリが生成した一時的な印刷用 `.html` ファイルを、印刷ハンドオフの
  ためにOSの既定ブラウザへ渡す

これらはプラットフォームごとの固定コマンドテンプレートで実装し、
フロントエンドから任意の実行ファイル名、任意引数、shell入力を受け取らない。
Rust側でURL scheme、印刷用ファイル名、ウィンドウラベルを検査し、危険な
scheme、path-like な印刷ファイル名、Agent Window からの呼び出しを拒否する。

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

Future Apple Local Assist or Foundation Models-based assistance must stay closer to the AI Assistance rule than to Agent Workbench. It may change the unsaved editor buffer only after an explicit user action and only as an AI edit transaction that records before/after text, source, target scope, and review state. These edits must remain inspectable through Diff, change history, or an equivalent review surface before the user saves. The first Apple Local Assist implementation must not expose tool-calling side effects, background workspace indexing, generic chat, command execution, local HTTP fallback, provider plugins, automatic save, or hidden/irreversible file application without a fresh boundary review.

Apple Local Assist may show bounded, user-visible operation feedback in
the Assist Window to make the alpha behaviour understandable.  This
feedback is UI state, not a provider transcript or diagnostics log.  It
may describe the app-known lifecycle, such as target kind, approximate
target length, sending / generating / applied / failed phases, and
whether the result is reviewable before save.  It must not show raw
Foundation Models prompts, raw model responses, hidden system
instructions, chain-of-thought-like "reasoning", broad document
excerpts, filesystem paths, secrets, or provider internals.  It must not
be persisted, exported, copied through Support Diagnostics, or sent to
another process beyond the existing explicit Apple Local Assist request
and AI edit transaction flow.
