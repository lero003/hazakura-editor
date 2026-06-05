// Apple Local Assist — Rust supervisor.
//
// This is the v0.12.1+ scaffolding for calling the Swift helper
// sidecar at `binaries/hazakura-apple-assist-helper-<rust-triple>`.
// The supervisor owns the helper process lifecycle, the
// JSON-over-stdio wire protocol, and the failure / retry state.
//
// v0.12.0 wiring note (CRITICAL — gate-default-hidden):
// The supervisor is REACHABLE from tests, but the Tauri command
// surface in `commands::apple_assist` still calls the in-process
// stub `probe_apple_assist_availability_with_platform` /
// `generate_apple_assist_candidate_with_stub`. These return
// `Unavailable { reason }` on macOS and `Unsupported` on other
// platforms; they never return `Available`. This preserves the
// "gate-default-hidden" contract documented in
// `docs/apple-local-assist-v0.12-design-review.md` section 10
// while a future slice wires the supervisor into the command
// body.
//
// Because the supervisor is intentionally unused in the live
// command surface, every symbol below would trip `dead_code` in
// the lib build. The integration tests in
// `src-tauri/src/tests/apple_assist_supervisor.rs` are the only
// callers today; `#![allow(dead_code)]` keeps the lib build
// warning-free until a future slice wires this into the live
// command body.
//
// The shape mirrors the `AgentWorkbenchSessionStore` pattern in
// `crate::types` and `crate::agent`: a `Default` store with a
// `Drop` impl that kills the child, a mutex over the optional
// `Child`, and `consecutive_failures: AtomicU32` for the cooldown
// state. Tests construct a store directly and exercise the
// supervisor via `probe_availability_via_helper` and
// `generate_candidate_via_helper`.

#![allow(dead_code)]

use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Mutex;
use std::time::Duration;

/// Maximum number of consecutive helper failures before the
/// supervisor enters cooldown. After this many failures, probe
/// returns `Unavailable { reason: "Apple Assist is currently
/// unavailable. Try again later." }` until the cooldown expires.
const CONSECUTIVE_FAILURE_LIMIT: u32 = 5;
/// How long the cooldown lasts once the failure limit is hit.
const COOLDOWN_DURATION: Duration = Duration::from_secs(300);
/// Per-request timeout. The Swift helper in fixture mode returns
/// in <100ms; live mode will be a few seconds. 15s gives plenty
/// of headroom while still surfacing a stuck helper quickly.
/// Enforced by a future slice that adds a worker-thread channel
/// around `read_line`; the `std::process::ChildStdout::read_line`
/// path used today does not enforce it. Kept as a const so the
/// budget is one place to change.
#[allow(dead_code)]
const REQUEST_TIMEOUT: Duration = Duration::from_secs(15);

/// The store is held by Tauri via `tauri::Builder::manage(...)`.
/// In v0.12.0 it is registered but the command surface does not
/// use it; in v0.12.1+ it will be threaded through the Tauri
/// commands.
pub(crate) struct AppleAssistHelperStore {
    inner: Mutex<Option<AppleAssistHelperInner>>,
    consecutive_failures: AtomicU32,
    cooldown_started_at: Mutex<Option<std::time::Instant>>,
    // The path the supervisor spawns. Held here so tests can
    // override it via the `HAZAKURA_APPLE_ASSIST_HELPER_FIXTURE`
    // env var without changing the API.
    helper_path_override: Option<std::path::PathBuf>,
}

struct AppleAssistHelperInner {
    child: Child,
    stdin: ChildStdin,
    stdout: BufReader<ChildStdout>,
}

impl Default for AppleAssistHelperStore {
    fn default() -> Self {
        let helper_path_override =
            std::env::var_os("HAZAKURA_APPLE_ASSIST_HELPER_FIXTURE").map(std::path::PathBuf::from);
        Self {
            inner: Mutex::new(None),
            consecutive_failures: AtomicU32::new(0),
            cooldown_started_at: Mutex::new(None),
            helper_path_override,
        }
    }
}

impl Drop for AppleAssistHelperStore {
    fn drop(&mut self) {
        if let Ok(mut guard) = self.inner.lock() {
            if let Some(mut inner) = guard.take() {
                let _ = inner.child.kill();
                let _ = inner.child.wait();
            }
        }
    }
}

