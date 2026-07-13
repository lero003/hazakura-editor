# Hazakura Local Assist — Rust Supervisor 設計メモ

Status: Implemented (slice 8-18, v0.12.0 still gate-default-hidden)
Scope: `src-tauri/src/commands/apple_assist_supervisor.rs` の helper sidecar 呼び出し層 (spawn / lifecycle / JSON 通信 / timeout / error mapping / fixture integration test)
Authority: Medium
Last reviewed: 2026-06-05

## 目的

`docs/apple-local-assist-live-helper-plan.md` で整理した live mode 設計のうち、**Rust 側 supervisor** の設計判断をまとめる。Slices 8-18 で実装済み: helper の spawn / lifecycle / JSON line 通信 / watchdog timeout / failure 集計 / cooldown / `WireEnvelope::Error` pass-through / protocol-violation 検出 / production helper-path resolver skeleton。Swift 側の `LanguageModelSession` 接続 (live mode 本体) は未着手。`tauri.conf.json` / `bundle.externalBin` / `minimumSystemVersion` / signing / entitlements は触らない。

> **用語注意**: 「supervisor 実装済み」 = helper spawn / lifecycle / JSON 通信 / timeout / cooldown / protocol-violation 検出が、Rust crate としてコードとテストで揃っているという意味。Foundation Models **live binding** は Swift 側で `LanguageModelSession` を呼ぶスライスで別建てで乗せるもので、本メモの範囲外 (未着手)。`tauri.conf.json` の `bundle.externalBin` も未設定なので、production `helper_path()` は `Err` を返し続け、command surface は supervisor を呼ばない。**「live binding 実装済み」 と読める表現は意図的に避けている**。

## 現状 (slice 18 時点)

### 構成

- `src-tauri/src/commands/apple_assist.rs` — Tauri command surface (slice 1-6 のまま)。`probe_apple_assist_availability_with_label` / `generate_apple_assist_candidate_with_label` は gate-default-hidden の in-process stub を呼ぶ (macOS → `Unavailable { reason }`、non-macOS → `Unsupported`)。**`Available` は絶対に返さない**。`probe_apple_assist_availability_with_platform` / `generate_apple_assist_candidate_with_stub` のコメントに「slice 9 で supervisor 経由の probe に切替」とあるが、本 slice 18 時点でも未着手 (gate-default-hidden 契約が優先)。
- `src-tauri/src/commands/apple_assist_supervisor.rs` — slice 8-18 で実装した supervisor 本体。`#![allow(dead_code)]` をモジュール先頭に置き、production の lib build が unused symbol で警告を出さないようにしてある (Tauri command surface から未到達のため)。
- `src-tauri/src/tests/apple_assist_supervisor.rs` — 27 ケースの integration test。fixture binary (slice 5 `scripts/build-apple-assist-helper-fixture.sh`) と、timeout / protocol-violation 用の小さな一時 shell script を組み合わせて supervisor を end-to-end で検証する。slice 18 で production helper-path resolver skeleton (triple / filename / not-configured) のテスト 6 ケースを追加。
- `src-helpers/apple-assist/` — SwiftPM executable。`.debug` が `-DFIXTURE_MODE` (probe → `available`、generate → `【要約案】\n...` 等の prefix)、`.release` は live mode スタブ (probe → `unsupported`、generate → `deferred` error envelope)。Foundation Models への live binding は未接続。
- `scripts/build-apple-assist-helper-fixture.sh` — `binaries/hazakura-apple-assist-helper-<triple>` に `.debug` build を作って JSON-over-stdio smoke を実行。テストはこのバイナリを spawn する。

### Tauri command surface と supervisor の関係

v0.12.0 の Tauri command surface は supervisor を **呼んでいない**。これは "gate-default-hidden" 契約 (design review section 10) の本体。supervisor 側だけが完成していても、command body は依然として `Unavailable { reason }` を返すので、UI 側 (command palette) は Hazakura Local Assist 項目を出さない。

