# Apple Local Assist — Rust Supervisor 設計メモ

Status: Planning (post-slice-7)
Scope: v0.12+ `src-tauri/src/commands/apple_assist.rs` 周辺の Rust supervisor (helper sidecar 呼び出し層) の設計
Authority: Medium
Last reviewed: 2026-06-05

## 目的

`docs/apple-local-assist-live-helper-plan.md` で整理した live mode 設計のうち、**Rust 側** の設計判断をまとめる。helper の spawn / lifecycle / JSON 通信 / error mapping / fixture integration test 方針を扱う。実装は本スライスでは行わない。`tauri.conf.json` / `bundle.externalBin` / `minimumSystemVersion` / signing / entitlements は触らない。

## 現状 (slice 5〜6 時点)

`src-tauri/src/commands/apple_assist.rs` には helper を spawn する経路が **まだない**。現状の Rust 側:

- `probe_apple_assist_availability_with_label` → `ensure_label_is_main` 通過後、`probe_apple_assist_availability_with_platform()` を直接呼ぶ
- `probe_apple_assist_availability_with_platform()` → `#[cfg(target_os = "macos")]` で `Unavailable { reason: "..." }` を即時 return、non-macOS で `Unsupported` を即時 return
- `generate_apple_assist_candidate_with_label` → `ensure_label_is_main` 通過後、`validate_request` → `generate_apple_assist_candidate_with_stub` を直接呼ぶ
- `generate_apple_assist_candidate_with_stub` → `AppleAssistOperation` ごとに `【要約案】\n` 等の prefix を付けた candidate を即時 return

つまり **現状は Rust 側だけで完結する stub** で、helper sidecar はまだ spawn されていない。Slice 5 の `scripts/build-apple-assist-helper-fixture.sh` は `binaries/hazakura-apple-assist-helper-<triple>` に fixture binary を build するだけで、Rust 側からは呼ばれていない。

## live mode で必要になる Rust 側の変更

### 1. 新しい型: `AppleAssistHelperStore`

Tauri の `tauri::Builder::manage(AppleAssistHelperStore::default())` で State に注入。`State<'_, AppleAssistHelperStore>` を `#[tauri::command]` の引数で受け取る。

```rust
// src-tauri/src/commands/apple_assist.rs に追加 (v0.12.1+)

// Lazy-spawn holder for the helper sidecar. The store is
// behind a Mutex so concurrent Tauri commands serialize their
// access to the helper's stdin/stdout. The helper is killed
// on store drop (kill_on_drop) so Tauri app exit cleans it
// up.
pub(crate) struct AppleAssistHelperStore {
    inner: Arc<Mutex<Option<Child>>>,
}

impl AppleAssistHelperStore {
    pub fn new() -> Self {
        Self { inner: Arc::new(Mutex::new(None)) }
    }

    // Returns a live `Child` handle, spawning a new helper if
    // the previous one died. Resets to None on EOF, exit, or
    // timeout (the next call will respawn).
    pub async fn get_or_spawn(&self) -> Result<Child, String> { ... }

    // Send a request envelope and read one response envelope.
    // Returns the parsed `WireEnvelope` JSON.
    pub async fn round_trip(
        &self,
        request: &serde_json::Value,
    ) -> Result<serde_json::Value, String> { ... }
}
```

`tauri::Builder` への登録は `src-tauri/src/lib.rs` に追加:

```rust
.manage(apple_assist::AppleAssistHelperStore::new())
```

### 2. 新しいモジュール: `apple_assist::supervisor`

- `mod supervisor;` を `src-tauri/src/commands/apple_assist.rs` 内に追加
- 役割: helper sidecar の spawn / write / read / kill / retry ロジック
- `tokio::process::Command` を使う (Tauri 2 は tokio runtime)
- `tokio::io::AsyncBufReadExt::read_line` / `AsyncWriteExt::write_all` で JSON line 通信
- `tokio::time::timeout` で `Duration::from_secs(N)` ガード
- helper 発見: `Command::new("binaries/hazakura-apple-assist-helper-<rust-triple>")` を macOS のみ (`#[cfg(target_os = "macos")]`)。non-macOS では supervisor は compile されない (probe が `Unsupported` を返すので呼ばれない)

### 3. probe / generate command の改修

