# Apple Local Assist — Live Helper 設計メモ

Status: Planning (post-slice-7)
Scope: v0.12+ `src-helpers/apple-assist/` の fixture mode / live mode 分離方針と、live mode が乗ったときに必要な request / response / availability mapping
Authority: Medium
Last reviewed: 2026-06-05

## 目的

`docs/apple-local-assist-distribution-plan.md` の "Official Information Confirmed" セクションで整理した Apple 公式情報をもとに、`src-helpers/apple-assist/` の live mode を実装する前に決めておく設計判断をまとめる。本スライスでは実装しない。`tauri.conf.json` / `bundle.externalBin` / `minimumSystemVersion` / signing / entitlements は触らない。

## 現状 (slice 5〜6 時点)

`src-helpers/apple-assist/` は SwiftPM executable target (`HazakuraAppleAssist`)。`Package.swift` の `.debug` configuration が `-DFIXTURE_MODE` を立て、それ以外 (`release` 等) は live mode のスタブになっている。

- **Wire protocol**: JSON-over-stdio。1 リクエスト 1 JSON ライン。`{"action": "probe_availability"}` または `{"action": "generate_candidate", "operation": ..., "selectedText": ..., "documentContext": ...}`。レスポンスは `{"kind": "availability"|"candidate"|"error", "value": ...}` envelope。
- **FIXTURE_MODE の挙動**:
  - `probe_availability` → `{"kind":"availability","value":{"kind":"available","reason":null}}` (常に available を返す)
  - `generate_candidate` → `{"kind":"candidate","value":{"operation":"<op>","candidateText":"【<op-prefix>】\n<text>","modelId":"fixture:helper-v0.12","latencyMs":0}}`
- **live mode (現状)**: Foundation Models binding 未接続のため、`probe_availability` は `unsupported`、`generate_candidate` は `deferred` error envelope を返す。
- **Rust 側 stub (slice 1〜6)**: macOS で `Unavailable { reason: "Foundation Models binding is not yet implemented in this build." }`、non-macOS で `Unsupported` を返す。**`Available` は絶対に返さない** (gate-default-hidden 契約)。これは live mode が着地したスライスで初めて `Available` を返し始める。

## 設計判断

### 1. アーキテクチャ: sidecar 継続

slice 7 で `LanguageModelSession` が App プロセス内から直接呼べることを確認した。代替案として「in-process Swift bridging (Rust バイナリへ Swift を静的リンク)」も検討したが、v0.12 では **sidecar 継続** を採用する。

理由:

- 既存の External Agent Workbench (`codex` / `opencode` / `pi` / `claude`) も sidecar / サブプロセスモデル。Apple Local Assist も同じパターンに揃えることで、trust boundary と運用モデルの一貫性が保たれる
- sidecar なら Rust crate は cross-platform のまま保てる (非 macOS コントリビューターが Xcode 不要)
- IPC は JSON-over-stdio で 1 往復数十 ms 程度。`MAX_SELECTED_CHARS=4000` / `MAX_CONTEXT_CHARS=8000` の入力サイズなら無視できる
- ビルド / 配布面の論点 (`externalBin` 追加、helper の signing、App Store sandbox での sidecar spawn) は別途必要だが、in-process に切り替えることでは解決しない (その場合もリンク先の Foundation Models framework が必要になる)

in-process 移行は **Helper 経路を避けたくなった将来のスライス** での re-evaluation 案件として残す。`docs/apple-local-assist-v0.12-design-review.md` の "残った不確実性" にも記載。

### 2. Fixture mode / live mode の分離

**`#if FIXTURE_MODE` でビルド時に切り替える現在の方式を維持する。**

理由:

- 2 つの異なる動作を 1 バイナリに混ぜると、CI / ローカル / DMG preview で「どのモードで動いているか」の判定が複雑化する
- `FIXTURE_MODE` は「Rust 側 stub の response shape と Swift 側 fixture の response shape が同じ」を保証するためのテスト用ビルド
- live mode は production / developer build のみ。Foundation Models を使う本番経路をテストで踏むには別ビルドが必要 (後述)
- 将来 `FIXTURE_MODE` の他に `LIVE_FIXTURE_MODE` (本物の Foundation Models 経路をダミー入力で通す) を増やす可能性はあるが、当面は 2 分岐で十分

**`swift build` 構成**:

- `.debug` (default) → `-DFIXTURE_MODE`: fixture、probe は常に `available`、generate は prefix + passthrough
- `.release` → live mode (Foundation Models 経路を呼ぶ、未実装)

**Rust supervisor との組み合わせ**:

- Rust 側は現在 `Command::new("binaries/hazakura-apple-assist-helper-<triple>")` を spawn する設計
- live mode の helper もこのパスから spawn。spawn したバイナリが fixture か live かは外部からは判別できない (response shape のみが判別材料)
- 配布時は `release` build (live) を `binaries/` に置く
- ローカル / CI 検証では fixture build を `binaries/` に置く。両者は同じ JSON プロトコルで話すので、production の Rust 側コードが両方のモードで動く

### 3. Availability mapping (live mode)

Apple 公式 `SystemLanguageModel.availability` は公式ドキュメントに "a two case enum that's either available or unavailable. If it's unavailable, you also receive a reason" と記載されている (WWDC25 286)。これを本プロジェクトの 4 状態 (`available` / `unavailable { reason }` / `disabled` / `unsupported`) に mapping する。

| Apple 公式 `availability` | 本プロジェクト `AppleAssistAvailability` | rationale |
|---|---|---|
| `.available` | `Available` | 直接 mapping |
| `.unavailable(.deviceNotEligible)` (Foundation Models 非対応 Mac) | `Unsupported` | OS / ハード非対応は "unsupported" 相当。React 側は command palette を隠す |
| `.unavailable(.appleIntelligenceNotEnabled)` (System Settings で Apple Intelligence オフ) | `Disabled` | ユーザー操作で復帰可能。`Disabled` の語彙は v0.12 design review で「user disabled the feature」と定義済み |
| `.unavailable(.modelNotReady)` (モデル未ダウンロード / ダウンロード中) | `Unavailable { reason: "<localized>" }` | 一時的な失敗。レビュー側で `reason` を見て「モデルを待つ」等の UI を出す余地あり |
| `.unavailable(.otherReason)` (guardrail 等の未知の理由) | `Unavailable { reason: "<localized>" }` | 一般化された "今の状態では利用不可" |
| `LanguageModelSession.GenerationError` 起動時 (例: `.unsupportedLanguageOrLocale`) | `Unavailable { reason: "<localized>" }` | エラーが起因の "今は使えない" |

**`is_implemented_in_v0_12` の operation allowlist との相互作用**:

- probe が `Available` でも、5 operation のうち 3 operation (`extract` / `proofread` / `explain_diff`) は v0.12.0 ではまだ deferred。Rust 側の `validate_request` がそれらを reject する。Swift 側にも同じ `IntentAllowlist` があり、deferred operation は "deferred" error envelope を返す (現状と同じ)

**`isResponding` による concurrency gate**:

- Apple 公式 "isResponding for concurrent-prompt gating" を踏まえ、同一 helper プロセスに対する `generate_candidate` 2 連発は Swift 側で直列化する
- helper 内の state は最小限 (1 つの `LanguageModelSession` か、リクエストごとに新規 session を切る)
- Rust 側 supervisor は複数 Tauri コマンド呼び出しを直列化するか、helper 側で `isResponding` を尊重してブロックする

### 4. Request / response shape

**結論: 現状の wire protocol を維持する**。理由:

- Rust 側 `AppleAssistRequest` / `AppleAssistResponse` / `AppleAssistAvailabilityResponse` は変更不要
- Foundation Models の `LanguageModelSession.respond(to:)` 入力は `String` または `Prompt`。`selectedText` と `documentContext` を `prompt` に組成する責任は Swift 側に閉じる
- `documentContext` の使い方は operation ごとに Swift 側で判断 (`summarize` なら `prompt = "<text>\n\n<context>"` のような形)。これは v0.12.0 では `summarize` / `rephrase` の 2 operation だけ。残り 3 operation が追加されたときに instruction を切り替える

**`instructions` の扱い**:

- Apple 公式 "Instructions should come from you, the developer, while prompts can come from the user"
- `instructions` は **Swift ヘルパー内にハードコード** し、絶対に user input を入れない
- operation ごとに instruction 文字列を切り替える: `summarize` → "You summarize the user's selected text in 1-2 sentences. Return only the summary, no preamble, no labels."、 `rephrase` → "You rewrite the user's selected text in the same language. Return only the rewritten text, no preamble, no labels, no commentary." のような形
- ユーザー入力 (`selectedText` / `documentContext`) は `prompt` 側にだけ流し込む
- これにより prompt injection リスクを最小化

**`@Generable` の使いどころ**:

- v0.12.0 では `summarize` / `rephrase` とも free-form text で十分 (構造化が必要ない)
- `extract` が将来追加されたときに `@Generable struct Extracted { items: [String] }` のような形で使う
- `proofread` も `struct Proofread { corrected: String, changes: [Change] }` のような guided generation を将来のスライスで使う
- v0.12.0 では `@Generable` は使わず、`@available(macOS 26.0, *)` のガードと `LanguageModelSession().respond(to: prompt)` だけ