`AppleAssistHelperStore` は `tauri::Builder::manage(AppleAssistHelperStore::default())` で **登録済み** (`src-tauri/src/lib.rs` 参照)。登録しておいても無害な理由:
- `Default::default()` は environment を一切読まない。env-var ベースの override は `store_with_helper_path` / `store_without_helper` という `cfg(test)` 専用 API のみで、production の `Default::default()` 経路には存在しない。これにより「将来 `*_FIXTURE` env var を立てると勝手に helper が spawn される」事故を構造的に防ぐ。
- `helper_path()` は production 経路では常に `Err("Hazakura Local Assist helper is not configured for this build.")` を返す。store を `manage` した瞬間に何か spawn される事故は起きない (`spawn_locked` はこの `Err` をそのまま伝搬する)。
- supervisor 経路を Tauri command body から呼び出すのは gate-flip スライスで、明示承認が必要。それまでは store は Tauri 状態として存在するが誰も触らない。

## 実装済み supervisor の設計

### 1. `AppleAssistHelperStore`

`src-tauri/src/commands/apple_assist_supervisor.rs` に定義。`Default::default()` コンストラクタ。production の lib build 経路からは `helper_path()` が常に `Err("Hazakura Local Assist helper is not configured for this build.")` を返すので、store を `manage` した瞬間に何か spawn される事故は起きない。

```rust
pub(crate) struct AppleAssistHelperStore {
    inner: Mutex<Option<AppleAssistHelperInner>>,
    consecutive_failures: AtomicU32,
    cooldown_started_at: Mutex<Option<std::time::Instant>>,
    #[cfg(test)] helper_path_override: Option<std::path::PathBuf>,
    #[cfg(test)] timeout_override: Option<Duration>,
    #[cfg(test)] consecutive_failures_for_test: AtomicU32,
}
```

`Drop` impl: `inner` を `take()` して `kill_child(&inner.child)` (best-effort kill+wait)。`Child` を `Arc<Mutex<Child>>` で包んでいるのは watchdog thread が main thread の outer mutex を保持したまま child を kill できるようにするため。

### 2. モジュール配置

`src-tauri/src/commands/apple_assist.rs` 内の sub-module ではなく、独立したファイル `src-tauri/src/commands/apple_assist_supervisor.rs` に置いた。`mod apple_assist_supervisor;` を `commands/mod.rs` から外側 (`lib.rs`) で宣言し、`commands::apple_assist_supervisor::...` として Tauri 側からも参照できる構造。

**Tokio は採用しなかった**。理由:
- 1 リクエスト 1 round trip のみで、tokio runtime 上で `spawn_blocking` を経由する設計は supervisor に tokio 依存を強制し、テストもしにくくなる
- `std::sync::{Arc, Condvar, Mutex}` + `std::thread::Builder` だけで watchdog も timeout も表現できる
- 既存の Tauri command surface は `#[tauri::command] -> *_with_label` の同期 shim パターンなので、supervisor も同期 API に揃える方が一貫する

### 3. probe / generate 経路

```rust
pub(crate) fn probe_availability_via_helper(
    store: &AppleAssistHelperStore,
) -> Result<WireEnvelope, String> {
    if store.is_in_cooldown() {
        return Err("Hazakura Local Assist is currently unavailable. Try again in a moment.".to_string());
    }
    let mut guard = store.inner.lock().expect("helper store lock");
    if guard.is_none() {
        store.spawn_locked(&mut guard)?;
    }
    let timeout = store.effective_timeout();
    let result = AppleAssistHelperStore::round_trip_locked(
        guard.as_mut().expect("just spawned"),
        &WireRequest::ProbeAvailability,
        timeout,
    );
    match &result {
        Ok(WireEnvelope::Availability(_)) => store.record_success(),
        Ok(WireEnvelope::Error(_)) => {} // pass through; helper refused, not a process failure
        Ok(WireEnvelope::Candidate(_)) => { store.reset_locked(&mut guard); store.record_failure(); }
        Err(_) => { store.reset_locked(&mut guard); store.record_failure(); }
    }
    result
}
```

`generate_candidate_via_helper` も同じ構造で、`WireRequest::GenerateCandidate { operation, selected_text, document_context }` を送る。`Ok(WireEnvelope::Availability(_))` が返ったら protocol violation として reset+count。

`is_in_cooldown()` は `consecutive_failures >= 5` かつ `cooldown_started_at` から 5 分以内なら `true`。cooldown 中の probe / generate は即時 `Err("Hazakura Local Assist is currently unavailable. Try again in a moment.")` を返し、helper には触らない。

