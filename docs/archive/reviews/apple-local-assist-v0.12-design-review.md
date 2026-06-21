# Hazakura Local Assist v0.12 設計レビュー

Status: Review record (post-slice-6)
Scope: v0.12 Hazakura Local Assist スライス 1〜6 (型・境界 / probe / Review Desk handoff / UI entry / Swift helper feasibility / docs sync) の設計選択・ゲート・残課題レビュー
Authority: Medium
Last reviewed: 2026-06-05 (post-slice-6 implementation, post-P1/P2 boundary fixes, post-slice-7 official info confirmation)

Current-state note (2026-06-06): this is now a historical review record. The live helper gate has since been flipped on `main` via `bundle.externalBin`, Swift `LanguageModelSession`, and Rust supervisor command routing. Use `docs/current-status.md`, `docs/apple-local-assist-writing-companion-plan.md`, and `docs/apple-local-assist-helper-path-design.md` for current implementation state.

## 目的

`docs/apple-local-assist-distribution-plan.md` の方針が現在のコード構造に対して実装可能か、Agent Workbench / Review Desk の既存構造との整合を確認した上で、v0.12 のスライス 1〜6 が安全に着地した最小変更点と、その間に残った不確実性をまとめる。本メモは v0.12.0 リリースまでの間 "Snapshot + Review record" として参照される。新しいスライスを始める前に読み返して、設計判断の根拠を残す用途を想定。

## 読んだファイル

### Agent Workbench 既存構造
- `src/lib/tauri/agent.ts` — `AgentWorkbenchProvider = "codex" | "opencode" | "pi" | "claude"`、invoke レイヤ
- `src/hooks/agent/useAgentWorkbenchPreferences.ts` — active / preference 分離、consent、provider の localStorage 4 種
- `src/hooks/agent/useAgentProviderAvailability.ts` — マウント時 1 回 probe、Map 化
- `src/components/agent/AgentWorkbenchPreferencesPane.tsx` — preferences UI、3 セクション (mode / session / boundary)
- `src-tauri/src/commands/agent_workbench.rs` — `*_with_label` シムパターン、preflight → start / stop / state / input / resize / availability の 6 コマンド
- `src-tauri/src/security/window_guard.rs` — `ensure_label_is_main` と `ensure_label_is_main_or_agent`
- `src-tauri/capabilities/default.json` (windows: ["main"]) と `agent-window.json` (windows: ["agent"]) — カスタム `#[tauri::command]` は capability に書いた window には自動 allowlist

### Review Desk candidate flow
- `src/hooks/review/useReviewDeskState.ts` — `runCandidateCompare` は `candidateSourceLabel` を含む 8 パラメータを受けて `CompareCase { kind: "candidate", ... }` を組み立てる
- `src/types.ts:301-345` — `CompareCase` の 3 種 (`file` / `changes` / `candidate`)、`candidate` は `documentTabId / documentContents / documentPath / documentLabel / leftColumnLabel / rightColumnLabel / candidateSourceLabel / candidateText / comparedAt` を持つ
- `src/components/review/ReviewSurface.tsx:185` — 手動貼り付けでは `candidateSourceLabel: copy.candidateSourceManual` を渡している
- `src/lib/locale/reviewDesk.ts:29, 81, 143, 177` — `candidateSourceManual` が 3 言語で定義済み (en / ja / kana)
- `src/components/review/ChangeReviewView.tsx` — 候補の diff 描画。`onApplyBackup` は `backup-vs-buffer` scope のみ。candidate は read-only 表示で apply は別経路 (手動)

## 結論: 実装可能 (着地済み)

既存の Review Desk candidate flow はすでに `candidateSourceLabel` を引数で受ける設計になっている。Hazakura Local Assist 候補も同じ `runCandidateCompare` 経路に新しいラベルで流し込めば、UI 側の diff 描画は既存を再利用できる。手動 apply の安全策 (stale candidate guards / tab switch / buffer edit) はそのまま機能する。

