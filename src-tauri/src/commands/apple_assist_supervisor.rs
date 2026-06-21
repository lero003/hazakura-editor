// Hazakura Local Assist — Rust supervisor.
//
// This is the v0.12.1+ scaffolding for calling the Swift helper
// sidecar bundled by Tauri's `bundle.externalBin`.
// The supervisor owns the helper process lifecycle, the
// JSON-over-stdio wire protocol, and the failure / retry state.
//
// The Tauri command surface calls this supervisor from the main
// window only. The helper may still answer disabled /
// unavailable / unsupported depending on the local Apple
// Intelligence state.
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
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{Arc, Condvar, Mutex};
use std::time::Duration;

/// Maximum number of consecutive helper failures before the
/// supervisor enters cooldown. After this many failures, probe
/// returns `Unavailable { reason: "Hazakura Local Assist is currently
/// unavailable. Try again later." }` until the cooldown expires.
const CONSECUTIVE_FAILURE_LIMIT: u32 = 5;
/// How long the cooldown lasts once the failure limit is hit.
const COOLDOWN_DURATION: Duration = Duration::from_secs(300);
/// Per-request timeout. The Swift helper in fixture mode returns
/// in <100ms; live Foundation Models may take tens of seconds on
/// first use while Apple Intelligence warms the local model. 360s
/// keeps the UX bounded while avoiding false timeouts during that
/// initial warm-up path in this alpha feature.
/// Enforced by a watchdog thread that kills the helper child if
/// `read_line` is still blocked after this duration; the kill is
/// what unblocks the read.
const REQUEST_TIMEOUT: Duration = Duration::from_secs(360);

/// The store is held by Tauri via `tauri::Builder::manage(...)`.
pub(crate) struct AppleAssistHelperStore {
    inner: Mutex<Option<AppleAssistHelperInner>>,
    consecutive_failures: AtomicU32,
    cooldown_started_at: Mutex<Option<std::time::Instant>>,
    // Test-only override slot. Production `Default` never reads
    // the environment. It resolves only the bundled helper next
    // to the app executable. Tests use
    // `store_with_helper_path` (cfg(test)) to inject the fixture
    // binary instead. See `apple-local-assist-rust-supervisor-plan.md`
    // for the resolved-path plan.
    #[cfg(test)]
    helper_path_override: Option<std::path::PathBuf>,
    // Test-only timeout override. Production code always uses
    // `REQUEST_TIMEOUT`. Tests that need to exercise the timeout
    // path without waiting 15s set this to a small duration via
    // `with_timeout_override`. Gated to `cfg(test)` so the
    // production lib build cannot accidentally shorten the
    // timeout.
    #[cfg(test)]
    timeout_override: Option<Duration>,
    // Test-only handle to the current failure counter. Used by
    // protocol-violation regression tests to assert that a
    // `WireEnvelope` mismatch counted as a failure.
    #[cfg(test)]
    consecutive_failures_for_test: AtomicU32,
}

struct AppleAssistHelperInner {
    // Wrapped in Arc<Mutex<>> so the watchdog thread can kill
    // the child on timeout while the main thread holds the
    // outer `inner` mutex. Without this, the main thread's
    // blocking `read_line` would have no way to be unblocked.
    child: Arc<Mutex<Child>>,
    stdin: ChildStdin,
    stdout: BufReader<ChildStdout>,
}

impl Default for AppleAssistHelperStore {
    fn default() -> Self {
        Self {
            inner: Mutex::new(None),
            consecutive_failures: AtomicU32::new(0),
            cooldown_started_at: Mutex::new(None),
            #[cfg(test)]
            helper_path_override: None,
            #[cfg(test)]
            timeout_override: None,
            #[cfg(test)]
            consecutive_failures_for_test: AtomicU32::new(0),
        }
    }
}

impl Drop for AppleAssistHelperStore {
    fn drop(&mut self) {
        if let Ok(mut guard) = self.inner.lock() {
            if let Some(inner) = guard.take() {
                Self::kill_child(&inner.child);
            }
        }
    }
}

impl AppleAssistHelperStore {
    /// Kill the child process via the shared `Arc<Mutex<Child>>`
    /// and reap it. Best-effort: kill/wait errors are swallowed
    /// because the caller is already on the failure path.
    fn kill_child(child: &Arc<Mutex<Child>>) {
        if let Ok(mut child) = child.lock() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }

    /// Test-only accessor for the current consecutive-failure
    /// count. Mirrors what `record_failure` / `record_success`
    /// maintain in `consecutive_failures`, but is a separate
    /// atomic so tests do not have to race the supervisor's own
    /// atomic loads. They are updated together inside
    /// `record_failure` / `record_success`.
    #[cfg(test)]
    pub(crate) fn consecutive_failures_for_test(&self) -> u32 {
        self.consecutive_failures_for_test.load(Ordering::SeqCst)
    }

    /// Test-only builder: set a custom request timeout for this
    /// store. Used by timeout regression tests so they do not
    /// have to wait 360s for the production `REQUEST_TIMEOUT`.
    /// Gated to `cfg(test)` so the production lib build cannot
    /// accidentally shorten the timeout.
    #[cfg(test)]
    pub(crate) fn with_timeout_override(mut self, timeout: Duration) -> Self {
        self.timeout_override = Some(timeout);
        self
    }

    /// Test-only accessor: returns `true` if the store currently
    /// has a spawned helper child. Used by timeout regression
    /// tests to assert that the watchdog killed the child and
    /// the inner slot is `None` (so the next call respawns).
    /// Gated to `cfg(test)`.
    #[cfg(test)]
    pub(crate) fn inner_is_empty(&self) -> bool {
        match self.inner.lock() {
            Ok(guard) => guard.is_none(),
            Err(_) => true,
        }
    }

    /// Returns the path the supervisor will spawn, or an error
    /// if no helper is available.
    ///
    /// In test runs, `store_with_helper_path` (cfg(test) only)
    /// injects the fixture binary built by
    /// `scripts/build-apple-assist-helper-fixture.sh`. In
    /// production, `Default::default()` never reads any
    /// environment variable and resolves only the bundled helper
    /// path next to the running app executable.
    pub(crate) fn helper_path(&self) -> Result<std::path::PathBuf, String> {
        #[cfg(test)]
        {
            if let Some(path) = &self.helper_path_override {
                if path.exists() {
                    return Ok(path.clone());
                }
                return Err(format!(
                    "Hazakura Local Assist helper fixture path points at a missing file: {}",
                    path.display()
                ));
            }
        }
        // Production: defer to the production resolver skeleton
        // (`resolve_bundled_helper_path`). As of slice 17 that
        // function returns `Err("...not configured...")` to keep
        // gate-default-hidden; the gate-flip approval slice will
        // wire `current_exe().parent() / bundled_helper_filename()`
        // there. See `docs/apple-local-assist-helper-path-design.md`
        // for the resolved-path design.
        resolve_bundled_helper_path()
    }

    /// The timeout that the current call should use. Production
    /// always uses `REQUEST_TIMEOUT`. Tests that build a store
    /// via `with_timeout_override` get their value.
    fn effective_timeout(&self) -> Duration {
        #[cfg(test)]
        {
            if let Some(t) = self.timeout_override {
                return t;
            }
        }
        REQUEST_TIMEOUT
    }