```rust
#[tauri::command]
pub(crate) fn probe_apple_assist_availability<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    store: tauri::State<'_, AppleAssistHelperStore>,
) -> Result<AppleAssistAvailability, String> {
    probe_apple_assist_availability_with_label(window.label(), &store)
}

pub(crate) fn probe_apple_assist_availability_with_label(
    label: &str,
    store: &AppleAssistHelperStore,
) -> Result<AppleAssistAvailability, String> {
    ensure_label_is_main(label)?;
    supervisor::probe_availability(store)  // async wrapper
}
```

`supervisor::probe_availability` は内部で `tokio::task::spawn_blocking` か async で `store.get_or_spawn().round_trip({action: "probe_availability"})` を呼ぶ。返ってきた JSON envelope を `AppleAssistAvailability` に deserialize して返す。

`generate_apple_assist_candidate_with_label` も同様に `store` を引数に取る。

### 4. probe のフォールバック

live mode 経路を追加しても、**`probe_apple_assist_availability_with_platform` の `Unavailable { reason }` / `Unsupported` を返す挙動は live mode が着地するまで維持する**。これは "gate-default-hidden" 契約 (design review section 10) の本体。

実装案:

```rust
pub(crate) async fn probe_availability(
    store: &AppleAssistHelperStore,
) -> Result<AppleAssistAvailability, String> {
    let request = serde_json::json!({"action": "probe_availability"});
    let response = store.round_trip(&request).await?;
    // envelope = {"kind": "availability", "value": {"kind": "<state>", "reason": ...}}
    let envelope: AppleAssistHelperEnvelope = serde_json::from_value(response)?;
    let availability: AppleAssistHelperAvailability = serde_json::from_value(envelope.value)?;
    Ok(map_helper_availability(availability))
}

fn map_helper_availability(
    helper: AppleAssistHelperAvailability,
) -> AppleAssistAvailability {
    match helper.kind.as_str() {
        "available" => AppleAssistAvailability::Available,
        "unavailable" => AppleAssistAvailability::Unavailable {
            reason: helper.reason.unwrap_or_default(),
        },
        "disabled" => AppleAssistAvailability::Disabled,
        "unsupported" => AppleAssistAvailability::Unsupported,
        // unknown kinds are treated as Unavailable with a reason
        // so the React side never sees a phantom Available.
        other => AppleAssistAvailability::Unavailable {
            reason: format!("Unknown availability kind from helper: {other}"),
        },
    }
}
```

**`Available` を受け取る条件**: live helper が `{"kind": "available", "reason": null}` を返したときのみ。これは live mode 着地後の最初のスライスで起こる。

### 5. generate のフォールバック

```rust
pub(crate) async fn generate_candidate(
    store: &AppleAssistHelperStore,
    request: &AppleAssistRequest,
) -> Result<AppleAssistResponse, String> {
    validate_request(request)?;
    let helper_request = serde_json::json!({
        "action": "generate_candidate",
        "operation": operation_to_string(request.operation),
        "selectedText": request.selected_text,
        "documentContext": request.document_context,
    });
    let response = store.round_trip(&helper_request).await?;
    let envelope: AppleAssistHelperEnvelope = serde_json::from_value(response)?;
    match envelope.kind.as_str() {
        "candidate" => serde_json::from_value(envelope.value).map_err(|e| e.to_string()),
        "error" => {
            let err: AppleAssistHelperError = serde_json::from_value(envelope.value)?;
            Err(format!("{} ({})", err.error, err.kind))
        }
        other => Err(format!("Unknown helper response kind: {other}")),
    }
}
```

### 6. Lifecycle / timeout / error handling

**Helper lifecycle**:

- 1 回目の呼び出し → `get_or_spawn` で spawn、helper の stdout / stderr を `BufReader` に wrap
- 2 回目以降 → 同じ helper を使い回し
- 失敗 (EOF / 非 0 exit / timeout) → 該当 child を kill、`None` に戻す。次回呼び出しで再 spawn
- 連続失敗 N 回 → `Unavailable { reason: "..." }` を返して N 分 cooldown
- Tauri app 終了 → `AppleAssistHelperStore` の drop で child を kill (`Child::kill()`)

**Timeout**:

- 1 リクエストあたりの timeout は `Duration::from_secs(15)` (要決定)
- timeout 発生時: `tokio::time::timeout` が `Err(Elapsed)` を返す → child を kill、`None` に戻す、`Err("Apple Assist timed out")` を返す