Agent Workbench のパターン (active / preference 分離、availability probe、restart-required、consent、`*_with_label` シム、window label gate) は流用可能だった。ただし、**実装は別ディレクトリ・別型として切り出し、既存の `AgentWorkbenchProvider` には触らない** — これも v0.12 内で守られている (src/hooks/agent/* は無変更)。

## 重要な差分: 以前の plan ファイルとの食い違い

セッション中に書いた `~/.claude/plans/v0-11-v0-12-mac-ai-swift-crispy-mango.md` (素案) は最新ドキュメントと一部食い違う。実装フェーズでは `docs/apple-local-assist-distribution-plan.md` と本メモを優先する。

| 項目 | 素案 (plan ファイル) | 最新 (distribution plan + 本メモ) |
|---|---|---|
| Provider モデル | 既存 `AgentWorkbenchProvider` に `"apple-local"` を追加 | `AgentWorkbenchProvider` には触らず、`AppleLocalAssist` を別 provider class として独立 |
| `minimumSystemVersion` | 26.0 に bump | 全レーン一律 bump しない。Foundation Models availability で実行時 gate。sandbox / App Store proof 後に判断 |
| `externalBin` | 追加する前提 | 検証してから。本スライスでは設定変更しない |
| 役割の語彙 | "agent concept" に統合 | "Assist Surface provider class" として独立。CLI-agent provider とは別境界 |

## 設計選択 (v0.12 で確定するもの)

### 1. 型は別ファイルに置く

- `src/lib/tauri/appleAssist.ts` (新規) — `AppleAssistOperation`, `AppleAssistAvailability`, request / response 型、invoke 関数
- `AgentWorkbenchProvider` には `"apple-local"` を加えない (CLI-agent provider ではないため)
- `useAgentWorkbenchPreferences` の active / preference / consent / provider 4 種にも触らない

### 2. `AppleAssistOperation` は 5 種定義、v0.12 では 2 種実装

```ts
export type AppleAssistOperation =
  | "summarize"
  | "rephrase"
  | "extract"
  | "proofread"
  | "explain_diff";
```

- `summarize` / `rephrase` は slice 1〜4 で通す
- `extract` / `proofread` / `explain_diff` は enum だけ定義、v0.12.0 では unknown operation として拒否 (v0.12.x / v0.13 で追加)

### 3. `AppleAssistAvailability` は 4 状態

```ts
export type AppleAssistAvailability =
  | { kind: "available" }
  | { kind: "unavailable"; reason: string }
  | { kind: "disabled" }   // user disabled the feature
  | { kind: "unsupported" }; // macOS 14 or earlier
```

- Apple 公式の "model availability" には複数の失敗理由 (Apple Intelligence 無効、モデル未ダウンロード、OS 非対応) があるため、v0.12 では `reason: string` で吸収する
- 4 状態すべてで Safe Editor は壊れない (probe 失敗 → unavailable 表示、コマンドパレットから隠す)

### 4. 再起動は要求しない

- Agent Workbench の restart-required は PTY バックエンド初期化が必要なため
- Hazakura Local Assist はランタイム probe 1 回 + 候補生成コマンドの 2 つだけ。スライス 1〜5 時点ではプロセス spawn しない (Rust 側 stub で完結)。slice 5 で Swift helper を `binaries/` に書く形は検証済みだが、bundled sidecar として spawn する経路は Foundation Models live binding 着地後に別スライスで扱う
- availability の変化 (Apple Intelligence をあとで有効化、等) は次の probe / 次の generate 呼び出しで反映すればよい
- これは Agent Workbench パターンからの意図的な divergence

### 5. consent は不要 (v0.12)

- 候補は必ず Review Desk を通る。Review Desk 自身が安全網
- ユーザー操作 (コマンドパレット選択) が必要なアクション 2 段
- 「AI Assistance 4 ステップ (select → generate → diff → apply) の中で同意をどう扱うか」は `security-boundary.md` 側の後続レビューに委ねる (本メモでは未着手)
- **v0.12 では consent UI を作らない**

### 6. 入力サイズ上限

- `MAX_SELECTED_CHARS = 4000`
- `MAX_CONTEXT_CHARS = 8000`
- 制限を超える入力は Rust 側で即拒否 (silent truncate はしない)
- App Store build でネットワーク fallback を入れないために、入力サイズを契約として固定する

### 7. UI 露出経路は 1 つだけ

- Command Palette にだけ項目を出す ("Hazakura Local Assist: Summarize selection" / "…: Rephrase selection")
- View メニューには出さない (L Mode toggle とは別物なので混同を避ける)
- Preferences にも独立セクションは作らない (slice 4 完了時点で enable 設定も追加しない判断 — gate-default-hidden 契約と相性が良いため)
- 汎用チャット画面 / 常駐サイドバー / agent window 化 / prompt editor / provider-add UI は作らない

### 8. 既存 Review Desk の安全策を再利用

- `runCandidateCompare` の `setCandidateInputText` 経由クリア (tab switch / buffer edit / candidate edit 時に stale 破棄)
- Apply は手動経路 (UI 上の Apply ボタン)。auto-apply なし
- 保存は明示 Save のみ (auto-save なし)

### 9. IPC は main window / Hazakura Local Assist window に限定

- `probe_apple_assist_availability_with_label` の gate は `ensure_label_is_main_or_apple_assist` を使う。読み取り専用の availability probe は、Hazakura Local Assist window 自身が unavailable / disabled / unsupported state を表示するために必要
- `generate_apple_assist_candidate_with_label` の gate は `ensure_label_is_main` を使う。本文 context を渡す candidate generation は main window 側に限定する
- どちらも `..._or_agent` は使わない
- Agent Workbench の CLI trust boundary を継承しない。`agent` ラベルの窓から Hazakura Local Assist IPC を呼ぼうとすると即時 `Command is not allowed from window 'agent'.` で拒否される
- これは strategy doc の「Agent Workbench の CLI trust boundary を継承しない」と一致する

### 10. historical: probe は "gate-default-hidden" 契約

- Historical slice-6 state: v0.12 の Rust probe は macOS で `Unavailable { reason: "Foundation Models binding is not yet implemented in this build." }` を返し、non-macOS で `Unsupported` を返す。`Available` は **絶対に返さない**
- ライブ Foundation Models バインドが乗った将来のスライスで、この probe だけが `Available` を返し始める (そのとき React 側の `useAppleAssistAvailability` がコマンドパレット項目を露出する)
- `generate_apple_assist_candidate_with_stub` のレスポンスは `modelId: "stub:v0.12"` を持ち続ける。Foundation Models 実バインドに切り替わったとき、この modelId が消えるので、テスト / 将来 telemetry でスタブ漏れを検出できる

## スライスごとの確認ポイント

| Slice | 触るファイル | 触らないファイル | 確認コマンド |
|---|---|---|---|
| 0 (本メモ) | `docs/apple-local-assist-v0.12-design-review.md` | コード | `git diff --check` |
| 1 (型・境界) | `src/lib/tauri/appleAssist.ts` (新)、`src-tauri/src/commands/apple_assist.rs` (新、stub)、`src-tauri/src/lib.rs` (module decl + handler 追加)、`src-tauri/src/tests/apple_assist.rs` (新) | `src/lib/tauri/agent.ts`、`src/hooks/agent/*`、`tauri.conf.json` | `npm run typecheck`、`npm test`、`cargo test`、`git diff --check` |
| 2 (probe) | `src/hooks/agent/useAppleAssistAvailability.ts` (新、`useAgentProviderAvailability` をミラー)、`src/lib/locale/appleAssist.ts` (新) | `src/hooks/agent/useAgentProviderAvailability.ts` | + `npm run build:vite` |
| 3 (handoff) | `src/hooks/review/useAppleAssistCandidate.ts` (新、stub 候補 → `runCandidateCompare`)、`src/lib/locale/reviewDesk.ts` (`candidateSourceAppleAssist` 追加) | `src/hooks/review/useReviewDeskState.ts` (触らない) | + stale candidate 既存 test が壊れていないこと |
| 4 (UI) | `src/hooks/commandPalette/useCommandPaletteController.ts` (新コマンド 2 種、availability で gate) | preferences pane には入れない | + `npm run build:vite` |
| 5 (Swift spike) | `src-helpers/apple-assist/` (新、SwiftPM パッケージ + Swift ソース)、`scripts/build-apple-assist-helper-fixture.sh` (新)、`package.json` (build script 追加)、`.gitignore` (`.build/` / `binaries/`) | `tauri.conf.json`、`Cargo.toml` | + `bash scripts/build-apple-assist-helper-fixture.sh` で fixture smoke 通過 |
| 6 (docs) | `docs/apple-local-assist-distribution-plan.md`、`docs/assist-surface-strategy.md`、`docs/roadmap.md`、`docs/current-status.md`、`docs/development-automation.md`、`docs/smoke-checklist.md` | コード | `git diff --check` |

## 実装済みスライス (2026-06-05 時点)

- Slice 1 (型・境界) — 着地
- Slice 2 (availability probe) — 着地
- Slice 3 (Review Desk handoff) — 着地
- Slice 4 (UI entry の最小化) — 着地
- Slice 5 (Swift helper feasibility spike — fixture mode) — 着地
- Slice 6 (docs sync) — 着地

スライスごとの目的とファイル境界の記録は下の表に残す (各スライスの "触るファイル" 列がそのまま実装 footprint)。

## Slice 5 検証結果

`src-helpers/apple-assist/` に Swift パッケージを追加し、`bash scripts/build-apple-assist-helper-fixture.sh` で end-to-end smoke が通ることを確認。

- **Toolchain**: macOS 26.5.1 + Swift 6.3.2 (`Target: arm64-apple-macosx26.0`)。Xcode SDK 上に `FoundationModels.framework` が存在する (`/Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX.sdk/System/Library/Frameworks/FoundationModels.framework`)
- **Package shape**: `Package.swift` (SwiftPM 5.9, executable target, macOS 13+)。`.debug` configuration が `-DFIXTURE_MODE` を立てる。`live mode` (`.release` 等) は意図的にまだ未配線で、`unsupported` と `deferred` を返す stub のまま
- **Wire protocol**: JSON-over-stdio。リクエストは 1 行 1 JSON、`{"action": "probe_availability"}` または `{"action": "generate_candidate", ...}`。レスポンスは `{"kind": "availability"|"candidate"|"error", "value": ...}` の envelope
- **Tauri sidecar naming**: 出力先は `binaries/hazakura-apple-assist-helper-<rust-triple>` (現在は `aarch64-apple-darwin`)。`bundle.externalBin` は **まだ追加していない** — `tauri.conf.json` の配布設定は明示承認待ち
- **Rust stub との一貫性**: `IntentAllowlist.implementedInV0_12 = {"summarize", "rephrase"}`、`CandidatePrefix.prefix(for:)` が `【要約案】` / `【書き換え案】` を返す。これは Rust 側 `generate_apple_assist_candidate_with_stub` と同じ。両側を 1 つの assertion で確かめられる
- **Smoke 結果**: probe → `{"kind":"availability","value":{"kind":"available","reason":null}}`、summarize → `{"kind":"candidate","value":{"operation":"summarize","candidateText":"【要約案】\nhello", ...}}`

### Slice 5 で残った不確実性

- **App Store build と Foundation Models の許容範囲** — Apple の `acceptable-use-requirements-for-the-foundation-models-framework/` を未確認。App Store sandbox 内から `LanguageModelSession` を呼べるかは別途検証
- **Live mode (Foundation Models 実バインド)** — 現状は `unsupported` / `deferred` を返す。`if #available(macOS 26.0, *)` で `LanguageModelSession` を開き、readiness を 4 状態に map する仕事が残っている
- **sidecar spawn と App Store sandbox** — `Command::new("binaries/...")` を Tauri 配布アプリ内で実行すると、sandbox 設定 / `LSEnvironment` / `embedded.provisionprofile` 等の調整が必要かもしれない。判明したら distribution plan に明記
- **`minimumSystemVersion` の扱い** — 現在の `tauri.conf.json` は `11.0`。Foundation Models 実バインドを有効化する build flavor では 26.0 に上げる必要があるが、すべての lane で一律上げるかは別レビュー
- **Code signing / notarization の差分** — `externalBin` を追加すると helper も notarize 対象。DMG warning preview に影響しないかは Slice 6 で再確認

## 残った不確実性 (v0.12.0 リリース前)

スライス 1〜6 で解消済みの項目 + 残った項目を分けて記録する。Slice 7 (2026-06-05) で `docs/apple-local-assist-distribution-plan.md` の "Official Information Confirmed" セクションに Apple 公式情報を整理したため、本セクションの未解消項目も一部状態更新した。

### 解消済み (着地時 2026-06-05)

- **Swift helper feasibility** — fixture mode で Rust↔helper 疎通を確認 (smoke 結果: probe→`available`、summarize→`【要約案】\n...`、下の "Slice 5 検証結果" を参照)
- **probe のキャッシュ戦略** — `useAppleAssistAvailability` をマウント時 1 回呼ぶ形に固定 (`useAgentProviderAvailability` と同じパターン)
- **Locale** — `src/lib/locale/appleAssist.ts` 3 言語、`candidateSourceAppleAssist` も `src/lib/locale/reviewDesk.ts` に 3 言語追加済み
- **手動 candidate との競合** — `useAppleAssistCandidate` が `runCandidateCompare` 経由で投入するので、既存の `setCandidateInputText` stale ガードがそのまま機能する
- **Apple 公式の acceptable use / App Store 制約の確認** — `docs/apple-local-assist-distribution-plan.md` の "Official Information Confirmed" セクションにまとめる。設計上 danger zone と判明したのは "courseware" (item 19) と "tone-shifting" (item 3) と "framework safety circumvention" (item 16) の 3 点。いずれも本スライスの 5 operations (`summarize` / `rephrase` / `extract` / `proofread` / `explain_diff`、全操作が "transform the user's own text") には触らない

### 未解消 (v0.12.0 リリース前に対応すべきもの)

- **Live mode (Foundation Models 実バインド)** — Slice 7 で framework 公式 API は確認 (SystemLanguageModel / LanguageModelSession / @Generable / isResponding)。Rust 側 stub は引き続き `Unavailable { reason }` を返す。`if #available(macOS 26.0, *)` で `LanguageModelSession` を開くところ、4 状態の `availability` mapping、Foundation Models の `unavailable(let reason)` を本プロジェクトの `Unavailable { reason }` に翻訳するところが残る。これが乗ったスライスで `Available` が初めて返る
- **sidecar spawn と App Store sandbox** — `Command::new("binaries/...")` を Tauri 配布アプリ内で実行する経路が、macOS App Store の sandbox (Guideline 2.4.5(i)) と Private Cloud Compute fallback (Apple Intelligence overview) の両方で動くか。現時点では Helper なしでも `LanguageModelSession` を in-process で呼べるはず (App プロセスが Foundation Models framework を直接 import する経路) — slice 8 で「sidecar 経由」 vs 「in-process リンク」のどちらが App Store 的に素直か整理する
- **`minimumSystemVersion` の扱い** — 現在の `tauri.conf.json` は `11.0`。Apple 公式ページの device list は M1+ Mac 系なので、レガシー Mac を切り落とすことになる。Slice 8 で「App Store build は 26.0 に上げる / Developer build は 11.0 のまま」のように lane 分離できるか設計する
- **Helper の signing / notarization** — Slice 7 では Helper 経路を採らない方向が見えてきた (上記 sidecar 議論)。Helper 経路を採らない場合、`externalBin` も `signing / notarization` も当面は触らない。Helper 採否の最終判断は Slice 8
- **`@available(macOS 26.0, *)` の正確な annotation** — reference ページが WebFetch で本文取得できなかったので、Xcode ドキュメントビューアで実装直前に再確認する
- **In-app disclosure 文言 (item 19 / item 1 / item 14 対策)** — Foundation Models を使う旨と acceptable use への同意を App Store build に組み込む文言を Slice 10 で設計する (Preferences への追加は方針未定)

## 想定リスク

1. **素案 (plan ファイル) を読み返して v0.12 を始めると、provider モデルが `AgentWorkbenchProvider` 拡張になってしまう** — distribution plan と本メモを authoritative とし、素案は破棄
2. **availability 4 状態の UI 文言が、platform / locale / 個人設定で発散する** — slice 2 で文言を集約、3 言語 × 4 状態 = 12 種類をレビュー時に確認済み。v0.12 内の 4 状態は `src/lib/locale/appleAssist.ts` の 1 ファイルに集約されているが、将来 `disabled` を "user disabled" 以外の文脈で使う場合に発散の余地あり
3. **stub と本番の境界** — v0.12 の Rust 側 probe は macOS で `Unavailable { reason }` を返し、non-macOS で `Unsupported` を返す。`Available` を返さないことが「gate-default-hidden」契約の本体。ライブ Foundation Models バインドが乗ったスライスだけが `Available` を返し始める (slice 5 までの検証済み)
4. **Apply 経路の安全性** — `runCandidateCompare` 後の Apply が手動ボタンであることを、UI 上に毎回明示する。Hazakura Local Assist だから auto-apply される、という誤読を防ぐ
5. **distribution plan で「may include Hazakura Local Assist when available」と書いたが、App Store build には含める前提でよいか** — ユーザー指示は「App Store build には External Agent Workbench / CLI launch / arbitrary process execution を入れない方向」なので、Hazakura Local Assist 自体は App Store build に入る前提。distribution plan と整合
6. **agent 窓からの IPC 呼び出し** — `ensure_label_is_main_or_agent` を使って agent 窓からも呼べてしまうと、Agent Workbench の CLI trust boundary を継承してしまう。v0.12 では `ensure_label_is_main` に絞り、agent ラベルは Rust 側で即時拒否する (section 9)

## 次のアクション (v0.12.0 リリース前)

- **残った不確実性** — Foundation Models live binding / App Store sandbox + Foundation Models acceptable-use 確認 / OS-minimum 決定 (Foundation Models 実バインド build flavor のみで 26.0 にするか、全レーン一律にするか) / helper の signing / notarization の差分。スライス 5 検証結果の "残った不確実性" を参照
- **素案 plan ファイルのアーカイブ** — `~/.claude/plans/v0-11-v0-12-mac-ai-swift-crispy-mango.md` を `docs/archive/plans/v0-12-initial-draft.md` にコピーして残す (本メモの "重要な差分" 表とあわせて参照できる形にする)
- **v0.12.0 リリース可否の判断** — 実装は完了したが、リリース判定 (live binding なしのまま公開して良いか、それとも live binding 着地後にするかを明示承認なしで決めない) はユーザー判断待ち
- **次のスライスを始める場合** — 本メモの "設計選択" と "想定リスク" を読んでから着手。`Available` 化 / agent 窓の gate 緩和 / live Foundation Models 呼び出しを追加したい場合は、status を "Review record" から "Active planning" に戻し、新しいリスク項目を追加する
