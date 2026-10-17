//! Transport plumbing shared by the fixed-binary helper processes.
//!
//! Hazakura Local Assist (`commands/apple_assist_supervisor.rs`) and
//! Import Assist (`import_assist/helper.rs`) each own their request /
//! response contract and their child life cycle — Local Assist keeps a
//! long-lived child, Import Assist spawns one child per call — but the
//! pieces below are byte-identical on both sides and therefore live
//! here:
//!
//!   * the sidecar Rust target triple used in helper filenames,
//!   * the wall-clock watchdog that kills a child to unblock a stuck
//!     `read_line`,
//!   * `kill_child` (kill + reap through the shared handle),
//!   * resolving a sidecar next to the running executable.
//!
//! No request or response types belong here: the two helpers speak
//! different JSON contracts and stay separate on purpose.

use std::path::{Path, PathBuf};
use std::process::Child;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Condvar, Mutex};
use std::time::Duration;

/// The macOS Tauri sidecar triple used in helper filenames.
///
/// Returns `aarch64-apple-darwin` / `x86_64-apple-darwin` on supported
/// hosts, or `"unknown-target"` on anything else. The latter is purely
/// a placeholder — both helpers are macOS-only and will not spawn on an
/// unknown host.
pub(crate) fn rust_target_triple() -> &'static str {
    match (std::env::consts::ARCH, std::env::consts::OS) {
        ("aarch64", "macos") => "aarch64-apple-darwin",
        ("x86_64", "macos") => "x86_64-apple-darwin",
        _ => "unknown-target",
    }
}

/// Kill the child process via the shared `Arc<Mutex<Child>>` and reap
/// it. Best-effort: kill/wait errors are swallowed because the caller
/// is already on the failure path.
pub(crate) fn kill_child(child: &Arc<Mutex<Child>>) {
    if let Ok(mut child) = child.lock() {
        let _ = child.kill();
        let _ = child.wait();
    }
}

/// Kills the helper child if a blocking `read_line` has not finished
/// within `timeout`. Dropping the child's stdout via `kill` is what
/// unblocks the read (`Err` or `Ok(0)` depending on the platform).
///
/// Coordination: the main thread calls [`ReadWatchdog::finish`], which
/// sets `done = true` and notifies the condvar. The watchdog wakes up,
/// sees the flag, and exits without killing. `finish` returns the
/// `timed_out` flag so the caller can distinguish "killed by watchdog"
/// from "child exited on its own".
pub(crate) struct ReadWatchdog {
    done_pair: Arc<(Mutex<bool>, Condvar)>,
    timed_out: Arc<AtomicBool>,
    handle: Option<std::thread::JoinHandle<()>>,
}

impl ReadWatchdog {
    /// Spawn the watchdog thread. The `std::io::Error` is returned so
    /// each caller keeps its own spawn-failure message.
    pub(crate) fn arm(
        name: &str,
        child: Arc<Mutex<Child>>,
        timeout: Duration,
    ) -> std::io::Result<Self> {
        let done_pair = Arc::new((Mutex::new(false), Condvar::new()));
        let done_pair_w = done_pair.clone();
        let timed_out = Arc::new(AtomicBool::new(false));
        let timed_out_w = timed_out.clone();

        let handle = std::thread::Builder::new()
            .name(name.to_string())
            .spawn(move || {
                let (lock, cvar) = &*done_pair_w;
                let mut done = lock.lock().expect("watchdog lock");
                // Re-check the predicate after acquiring the lock: if
                // the main thread already set `done = true` and called
                // `notify_all` before we got scheduled, the success
                // path is finished and we can exit without entering
                // `wait_timeout` at all. This is the textbook "wait
                // with predicate" pattern and also dodges a
                // lost-wakeup window between the time the main thread
                // sets `done` and the time this thread would otherwise
                // enter the wait.
                if !*done {
                    let (next_done, _) = cvar
                        .wait_timeout(done, timeout)
                        .expect("watchdog wait_timeout");
                    done = next_done;
                }
                if !*done {
                    timed_out_w.store(true, Ordering::SeqCst);
                    kill_child(&child);
                }
            })?;

        Ok(Self {
            done_pair,
            timed_out,
            handle: Some(handle),
        })
    }

    /// Signal the watchdog, join it, and report whether it killed the
    /// child. If the watchdog already fired and is in the middle of
    /// `kill_child`, the join waits for that to complete — so the child
    /// is fully reaped before this returns.
    pub(crate) fn finish(mut self) -> bool {
        {
            let (lock, cvar) = &*self.done_pair;
            let mut done = lock.lock().expect("watchdog signal lock");
            *done = true;
            cvar.notify_all();
        }
        if let Some(handle) = self.handle.take() {
            let _ = handle.join();
        }
        self.timed_out()
    }

    /// Whether the watchdog has killed the child for exceeding the
    /// timeout. Callers that poll while the watchdog is still armed
    /// (the one-shot Import Assist read loop) use this to tell a
    /// watchdog kill apart from a helper that exited on its own.
    pub(crate) fn timed_out(&self) -> bool {
        self.timed_out.load(Ordering::SeqCst)
    }
}

/// Resolve a sidecar that Tauri places next to the running executable.
/// Depending on the Tauri sidecar normalization path, the file may keep
/// the Rust target triple suffix or be exposed as the base name, so
/// `resolve_from_dir` is handed the executable's directory and accepts
/// both.
pub(crate) fn resolve_sidecar_next_to_executable(
    resolve_from_dir: fn(&Path) -> Result<PathBuf, String>,
) -> Result<PathBuf, String> {
    let exe = std::env::current_exe()
        .map_err(|e| format!("Failed to resolve current executable path: {e}"))?;
    let dir = exe
        .parent()
        .ok_or_else(|| format!("Current executable path has no parent: {}", exe.display()))?;
    resolve_from_dir(dir)
}
