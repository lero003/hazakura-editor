# Security Boundary

Status: Canonical
Scope: Safety constraints for implementation
Authority: High
Last reviewed: 2026-07-17 (Theme G M0–M3 media consent; defaults stay safe)

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

## OKF Compatibility Review

OKF (Open Knowledge Format) compatibility review は、通常のworkspace openとは
別の明示操作としてのみ許容する。

- 対象はユーザーが選択済みのworkspace rootまたは明示的に選んだsubfolderに限定する
- 一回のbounded・cancellable scanとし、起動時解析、background indexing、
  file watcher、永続cache databaseを追加しない
- Markdown text、frontmatter、reserved file、bundle-relative Markdown link
  だけを解釈し、project fileの実行、Git状態、外部serviceを参照しない
- symlinkやlink targetを含め、選択root外へ出るpathを読み込まない
- directory walkはsymlink file / directoryを追跡せず、regular `.md` fileだけを
  明示budget内で読む。non-Markdown fileは数え分けて内容を読まない
- unknown field/type、broken link、missing `index.md`は安全に読める限り助言とし、
  自動修正、自動保存、frontmatter生成を行わない
- `resource:`、citation、Markdown linkのURLを自動fetchしない。外部linkはmetadata
  として分類するだけで、review surfaceからOS handoffもしない
- review surfaceはmetadata、file list、findingだけを表示し、bundle本文の
  Markdown image、inline HTML、HTML previewをrenderしない
- scanはdisk snapshotであり、dirty tabとの差を明示する。concept openは既存の
  dirty tabを尊重し、disk内容で置き換えない
- invocationはmain Safe Editor windowの明示操作に限定し、Agent Workbench、
  Assist、startup/background処理から呼び出せない
- derived compatibility resultはmemory上のpreviewとし、hidden manifest、
  link graph、Book databaseとして保存しない

詳細なslice contractは `v1.11-okf-draft-preview-design.md` を参照する。

## Markdown Preview

Markdownプレビューを実装する場合は、初期状態で安全側に倒す。

- HTMLは無効化またはsanitizeする
- `script` は実行しない
- 外部リンクを勝手に開かない
- リンククリックでアプリ本体のWebViewをページ遷移させない
- 外部画像を勝手に読み込まない（リモート既定オフ、https のみ・有界 fetch）
- ローカルファイル参照の扱いをUI上で明示する
- ブロックした画像は、理由（workspace 外相対 / 絶対 / リモート / 未配置など）と
  次の操作をプレースホルダに書く
- workspace 外ローカル画像は **設定（オフ / 都度許可 / フォルダ記憶）と明示許可**
  があるときだけ読み込む。許可はファイル親フォルダ単位。Rust は承認 root 外を拒否
- 書き出し時の画像埋め込みは設定で制御（既定オン）。Markdown source は黙って書き換えない
- 明示コマンド「外部画像を assets に固定」のみ、読める参照を workspace `assets/` に
  コピーして Markdown を **1 Undo の編集**で書き換えてよい（自動保存しない）
- 詳細: `docs/v1.xx-image-media-boundary-plan.md`

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
- アプリが生成したHTMLを、アプリ内のWebViewでPDFデータへ変換し、
  ユーザーが保存ダイアログで選んだ `.pdf` へ書き出す

外部URLとファイルマネージャ表示は、プラットフォームごとの固定コマンドテンプレートで実装し、
フロントエンドから任意の実行ファイル名、任意引数、shell入力を受け取らない。
PDF書き出しは外部コマンドや印刷UIへ渡さず、アプリ内WebViewとWebKit PDF生成APIで完結させる。
Rust側でURL scheme、PDF保存先の拡張子、HTMLの空入力、ウィンドウラベルを
検査し、危険なscheme、`.pdf` 以外の保存先、Agent Window からの呼び出しを拒否する。

## Security Report Triage

外部または自動生成されたセキュリティレポートを扱う場合は、まず現行ツリーと
照合する。存在しないファイル、古いWebアプリ構成、または別プロジェクト由来の
`fetch()` / `NEXT_PUBLIC_*` / `API_BASE` / 認証フォーム / token保存指摘は、
そのまま実装リスクとして扱わない。

2026-06-26時点の現行アプリでは、フロントエンドから任意のHTTP APIへ
`fetch()`する経路は確認されていない。Safe Editor / Assist / Agent
Workbench のフロントエンド境界は Tauri `invoke` と Rust 側コマンド検証で
扱う。`localStorage` はテーマ、表示設定、最近使ったファイル、下書き、
Agent Workbench の有効化希望・同意・allowlist provider などのローカル状態に
限定し、API key、password、外部サービストークンの保存場所にしない。

テーマの視覚演出（季節アンビエント、`crt` ジョークテーマの WebGL シェーダー
など）は、すべてプロシージャル（外部テクスチャ fetch なし、`blob:` URL 生成
なし）でアプリバンドル内に完結し、既定の CSP を変えない。ジョークテーマは
「あえて読みにくい」演出を許容するが、既存の安全境界（任意コマンド実行、外部
通信、Preview の sanitize 等）を壊さない範囲で追加してよい。

Agent Workbench に関するレポートは [Agent Workbench Boundary](agent-workbench-boundary.md)
と照合する。UI 側の保存値だけで信頼せず、Rust 側で distribution lane、
window label、mode gate、consent、provider allowlist、workspace root の
検証が維持されているかを確認する。

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

Hazakura Local Assist or Foundation Models-based assistance must stay closer to the AI Assistance rule than to Agent Workbench, including in the App Store lane. It may change the unsaved editor buffer only after an explicit user action and only as an AI edit transaction that records before/after text, source, target scope, and review state. These edits must remain inspectable through Diff, change history, or an equivalent review surface before the user saves. Hazakura Local Assist must not expose tool-calling side effects, background workspace indexing, generic chat, command execution, local HTTP fallback, provider plugins, automatic save, or hidden/irreversible file application without a fresh boundary review.

Hazakura Local Assist may show bounded, user-visible operation feedback in
the Assist Window to make the alpha behaviour understandable.  This
feedback is UI state, not a provider transcript or diagnostics log.  It
may describe the app-known lifecycle, such as target kind, approximate
target length, sending / generating / applied / failed phases, and
whether the result is reviewable before save.  It must not show raw
Foundation Models prompts, raw model responses, hidden system
instructions, chain-of-thought-like "reasoning", broad document
excerpts, filesystem paths, secrets, or provider internals.  It must not
be persisted, exported, copied through Support Diagnostics, or sent to
another process beyond the existing explicit Hazakura Local Assist request
and AI edit transaction flow.
