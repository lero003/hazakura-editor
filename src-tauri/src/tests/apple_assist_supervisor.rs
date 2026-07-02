// Integration tests for the Hazakura Local Assist Rust supervisor.
//
// The supervisor is the future entry point for the live Foundation
// Models binding. In v0.12.0 it is REACHABLE from these tests but
// is NOT called from the Tauri command surface in
// `commands::apple_assist` — the command body still returns the
// gate-default-hidden `Unavailable { reason }` (macOS) and
// `Unsupported` (other) to keep the React side hiding the
// command palette entries until live mode is wired. See
// docs/apple-local-assist-v0.12-design-review.md section 10.
//
// These tests verify two things:
//
//   1. Pure store behavior with no helper binary — store
//      construction (the production `Default` must NOT read any
//      environment variable), the "not configured" error from
//      `helper_path()`, `Drop` semantics. These run on every
//      machine.
//
//   2. End-to-end JSON round-trip via the fixture helper built by
//      `scripts/build-apple-assist-helper-fixture.sh`. The
//      fixture binary path is injected via
//      `store_with_helper_path`, which is `cfg(test)`-gated; the
//      tests consult `HAZAKURA_APPLE_ASSIST_HELPER_FIXTURE` only
//      to decide whether the fixture binary is available and
//      skip cleanly when not set, so CI without the fixture
//      stays green. The env var is never read by production
//      code, only by these tests as a skip-guard.

// The other per-feature test modules pull `use super::*;` for
// the shared fixtures and re-exported std types. This module
// only touches `crate::commands::apple_assist_supervisor` and
// `std::env` / `std::path`, so it imports those directly and
// skips the shared re-exports.

use crate::commands::apple_assist_supervisor::{
    bundled_helper_filename, generate_candidate_via_helper as generate_candidate_via_helper_impl,
    probe_availability_via_helper, resolve_bundled_helper_path, rust_target_triple,
    store_with_helper_path, store_without_helper, AppleAssistHelperStore, HelperAvailability,
    HelperCandidate, HelperCandidatePartial, WireEnvelope, GENERATE_TIMEOUT, PROBE_TIMEOUT,
};

fn generate_candidate_via_helper(
    store: &AppleAssistHelperStore,
    operation: &str,
    selected_text: &str,
    document_context: Option<&str>,
    instruction: Option<&str>,
) -> Result<WireEnvelope, String> {
    generate_candidate_via_helper_impl(
        store,
        operation,
        selected_text,
        document_context,
        instruction,
        None,
        None,
    )
}

#[test]
fn supervisor_parses_candidate_partial_envelope() {
    let envelope: WireEnvelope = serde_json::from_str(
        r#"{"kind":"candidate_partial","value":{"candidateText":"途中結果"}}"#,
    )
    .expect("candidate_partial envelope should parse");

    assert_eq!(
        envelope,
        WireEnvelope::CandidatePartial(HelperCandidatePartial {
            candidate_text: "途中結果".to_string(),
        }),
    );
}

// ----------------------------------------------------------------
// Pure-store tests (no helper binary required).
// ----------------------------------------------------------------

#[test]
fn supervisor_probe_timeout_is_shorter_than_generation_timeout() {
    assert!(
        PROBE_TIMEOUT < GENERATE_TIMEOUT,
        "availability probe timeout must stay shorter than generation timeout"
    );
    assert_eq!(PROBE_TIMEOUT, std::time::Duration::from_secs(10));
}

#[test]
fn supervisor_store_default_constructs_cleanly() {
    // `Default::default()` does not read the environment (the
    // env-var-based override is test-only via
    // `store_with_helper_path`). The default store must report
    // "not configured" when `helper_path()` is consulted.
    let store = AppleAssistHelperStore::default();
    let err = store
        .helper_path()
        .expect_err("default store must report not-configured");
    assert!(
        err.contains("not configured"),
        "error should mention 'not configured', got: {err}"
    );
}

