# hazakura-note Dev Agent Mode: RPC 実装メモ

Status: Archive
Scope: Future Agent Workbench / RPC exploration
Authority: Low; current release planning is controlled by `docs/roadmap.md` and `docs/agent-workbench-boundary.md`
Last reviewed: 2026-06-04

Note: This is not a public promise or an active implementation plan. As of the v0.6 planning pass, CLI mode hardening remains the preferred path, and Structured RPC stays deferred until CLI mode proves insufficient.

## 背景

hazakura-note は、Markdown / text を安全に開き、編集し、確認するための Markdown-first safe editor として進める。

一方で、pi / codex / opencode などの agent CLI を右ペインや開発者向け機能として扱いたい需要がある。ただし、agent は外部プロセスとしてファイル編集・コマンド実行・ネットワークアクセス・Git操作などを行いうるため、通常の Safe Editor 機能とは責任境界が異なる。

そのため、単純な「Agent Mode」として通常機能に混ぜるのではなく、明示的な **Dev Agent Mode** / **Developer Agent Workbench** として扱う。

---

## 基本方針

### Safe Editor Mode と Dev Agent Mode を分ける

```text
Safe Editor Mode
  - Markdown / text を安全に開く
  - 編集する
  - sanitized preview
  - diff / review / navigation
  - 外部プロセス起動なし
  - 通常機能

Dev Agent Mode
  - 明示的にON
  - allowlisted agent CLI のみ起動
  - trusted workspace 前提
  - 外部プロセス起動あり
  - Terminal mode / RPC mode を選択可能
  - 個人開発・自己責任寄りの特殊モード
```

Dev Agent Mode は、hazakura-note 本体の中核価値ではなく、開発者向けの別レーンとして扱う。

hazakura-note の中核価値は、あくまで以下。

```text
信頼しきれない Markdown / text を安全に読む・編集・確認する
```

---

## 「境界をまたぐ」とは何か

ここでいう境界とは、主に以下の3つ。

```text
セキュリティ境界:
  安全なテキストエディタ
  ↔ 外部プロセスを起動する開発者用モード

責任境界:
  hazakura-note 本体の責任
  ↔ pi / codex / opencode 側の挙動

設計境界:
  Safe Editor UI / logic
  ↔ Agent launcher / terminal / RPC integration
```

pi が hazakura-note 内部を侵食するというより、hazakura-note が pi などの外部 agent CLI を起動することで、ユーザー体験上は hazakura-note の中から強い実行能力を使えるようになる。

CLI mode では「hazakura-note はターミナル枠を提供しているだけ」と切り分けやすい。

RPC mode では hazakura-note 側が agent の出力を解釈し、UIとして再構成するため、アプリ側の責任が増える。

---

## CLI mode と RPC mode の位置づけ

### CLI mode

```text
hazakura-note
  ↓
Terminal / xterm
  ↓
pi CLI / codex CLI / opencode CLI
```

特徴:

- 互換性が高い
- 仕様変更に比較的強い
- agent 側の表示・挙動をそのまま見せられる
- hazakura-note は「器」に徹しやすい
- リサイズやTUI表示、ANSI表示、ウィンドウサイズ変更時の崩れが起きやすい
- UIとしては統合しづらい

責任分界:

```text
hazakura-note:
  - 起動した
  - 表示した
  - 入力を渡した
  - プロセスを止めた

agent CLI:
  - 何を判断したか
  - 何を実行したか
  - どう応答したか
```

CLI mode は互換性重視の fallback として残す。

---

### RPC mode

```text
hazakura-note
  ↓
pi --mode rpc
  ↓
JSON / event stream
  ↓
hazakura-note が message / tool log / error / diff として表示
```

特徴:

- UIに統合しやすい
- message / tool log / error / diff などを分けて表示できる
- Terminal より崩れにくい
- 将来的にレビューUIや差分UIに接続しやすい
- RPC schema の変更に追従する必要がある
- hazakura-note 側が出力を解釈するため、責任が増える
- 表示設計次第で、ユーザーが挙動を誤解する可能性がある

