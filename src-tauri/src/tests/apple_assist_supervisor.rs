// Integration tests for the Apple Local Assist Rust supervisor.
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
//      construction, the "not configured" error from `helper_path()`,
//      `Drop` semantics. These run on every machine.
//
//   2. End-to-end JSON round-trip via the fixture helper built by
//      `scripts/build-apple-assist-helper-fixture.sh`. These are
//      guarded on the `HAZAKURA_APPLE_ASSIST_HELPER_FIXTURE` env
//      var being set to the fixture binary path. They skip
//      cleanly when not set, so CI without the fixture stays
//      green.

// The other per-feature test modules pull `use super::*;` for
// the shared fixtures and re-exported std types. This module
// only touches `crate::commands::apple_assist_supervisor` and
// `std::env` / `std::path`, so it imports those directly and
// skips the shared re-exports.

use crate::commands::apple_assist_supervisor::{
    generate_candidate_via_helper, probe_availability_via_helper, store_with_helper_path,
    store_without_helper, AppleAssistHelperStore, HelperAvailability, HelperCandidate,
    WireEnvelope,
};

// ----------------------------------------------------------------
// Pure-store tests (no helper binary required).
// ----------------------------------------------------------------

#[test]
fn supervisor_store_default_constructs_without_env_var() {
    // SAFETY: the default constructor reads the env var at
    // construction time. Remove it first so the test does not
    // accidentally pick up a fixture path leaked from the shell.
    // SAFETY-justification: tests in this binary do not race on
    // env vars (cargo test is single-process; std::env::set_var
    // / remove_var is the documented way to manipulate the
    // current process's environment).
    let prev = std::env::var_os("HAZAKURA_APPLE_ASSIST_HELPER_FIXTURE");
    // SAFETY: see comment above.
    unsafe {
        std::env::remove_var("HAZAKURA_APPLE_ASSIST_HELPER_FIXTURE");
    }
    let store = AppleAssistHelperStore::default();
    let err = store
        .helper_path()
        .expect_err("default store without env var must report not-configured");
    assert!(
        err.contains("not configured"),
        "error should mention 'not configured', got: {err}"
    );
    // SAFETY: see comment above.
    if let Some(value) = prev {
        unsafe {
            std::env::set_var("HAZAKURA_APPLE_ASSIST_HELPER_FIXTURE", value);
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
    let err =
        generate_candidate_via_helper(&store, "summarize", "body", None).expect_err("must error");
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
    let envelope = generate_candidate_via_helper(&store, "summarize", "body", None)
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
    let envelope = generate_candidate_via_helper(&store, "rephrase", "hello", None)
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
    let envelope = generate_candidate_via_helper(&store, "extract", "body", None);
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
        generate_candidate_via_helper(&store, "summarize", "body 1", None).expect("gen 1"),
        WireEnvelope::Candidate(_)
    ));
    assert!(matches!(
        probe_availability_via_helper(&store).expect("probe 2"),
        WireEnvelope::Availability(_)
    ));
    assert!(matches!(
        generate_candidate_via_helper(&store, "rephrase", "body 2", None).expect("gen 2"),
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
    let envelope =
        generate_candidate_via_helper(&store, "summarize", "body", Some("surrounding paragraph"))
            .expect("generate with context must succeed");
    assert!(matches!(envelope, WireEnvelope::Candidate(_)));
}