#[test]
fn supervisor_store_default_ignores_fixture_env_var() {
    // Regression: the production `Default::default()` must NOT
    // honor `HAZAKURA_APPLE_ASSIST_HELPER_FIXTURE`. If it did,
    // any environment that happened to export a path would let
    // a future gate-flip spawn an arbitrary binary as the
    // helper. The override is test-only via
    // `store_with_helper_path`.
    //
    // SAFETY: env-var manipulation in tests is single-process
    // and does not race (cargo test is the documented usage of
    // std::env::set_var / remove_var).
    let prev = std::env::var_os("HAZAKURA_APPLE_ASSIST_HELPER_FIXTURE");
    unsafe {
        std::env::set_var("HAZAKURA_APPLE_ASSIST_HELPER_FIXTURE", "/usr/bin/true");
    }
    let store = AppleAssistHelperStore::default();
    let err = store
        .helper_path()
        .expect_err("default store must ignore the env var");
    assert!(
        err.contains("not configured"),
        "default store must not honor HAZAKURA_APPLE_ASSIST_HELPER_FIXTURE, got: {err}"
    );
    if let Some(value) = prev {
        unsafe {
            std::env::set_var("HAZAKURA_APPLE_ASSIST_HELPER_FIXTURE", value);
        }
    } else {
        unsafe {
            std::env::remove_var("HAZAKURA_APPLE_ASSIST_HELPER_FIXTURE");
        }
    }
}

#[test]
fn supervisor_store_without_helper_reports_not_configured() {
    let store = store_without_helper();
    let err = store.helper_path().expect_err("must error");
    assert!(
        err.contains("not configured"),
        "error should mention 'not configured', got: {err}"
    );
}

#[test]
fn supervisor_store_with_missing_helper_path_reports_missing_file() {
    let bogus = std::env::temp_dir().join("hazakura-no-such-helper-binary");
    let store = store_with_helper_path(bogus.clone());
    let err = store.helper_path().expect_err("must error");
    assert!(
        err.contains("missing"),
        "error should mention the missing file, got: {err}"
    );
    assert!(
        err.contains(&bogus.display().to_string()),
        "error should include the offending path, got: {err}"
    );
}

#[test]
fn supervisor_probe_without_helper_returns_err_quickly() {
    // No helper configured → probe must return an error
    // immediately, NOT spin / hang / return `Available`.
    let store = store_without_helper();
    let err = probe_availability_via_helper(&store).expect_err("must error");
    assert!(err.contains("not configured"), "got: {err}");
}

#[test]
fn supervisor_generate_without_helper_returns_err_quickly() {
    let store = store_without_helper();
    let err = generate_candidate_via_helper(&store, "summarize", "body", None, None)
        .expect_err("must error");
    assert!(err.contains("not configured"), "got: {err}");
}

// ----------------------------------------------------------------
// Fixture-helper round-trip tests.
// ----------------------------------------------------------------
//
// These tests require the fixture binary built by
// `scripts/build-apple-assist-helper-fixture.sh`. They opt-in via
// the `HAZAKURA_APPLE_ASSIST_HELPER_FIXTURE` env var so CI
// without the fixture skips them cleanly.

fn fixture_path_or_skip() -> Option<std::path::PathBuf> {
    let raw = std::env::var_os("HAZAKURA_APPLE_ASSIST_HELPER_FIXTURE")?;
    let path = std::path::PathBuf::from(raw);
    if !path.exists() {
        eprintln!(
            "skip: HAZAKURA_APPLE_ASSIST_HELPER_FIXTURE points at a missing file: {}",
            path.display()
        );
        return None;
    }
    Some(path)
}

#[test]
fn supervisor_probe_via_fixture_returns_available() {
    let Some(path) = fixture_path_or_skip() else {
        eprintln!("skip: HAZAKURA_APPLE_ASSIST_HELPER_FIXTURE not set");
        return;
    };
    let store = store_with_helper_path(path);
    let envelope = probe_availability_via_helper(&store).expect("fixture probe must succeed");
    match envelope {
        WireEnvelope::Availability(HelperAvailability { kind, .. }) => {
            assert_eq!(
                kind, "available",
                "fixture helper must report available; got kind: {kind}",
            );
        }
        other => panic!("fixture probe returned unexpected envelope: {other:?}"),
    }
}

#[test]
fn supervisor_generate_summarize_via_fixture_returns_prefixed_candidate() {
    let Some(path) = fixture_path_or_skip() else {
        eprintln!("skip: HAZAKURA_APPLE_ASSIST_HELPER_FIXTURE not set");
        return;
    };
    let store = store_with_helper_path(path);
    let envelope = generate_candidate_via_helper(&store, "summarize", "body", None, None)
        .expect("fixture generate must succeed");
    match envelope {
        WireEnvelope::Candidate(HelperCandidate {
            operation,
            candidate_text,
            model_id,
            ..
        }) => {
            assert_eq!(operation, "summarize");
            assert!(
                candidate_text.starts_with("【要約案】"),
                "candidate must start with the summarize prefix; got: {candidate_text:?}"
            );
            assert!(
                candidate_text.contains("body"),
                "candidate must echo the input; got: {candidate_text:?}"
            );
            assert!(
                model_id.starts_with("fixture:"),
                "fixture build must report a fixture: model id; got: {model_id}"
            );
        }
        other => panic!("fixture generate returned unexpected envelope: {other:?}"),
    }
}