impl AppleAssistHelperStore {
    /// Returns the path the supervisor will spawn, or an error
    /// if no helper is available. In test runs, the
    /// `HAZAKURA_APPLE_ASSIST_HELPER_FIXTURE` env var points at
    /// the fixture binary built by
    /// `scripts/build-apple-assist-helper-fixture.sh`. In
    /// production, this helper is not yet wired to a real binary
    /// (slice 5 fixture path is dev-only), so callers fall back
    /// to the in-process stub.
    pub(crate) fn helper_path(&self) -> Result<std::path::PathBuf, String> {
        if let Some(path) = &self.helper_path_override {
            if path.exists() {
                return Ok(path.clone());
            }
            return Err(format!(
                "HAZAKURA_APPLE_ASSIST_HELPER_FIXTURE points at a missing file: {}",
                path.display()
            ));
        }
        // Production: no externalBin / no minimumSystemVersion bump
        // yet, so the supervisor cannot resolve a real binary.
        Err("Apple Assist helper is not configured for this build.".to_string())
    }

    fn reset_locked(&self, inner_slot: &mut Option<AppleAssistHelperInner>) {
        if let Some(mut inner) = inner_slot.take() {
            let _ = inner.child.kill();
            let _ = inner.child.wait();
        }
    }

    fn spawn_locked(&self, inner_slot: &mut Option<AppleAssistHelperInner>) -> Result<(), String> {
        let path = self.helper_path()?;
        let mut command = Command::new(&path);
        command
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        let mut child = command
            .spawn()
            .map_err(|e| format!("Failed to spawn Apple Assist helper: {e}"))?;
        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| "Apple Assist helper stdin is not piped.".to_string())?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "Apple Assist helper stdout is not piped.".to_string())?;
        // Drain stderr in a background thread. The Swift helper
        // reserves stderr for log lines only (encode failures,
        // diagnostic notices). The Rust supervisor never parses
        // stderr; draining it prevents a full pipe from blocking
        // the helper if it ever decides to log more than one
        // buffer's worth. Slice 9+ may route this to a log file in
        // ~/Library/Logs/hazakura-editor/.
        if let Some(stderr) = child.stderr.take() {
            std::thread::spawn(move || {
                let mut reader = BufReader::new(stderr);
                let mut sink = String::new();
                while let Ok(n) = reader.read_line(&mut sink) {
                    if n == 0 {
                        break;
                    }
                    sink.clear();
                }
            });
        }
        *inner_slot = Some(AppleAssistHelperInner {
            child,
            stdin,
            stdout: BufReader::new(stdout),
        });
        Ok(())
    }

    fn round_trip_locked(
        inner_slot: &mut Option<AppleAssistHelperInner>,
        request: &WireRequest<'_>,
    ) -> Result<WireEnvelope, String> {
        let inner = inner_slot
            .as_mut()
            .ok_or_else(|| "Apple Assist helper is not running.".to_string())?;

        let serialized = serde_json::to_string(request)
            .map_err(|e| format!("Failed to serialize helper request: {e}"))?;
        inner
            .stdin
            .write_all(serialized.as_bytes())
            .map_err(|e| format!("Failed to write to helper stdin: {e}"))?;
        inner
            .stdin
            .write_all(b"\n")
            .map_err(|e| format!("Failed to write newline to helper stdin: {e}"))?;
        inner
            .stdin
            .flush()
            .map_err(|e| format!("Failed to flush helper stdin: {e}"))?;

        let mut line = String::new();
        inner
            .stdout
            .read_line(&mut line)
            .map_err(|e| format!("Failed to read helper response: {e}"))?;
        if line.is_empty() {
            return Err("Apple Assist helper closed the response stream.".to_string());
        }
        serde_json::from_str(&line)
            .map_err(|e| format!("Failed to parse helper response: {e} (raw: {line:?})"))
    }

    fn is_in_cooldown(&self) -> bool {
        if self.consecutive_failures.load(Ordering::SeqCst) < CONSECUTIVE_FAILURE_LIMIT {
            return false;
        }
        let started_at = match *self.cooldown_started_at.lock().expect("cooldown lock") {
            Some(instant) => instant,
            None => return false,
        };
        started_at.elapsed() < COOLDOWN_DURATION
    }

    fn record_failure(&self) {
        let count = self.consecutive_failures.fetch_add(1, Ordering::SeqCst) + 1;
        if count == CONSECUTIVE_FAILURE_LIMIT {
            if let Ok(mut started_at) = self.cooldown_started_at.lock() {
                *started_at = Some(std::time::Instant::now());
            }
        }
    }

    fn record_success(&self) {
        self.consecutive_failures.store(0, Ordering::SeqCst);
        if let Ok(mut started_at) = self.cooldown_started_at.lock() {
            *started_at = None;
        }
    }
}