**JSON line parsing**:

- helper への write: `serde_json::to_string(&request)? + "\n"` を `child.stdin.write_all` に渡す
- helper からの read: `BufReader::new(child.stdout).read_line(&mut buf)` を 1 回。空行はスキップ
- 不正な JSON: `serde_json::from_str` が `Err` → その child を `None` に戻して再 spawn 次回 retry、`Err("Invalid response from Apple Assist")` を返す

**stderr handling**:

- helper の stderr は読み捨て (FileHandle を別 task で読んで捨てる)
- 本番: stderr 内容を `~/Library/Logs/hazakura-editor/apple-assist-helper.log` に追記 (Foundation Models 内部の診断情報を残せる)
- 開発: stderr をそのまま親の stderr に forward (console から見える)
- 環境変数 `HAZAKURA_APPLE_ASSIST_HELPER_LOG` でログファイルパス切替

**Malformed response**:

- JSON parse 失敗 → `None` に戻して再 spawn
- envelope kind が未知 → `Err("Unknown helper response kind: <kind>")` を 1 回だけ返し、`None` に戻して次回は再 spawn
- 連続して malformed が来る場合は timeout と同じ cooldown 処理

### 7. Concurrent request policy

- `AppleAssistHelperStore` 内部の `Mutex<Option<Child>>` でアクセス直列化
- 案 A: busy 即時失敗 → 2 番目の呼び出しは `Err("Apple Assist is busy")` を即時返す
- 案 B: 待ち → 1 番目の完了を待って 2 番目を実行 (timeout あり)
- 推奨: 案 A。理由:
  - 候補生成は 1〜数秒。1 秒待って 2 番目を実行するより、ユーザーに「今 busy」と伝えて再試行させるほうが UX として自然
  - 案 B は timeout をどちらの呼び出しに課すか問題 (合計 vs 個別) があり、複雑化する
- ユーザーが busy を見て retry するときは、command palette 項目を再度選択すれば良い

### 8. Failure state / retry

- 1 リクエスト失敗 = 1 つの child インスタンスが死んだ、とみなす
- `consecutive_failures: u32` を `AppleAssistHelperStore` に持つ
- 5 回連続失敗 → クールダウン状態に遷移
- クールダウン中: probe は `Unavailable { reason: "Apple Assist is currently unavailable. Try again in a moment." }` を返す
- 5 分経過 or 最後の成功から 5 分経過 → クールダウン解除
- 1 回でも成功したら `consecutive_failures = 0` にリセット

### 9. fixture helper integration test 方針

`bash scripts/build-apple-assist-helper-fixture.sh` で build される fixture binary は **テスト専用**。`binaries/` には gitignored として置かれる。テスト時に `cargo test` が fixture を spawn して Rust supervisor の end-to-end を検証する。

**テストファイル**: `src-tauri/src/tests/apple_assist_supervisor.rs` (新)

**テストケース**:

1. `supervisor_probe_via_fixture_returns_available`: fixture binary を spawn して probe → `AppleAssistAvailability::Available` が返る
2. `supervisor_generate_via_fixture_returns_prefixed_candidate`: fixture binary を spawn して `summarize` → `【要約案】\n...` を含む candidate
3. `supervisor_reuses_helper_across_requests`: 1 度 spawn した helper に 2 回リクエストを送り、spawn し直していないことを確認 (pid 比較)
4. `supervisor_kills_helper_after_oversized_input`: oversized `selectedText` (4001 chars) → helper が `validation` error envelope を返し、supervisor は `Err` を返す
5. `supervisor_respawns_after_helper_exit`: helper を `kill` してから次の probe → 新 pid で spawn
6. `supervisor_timeout_when_helper_hangs`: helper 側に `sleep(20)` を仕込んだテスト binary で 1s timeout → `Err("Apple Assist timed out")`
7. `supervisor_stderr_does_not_break_round_trip`: helper が stderr にログを書くテスト binary で、round trip は成功する
8. `supervisor_malformed_json_triggers_respawn`: helper が不正な JSON を返すテスト binary → 1 回失敗 → 次の probe で新 pid
9. `supervisor_concurrent_calls_are_serialized`: 2 並行で generate を呼び、helper 内部で直列化される (helper 側 pid は同じ、応答順序は不定)