#[test]
fn supervisor_generate_rephrase_via_fixture_returns_prefixed_candidate() {
    let Some(path) = fixture_path_or_skip() else {
        eprintln!("skip: HAZAKURA_APPLE_ASSIST_HELPER_FIXTURE not set");
        return;
    };
    let store = store_with_helper_path(path);
    let envelope = generate_candidate_via_helper(&store, "rephrase", "hello", None, None)
        .expect("fixture generate must succeed");
    match envelope {
        WireEnvelope::Candidate(HelperCandidate {
            operation,
            candidate_text,
            ..
        }) => {
            assert_eq!(operation, "rephrase");
            assert!(
                candidate_text.starts_with("【書き換え案】"),
                "candidate must start with the rephrase prefix; got: {candidate_text:?}"
            );
        }
        other => panic!("fixture generate returned unexpected envelope: {other:?}"),
    }
}

#[test]
fn supervisor_generate_deferred_operation_via_fixture_returns_error_envelope() {
    let Some(path) = fixture_path_or_skip() else {
        eprintln!("skip: HAZAKURA_APPLE_ASSIST_HELPER_FIXTURE not set");
        return;
    };
    let store = store_with_helper_path(path);
    // `extract` / `proofread` / `explain_diff` are well-formed
    // operations but deferred in v0.12. The helper must return
    // an error envelope (kind = "deferred"), not a candidate.
    let envelope = generate_candidate_via_helper(&store, "extract", "body", None, None);
    match envelope {
        Ok(WireEnvelope::Error(err)) => {
            assert_eq!(
                err.kind, "deferred",
                "deferred operation must return error kind 'deferred', got: {err:?}"
            );
        }
        other => panic!("deferred operation should return Ok(WireEnvelope::Error), got: {other:?}"),
    }
}

#[test]
fn supervisor_does_not_count_helper_error_envelopes_as_failures() {
    // Regression: `WireEnvelope::Error` from the helper is the
    // helper working correctly and refusing (guardrail /
    // validation / deferred / rate-limited). It must pass
    // through to the caller unchanged. It must NOT reset the
    // child and must NOT increment the failure counter. If it
    // did, a user exploring the deferred operations (`extract`,
    // `proofread`, `explain_diff`) would trip the 5-strike
    // cooldown for the session, which is the opposite of what
    // a refusal budget is for.
    let Some(path) = fixture_path_or_skip() else {
        eprintln!("skip: HAZAKURA_APPLE_ASSIST_HELPER_FIXTURE not set");
        return;
    };
    let store = store_with_helper_path(path);
    // 6 is two more than `CONSECUTIVE_FAILURE_LIMIT`. If the
    // helper-error envelope were counted as a failure, the 6th
    // call would enter cooldown and the post-loop probe would
    // return the cooldown error.
    for i in 0..6 {
        let envelope = generate_candidate_via_helper(&store, "extract", "body", None, None)
            .unwrap_or_else(|e| panic!("deferred call #{i} must pass through, got err: {e}"));
        match envelope {
            WireEnvelope::Error(err) => {
                assert_eq!(
                    err.kind, "deferred",
                    "deferred call #{i} must return kind 'deferred', got: {err:?}"
                );
            }
            other => panic!("deferred call #{i} expected Error envelope, got: {other:?}"),
        }
    }
    // Sanity probe: the helper must still be alive and the
    // failure counter must still be at zero. If either were
    // tripped, the probe returns the cooldown error.
    let envelope = probe_availability_via_helper(&store)
        .expect("post-loop probe must succeed (no cooldown should have been entered)");
    assert!(
        matches!(envelope, WireEnvelope::Availability(_)),
        "post-loop probe must return Availability; got: {envelope:?}"
    );
}

#[test]
fn supervisor_reuses_helper_across_multiple_requests() {
    let Some(path) = fixture_path_or_skip() else {
        eprintln!("skip: HAZAKURA_APPLE_ASSIST_HELPER_FIXTURE not set");
        return;
    };
    let store = store_with_helper_path(path);
    // First probe spawns the helper; subsequent calls must reuse
    // it. We do not have a public PID accessor, so we exercise
    // the round-trip path multiple times and assert all calls
    // succeed — a respawn on every call would still pass this
    // test, but the dedicated reuse-detection lives in the
    // doc-described slice that adds a PID accessor. The intent
    // here is to lock down the "second probe still works against
    // a long-lived helper" path.
    for _ in 0..3 {
        let envelope = probe_availability_via_helper(&store).expect("repeated probes must succeed");
        match envelope {
            WireEnvelope::Availability(_) => {}
            other => panic!("expected availability envelope, got: {other:?}"),
        }
    }
}