### 4. Wire types

`src-helpers/apple-assist/Sources/.../Response.swift` の Swift JSONEncoder 出力と lockstep した serde envelope:

```rust
#[derive(Debug, Serialize)]
#[serde(tag = "action", rename_all = "snake_case")]
enum WireRequest<'a> {
    ProbeAvailability,
    #[serde(rename_all = "camelCase")]
    GenerateCandidate {
        operation: &'a str,
        selected_text: &'a str,
        #[serde(skip_serializing_if = "Option::is_none")]
        document_context: Option<&'a str>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "kind", content = "value", rename_all = "snake_case")]
pub(crate) enum WireEnvelope {
    Availability(HelperAvailability),
    Candidate(HelperCandidate),
    Error(HelperError),
}
```

camelCase の `selectedText` / `documentContext` が Swift 側と一致する。`envelope.kind` / `envelope.value` も Swift の `WireEnvelope.kind` / `WireEnvelope.value` と一致。

### 5. Lifecycle / timeout / error handling (実装済み)

**Helper lifecycle**:
- 1 回目の呼び出し → `spawn_locked` で spawn。`stdin` / `stdout` を `piped` で取り、`stderr` は別スレッドで `BufReader::read_line` ループを回して drain する (helper が stderr にいっぱい書いても pipe が詰まらないように)。
- 2 回目以降 → 同じ child を使い回し (`inner.is_none()` なら spawn、そうでなければ既存を再利用)。
- 失敗 (EOF / IO error / timeout / spawn 失敗 / 未知 kind / parse 失敗) → `reset_locked` で child を kill、inner slot を `None` に戻す。次回呼び出しで再 spawn。
- Tauri app 終了 → `Drop::drop` で `kill_child(&inner.child)`。`kill_on_drop` 相当。
- 連続失敗 5 回 → 5 分 cooldown。cooldown 中の probe / generate は即時 `Err`。成功すると `consecutive_failures = 0` + `cooldown_started_at = None` にリセット。

**Timeout — 15s watchdog**:
- `const REQUEST_TIMEOUT: Duration = Duration::from_secs(15)` (fixture 動作は <100ms、live mode で数秒かかる想定に headroom)。
- `round_trip_locked` 内で `Arc<(Mutex<bool>, Condvar)>` と `Arc<AtomicBool>` を共有し、別スレッド ("apple-assist-supervisor-watchdog") を `std::thread::Builder` で spawn。
- main thread は `inner.stdout.read_line(&mut line)` で blocking。watchdog は `cvar.wait_timeout(lock, timeout)` で待機し、タイムアウト時に `timed_out.store(true)` + `kill_child(&child_arc)`。kill が `read_line` を `Ok(0)` (EOF) または `Err` で unblock する。
- main thread は `read_line` 復帰後、`done = true` + `cvar.notify_all()` → `watchdog.join()`。`timed_out.load()` なら `Err(format!("Hazakura Local Assist helper timed out after {}s", timeout.as_secs()))` で即時 return。
- `child_arc: Arc<Mutex<Child>>` で outer mutex を保持したままでも watchdog が kill できる構造。`kill_child` 内部で `child.kill()` + `child.wait()` を best-effort で実行。

**JSON line parsing**:
- write: `serde_json::to_string(request)` + `write_all("\n")` + `flush`。`BufReader::read_line` は newline まで読んで消費する。
- read: 1 リクエスト 1 ライン。`line.is_empty()` は EOF (helper 終了 / pipe 切断) → `Err("Hazakura Local Assist helper closed the response stream.")`。
- parse: `serde_json::from_str(&line)` の `Err` → `Err(format!("Failed to parse helper response: {e} (raw: {line:?})"))`。raw を含めるのは fixture と live の形状ずれをデバッグしやすくするため。

**stderr handling**:
- helper の stderr は supervisor 側で drain する。FileHandle を別 thread に渡し、`BufReader::read_line` ループで読み捨てる (本番ログファイルへのルーティングは slice 9 以降で別途)。
- fixture / live どちらの helper も stderr に fatal なログを残す設計ではない前提で、drain のみ。