**`candidateText` 以外のフィールド**:

- `modelId`: live mode では `"apple:foundation:<useCase>"` のような形 (例: `"apple:foundation:default"`)。`stub:v0.12` / `fixture:helper-v0.12` とは明確に区別
- `latencyMs`: live mode では `Int(Date().timeIntervalSince(start) * 1000)` で実測。fixture は 0 固定

### 5. Error handling

Apple 公式 "These errors might include guardrail violation, unsupported language, or context window exceeded" を踏まえ、Swift 側で `LanguageModelSession.GenerationError` を catch して error envelope に詰める。

| Apple error | Helper error envelope `kind` | Rust 側 `Result::Err` メッセージ |
|---|---|---|
| `.guardrailViolation` | `guardrail` | "Apple Assist refused the request (guardrail)." |
| `.unsupportedLanguageOrLocale` | `validation` | "Selected text language is not supported by Apple Intelligence." |
| `.contextWindowExceeded` | `validation` | "Selected text is too long for Apple Assist. (Limit: 4000 chars)" |
| `.rateLimited` | `throttled` | "Apple Assist is rate-limited. Try again in a moment." |
| `.unsupportedUseCase` | `validation` | "This operation is not supported on this device." |
| other | `internal` | "Apple Assist returned an unexpected error." |

**Rust 側**:

- 既存の `generate_apple_assist_candidate_with_label` は helper を spawn して envelope を parse する
- error envelope を受け取った場合は `Result::Err(message)` を返し、React 側 (useAppleAssistCandidate) は status bar にエラー文言を出す
- **auto-apply / auto-retry なし**。ユーザー操作を待つ

### 6. 起動と lifecycle

**現状の helper 起動 (slice 5 時点)**:

- Rust 側は `Command::new("binaries/hazakura-apple-assist-helper-<triple>")` を spawn
- 起動トリガーは最初の `probe_apple_assist_availability` または `generate_apple_assist_candidate` 呼び出し
- helper の終了は Tauri コマンドが完了したら即座 (1 リクエスト 1 spawn) — これが現在の stub の挙動

**live mode での変更候補**:

- 案 A: 1 リクエスト 1 spawn のまま。Foundation Models 起動コスト (~ 数百 ms) があるたびに毎回払う
- 案 B: helper を long-lived にする。Tauri 側で `OnceCell<Child>` か `Arc<Mutex<Child>>` で保持。コマンド完了後も stdin を閉じずに次回呼び出し時に再利用
- 案 C: Tauri 起動時に helper を warm-up spawn し、ずっと keep-alive

**推奨**: 案 B。理由:

- Foundation Models のロードは初回が大きく (~数百 ms)、2 回目以降は session 再利用で速い
- helper の stdin を keep-alive しても `isResponding` で concurrency gate すれば競合しない
- 案 C は App Store sandbox での常駐プロセス扱いが論点 (Guideline 2.4.2 "no unrelated background processes" に近くなる)
- 案 A は UX が悪い (候補生成ごとに 500ms 余計にかかる)

**実装メモ (案 B の場合)**:

- Rust 側に `AppleAssistHelperStore` を持つ (Tauri の `.manage(...)` で State に注入)
- `probe` と `generate` 両方の command で `State<AppleAssistHelperStore>` を受け取る
- 内部に `Mutex<Option<Child>>` を持つ。初回は `None` → spawn。2 回目以降は `Some(child)` を再利用
- 書き込みは stdin の 1 ライン。読み取りは stdout の 1 ラインを `BufReader::read_line` で受ける
- timeout は `child.wait_timeout(Duration::from_secs(N))` で設ける (N は要決定、候補生成は長くて数秒)
- stderr は読み捨て (ログは別途ファイルに書く)
- EOF / exit / timeout で `None` に戻し、次回 spawn する
- kill-on-drop: Tauri の State 破棄時に helper も kill する

### 7. Concurrency policy

- Tauri の command handler は async (tokio runtime 上で動く)
- helper への書き込みは `Mutex<Option<Child>>` で直列化
- 1 ユーザーが複数タブで同時に "Apple Assist" を起動しても、helper 側で直列化される
- 候補生成に 5 秒かかった場合、2 番目の呼び出しは 5 秒待つ (timeout で諦める設定)
- 案: 2 番目を即時失敗させる (Busy) → Rust 側で "Apple Assist is busy" を出して再試行はユーザーに任せる。これも要決定

### 8. Failure state / retry