#[test]
fn supervisor_handles_mixed_request_types_in_sequence() {
    let Some(path) = fixture_path_or_skip() else {
        eprintln!("skip: HAZAKURA_APPLE_ASSIST_HELPER_FIXTURE not set");
        return;
    };
    let store = store_with_helper_path(path);
    // probe → generate → probe → generate must all succeed
    // against the same long-lived helper. This is the path the
    // command palette + Review Desk will exercise once live mode
    // lands.
    assert!(matches!(
        probe_availability_via_helper(&store).expect("probe 1"),
        WireEnvelope::Availability(_)
    ));
    assert!(matches!(
        generate_candidate_via_helper(&store, "summarize", "body 1", None, None).expect("gen 1"),
        WireEnvelope::Candidate(_)
    ));
    assert!(matches!(
        probe_availability_via_helper(&store).expect("probe 2"),
        WireEnvelope::Availability(_)
    ));
    assert!(matches!(
        generate_candidate_via_helper(&store, "rephrase", "body 2", None, None).expect("gen 2"),
        WireEnvelope::Candidate(_)
    ));
}

#[test]
fn supervisor_passes_document_context_to_helper() {
    let Some(path) = fixture_path_or_skip() else {
        eprintln!("skip: HAZAKURA_APPLE_ASSIST_HELPER_FIXTURE not set");
        return;
    };
    let store = store_with_helper_path(path);
    // Fixture helper does not USE documentContext (it only
    // returns the prefix + selectedText). The assertion here is
    // that passing a Some(_) does not break the round-trip; if
    // serde silently emitted a malformed JSON key, the Swift
    // decoder would fail and the round-trip would error.
    let envelope = generate_candidate_via_helper(
        &store,
        "summarize",
        "body",
        Some("surrounding paragraph"),
        None,
    )
    .expect("generate with context must succeed");
    assert!(matches!(envelope, WireEnvelope::Candidate(_)));
}

// ----------------------------------------------------------------
// Timeout tests (slice 11).
// ----------------------------------------------------------------
//
// These tests use a tiny temporary shell script as a fake
// helper that reads the request and then sleeps for 5
// seconds. The supervisor writes the request, the script
// drains it and sleeps, and the main thread's read_line
// blocks. The watchdog fires after the test's small timeout
// override, kills the child, and the supervisor returns a
// timeout error. The failure counter is incremented. The
// test script is the same one-liner pattern used by the
// protocol-violation tests below — no fake-helper
// infrastructure beyond a 3-line shell script.

fn sleep_helper_script_or_skip(suffix: &str) -> Option<std::path::PathBuf> {
    let script = std::env::temp_dir().join(format!(
        "hazakura-apple-assist-test-slow-helper-{suffix}.sh"
    ));
    let body = "#!/bin/sh\n\
                read -r _request\n\
                sleep 5\n";
    std::fs::write(&script, body).expect("write slow helper script");
    std::fs::set_permissions(&script, std::os::unix::fs::PermissionsExt::from_mode(0o755))
        .expect("chmod slow helper script");
    Some(script)
}

#[test]
fn supervisor_round_trip_times_out_when_helper_hangs() {
    let Some(slow) = sleep_helper_script_or_skip("hangs") else {
        return;
    };
    // 200ms is much shorter than the script's 5s sleep, so the
    // watchdog must fire before the helper "responds" (it
    // never does — it just sleeps).
    let store =
        store_with_helper_path(slow).with_timeout_override(std::time::Duration::from_millis(200));
    let err = probe_availability_via_helper(&store)
        .expect_err("a sleeping helper must time out, not return Available");
    assert!(
        err.contains("timed out"),
        "error should mention 'timed out', got: {err}"
    );
    // The timeout must be counted as a failure (same bucket as
    // IO / EOF / parse / spawn failures).
    assert_eq!(
        store.consecutive_failures_for_test(),
        1,
        "timeout must increment the failure counter",
    );
}

