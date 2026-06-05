// Tests for the Apple Local Assist command surface.
//
// These tests exercise the `*_with_label` shims and the pure
// validation / stub helpers in `commands::apple_assist`. The
// shim discipline mirrors `commands::agent_workbench` so a
// future rewrite of the real Foundation Models binding only
// needs to swap the body of `*_with_platform` / `*_with_stub`.
//
// The Tauri-runtime command bodies themselves are not
// separately tested here — the label gate is the only
// window-context concern, and the `*_with_label` shim covers
// that.

use crate::commands::apple_assist::*;

fn request_with(operation: AppleAssistOperation, text: &str) -> AppleAssistRequest {
    AppleAssistRequest {
        operation,
        selected_text: text.to_string(),
        document_context: None,
    }
}

#[test]
fn apple_assist_probe_rejects_unknown_window_label() {
    let error = probe_apple_assist_availability_with_label("settings").unwrap_err();
    assert!(
        error.contains("settings"),
        "error must mention the bad label: {error}"
    );
}

#[test]
fn apple_assist_generate_rejects_unknown_window_label() {
    let request = request_with(AppleAssistOperation::Summarize, "hello");
    let error = generate_apple_assist_candidate_with_label("settings", request).unwrap_err();
    assert!(error.contains("settings"));
}

#[test]
fn apple_assist_probe_accepts_main_window_only() {
    // Apple Local Assist must NOT inherit the Agent Workbench
    // CLI trust boundary — the IPC is main-only. The probe is
    // allowed from the main window so the command palette can
    // gate the entries on the real Foundation Models state.
    assert!(probe_apple_assist_availability_with_label("main").is_ok());
}

#[test]
fn apple_assist_probe_rejects_agent_window() {
    // The agent window is the External Agent Workbench trust
    // boundary. It must not be able to invoke Apple Local
    // Assist, even on a future build that has the live
    // Foundation Models binding wired.
    let error = probe_apple_assist_availability_with_label("agent").unwrap_err();
    assert!(
        error.contains("agent"),
        "error must mention the bad label: {error}"
    );
}

#[test]
fn apple_assist_generate_accepts_main_window_only() {
    let request = request_with(AppleAssistOperation::Summarize, "hello");
    assert!(generate_apple_assist_candidate_with_label("main", request).is_ok());
}

#[test]
fn apple_assist_generate_rejects_agent_window() {
    let request = request_with(AppleAssistOperation::Summarize, "hello");
    let error = generate_apple_assist_candidate_with_label("agent", request).unwrap_err();
    assert!(
        error.contains("agent"),
        "error must mention the bad label: {error}"
    );
}

#[test]
fn apple_assist_validate_rejects_deferred_operations() {
    let cases = [
        AppleAssistOperation::Extract,
        AppleAssistOperation::Proofread,
        AppleAssistOperation::ExplainDiff,
    ];
    for op in cases {
        let request = request_with(op, "hello");
        let error = validate_request(&request).unwrap_err();
        assert!(
            error.contains("not implemented in v0.12"),
            "{op:?} should be rejected as deferred, got: {error}"
        );
    }
}

#[test]
fn apple_assist_validate_accepts_v0_12_operations() {
    assert!(validate_request(&request_with(AppleAssistOperation::Summarize, "hello")).is_ok());
    assert!(validate_request(&request_with(AppleAssistOperation::Rephrase, "hello")).is_ok());
}

#[test]
fn apple_assist_validate_rejects_oversized_selected_text() {
    let text = "a".repeat(APPLE_ASSIST_MAX_SELECTED_CHARS + 1);
    let request = request_with(AppleAssistOperation::Summarize, &text);
    let error = validate_request(&request).unwrap_err();
    assert!(error.contains("Selected text"));
    assert!(error.contains(&APPLE_ASSIST_MAX_SELECTED_CHARS.to_string()));
}

#[test]
fn apple_assist_validate_accepts_selected_text_at_boundary() {
    let text = "a".repeat(APPLE_ASSIST_MAX_SELECTED_CHARS);
    assert!(validate_request(&request_with(AppleAssistOperation::Summarize, &text)).is_ok());
}

#[test]
fn apple_assist_validate_counts_chars_not_bytes_for_oversize_check() {
    // 4001 chars of 4-byte CJK = 16004 bytes, but char count
    // matters. Capping by bytes would silently truncate the
    // input and hide a real overflow from the user.
    let text: String = "あ".repeat(APPLE_ASSIST_MAX_SELECTED_CHARS + 1);
    let request = request_with(AppleAssistOperation::Summarize, &text);
    assert!(
        validate_request(&request).is_err(),
        "char-count overflow must be rejected"
    );
}

