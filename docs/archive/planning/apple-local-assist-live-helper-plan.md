# Apple Local Assist — Live Helper 設計メモ

Status: Implemented (slice 8-18, Foundation Models live binding のみ未着手)
Scope: `src-helpers/apple-assist/` の fixture mode / live mode 分離方針と、live mode が乗ったときに必要な request / response / availability mapping
Authority: Medium
Last reviewed: 2026-06-05

## 目的

`docs/apple-local-assist-distribution-plan.md` の "Official Information Confirmed" セクションで整理した Apple 公式情報をもとに、`src-helpers/apple-assist/` の live mode を実装する前に決めておく設計判断をまとめる。Slice 8-18 で supervisor 側 (spawn / lifecycle / timeout / protocol-violation detection / production helper-path resolver skeleton) は実装済み。Swift 側の `LanguageModelSession` 接続 (live mode 本体) は未実装で、本メモはその着地条件を pin する。`tauri.conf.json` / `bundle.externalBin` / `minimumSystemVersion` / signing / entitlements は触らない。

> **用語注意**: 「supervisor 実装済み」 = Rust crate 側で helper の spawn / lifecycle / timeout / cooldown / protocol-violation 検出、production helper-path resolver skeleton、integration test 27 ケースが揃っているという意味。Foundation Models **live binding** (`LanguageModelSession` 呼び出し) は Swift 側で別スライスに乗せる未着手のもの。本メモ中で "live binding 実装済み" と読める表現は意図的に避けている。production `helper_path()` は依然として `Err` を返し、command surface は supervisor を呼ばない (gate-default-hidden 維持)。

## 現状 (slice 18 時点)

`src-helpers/apple-assist/` は SwiftPM executable target (`HazakuraAppleAssist`)。`Package.swift` の `.debug` configuration が `-DFIXTURE_MODE` を立て、それ以外 (`release` 等) は live mode のスタブになっている。

- **Wire protocol** (実装済み、live 経路でも lockstep): JSON-over-stdio。1 リクエスト 1 JSON ライン。`{"action": "probe_availability"}` または `{"action": "generate_candidate", "operation": ..., "selectedText": ..., "documentContext": ...}`。レスポンスは `{"kind": "availability"|"candidate"|"error", "value": ...}` envelope。Rust 側 `serde` タグ (`tag = "kind", content = "value"`) と Swift 側 `JSONEncoder` 出力 (`kind` / `value`) が lock している。
- **FIXTURE_MODE の挙動** (実装済み):
  - `probe_availability` → `{"kind":"availability","value":{"kind":"available","reason":null}}` (常に available を返す)
  - `generate_candidate` → `{"kind":"candidate","value":{"operation":"<op>","candidateText":"【<op-prefix>】\n<text>","modelId":"fixture:helper-v0.12","latencyMs":0}}`
- **live mode (現状)**: Foundation Models binding 未接続のため、`probe_availability` は `unsupported`、`generate_candidate` は `deferred` error envelope を返す。Slice 13+ で `LanguageModelSession` 経路を乗せる。
- **Rust 側 stub (slice 1-6 の Tauri command surface)**: macOS で `Unavailable { reason: "Foundation Models binding is not yet implemented in this build." }`、non-macOS で `Unsupported` を返す。**`Available` は絶対に返さない** (gate-default-hidden 契約)。これは live mode が着地したスライスで初めて `Available` を返し始める。
- **Rust 側 supervisor (slice 8-18)**: 実装済み。`binaries/hazakura-apple-assist-helper-<triple>` を spawn して JSON line 通信 + 15s watchdog + 5 連続失敗で 5 分 cooldown + protocol violation (Candidate-on-probe / Availability-on-generate / malformed / EOF) を reset+count。`WireEnvelope::Error` (guardrail / validation / deferred / throttled) は pass-through で cooldown 集計に入れない。production helper-path resolver skeleton も wired だが、gate-default-hidden 維持のため production `helper_path()` は not-configured を返す。詳細: `docs/apple-local-assist-rust-supervisor-plan.md`。v0.12.0 では Tauri command surface から supervisor 経路を呼んでいない (gate-default-hidden 維持)。

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

**実装済みの helper 起動 (slice 8-18)**:

Rust 側 supervisor は案 B (long-lived helper) で実装済み。Swift 側の launch 経路は slice 5 のまま:

- Rust 側は `Command::new("binaries/hazakura-apple-assist-helper-<triple>")` を spawn (`AppleAssistHelperStore` は v0.12.0 で `tauri::Builder::manage` 登録済みだが、production `Default::default()` は helper を解決できず、command surface も supervisor を呼ばないため gate-default-hidden 維持)
- 起動トリガーは最初の `probe_apple_assist_availability` または `generate_apple_assist_candidate` 呼び出し
- helper は long-lived: 同じ child を `AppleAssistHelperStore` の `Mutex<Option<Inner>>` に保持し、2 回目以降のリクエストは再 spawn せず stdin/stdout を使い回す
- 失敗 (EOF / IO error / timeout / spawn 失敗 / 未知 kind / parse 失敗) で `inner` を `None` に戻し、次回呼び出しで再 spawn
- 連続 5 回失敗で 5 分 cooldown。cooldown 中の probe / generate は即時 `Err` を返し、helper には触らない
- 成功すると `consecutive_failures = 0` + `cooldown_started_at = None` にリセット
- Tauri app 終了 → `AppleAssistHelperStore::drop` で `kill_child(&inner.child)` (kill_on_drop 相当)
- stderr は別 thread で `BufReader::read_line` ループを回して drain する (helper 側のパイプ詰まり防止)

**案 A → 案 B への変更理由 (slice 8 で確定)**:

- Foundation Models のロードは初回が大きく (~数百 ms)、2 回目以降は session 再利用で速い
- helper の stdin を keep-alive しても `isResponding` で concurrency gate すれば競合しない (live mode 側で将来 Swift 側に concurrency gate を入れる余地)
- 案 C (warm-up spawn) は App Store sandbox での常駐プロセス扱いが論点 (Guideline 2.4.2 "no unrelated background processes" に近くなる) ので採用しない

**timeout (slice 11 で実装)**:

- `const REQUEST_TIMEOUT: Duration = Duration::from_secs(15)` (fixture 動作は <100ms、live mode で数秒かかる想定に headroom)
- `round_trip_locked` 内で別 thread ("apple-assist-supervisor-watchdog") を `std::thread::Builder` で spawn し、`Condvar::wait_timeout` で 15s 待つ
- タイムアウト時に `Arc<AtomicBool>` に `timed_out = true` を立て、`Arc<Mutex<Child>>` 経由で child を kill する (kill が `read_line` を unblock する)
- main thread は `read_line` 復帰後に `done = true` + `cvar.notify_all()` → `watchdog.join()`
- タイムアウト時 `Err(format!("Apple Assist helper timed out after {}s", timeout.as_secs()))` を返し、`consecutive_failures` を +1 して 5 回到達で cooldown 入り

**stderr handling**:

- supervisor 側で別 thread に `BufReader::read_line` ループを回して drain する (現状の実装)
- 本番ログファイル (`~/Library/Logs/hazakura-editor/apple-assist-helper.log`) へのルーティングは slice 9 以降の別スライスで要実装

### 7. Concurrency policy

- supervisor は同期 API。`#[tauri::command] -> *_with_label` shim から呼ばれる前提
- helper への書き込みは `Mutex<Option<AppleAssistHelperInner>>` で直列化
- watchdog thread だけが outer mutex を bypass する (`Arc<Mutex<Child>>` 経由)
- 1 ユーザーが複数タブで同時に "Apple Assist" を起動しても、helper 側で直列化される
- 候補生成に 15s 近くかかった場合、2 番目の呼び出しは timeout を待ってから自分の round trip に入る
- busy 即時失敗 (案 A) は未実装。`is_in_flight: AtomicBool` を store に足して即時 `Err("Apple Assist is busy.")` を返す拡張で済む。Foundation Models live 経路で「待ち」が UX 的に許容できるか、本番で観察してから判断

### 8. Failure state / retry (実装済み)

- `consecutive_failures: AtomicU32` (SeqCst) と `cooldown_started_at: Mutex<Option<Instant>>` を `AppleAssistHelperStore` が持つ
- 失敗の種類ごとの扱い:
  - **process-level failure** (EOF / IO error / timeout / spawn 失敗 / 未知 kind / parse 失敗 / 期待外の envelope 種) → `reset_locked` + `record_failure`
  - **WireEnvelope::Error** (helper 自身が guardrail / validation / deferred / throttled を返した) → pass-through unchanged, no count, no reset
- 連続 5 回失敗で cooldown 状態に遷移 (`cooldown_started_at` を打刻)
- cooldown 中: probe / generate は即時 `Err("Apple Assist is currently unavailable. Try again in a moment.")` を返し、helper には触らない
- 5 分経過 → `cooldown_started_at.elapsed() >= 300s` で cooldown 解除。次の 1 回の試行で再カウントされる (連続 5 回失敗で再 cooldown に入る可能性はある)
- 1 回でも成功したら `consecutive_failures = 0` + `cooldown_started_at = None` にリセット
- 5 回失敗で再 cooldown に入ることを、テスト (`supervisor_does_not_count_helper_error_envelopes_as_failures`) で pin している

### 9. テスト方針

**Fixture mode (現状)**:

- `bash scripts/build-apple-assist-helper-fixture.sh` で fixture build + JSON-over-stdio smoke (probe→available, summarize→【要約案】\n...)
- 既存の `cargo test apple_assist` で Rust 側 stub の shape を固定
- 既存の `useAppleAssistCandidate.test.ts` で stub candidate → runCandidateCompare の handoff を固定
- Writing Companion 方向では、この handoff は基盤確認であり最終 UX ではない。直接 buffer edit を入れる場合は `docs/apple-local-assist-writing-companion-plan.md` の AI edit transaction 条件を満たす。

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

| 順番 | 内容 | 影響範囲 | 状態 |
|---|---|---|---|
| 1 | `IntentAllowlist.swift` の live mode 実装 (operation → instruction 文字列マッピング) | Swift | pending (gate-flip) |
| 2 | `AvailabilityProbe.swift` の live mode 実装 (4 状態 mapping) | Swift | pending (gate-flip) |
| 3 | `GenerateCandidate.swift` の live mode 実装 (LanguageModelSession) | Swift | pending (gate-flip) |
| 4 | `Package.swift` の `linkerFlags` 設定 (FoundationModels framework 自動 link 確認) | SwiftPM | pending (gate-flip) |
| 5 | `scripts/build-apple-assist-helper-fixture.sh` に `release` build ターゲットを追加 (明示承認後) | script | pending (明示承認) |
| 6 | Rust 側 `AppleAssistHelperStore` 導入 (案 B) | Rust | done slice 8 |
| 7 | supervisor に `REQUEST_TIMEOUT = 15s` watchdog を追加 | Rust | done slice 11 |
| 8 | supervisor に consecutive_failures / cooldown_started_at / protocol-violation detection を追加 | Rust | done slice 9 / 12 |
| 9 | `src-tauri/src/tests/apple_assist_supervisor.rs` 27 ケース (fixture + timeout script + protocol-violation script + resolver skeleton) | Rust test | done slice 9-18 |
| 10 | supervisor / live helper plan の docs sync | doc | done slice 13 |
| 11 | watchdog に "wait with predicate" 修正 (success path が timeout duration を待たない) | Rust | done slice 14 |
| 12 | success-path elapsed regression test (`timeout / 2` 以内で完了) | Rust test | done slice 14 |
| 13 | `tauri::Builder::manage(AppleAssistHelperStore::default())` を `lib.rs` に追加 | Rust | done v0.12.0 (登録済み、command surface は未到達) |
| 14 | `probe_apple_assist_availability_with_platform` を `probe_availability_via_helper` 経由に切替 (gate-default-hidden 解除) | Rust | pending (gate-flip スライス、明示承認待ち) |
| 15 | `useAppleAssistAvailability` の error handling を `Unavailable { reason: "..." }` 形に拡張 (probe 失敗時 detail を表示) | TS | pending (gate-flip) |
| 16 | `useAppleAssistCandidate` の error handling を error envelope kind ごとに分類 | TS | pending (gate-flip) |
| 17 | `docs/smoke-checklist.md` の Apple Local Assist セクションに live mode 項目追加 | doc | pending (gate-flip) |

## Open questions (明示承認待ち)

- **gate-flip の閾値と手順**: Foundation Models live binding (順序 1-4) と supervisor 経路の wire 化 (11 のみ) をどのスライスで行うか
- **`busy` 即時失敗 (案 A) を導入するか**: 現状は 2 番目の呼び出しが 1 番目の完了を待つ。Foundation Models live 経路で「待ち」が UX 的に許容できるか、本番で観察してから判断
- **timeout 値 15s の妥当性**: live mode で 15s を超える候補生成 (長文 proofread など) があれば上げる
- **cooldown 5 分 / 5 連続失敗の妥当性**: live mode で運用してから再評価
- **in-process 移行**: 今回 sidecar 継続を決めたが、App Store sandbox での sidecar spawn が想定外の挙動をした場合は再評価
- **streaming vs single-shot**: `streamResponse` の UX メリット (候補が段階的に表示される) と実装コスト (Rust 側で partial をどう Review Desk に渡すか) のトレードオフ

## 参照

- `docs/apple-local-assist-distribution-plan.md` — "Official Information Confirmed" セクション
- `docs/apple-local-assist-v0.12-design-review.md` — "残った不確実性" / 設計選択
- `docs/apple-local-assist-rust-supervisor-plan.md` — 実装済み Rust supervisor の詳細 (slice 8-18)
- `docs/apple-local-assist-helper-path-design.md` — bundled helper path 設計 (slice 16)
- `src-helpers/apple-assist/Sources/HazakuraAppleAssist/*.swift` — 現状の fixture / live コード
- `src-tauri/src/commands/apple_assist.rs` — Tauri command surface (slice 1-6 stub)
- `src-tauri/src/commands/apple_assist_supervisor.rs` — 実装済み supervisor (slice 8-18)
- `src-tauri/src/tests/apple_assist_supervisor.rs` — 27 ケースの integration test
- `scripts/build-apple-assist-helper-fixture.sh` — fixture build script