// Pin the watchdog success path: a fast helper response must NOT
// cause `round_trip_locked` to wait the full `timeout` duration.
// The watchdog thread re-checks the `done` predicate after
// acquiring its lock and skips `wait_timeout` entirely if the
// main thread has already signaled completion. This test uses a
// 500ms timeout override and asserts the elapsed wall time is
// well under 500ms — if the success path leaked the timeout
// duration, this would fail intermittently or deterministically
// depending on the leak's magnitude.
#[test]
fn supervisor_fast_success_does_not_wait_full_timeout_duration() {
    let Some(fixture) = fixture_path_or_skip() else {
        return;
    };
    let timeout = std::time::Duration::from_millis(500);
    let store = store_with_helper_path(fixture).with_timeout_override(timeout);
    let start = std::time::Instant::now();
    let envelope = probe_availability_via_helper(&store)
        .expect("fixture helper must return Availability, not error");
    let elapsed = start.elapsed();
    // Hard upper bound: if the round trip leaked the timeout
    // duration, this would be >= 500ms with the kill_child
    // overhead. 250ms gives a generous margin for slow CI while
    // still failing on a true leak. The fixture binary is
    // <100ms in practice; the watchdog thread must not add to
    // that.
    assert!(
        elapsed < timeout / 2,
        "fast success path took {elapsed:?}, expected well under timeout {timeout:?}"
    );
    assert!(
        matches!(
            envelope,
            WireEnvelope::Availability(HelperAvailability { .. })
        ),
        "expected Availability envelope, got {envelope:?}"
    );
    // And the success must have reset the failure counter.
    assert_eq!(
        store.consecutive_failures_for_test(),
        0,
        "fast success must not increment the failure counter"
    );
}

#[test]
fn supervisor_timeout_does_not_pile_up_zombie_children() {
    // After a timeout, the watchdog must have killed the helper
    // child. If the kill were skipped, the sleep 5 would
    // linger. The smoke assertion: the store's inner slot is
    // None after the timeout, so the next call respawns
    // cleanly.
    let Some(slow) = sleep_helper_script_or_skip("zombie") else {
        return;
    };
    let store =
        store_with_helper_path(slow).with_timeout_override(std::time::Duration::from_millis(200));
    let _ = probe_availability_via_helper(&store);
    assert!(
        store.inner_is_empty(),
        "inner slot must be None after a timeout (helper was killed and not replaced)"
    );
    // The next call must attempt to respawn a new helper. We
    // do not assert it succeeds (the new helper is also a
    // sleep 5, so it will time out again); we assert it does
    // not fail for "helper is not running" reasons.
    let result = probe_availability_via_helper(&store);
    assert!(
        result.is_err(),
        "second call against a fresh sleep helper must also time out"
    );
    let err = result.unwrap_err();
    assert!(
        err.contains("timed out") || err.contains("not configured") || err.contains("Failed to"),
        "second call should be another timeout, not a different error; got: {err}"
    );
}

// A user cancel (stop_apple_assist_candidate) must kill the active
// helper child without acquiring `inner`, surface a "cancelled by
// user" error, leave the failure counter untouched (cancel is a user
// intent, not a helper failure), and leave the inner slot empty so
// the next call respawns. The probe path is used because it is the
// simplest blocking entry point; generate/stream share the same
// cancel plumbing inside `round_trip_locked`.
#[test]
fn supervisor_cancel_kills_active_helper_without_counting_failure() {
    let Some(slow) = sleep_helper_script_or_skip("cancel") else {
        return;
    };
    let store =
        store_with_helper_path(slow).with_timeout_override(std::time::Duration::from_secs(30));
    let store = std::sync::Arc::new(store);
    let store_for_cancel = std::sync::Arc::clone(&store);

    // The probe blocks on the slow helper's read_line. Cancel from a
    // separate thread shortly after the probe starts so the main
    // thread is actually blocked on the read when cancel fires. The
    // 300ms margin covers spawn + write + arm_cancel on slow CI; the
    // helper's own `read` + `sleep 5` keeps the probe blocked well
    // past this point.
    let cancel_thread = std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(300));
        store_for_cancel.cancel_active()
    });

    let err = probe_availability_via_helper(&store)
        .expect_err("a cancelled probe must return an error, not succeed");
    let cancelled = cancel_thread.join().expect("cancel thread panicked");

    assert!(
        cancelled,
        "cancel_active must report it cancelled an active generation"
    );
    assert!(
        err.contains("cancelled by user"),
        "error should mention 'cancelled by user', got: {err}"
    );
    // Cancel must NOT count toward cooldown.
    assert_eq!(
        store.consecutive_failures_for_test(),
        0,
        "user cancel must not increment the failure counter"
    );
    assert!(
        store.inner_is_empty(),
        "inner slot must be None after cancel (helper was killed and the slot cleared)"
    );
}