**fixture 切り替え**: テストでは fixture binary をテスト用ディレクトリに build して、supervisor に discovery path を引数で渡す (production の `Command::new("binaries/...")` ではなく)。

```rust
// test helper
fn fixture_helper_path() -> PathBuf {
    let out = std::env::var("HAZAKURA_APPLE_ASSIST_HELPER_FIXTURE")
        .expect("Set HAZAKURA_APPLE_ASSIST_HELPER_FIXTURE to fixture binary path");
    PathBuf::from(out)
}
```

CI / ローカルで `cargo test` を回す前に `bash scripts/build-apple-assist-helper-fixture.sh` を実行してパスを export。

### 10. 既存 stub との共存

live mode 実装中も `generate_apple_assist_candidate_with_stub` は **残す**。これは:
- live mode が `unavailable` を返したときのフォールバックではない (Rust 側 stub は `Unavailable` を返している、generate には来ない)
- ユニットテストで prefix table を pin するため
- fixture helper と Rust stub の prefix が同じであることを assertion で確認するため

live mode 着地後の優先順位:

1. helper が応答 → それを返す
2. helper が `deferred` / `validation` / `internal` error envelope → error メッセージを返す
3. helper が起動できない / timeout / malformed → `Result::Err` を返す (`Unavailable` ではない、これは generate 経路なので)

`generate_apple_assist_candidate_with_stub` は **呼ばれなくなる** が、ユニットテストのため残す。

## 実装 plan

| 順番 | 内容 | 影響範囲 |
|---|---|---|
| 1 | `AppleAssistHelperStore` struct を `commands/apple_assist.rs` に追加 (Tauri State 登録はまだしない) | Rust |
| 2 | `supervisor` module を `commands/apple_assist.rs` 内に追加 (関数シグネチャのみ、`unimplemented!()` でもいい) | Rust |
| 3 | `probe_apple_assist_availability_with_label` / `generate_apple_assist_candidate_with_label` の引数に `store` を追加、body は stub のまま | Rust |
| 4 | 既存テスト (`src-tauri/src/tests/apple_assist.rs`) の呼び出しを新シグネチャに追随 | Rust |
| 5 | `tauri::Builder::manage(AppleAssistHelperStore::new())` を `src-tauri/src/lib.rs` に追加 | Rust |
| 6 | `tokio::process::Command` ベースで helper を spawn する最小実装 (probe のみ、generate は次スライス) | Rust |
| 7 | `src-tauri/src/tests/apple_assist_supervisor.rs` を追加 (fixture 経由の integration test) | Rust test |
| 8 | live mode が `Available` を返すようになったら、`probe_apple_assist_availability_with_platform` を helper 経由の probe に切替 | Rust |

## Open questions (明示承認待ち)

- **fixture binary の CI 配置**: GitHub Actions の macos runner (Apple Silicon) で fixture build + cargo test を回せるか。Foundation Models 実バインドの live mode テストは別 runner が必要
- **timeout 値**: 15 秒が妥当か、短い候補なら 5 秒でもよいか
- **連続失敗の上限とクールダウン**: 5 回 / 5 分、等の数値
- **2 番目の同時呼び出しの扱い**: busy 即時失敗が妥当か、ユーザーに「待っている」 progress を出す方がよいか
- **stderr ログのパス**: `~/Library/Logs/hazakura-editor/apple-assist-helper.log` で固定するか、`HAZAKURA_LOG_DIR` 環境変数で切替できるようにするか
- **既存の `generate_apple_assist_candidate_with_stub` を live mode 着地後に残すか削除するか**: テスト用に残すと保守対象が増える、削除すると prefix 同期の assertion が消える

## 参照

- `docs/apple-local-assist-live-helper-plan.md` — live mode 設計の Swift 側 / 共通事項
- `docs/apple-local-assist-distribution-plan.md` — "Official Information Confirmed" / 全体方針
- `docs/apple-local-assist-v0.12-design-review.md` — 設計選択 / gate 契約
- `src-tauri/src/commands/apple_assist.rs` — 現状の Rust stub
- `src-tauri/src/security/window_guard.rs` — `ensure_label_is_main` の gate ヘルパ
- `src-helpers/apple-assist/Sources/HazakuraAppleAssist/*.swift` — live mode 実装先
- `scripts/build-apple-assist-helper-fixture.sh` — fixture build script