    fn reset_locked(&self, inner_slot: &mut Option<AppleAssistHelperInner>) {
        if let Some(inner) = inner_slot.take() {
            Self::kill_child(&inner.child);
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
            .map_err(|e| format!("Failed to spawn Hazakura Local Assist helper: {e}"))?;
        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| "Hazakura Local Assist helper stdin is not piped.".to_string())?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "Hazakura Local Assist helper stdout is not piped.".to_string())?;
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
        let child = Arc::new(Mutex::new(child));
        *inner_slot = Some(AppleAssistHelperInner {
            child,
            stdin,
            stdout: BufReader::new(stdout),
        });
        Ok(())
    }

    fn round_trip_locked(
        inner: &mut AppleAssistHelperInner,
        request: &WireRequest<'_>,
        timeout: Duration,
    ) -> Result<WireEnvelope, String> {
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

        // Spawn a watchdog that will kill the child if the main
        // thread is still blocked on `read_line` after `timeout`.
        // The kill is what unblocks `read_line` — closing the
        // child's stdout pipe causes the read to return Err or
        // Ok(0) depending on the platform.
        //
        // Coordination: the main thread sets `done = true` and
        // notifies the Condvar after read_line returns. The
        // watchdog wakes up, sees the flag, and exits without
        // killing. The `timed_out` atomic distinguishes "killed by
        // watchdog" (timeout) from "child exited on its own" (EOF
        // / IO error).
        let done_pair = Arc::new((Mutex::new(false), Condvar::new()));
        let done_pair_w = done_pair.clone();
        let child_arc = inner.child.clone();
        let timed_out = Arc::new(AtomicBool::new(false));
        let timed_out_w = timed_out.clone();

        let watchdog = std::thread::Builder::new()
            .name("apple-assist-supervisor-watchdog".to_string())
            .spawn(move || {
                let (lock, cvar) = &*done_pair_w;
                let mut done = lock.lock().expect("watchdog lock");
                // Re-check the predicate after acquiring the lock:
                // if the main thread already set `done = true` and
                // called `notify_all` before we got scheduled, the
                // success path is finished and we can exit without
                // entering `wait_timeout` at all. This is the
                // textbook "wait with predicate" pattern and also
                // dodges a lost-wakeup window between the time the
                // main thread sets `done` and the time this thread
                // would otherwise enter the wait.
                if !*done {
                    let (next_done, _) = cvar
                        .wait_timeout(done, timeout)
                        .expect("watchdog wait_timeout");
                    done = next_done;
                }
                if !*done {
                    timed_out_w.store(true, Ordering::SeqCst);
                    Self::kill_child(&child_arc);
                }
            })
            .map_err(|e| format!("Failed to spawn watchdog thread: {e}"))?;

        let mut line = String::new();
        let read_result = inner.stdout.read_line(&mut line);

        // Signal the watchdog that read_line returned. The
        // watchdog will exit without killing if it had not
        // already fired.
        {
            let (lock, cvar) = &*done_pair;
            let mut done = lock.lock().expect("watchdog signal lock");
            *done = true;
            cvar.notify_all();
        }
        // Join the watchdog so it does not outlive this call.
        // If the watchdog already fired and is in the middle of
        // `kill_child`, the join waits for that to complete —
        // which is what we want, so the child is fully reaped
        // before we return.
        let _ = watchdog.join();

        if timed_out.load(Ordering::SeqCst) {
            return Err(format!(
                "Hazakura Local Assist helper timed out after {}s",
                timeout.as_secs()
            ));
        }

        if line.is_empty() {
            return Err("Hazakura Local Assist helper closed the response stream.".to_string());
        }

        if let Err(e) = read_result {
            return Err(format!("Failed to read helper response: {e}"));
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
        #[cfg(test)]
        {
            self.consecutive_failures_for_test
                .store(count, Ordering::SeqCst);
        }
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
        #[cfg(test)]
        {
            self.consecutive_failures_for_test
                .store(0, Ordering::SeqCst);
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
        #[serde(skip_serializing_if = "Option::is_none")]
        instruction: Option<&'a str>,
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
/// Cooldown discipline: only IO / EOF / parse / timeout / spawn
/// failures and unexpected-envelope-shape responses count toward
/// the failure budget. A `WireEnvelope::Error` from the helper
/// is the helper working correctly and refusing (guardrail,
/// validation, deferred, rate-limited) — it is passed through
/// unchanged and does NOT reset the child or count toward
/// cooldown. Treating those as process failures would mean
/// "5 honest refusals in a row kill the helper," which is the
/// opposite of what a refusal-budget is for.
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
        // The helper is alive and refused the probe (e.g.
        // framework compiled out). Pass it through; do not
        // count, do not reset.
        Ok(WireEnvelope::Error(_)) => {}
        // A Candidate envelope in response to a probe is a
        // protocol violation from the helper side. Reset and
        // count so the next call respawns.
        Ok(WireEnvelope::Candidate(_)) => {
            store.reset_locked(&mut guard);
            store.record_failure();
        }
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
///
/// Cooldown discipline: see `probe_availability_via_helper`.
/// A `WireEnvelope::Error` from the helper — guardrail,
/// validation, deferred, rate-limited — is the helper doing
/// its job and refusing. It passes through unchanged; the
/// child stays alive and the failure counter does not move.
pub(crate) fn generate_candidate_via_helper(
    store: &AppleAssistHelperStore,
    operation: &str,
    selected_text: &str,
    document_context: Option<&str>,
    instruction: Option<&str>,
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
        &WireRequest::GenerateCandidate {
            operation,
            selected_text,
            document_context,
            instruction,
        },
        timeout,
    );

    match &result {
        Ok(WireEnvelope::Candidate(_)) => store.record_success(),
        // Helper refused (guardrail / validation / deferred /
        // rate-limited). Pass through; do not count, do not
        // reset. Otherwise "5 deferred attempts in a row"
        // would terminate a perfectly healthy helper.
        Ok(WireEnvelope::Error(_)) => {}
        // An Availability envelope in response to a generate
        // is a protocol violation from the helper side. Reset
        // and count so the next call respawns.
        Ok(WireEnvelope::Availability(_)) => {
            store.reset_locked(&mut guard);
            store.record_failure();
        }
        Err(_) => {
            store.reset_locked(&mut guard);
            store.record_failure();
        }
    }
    result
}

// -- Drop helper for testability -------------------------------

/// Test-only helper: build a store with a custom helper path.
/// Production code uses `Default::default()` (which never reads
/// the environment); tests use this to inject the fixture
/// binary. Gated to `cfg(test)` so the production lib build
/// cannot accidentally call this.
#[cfg(test)]
pub(crate) fn store_with_helper_path(path: std::path::PathBuf) -> AppleAssistHelperStore {
    AppleAssistHelperStore {
        inner: Mutex::new(None),
        consecutive_failures: AtomicU32::new(0),
        cooldown_started_at: Mutex::new(None),
        helper_path_override: Some(path),
        timeout_override: None,
        consecutive_failures_for_test: AtomicU32::new(0),
    }
}

/// Test-only helper: build a store with no helper available.
/// Used to assert that probe returns the right "not configured"
/// error in v0.12.0 production builds. Gated to `cfg(test)` so
/// the production lib build cannot accidentally call this.
#[cfg(test)]
pub(crate) fn store_without_helper() -> AppleAssistHelperStore {
    AppleAssistHelperStore {
        inner: Mutex::new(None),
        consecutive_failures: AtomicU32::new(0),
        cooldown_started_at: Mutex::new(None),
        helper_path_override: None,
        timeout_override: None,
        consecutive_failures_for_test: AtomicU32::new(0),
    }
}

// -- Production helper-path resolver ---------------------------
//
// The functions below pin the production helper-path resolver.
// All are `pub(crate)` so the integration test module can reach
// them and lock down:
//   - the host triple format the supervisor expects
//   - the bundled-helper filename the production path will look
//     for (Tauri sidecar convention)
//
// Crucially, `resolve_bundled_helper_path` must NOT read any
// environment variable. If it did, a user shell could trick the
// gate-flipped build into spawning an arbitrary binary just
// because a path-shaped variable happened to be exported.

/// The Rust target triple this binary was built for. Used by
/// `bundled_helper_filename` to construct the production
/// sidecar filename (`hazakura-apple-assist-helper-<triple>`).
///
/// Returns one of the macOS Tauri sidecar triples
/// (`aarch64-apple-darwin` / `x86_64-apple-darwin`) on supported
/// hosts, or `"unknown-target"` on anything else. The latter is
/// purely a placeholder — Hazakura Local Assist is macOS-only and
/// will not spawn a helper on an unknown host. The supervisor
/// will return not-configured from `resolve_bundled_helper_path`
/// regardless of what this function returns.
pub(crate) fn rust_target_triple() -> &'static str {
    match (std::env::consts::ARCH, std::env::consts::OS) {
        ("aarch64", "macos") => "aarch64-apple-darwin",
        ("x86_64", "macos") => "x86_64-apple-darwin",
        _ => "unknown-target",
    }
}

/// The bundled helper filename the production resolver may look
/// for next to the running executable.
/// Format: `hazakura-apple-assist-helper-<rust-target-triple>`.
///
/// Mirrors the DEST naming in
/// `scripts/build-apple-assist-helper-fixture.sh` so the same
/// filename works in fixture build, test fixture, and packaged
/// build paths.
pub(crate) fn bundled_helper_filename() -> String {
    format!("hazakura-apple-assist-helper-{}", rust_target_triple())
}

pub(crate) fn bundled_helper_base_filename() -> &'static str {
    "hazakura-apple-assist-helper"
}

pub(crate) fn resolve_bundled_helper_path_from_dir(dir: &Path) -> Result<PathBuf, String> {
    let candidates = [
        dir.join(bundled_helper_filename()),
        dir.join(bundled_helper_base_filename()),
    ];
    for candidate in candidates {
        if candidate.exists() {
            return Ok(candidate);
        }
    }
    Err(format!(
        "Hazakura Local Assist helper is not configured for this build. Looked in {}.",
        dir.display()
    ))
}

/// Production helper-path resolution. Tauri sidecars are placed
/// next to the running executable in packaged builds. Depending
/// on the Tauri sidecar normalization path, the file may keep
/// the Rust target triple suffix or be exposed as the base name,
/// so both are accepted.
pub(crate) fn resolve_bundled_helper_path() -> Result<std::path::PathBuf, String> {
    let exe = std::env::current_exe()
        .map_err(|e| format!("Failed to resolve current executable path: {e}"))?;
    let dir = exe
        .parent()
        .ok_or_else(|| format!("Current executable path has no parent: {}", exe.display()))?;
    resolve_bundled_helper_path_from_dir(dir)
}