// A cancel with no active generation must be an idempotent no-op.
#[test]
fn supervisor_cancel_with_no_active_generation_is_noop() {
    let store = store_without_helper();
    let cancelled = store.cancel_active();
    assert!(
        !cancelled,
        "cancel with no active generation must return false"
    );
}

// ----------------------------------------------------------------
// Protocol-shape tests (slice 12).
// ----------------------------------------------------------------
//
// These tests write a tiny temporary shell script as the fake
// helper. The script does not speak the JSON protocol; it
// just dumps a canned response (wrong-shape envelope, malformed
// JSON, or no data at all) to stdout and exits. The supervisor
// reads the canned response, the round-trip detects the
// violation / parse failure / EOF, and the cooldown discipline
// resets + counts. This lets us lock down the protocol-shape
// handling without a full fake-helper binary — just `cat
// >/dev/null` to swallow the request and `printf` to write
// the canned response.

#[test]
fn supervisor_probe_treats_candidate_envelope_as_protocol_violation() {
    // A `Candidate` envelope in response to a `probe_availability`
    // request is a protocol violation (the helper should have
    // returned `Availability` or `Error`). The supervisor must
    // reset the child and increment the failure counter, so the
    // next call respawns a fresh helper.
    let script = std::env::temp_dir().join("hazakura-apple-assist-test-candidate-on-probe.sh");
    let body = "#!/bin/sh\n\
                read -r _request\n\
                printf '%s\\n' '{\"kind\":\"candidate\",\"value\":{\"operation\":\"summarize\",\"candidateText\":\"x\",\"modelId\":\"test\",\"latencyMs\":0}}'\n";
    std::fs::write(&script, body).expect("write script");
    std::fs::set_permissions(&script, std::os::unix::fs::PermissionsExt::from_mode(0o755))
        .expect("chmod script");
    let store = store_with_helper_path(script.clone());
    let result = probe_availability_via_helper(&store)
        .expect("probe returns the parsed envelope; the violation is counted internally");
    assert!(
        matches!(result, WireEnvelope::Candidate(_)),
        "probe returned wrong-shape envelope; expected Candidate, got: {result:?}",
    );
    assert_eq!(
        store.consecutive_failures_for_test(),
        1,
        "wrong-shape envelope on probe must increment the failure counter",
    );
    std::fs::remove_file(&script).ok();
}

#[test]
fn supervisor_generate_treats_availability_envelope_as_protocol_violation() {
    // An `Availability` envelope in response to a `generate_candidate`
    // request is a protocol violation. Same discipline as the
    // probe / Candidate case.
    let script =
        std::env::temp_dir().join("hazakura-apple-assist-test-availability-on-generate.sh");
    let body = "#!/bin/sh\n\
                read -r _request\n\
                printf '%s\\n' '{\"kind\":\"availability\",\"value\":{\"kind\":\"available\"}}'\n";
    std::fs::write(&script, body).expect("write script");
    std::fs::set_permissions(&script, std::os::unix::fs::PermissionsExt::from_mode(0o755))
        .expect("chmod script");
    let store = store_with_helper_path(script.clone());
    let result = generate_candidate_via_helper(&store, "summarize", "body", None, None)
        .expect("generate returns the parsed envelope; the violation is counted internally");
    assert!(
        matches!(result, WireEnvelope::Availability(_)),
        "generate returned wrong-shape envelope; expected Availability, got: {result:?}",
    );
    assert_eq!(
        store.consecutive_failures_for_test(),
        1,
        "wrong-shape envelope on generate must increment the failure counter",
    );
    std::fs::remove_file(&script).ok();
}

#[test]
fn supervisor_treats_malformed_json_response_as_failure() {
    // The helper writes invalid JSON to stdout. The supervisor's
    // serde_json::from_str fails, the round_trip returns Err,
    // and the cooldown discipline treats that as a process
    // failure (reset + count).
    let script = std::env::temp_dir().join("hazakura-apple-assist-test-malformed-json.sh");
    let body = "#!/bin/sh\n\
                read -r _request\n\
                printf '%s\\n' 'not-json-at-all'\n";
    std::fs::write(&script, body).expect("write script");
    std::fs::set_permissions(&script, std::os::unix::fs::PermissionsExt::from_mode(0o755))
        .expect("chmod script");
    let store = store_with_helper_path(script.clone());
    let err =
        probe_availability_via_helper(&store).expect_err("malformed JSON must surface as an error");
    assert!(
        err.contains("Failed to parse") || err.contains("parse"),
        "error should mention the parse failure; got: {err}"
    );
    assert_eq!(
        store.consecutive_failures_for_test(),
        1,
        "malformed JSON must increment the failure counter",
    );
    std::fs::remove_file(&script).ok();
}