- helper プロセスが落ちた / 応答がない / 不正な JSON を返した → Rust 側は `None` に戻して次回 spawn し直す
- 連続失敗 N 回で 1 度は打ち切る (N は要決定、5 回程度?)
- 打ち切ったあとの probe は `Unavailable { reason: "Apple Assist is currently unavailable. Try again later." }` を返す
- 打ち切り状態は一定時間 (例: 5 分) 後に自動解除

### 9. テスト方針

**Fixture mode (現状)**:

- `bash scripts/build-apple-assist-helper-fixture.sh` で fixture build + JSON-over-stdio smoke (probe→available, summarize→【要約案】\n...)
- 既存の `cargo test apple_assist` で Rust 側 stub の shape を固定
- 既存の `useAppleAssistCandidate.test.ts` で stub candidate → runCandidateCompare の handoff を固定

**Live mode (将来スライス)**:

- Apple Silicon Mac + Apple Intelligence 有効環境での integration test
- CI では実行しない (ハードウェア依存)
- テスト対象:
  - probe が `Available` を返す
  - `summarize` が空でない candidate text を返す (`modelId` が `"apple:foundation:*"` で始まる)
  - `extract` / `proofread` / `explain_diff` が "deferred" error envelope を返す
  - guardrail violation 系のプロンプト (e.g. 暴力的文言) で `guardrail` error envelope を返す
  - oversized `selectedText` (> 4000 chars) で `validation` error envelope を返す
  - helper を kill したあとの probe が `Unavailable { reason: "..." }` を返す
- テストは `docs/smoke-checklist.md` に追加する項目 (slice 10 以降)

### 10. Build / 配布

- `Package.swift` の `.release` configuration は `-O` (default) で build。Foundation Models を import するので `linkerFlags` に `-framework FoundationModels` 相当が必要 (SwiftPM の executable target が自動的に framework をリンク)
- `-DFIXTURE_MODE` をつけない .release build が live mode
- live mode の build は Apple Silicon Mac + Xcode 26 SDK 必須 (FoundationModels framework は macOS 26+ SDK にしかない)
- CI (GitHub Actions) は Intel macos runner で `.debug` のみ build (fixture mode の smoke)
- live mode build は local もしくは Apple Silicon macos runner (要明示承認)

## 実装 plan

| 順番 | 内容 | 影響範囲 |
|---|---|---|
| 1 | `IntentAllowlist.swift` の live mode 実装 (operation → instruction 文字列マッピング) | Swift |
| 2 | `AvailabilityProbe.swift` の live mode 実装 (4 状態 mapping) | Swift |
| 3 | `GenerateCandidate.swift` の live mode 実装 (LanguageModelSession) | Swift |
| 4 | `Package.swift` の `linkerFlags` 設定 (FoundationModels framework 自動 link 確認) | SwiftPM |
| 5 | `scripts/build-apple-assist-helper-fixture.sh` に `release` build ターゲットを追加 (明示承認後) | script |
| 6 | Rust 側 `AppleAssistHelperStore` 導入 (案 B) | Rust |
| 7 | `useAppleAssistAvailability` の error handling を `Unavailable { reason: "..." }` 形に拡張 (probe 失敗時 detail を表示) | TS |
| 8 | `useAppleAssistCandidate` の error handling を error envelope kind ごとに分類 | TS |
| 9 | `docs/smoke-checklist.md` の Apple Local Assist セクションに live mode 項目追加 | doc |

## Open questions (明示承認待ち)

- **案 B (long-lived helper) vs 案 A (1 request 1 spawn)**: UX 要件で判断。案 B は helper 起動コストを 1 回目だけにできるが、`isResponding` ベースの concurrency gate の挙動を本番で観察してから確定
- **2 番目の同時呼び出しの扱い**: busy 即時失敗 vs 待ち
- **timeout 値**: 候補生成が LLM 次第なので 5 秒 / 10 秒 / 30 秒のどれを既定にするか
- **連続失敗の上限とクールダウン**: 5 回 / 5 分、等の数値
- **in-process 移行**: 今回 sidecar 継続を決めたが、App Store sandbox での sidecar spawn が想定外の挙動をした場合は再評価
- **streaming vs single-shot**: `streamResponse` の UX メリット (候補が段階的に表示される) と実装コスト (Rust 側で partial をどう Review Desk に渡すか) のトレードオフ

## 参照

- `docs/apple-local-assist-distribution-plan.md` — "Official Information Confirmed" セクション
- `docs/apple-local-assist-v0.12-design-review.md` — "残った不確実性" / 設計選択
- `src-helpers/apple-assist/Sources/HazakuraAppleAssist/*.swift` — 現状の fixture / live コード
- `src-tauri/src/commands/apple_assist.rs` — Rust 側 stub 実装
- `scripts/build-apple-assist-helper-fixture.sh` — fixture build script