#[test]
fn apple_assist_validate_rejects_oversized_document_context() {
    let context = "x".repeat(APPLE_ASSIST_MAX_CONTEXT_CHARS + 1);
    let mut request = request_with(AppleAssistOperation::Summarize, "ok");
    request.document_context = Some(context);
    let error = validate_request(&request).unwrap_err();
    assert!(error.contains("Document context"));
}

#[test]
fn apple_assist_validate_accepts_missing_document_context() {
    let mut request = request_with(AppleAssistOperation::Summarize, "ok");
    request.document_context = None;
    assert!(validate_request(&request).is_ok());
}

#[test]
fn apple_assist_stub_emits_operation_specific_prefix() {
    let cases = [
        (AppleAssistOperation::Summarize, "【要約案】"),
        (AppleAssistOperation::Rephrase, "【書き換え案】"),
        (AppleAssistOperation::Extract, "【抽出案】"),
        (AppleAssistOperation::Proofread, "【校正案】"),
        (AppleAssistOperation::ExplainDiff, "【差分説明案】"),
    ];
    for (op, prefix) in cases {
        let request = request_with(op, "body");
        let response = generate_apple_assist_candidate_with_stub(&request);
        assert_eq!(response.operation, op);
        assert!(
            response.candidate_text.starts_with(prefix),
            "{op:?} candidate must start with {prefix:?}, got {:?}",
            response.candidate_text
        );
        assert!(response.candidate_text.contains("body"));
        assert_eq!(response.model_id, "stub:v0.12");
        assert_eq!(response.latency_ms, 0);
    }
}

#[test]
fn apple_assist_stub_does_not_call_foundation_models() {
    // Belt-and-braces: the v0.12 contract is "no Foundation
    // Models call from Rust". The stub returns immediately
    // with modelId: "stub:v0.12" so any future regression that
    // routes through a real Foundation Models call will be
    // visible as a different modelId in a test failure.
    let request = request_with(AppleAssistOperation::Summarize, "hello");
    let response = generate_apple_assist_candidate_with_stub(&request);
    assert!(response.model_id.starts_with("stub:"));
}

#[test]
fn apple_assist_probe_platform_reflects_target_os() {
    // v0.12 is intentionally "gate-default-hidden" until the live
    // Foundation Models binding is wired. On macOS the probe must
    // NOT report Available (that would surface the command palette
    // entries on real hardware and let stub candidates flow as if
    // real). On other platforms the binding does not exist at all.
    let availability = probe_apple_assist_availability_with_platform();
    #[cfg(target_os = "macos")]
    match &availability {
        AppleAssistAvailability::Unavailable { reason } => {
            assert!(
                reason.contains("Foundation Models"),
                "macOS reason must mention Foundation Models, got: {reason}"
            );
        }
        other => panic!("macOS probe must be Unavailable, got: {other:?}"),
    }
    #[cfg(not(target_os = "macos"))]
    assert_eq!(availability, AppleAssistAvailability::Unsupported);
}

#[test]
fn apple_assist_probe_is_not_available_in_v0_12() {
    // Belt-and-braces: the v0.12 contract is "probe never returns
    // Available". When a future slice lands the live Foundation
    // Models binding, this test is the one that must flip to
    // assert availability against the real Foundation Models
    // state. Until then, the probe must say Unavailable or
    // Unsupported so the React side keeps the command palette
    // entries hidden.
    let availability = probe_apple_assist_availability_with_platform();
    assert_ne!(
        availability,
        AppleAssistAvailability::Available,
        "v0.12 probe must never report Available"
    );
}

#[test]
fn apple_assist_operation_allowlist_is_explicit() {
    // The whole point of `is_implemented_in_v0_12` is to be a
    // single match that the compiler will flag at every future
    // enum-add. Pin the truth here so adding a new operation
    // without updating the allowlist fails CI rather than
    // silently shipping.
    assert!(AppleAssistOperation::Summarize.is_implemented_in_v0_12());
    assert!(AppleAssistOperation::Rephrase.is_implemented_in_v0_12());
    assert!(!AppleAssistOperation::Extract.is_implemented_in_v0_12());
    assert!(!AppleAssistOperation::Proofread.is_implemented_in_v0_12());
    assert!(!AppleAssistOperation::ExplainDiff.is_implemented_in_v0_12());
}