#[test]
fn supervisor_treats_eof_response_as_failure() {
    // The helper reads the request and then exits without
    // writing a response. The supervisor's read_line sees EOF
    // (0 bytes), returns "Hazakura Local Assist helper closed the
    // response stream.", which is an Err and counts as a
    // failure.
    let script = std::env::temp_dir().join("hazakura-apple-assist-test-eof.sh");
    let body = "#!/bin/sh\n\
                read -r _request\n\
                exit 0\n";
    std::fs::write(&script, body).expect("write script");
    std::fs::set_permissions(&script, std::os::unix::fs::PermissionsExt::from_mode(0o755))
        .expect("chmod script");
    let store = store_with_helper_path(script.clone());
    let err = probe_availability_via_helper(&store)
        .expect_err("EOF before any data must surface as an error");
    assert!(
        err.contains("closed the response stream") || err.contains("Failed to read"),
        "error should mention closed stream or read failure; got: {err}"
    );
    assert_eq!(
        store.consecutive_failures_for_test(),
        1,
        "EOF response must increment the failure counter",
    );
    std::fs::remove_file(&script).ok();
}

// ----------------------------------------------------------------
// Production helper-path resolver tests (slice 18).
// ----------------------------------------------------------------
//
// These tests pin the production resolver skeleton added in
// slice 17. The slice 17 implementation returns
// `Err("...not configured...")` unconditionally so the
// gate-default-hidden contract is preserved while
// `bundle.externalBin` is still unapproved. The gate-flip slice
// will replace the body of `resolve_bundled_helper_path` with a
// `current_exe().parent()` lookup; these tests lock down:
//
//   - the host triple the supervisor expects
//   - the bundled-helper filename format (Tauri sidecar convention)
//   - the not-configured behavior (gate-default-hidden)
//   - the invariant that the production resolver does NOT read
//     any environment variable, even when shape-suspicious vars
//     are set
//
// `supervisor_store_default_ignores_fixture_env_var` (above)
// already pins the same invariant for `helper_path()`'s
// `Default::default()`-driven call into the store. The new tests
// below pin it for the free function `resolve_bundled_helper_path`
// directly, so a future refactor that wires the production
// resolver into `helper_path()` cannot accidentally reintroduce
// env-var reads.

#[test]
fn resolver_rust_target_triple_matches_host() {
    // The supervisor's host triple is a derived constant for now:
    // the actual binary we run on must report one of the
    // macOS Tauri sidecar triples, or "unknown-target" on an
    // unsupported host. The CI on this project is
    // `aarch64-apple-darwin` / `x86_64-apple-darwin`. Locking the
    // format down here lets us notice if `std::env::consts` ever
    // changes shape (it would not, but a future test that asserts
    // a specific value would catch it).
    let triple = rust_target_triple();
    assert!(
        triple == "aarch64-apple-darwin"
            || triple == "x86_64-apple-darwin"
            || triple == "unknown-target",
        "rust_target_triple() must report a known Tauri sidecar triple, got: {triple}"
    );
    // The function returns a `&'static str`, so the slice can
    // never panic and the lifetime is always valid for the
    // duration of the call.
    let _: &'static str = triple;
}

#[test]
fn resolver_bundled_helper_filename_uses_sidecar_convention() {
    // The production resolver will look for
    // `hazakura-local-assist-helper-<triple>` next to the running
    // executable. Mirror `scripts/build-apple-assist-helper-fixture.sh`'s
    // DEST naming so the same filename works in fixture build,
    // test fixture, and packaged build paths.
    let filename = bundled_helper_filename();
    assert!(
        filename.starts_with("hazakura-local-assist-helper-"),
        "filename must use the sidecar convention, got: {filename}"
    );
    let suffix = filename
        .strip_prefix("hazakura-local-assist-helper-")
        .expect("prefix stripped");
    assert!(
        suffix == "aarch64-apple-darwin"
            || suffix == "x86_64-apple-darwin"
            || suffix == "unknown-target",
        "filename suffix must be a known Tauri sidecar triple, got: {filename}"
    );
    // The filename must never be empty and must never contain a
    // path separator: it is meant to be joined with
    // `current_exe().parent()`, not used as an absolute path.
    assert!(!filename.is_empty(), "filename must not be empty");
    assert!(
        !filename.contains('/') && !filename.contains('\\'),
        "filename must not contain a path separator, got: {filename}"
    );
}