RPC mode は便利UIのための experimental / integrated mode として扱う。

---

## なぜ RPC は責任が増えるのか

RPC では hazakura-note 側が agent からのイベントを解釈する。

たとえば以下のような判断をアプリ側が行うことになる。

```text
- このイベントは通常メッセージとして表示する
- このイベントは tool log として表示する
- このイベントは error として強調する
- この diff は適用候補として表示する
- この状態なら成功扱いにする
- この状態なら中断扱いにする
```

ここで表示や解釈を間違えると、agent 側の実際の挙動と、ユーザーに伝わる意味がズレる。

特に注意すべきこと:

```text
- error を見落とさない
- tool execution を隠しすぎない
- success / failure / canceled を誤表示しない
- diff や編集提案を勝手に確定扱いしない
- unknown event を握りつぶさない
- RPC仕様変更時は安全側に倒す
```

RPC は「きれいなUI」ではなく、agent output の **解釈レイヤー** である。

---

## 推奨する実装方針

### 1. CLI mode をまず安定させる

最初は terminal compatibility mode を主軸にする。

やること:

```text
- xterm 表示
- fit addon
- 右ペインリサイズ対応
- scrollback
- font size 調整
- clear / restart
- process kill
- workspace root で起動
- provider allowlist
- env 管理
```

この段階では、hazakura-note は terminal container に徹する。

---

### 2. RPC mode は experimental として追加する

いきなり main path にしない。

```text
Dev Agent Mode
  Launch mode:
    - Terminal compatibility
    - Structured RPC experimental
```

RPCが壊れた場合でも CLI mode に戻れるようにする。

README / docs には以下のような注意を明記する。

```text
Structured RPC mode is experimental.
It may require updates when the upstream protocol changes.
Terminal compatibility mode remains the fallback.
```

---

### 3. RPC UI は「嘘をつかない表示」を優先する

最初から凝ったカードUIにしすぎない。

v1 の目標:

```text
- message を表示
- tool start / end を時系列ログに表示
- error を必ず目立つ場所に表示
- raw event log を見られる
- unknown event を警告として表示
- diff は表示のみ
- 自動適用しない
```

避けること:

```text
- tool log を過度に隠す
- error を折りたたみの中だけに置く
- unknown event を無視する
- agent の編集提案を hazakura-note 側で成功扱いにする
- 自動でファイル変更を適用する
```

合言葉:

```text
きれいに見せる前に、嘘をつかない表示にする
```

---

## アーキテクチャ案

### レイヤー分離

```text
Safe Editor Core
  - editor
  - preview
  - file tree
  - tabs
  - diff
  - markdown navigation
  - save conflict handling

Dev Agent Layer
  - provider allowlist
  - process launcher
  - terminal bridge
  - rpc bridge
  - workspace binding
  - env management
  - session lifecycle
```

Safe Editor Core に agent 実行ロジックを直接混ぜない。

---

### Adapter 構成

```text
AgentProvider
  - id: pi | codex | opencode
  - displayName
  - command
  - args
  - supportedLaunchModes

AgentLaunchMode
  - terminal
  - rpc

AgentSession
  - start()
  - stop()
  - restart()
  - sendInput()
  - onOutput()
  - onEvent()
  - onError()
  - onExit()
```

Terminal mode:

```text
AgentSession
  -> spawn("pi")
  -> stdout/stderr を xterm に流す
  -> user input を stdin に渡す
```

RPC mode:

```text
AgentSession
  -> spawn("pi", ["--mode", "rpc"])
  -> JSON event を parse
  -> structured events に変換
  -> StructuredAgentPanel に渡す
```

---

## UI案

### Dev Agent Mode 設定

```text
Developer Agent Mode
  [ ] Enable Developer Agent Mode

Provider
  - pi
  - codex
  - opencode

Launch mode
  - Terminal compatibility
  - Structured RPC experimental
```