**Malformed / unexpected response**:
- JSON parse 失敗 / envelope kind が期待値以外 (probe → `Candidate`、generate → `Availability`) → `reset_locked` + `record_failure`。
- envelope kind が未知 (例: `{"kind": "banana"}`) → 同上。
- `WireEnvelope::Error` (helper 自身が guardrail / validation / deferred / throttled を返した) → **pass through unchanged, no count, no reset**。「正直に 5 回 refused しただけで helper を殺す」のは本末転倒なので、cooldown 集計には入れない。
- 連続して malformed が来る場合 → 5 回で cooldown。`record_failure` が `consecutive_failures` を見て 5 回到達で `cooldown_started_at` を打刻。

### 6. Concurrent request policy

- `AppleAssistHelperStore.inner` の `Mutex<Option<...>>` でアクセス直列化。watchdog thread だけが outer mutex を bypass する (`Arc<Mutex<Child>>` 経由)。
- busy 即時失敗 (案 A) は **未実装**。現状は Tauri command handler 内で 1 つずつ直列化される前提で、2 番目の呼び出しは 1 番目の完了 (or timeout) を待つ。busy 判定を追加したくなったら、`is_in_flight: AtomicBool` を store に足して即時 `Err("Hazakura Local Assist is busy.")` を返す拡張で済む。
- 候補生成は fixture なら <100ms、live なら数秒程度を想定。timeout 15s に収まれば 2 番目も 2 周目で応答する想定。

### 7. Failure state / retry (実装済み)

- `consecutive_failures: AtomicU32` (SeqCst) と `cooldown_started_at: Mutex<Option<Instant>>` を store が持つ。
- `record_failure`: `fetch_add(1) + 1` を取得し、5 回到達で cooldown を開始。
- `record_success`: `consecutive_failures = 0` + `cooldown_started_at = None`。
- cooldown 中の `is_in_flight` チェック: `is_in_cooldown()` で「5 回失敗 AND 経過 < 5 分」を判定。
- 5 分経過 → `consecutive_failures` はそのまま (5 のまま) だが、`cooldown_started_at.elapsed() >= 300s` で cooldown 解除、次の 1 回の試行で再カウントされる。連続 5 回失敗で再 cooldown に入る可能性はある (5 分クールダウンを 1 発ずつ消費する設計)。

### 8. fixture helper integration test 方針 (実装済み)

`src-tauri/src/tests/apple_assist_supervisor.rs` の 27 ケース。fixture binary (`scripts/build-apple-assist-helper-fixture.sh` で build) と、timeout / protocol-violation 用の小さな一時 shell script を `std::env::temp_dir()` に書き出して使う。

**テストヘルパー**:
- `fixture_helper_path_or_skip()` → `HAZAKURA_APPLE_ASSIST_HELPER_FIXTURE` env var を読む。未設定なら `cargo test` の前提条件として skip。
- `sleep_helper_script_or_skip(suffix: &str)` → `#!/bin/sh\nread -r _request\nsleep 5` を一時ファイルに書く。timeout テスト専用。
- `respond_with_script(body: &str, suffix: &str)` → fixture と同じ wire protocol で 1 リクエスト 1 レスポンスの小さな shell を書く。protocol-violation テスト用。
- `store_with_helper_path_override(...)` → `cfg(test)` の `store_with_helper_path` 経由で fixture / script の path を注入。
- `with_timeout_override(200ms)` → 15s ではなく 200ms で timeout 経路を即時検証。

**テストケース (実装済み 27 個)**:

| ケース | 検証内容 |
|---|---|
| `supervisor_store_default_constructs_cleanly` | `Default::default()` で warning なし、consecutive_failures = 0、cooldown_started_at = None |
| `supervisor_store_default_ignores_fixture_env_var` | env var が立っていても production `Default` は読まない (gate-default-hidden 強化テスト) |
| `supervisor_store_with_missing_helper_path_reports_missing_file` | 存在しない path を `store_with_helper_path` に渡すと spawn 時に `Err("...missing file...")` |
| `supervisor_store_without_helper_reports_not_configured` | `store_without_helper` の `helper_path()` が `Err("...not configured...")` |
| `supervisor_probe_without_helper_returns_err_quickly` | `store_without_helper` で probe → `Err`、consecutive_failures は 0 のまま (cooldown 経路に入らない) |
| `supervisor_generate_without_helper_returns_err_quickly` | 同上、generate 側 |
| `supervisor_probe_via_fixture_returns_available` | fixture binary を spawn して probe → `WireEnvelope::Availability { kind: "available", reason: None }`、consecutive_failures = 0 |
| `supervisor_generate_summarize_via_fixture_returns_prefixed_candidate` | fixture + `summarize` → `WireEnvelope::Candidate { candidate_text: "【要約案】\n...", ... }` |
| `supervisor_generate_rephrase_via_fixture_returns_prefixed_candidate` | 同上、rephrase |
| `supervisor_generate_deferred_operation_via_fixture_returns_error_envelope` | fixture + `extract` (deferred) → `WireEnvelope::Error { kind: "deferred" }`、**consecutive_failures = 0** (Error は pass-through) |
| `supervisor_does_not_count_helper_error_envelopes_as_failures` | probe で 5 回連続 `Error` を返しても cooldown に入らない |
| `supervisor_reuses_helper_across_multiple_requests` | probe → generate → probe → generate と 4 連発しても `inner` slot は同じ child を保持 (`inner_is_empty() == false` かつ pid 比較) |
| `supervisor_handles_mixed_request_types_in_sequence` | 1 つの helper で probe → generate → probe を順に処理、それぞれ期待 envelope を返す |
| `supervisor_passes_document_context_to_helper` | `generate_candidate_via_helper` に `Some("<context>")` を渡すと helper 側 (echo script) が context を受け取る |
| `supervisor_round_trip_times_out_when_helper_hangs` | `sleep 5` script + 200ms override → `Err("...timed out after 0s")` (timeout 経路)、consecutive_failures = 1 |
| `supervisor_timeout_does_not_pile_up_zombie_children` | timeout 後に `inner_is_empty() == true`、続けて 2 回目の timeout も同じ helper に対し発火 (pid 比較) |
| `supervisor_probe_treats_candidate_envelope_as_protocol_violation` | probe に対して `WireEnvelope::Candidate` を返す script → `Err`、reset_locked、consecutive_failures = 1 |
| `supervisor_generate_treats_availability_envelope_as_protocol_violation` | generate に対して `WireEnvelope::Availability` を返す script → `Err`、reset_locked、consecutive_failures = 1 |
| `supervisor_treats_malformed_json_response_as_failure` | helper が `not-json-at-all` を返す → `Err`、reset_locked、consecutive_failures = 1 |
| `supervisor_treats_eof_response_as_failure` | helper が stdin を read して即 `exit 0` → `Err("...closed the response stream...")`、reset_locked、consecutive_failures = 1 |
| `supervisor_fast_success_does_not_wait_full_timeout_duration` | fixture + 500ms override → probe は `timeout / 2` 以内で完了 (success path が timeout duration をリークしない watch-dog 修正の回帰防止) |

**fixture 切り替え**: テストは `HAZAKURA_APPLE_ASSIST_HELPER_FIXTURE` env var 経由で fixture binary の path を渡す。production の `helper_path()` は env var を一切読まない (test-only override slot のみが env を参照)。

**並列実行の前提**: cargo test は複数 thread で同時に走るので、timeout / protocol-violation 用の一時 shell script は `format!("hazakura-apple-assist-test-...-{suffix}.sh")` で test 名 suffix 付きにし、衝突しない path を使う。cleanup は行わない (OS 任せ)。

### 9. 既存 stub との共存 (実装済み)

`generate_apple_assist_candidate_with_stub` は **残す**。これは:
- supervisor 経路が完成しても、Tauri command surface はまだ stub を呼ぶので production 経路として使われる (slice 1-6 のまま)
- ユニットテストで prefix table を pin するため
- supervisor 経路が live mode で着地した後も、stub はユニットテスト用途に残る (Rust 側 prefix と Swift 側 fixture prefix の同期 assertion)

production で supervisor 経路が呼ばれるようになるのは、`probe_apple_assist_availability_with_platform` の body を `probe_availability_via_helper` に切り替えるスライス。これは gate-default-hidden 契約を解除する gate-flip スライスなので、明示承認が必要。

## 実装 plan (参考 — slice 8-18 で現行項目完了)