// -- Wire types (must match Swift helper's WireEnvelope) -------
//
// The Swift side uses Swift JSONEncoder defaults: camelCase field
// names and a tagged envelope of the shape
// `{"kind": "<tag>", "value": {<payload>}}`. The serde attributes
// below mirror that exactly. Keep them in lockstep with the
// Swift types in `src-helpers/apple-assist/Sources/.../Response.swift`
// and the dispatch in `main.swift`.

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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub(crate) struct HelperAvailability {
    pub(crate) kind: String,
    pub(crate) reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct HelperCandidate {
    pub(crate) operation: String,
    pub(crate) candidate_text: String,
    pub(crate) model_id: String,
    pub(crate) latency_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub(crate) struct HelperError {
    pub(crate) error: String,
    pub(crate) kind: String,
}

// -- Public probe / generate entry points ---------------------

/// Probe Foundation Models availability via the helper sidecar.
/// The store handles spawn / reuse / reset / failure counting.
///
/// In v0.12.0 this function exists and is tested, but the Tauri
/// command surface in `commands::apple_assist` does NOT call it.
/// The command surface still returns the gate-default-hidden
/// `Unavailable { reason }` to keep the UI hidden until live mode
/// is wired. Slice 9 design note: the body in
/// `probe_apple_assist_availability_with_platform` flips to call
/// this in a future slice, gated on the helper being available.
pub(crate) fn probe_availability_via_helper(
    store: &AppleAssistHelperStore,
) -> Result<WireEnvelope, String> {
    if store.is_in_cooldown() {
        return Err("Apple Assist is currently unavailable. Try again in a moment.".to_string());
    }

    let mut guard = store.inner.lock().expect("helper store lock");
    if guard.is_none() {
        store.spawn_locked(&mut guard)?;
    }

    let result =
        AppleAssistHelperStore::round_trip_locked(&mut guard, &WireRequest::ProbeAvailability);

    match &result {
        Ok(_) => store.record_success(),
        Err(_) => {
            store.reset_locked(&mut guard);
            store.record_failure();
        }
    }
    result
}

/// Generate a candidate via the helper sidecar. The store
/// handles spawn / reuse / reset / failure counting. Returns
/// the raw envelope; the caller maps it to
/// `crate::commands::apple_assist::AppleAssistResponse` or
/// `Result::Err`.
pub(crate) fn generate_candidate_via_helper(
    store: &AppleAssistHelperStore,
    operation: &str,
    selected_text: &str,
    document_context: Option<&str>,
) -> Result<WireEnvelope, String> {
    if store.is_in_cooldown() {
        return Err("Apple Assist is currently unavailable. Try again in a moment.".to_string());
    }

    let mut guard = store.inner.lock().expect("helper store lock");
    if guard.is_none() {
        store.spawn_locked(&mut guard)?;
    }

    let result = AppleAssistHelperStore::round_trip_locked(
        &mut guard,
        &WireRequest::GenerateCandidate {
            operation,
            selected_text,
            document_context,
        },
    );

    match &result {
        Ok(envelope) if matches!(envelope, WireEnvelope::Candidate(_)) => {
            store.record_success();
        }
        _ => {
            store.reset_locked(&mut guard);
            store.record_failure();
        }
    }
    result
}

// -- Drop helper for testability -------------------------------

/// Test-only helper: build a store with a custom helper path.
/// Production code uses `Default::default()` which reads the
/// env var; tests use this to inject the fixture binary.
pub(crate) fn store_with_helper_path(path: std::path::PathBuf) -> AppleAssistHelperStore {
    AppleAssistHelperStore {
        inner: Mutex::new(None),
        consecutive_failures: AtomicU32::new(0),
        cooldown_started_at: Mutex::new(None),
        helper_path_override: Some(path),
    }
}

/// Test-only helper: build a store with no helper available.
/// Used to assert that probe returns the right "not configured"
/// error in v0.12.0 production builds.
pub(crate) fn store_without_helper() -> AppleAssistHelperStore {
    AppleAssistHelperStore {
        inner: Mutex::new(None),
        consecutive_failures: AtomicU32::new(0),
        cooldown_started_at: Mutex::new(None),
        helper_path_override: None,
    }
}