#[test]
fn resolver_resolve_bundled_helper_path_returns_not_configured() {
    // slice 17 invariant: the production resolver must return
    // `Err("...not configured...")` until the gate-flip approval
    // slice replaces the body with a `current_exe().parent()`
    // lookup. Lock the exact substring down so the supervisor's
    // existing error-mapping and the UI's "not configured"
    // branching continue to match.
    let err =
        resolve_bundled_helper_path().expect_err("slice 17 production resolver must return Err");
    assert!(
        err.contains("not configured"),
        "production resolver must report not-configured, got: {err}"
    );
    // And it must never claim the helper is "available": that
    // string is reserved for the post-gate-flip envelope path.
    assert!(
        !err.to_ascii_lowercase().contains("available"),
        "production resolver must never report available, got: {err}"
    );
}

#[test]
fn resolver_production_path_ignores_fixture_env_var() {
    // Symmetric to `supervisor_store_default_ignores_fixture_env_var`
    // above, but pinned against the free function
    // `resolve_bundled_helper_path` directly. The slice 17
    // invariant: this function must NOT read any env var, even
    // if a future contributor sets a path-shaped one in CI.
    //
    // SAFETY: env-var manipulation is single-process and does
    // not race (cargo test is the documented usage of
    // std::env::set_var / remove_var).
    let prev = std::env::var_os("HAZAKURA_APPLE_ASSIST_HELPER_FIXTURE");
    unsafe {
        std::env::set_var("HAZAKURA_APPLE_ASSIST_HELPER_FIXTURE", "/usr/bin/true");
    }
    let err = resolve_bundled_helper_path()
        .expect_err("resolve_bundled_helper_path must ignore the env var");
    assert!(
        err.contains("not configured"),
        "resolve_bundled_helper_path must not honor HAZAKURA_APPLE_ASSIST_HELPER_FIXTURE, got: {err}"
    );
    if let Some(value) = prev {
        unsafe {
            std::env::set_var("HAZAKURA_APPLE_ASSIST_HELPER_FIXTURE", value);
        }
    } else {
        unsafe {
            std::env::remove_var("HAZAKURA_APPLE_ASSIST_HELPER_FIXTURE");
        }
    }
}

#[test]
fn resolver_helper_path_still_reports_not_configured_for_default_store() {
    // Regression for the slice 17 refactor: `helper_path()` now
    // delegates to `resolve_bundled_helper_path()` instead of
    // returning the not-configured error inline. The default
    // store's `helper_path()` must still return the same
    // not-configured error so the existing
    // `supervisor_store_default_constructs_cleanly` /
    // `supervisor_probe_without_helper_returns_err_quickly` /
    // `supervisor_generate_without_helper_returns_err_quickly`
    // tests stay green and the UI's "not configured" branching
    // continues to work.
    let store = AppleAssistHelperStore::default();
    let err = store
        .helper_path()
        .expect_err("default store must still report not-configured");
    assert!(
        err.contains("not configured"),
        "default store's helper_path() must still report not-configured, got: {err}"
    );
    // And `probe` / `generate` against a default store must
    // still bail out before spawning anything.
    let err = probe_availability_via_helper(&store).expect_err("probe must error on default store");
    assert!(
        err.contains("not configured"),
        "probe against default store must still report not-configured, got: {err}"
    );
    let err = generate_candidate_via_helper(&store, "summarize", "body", None, None)
        .expect_err("generate must error on default store");
    assert!(
        err.contains("not configured"),
        "generate against default store must still report not-configured, got: {err}"
    );
}

#[test]
fn resolver_test_only_helper_path_override_still_works() {
    // Regression for the slice 17 refactor: the `cfg(test)`
    // override slot (`store_with_helper_path`) is what
    // `HAZAKURA_APPLE_ASSIST_HELPER_FIXTURE`-driven tests rely
    // on. The refactor only changed the production branch; the
    // `#[cfg(test)]` early-return must still resolve to the
    // injected fixture path (or, when the path is missing, the
    // "missing file" error that
    // `supervisor_store_with_missing_helper_path_reports_missing_file`
    // already pins).
    let bogus = std::env::temp_dir().join("hazakura-no-such-helper-binary");
    let store = store_with_helper_path(bogus.clone());
    let err = store
        .helper_path()
        .expect_err("missing-fixture path must still error");
    assert!(
        err.contains("missing"),
        "missing fixture path must still report missing, got: {err}"
    );
    assert!(
        err.contains(&bogus.display().to_string()),
        "missing fixture error must still include the path, got: {err}"
    );
}