| 順番 | 内容 | 状態 |
|---|---|---|
| 1 | `AppleAssistHelperStore` struct を `commands/apple_assist_supervisor.rs` に追加 | done slice 8 |
| 2 | Wire types (`WireRequest` / `WireEnvelope` / `HelperAvailability` / `HelperCandidate` / `HelperError`) を追加 | done slice 8 |
| 3 | `spawn_locked` / `reset_locked` / `round_trip_locked` (timeout なし版) を実装 | done slice 8 |
| 4 | `probe_availability_via_helper` / `generate_candidate_via_helper` を実装、match 枝で `record_success` / `record_failure` | done slice 8-9 |
| 5 | consecutive_failures / cooldown_started_at / `is_in_cooldown` / `record_failure` / `record_success` を追加 | done slice 9 |
| 6 | `src-tauri/src/tests/apple_assist_supervisor.rs` を追加 (fixture 経由の integration test) | done slice 9 |
| 7 | protocol-violation regression test (Candidate-on-probe, Availability-on-generate, malformed JSON, EOF) | done slice 12 |
| 8 | `round_trip_locked` に `REQUEST_TIMEOUT = 15s` watchdog を追加 (`Condvar::wait_timeout` + `Arc<Mutex<Child>>` + `Arc<AtomicBool>`) | done slice 11 |
| 9 | `timeout_override` を `cfg(test)` で追加、timeout regression test 2 ケース | done slice 11 |
| 10 | supervisor / live helper plan の docs sync | done slice 13 |
| 11 | `tauri::Builder::manage(AppleAssistHelperStore::default())` を `lib.rs` に追加 | done v0.12.0 (登録済み、command surface は未到達) |
| 12 | watchdog に "wait with predicate" 修正 (success path が timeout duration を待たない) | done slice 14 |
| 13 | success-path elapsed regression test (`timeout / 2` 以内で完了) | done slice 14 |
| 14 | `probe_apple_assist_availability_with_platform` を `probe_availability_via_helper` 経由に切替 (gate-default-hidden 解除) | pending (gate-flip スライス、明示承認待ち) |

## Open questions (明示承認待ち)

- **gate-flip の閾値と手順**: 順序 14 をどのスライスで行うか。Foundation Models live binding が先か、`probe_apple_assist_availability_with_platform` の body 切替 (14) が先か。順序 11 (`Builder::manage`) は v0.12.0 で **既に登録済み** — Tauri 状態として存在するが command surface から未到達なので gate-default-hidden は維持される
- **`busy` 即時失敗 (案 A) を導入するか**: 現状は 2 番目の呼び出しが 1 番目の完了を待つ。Foundation Models live 経路で「待ち」が UX 的に許容できるか、本番で観察してから判断
- **stderr のルーティング**: 本番で `~/Library/Logs/hazakura-editor/apple-assist-helper.log` に書くか、stdout に forward するか (現状は drain のみ)
- **timeout 値 15s の妥当性**: live mode で 15s を超える候補生成 (長文 proofread など) があれば上げる
- **cooldown 5 分 / 5 連続失敗の妥当性**: live mode で運用してから再評価
- **既存 `generate_apple_assist_candidate_with_stub` の削除タイミング**: live mode 着地後、prefix 同期 assertion をどう担保するか

## 参照

- `docs/apple-local-assist-live-helper-plan.md` — live mode 設計の Swift 側 / 共通事項
- `docs/archive/planning/apple-local-assist-helper-path-design.md` — bundled helper path 設計 (slice 16) / production 経路の差替先
- `docs/archive/planning/apple-local-assist-distribution-plan.md` — "Official Information Confirmed" / 全体方針
- `docs/apple-local-assist-v0.12-design-review.md` — 設計選択 / gate 契約
- `src-tauri/src/commands/apple_assist.rs` — Tauri command surface (slice 1-6 stub)
- `src-tauri/src/commands/apple_assist_supervisor.rs` — 実装済み supervisor 本体 (slice 8-18、resolver skeleton は slice 17)
- `src-tauri/src/tests/apple_assist_supervisor.rs` — 27 ケースの integration test
- `src-tauri/src/security/window_guard.rs` — `ensure_label_is_main` の gate ヘルパ
- `src-helpers/apple-assist/Sources/HazakuraAppleAssist/*.swift` — Swift 側 (fixture / live)
- `scripts/build-apple-assist-helper-fixture.sh` — fixture build script