初期値:

```text
Enable Developer Agent Mode: off
Launch mode: Terminal compatibility
```

---

### 起動時警告

```text
Developer Agent Mode is intended for trusted local workspaces.
It may launch allowlisted external agent CLIs that can read files, edit files, run commands, or access network resources depending on the selected tool.
Use this mode only when you understand and accept the risks.
```

日本語案:

```text
Developer Agent Mode は、信頼できるローカルワークスペース向けの開発者用機能です。
このモードでは、許可された外部 agent CLI を起動します。
選択した agent や設定によっては、ファイル読み取り、ファイル編集、コマンド実行、ネットワークアクセスなどが行われる可能性があります。
内容を理解したうえで自己責任で利用してください。
```

---

## RPC event handling 方針

RPC mode では、イベントを以下のように扱う。

```text
Known message event:
  - chat / response area に表示

Known tool start event:
  - tool log に表示
  - 実行中状態にする

Known tool end event:
  - tool log に結果を表示
  - success / failed を明示

Known error event:
  - error panel に表示
  - status を failed にする

Known diff / patch proposal:
  - diff viewer に表示
  - apply は手動のみ

Unknown event:
  - warning として表示
  - raw log に保存
  - silently ignore しない
```

未知イベントの扱いが重要。

```text
Unsupported RPC event received.
The event was not interpreted by hazakura-note.
See raw event log.
```

---

## RPC mode の安全側フォールバック

RPC parsing や schema mismatch が起きた場合:

```text
- セッションを failed / degraded 状態にする
- unknown event として raw log に出す
- ユーザーに Terminal compatibility mode への切り替えを案内する
- 自動的に編集適用しない
```

可能なら設定で以下を提供する。

```text
[Switch to Terminal compatibility mode]
[Open raw event log]
[Restart agent]
```

---

## 実装順序案

### Phase 1: Terminal compatibility mode hardening

```text
- provider allowlist
- xterm integration
- resize / fit
- workspace root 起動
- process lifecycle
- warning copy
- restart / stop
```

### Phase 2: Dev Agent Mode 分離

```text
- Safe Editor Mode から分離
- setting / feature flag
- Dev Agent Layer 導入
- AgentProvider / AgentSession 抽象化
```

### Phase 3: Structured RPC experimental

```text
- pi --mode rpc 起動
- basic JSON event parser
- raw event log
- message display
- tool log display
- error display
- unknown event handling
```

### Phase 4: Review / diff integration

```text
- Markdown review result card
- diff proposal viewer
- manual apply
- session log
- workspace scoped context
```

---

## 非目標

当面やらないこと。

```text
- SDK直結
- RPC mode の main path 化
- 自動編集適用
- 任意コマンド実行欄
- allowlist なしの provider 起動
- Safe Editor Mode からの agent 自動起動
- agent 結果を hazakura-note の成功状態として過度に抽象化すること
```

---

## まとめ

hazakura-note で RPC を実装するなら、RPC は main path ではなく、Dev Agent Mode 内の experimental integrated mode として扱うのがよい。

```text
CLI mode:
  互換性重視
  hazakura-note は terminal container に徹する
  fallback として残す

RPC mode:
  統合体験重視
  hazakura-note が agent output を解釈する
  そのぶん責任が増える
  experimental として始める
```

設計上の重要点は以下。

```text
- Safe Editor Core と Dev Agent Layer を分ける
- CLI mode と RPC mode を並行して持つ
- RPC は便利UIではなく解釈レイヤーとして扱う
- unknown event を握りつぶさない
- error / tool execution / diff を誤解させない
- RPCが壊れても CLI に逃げられるようにする
- Dev Agent Mode は自己責任の開発者向けモードとして明示する
```

最終的な方針:

```text
安全な読書室としての hazakura-note を守りつつ、
Dev Agent Mode では工具付き作業場への扉を開ける。
ただし、その扉には明確に Developer Mode の札をかける。
```
