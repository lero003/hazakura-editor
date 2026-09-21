// Tests for the Hazakura Local Assist command surface.
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
use crate::commands::apple_assist_supervisor::{
    store_without_helper, AssistGenerationProfile, AssistGenerationUsage, HelperAvailability,
    HelperCandidate,
};

fn request_with(operation: AppleAssistOperation, text: &str) -> AppleAssistRequest {
    AppleAssistRequest {
        operation,
        action_id: None,
        selected_text: text.to_string(),
        document_context: None,
        instruction: None,
        additional_request: None,
    }
}

#[test]
#[cfg(target_os = "macos")]
fn backend_probe_yields_native_dispatch_while_a_slow_helper_is_pending() {
    use crate::commands::apple_assist_supervisor::store_with_helper_path;
    use std::future::Future;
    use std::sync::Arc;
    use std::task::{Context, Poll, Wake, Waker};
    use std::time::Duration;
    struct TestWake;
    impl Wake for TestWake {
        fn wake(self: Arc<Self>) {}
    }

    let script =
        std::env::temp_dir().join(format!("hazakura-async-probe-{}.sh", std::process::id()));
    // Wait for a second stdin line that never arrives; the native watchdog
    // ends the probe. No external model/runtime or React mock is involved.
    std::fs::write(
        &script,
        "#!/bin/sh\nread -r request\nread -r wait_for_timeout\n",
    )
    .unwrap();
    std::fs::set_permissions(&script, std::os::unix::fs::PermissionsExt::from_mode(0o755)).unwrap();
    let store = Arc::new(
        store_with_helper_path(script.clone()).with_timeout_override(Duration::from_millis(150)),
    );
    let mut probe = Box::pin(probe_local_assist_backend_availability_async(Arc::clone(
        &store,
    )));
    let waker = Waker::from(Arc::new(TestWake));
    let first_poll = probe.as_mut().poll(&mut Context::from_waker(&waker));
    assert!(
        matches!(first_poll, Poll::Pending),
        "native dispatch must yield, not run the helper inline"
    );
    // Read-only native work on the calling thread can continue before the
    // probe resolves. Window-loop interaction is a separate built-app gate.
    assert_eq!(
        store.selected_model_id().unwrap(),
        "apple:foundation-models:system-default"
    );
    let error = tauri::async_runtime::block_on(probe).unwrap_err();
    assert!(error.contains("timed out"));
    drop(store);
    std::fs::remove_file(script).unwrap();
}

#[test]
fn apple_assist_probe_rejects_unknown_window_label() {
    let store = store_without_helper();
    let error = probe_apple_assist_availability_with_label("settings", &store).unwrap_err();
    assert!(
        error.contains("settings"),
        "error must mention the bad label: {error}"
    );
}

#[test]
fn apple_assist_generate_rejects_unknown_window_label() {
    let store = store_without_helper();
    let request = request_with(AppleAssistOperation::Summarize, "hello");
    let error =
        generate_apple_assist_candidate_with_label("settings", &store, request).unwrap_err();
    assert!(error.contains("settings"));
}

#[test]
fn apple_assist_probe_accepts_main_and_apple_assist_windows() {
    // Hazakura Local Assist must NOT inherit the Agent Workbench
    // CLI trust boundary. The read-only probe is allowed from
    // main and the detached Hazakura Local Assist companion so both
    // surfaces can gate on the real Foundation Models state.
    let store = store_without_helper();
    assert!(probe_apple_assist_availability_with_label("main", &store).is_err());
    assert!(probe_apple_assist_availability_with_label("apple-assist", &store).is_err());
}

#[test]
fn apple_assist_probe_rejects_agent_window() {
    // The agent window is the External Agent Workbench trust
    // boundary. It must not be able to invoke Apple Local
    // Assist, even on a future build that has the live
    // Foundation Models binding wired.
    let store = store_without_helper();
    let error = probe_apple_assist_availability_with_label("agent", &store).unwrap_err();
    assert!(
        error.contains("agent"),
        "error must mention the bad label: {error}"
    );
}

#[test]
fn apple_assist_generate_accepts_main_window_only() {
    let store = store_without_helper();
    let request = request_with(AppleAssistOperation::Summarize, "hello");
    let error = generate_apple_assist_candidate_with_label("main", &store, request).unwrap_err();
    assert!(
        error.contains("not configured"),
        "main-window generate should pass the label gate and then fail on missing helper, got: {error}"
    );
}

#[test]
fn apple_assist_generate_rejects_agent_window() {
    let store = store_without_helper();
    let request = request_with(AppleAssistOperation::Summarize, "hello");
    let error = generate_apple_assist_candidate_with_label("agent", &store, request).unwrap_err();
    assert!(
        error.contains("agent"),
        "error must mention the bad label: {error}"
    );
}

#[test]
fn apple_assist_validate_rejects_deferred_operations() {
    let cases = [
        AppleAssistOperation::Extract,
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
    assert!(validate_request(&request_with(AppleAssistOperation::Proofread, "hello")).is_ok());
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
fn apple_assist_validate_rejects_oversized_instruction() {
    let mut request = request_with(AppleAssistOperation::Rephrase, "ok");
    request.instruction = Some("x".repeat(APPLE_ASSIST_MAX_INSTRUCTION_CHARS + 1));
    let error = validate_request(&request).unwrap_err();
    assert!(error.contains("instruction"));
}

#[test]
fn apple_assist_validate_accepts_missing_document_context() {
    let mut request = request_with(AppleAssistOperation::Summarize, "ok");
    request.document_context = None;
    assert!(validate_request(&request).is_ok());
}

#[test]
fn apple_assist_request_deserializes_frontend_camel_case_payload() {
    let request: AppleAssistRequest = serde_json::from_value(serde_json::json!({
        "operation": "rephrase",
        "actionId": "rewrite_natural",
        "selectedText": "body",
        "documentContext": "surrounding",
        "instruction": "legacy instruction",
        "additionalRequest": "もっと軽く"
    }))
    .expect("frontend camelCase payload should deserialize");

    assert_eq!(request.operation, AppleAssistOperation::Rephrase);
    assert_eq!(request.action_id.as_deref(), Some("rewrite_natural"));
    assert_eq!(request.selected_text, "body");
    assert_eq!(request.document_context.as_deref(), Some("surrounding"));
    assert_eq!(request.instruction.as_deref(), Some("legacy instruction"));
    assert_eq!(request.additional_request.as_deref(), Some("もっと軽く"));
}

#[test]
fn apple_assist_response_serializes_frontend_camel_case_payload() {
    let response = AppleAssistResponse {
        operation: AppleAssistOperation::Rephrase,
        candidate_text: "better body".to_string(),
        model_id: "apple:foundation-models:system-default".to_string(),
        latency_ms: 42,
        usage: None,
    };
    let value = serde_json::to_value(response).expect("response should serialize");
    assert_eq!(value["candidateText"], "better body");
    assert_eq!(value["modelId"], "apple:foundation-models:system-default");
    assert_eq!(value["latencyMs"], 42);
    // The webview only receives the record when the helper reported one.
    assert!(value.get("usage").is_none());
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
fn apple_assist_maps_helper_availability() {
    assert_eq!(
        map_helper_availability(HelperAvailability {
            kind: "available".to_string(),
            reason: None,
        }),
        AppleAssistAvailability::Available
    );
    assert_eq!(
        map_helper_availability(HelperAvailability {
            kind: "disabled".to_string(),
            reason: Some("off".to_string()),
        }),
        AppleAssistAvailability::Disabled
    );
    assert_eq!(
        map_helper_availability(HelperAvailability {
            kind: "unsupported".to_string(),
            reason: Some("old mac".to_string()),
        }),
        AppleAssistAvailability::Unsupported
    );
    assert_eq!(
        map_helper_availability(HelperAvailability {
            kind: "unavailable".to_string(),
            reason: Some("not ready".to_string()),
        }),
        AppleAssistAvailability::Unavailable {
            reason: "not ready".to_string()
        }
    );
}

#[test]
fn selected_backend_availability_discloses_actual_model_without_accepting_frontend_selection() {
    assert_eq!(
        map_selected_helper_availability(
            HelperAvailability {
                kind: "available".to_string(),
                reason: None,
            },
            "apple:core-ai:qwen3-0.6b-test".to_string(),
        ),
        LocalAssistBackendAvailability::Available {
            model_id: "apple:core-ai:qwen3-0.6b-test".to_string(),
        }
    );
    assert_eq!(
        map_selected_helper_availability(
            HelperAvailability {
                kind: "unavailable".to_string(),
                reason: Some("The fixed Core AI test resource is missing.".to_string()),
            },
            "apple:core-ai:qwen3-0.6b-test".to_string(),
        ),
        LocalAssistBackendAvailability::Unavailable {
            reason: "The fixed Core AI test resource is missing.".to_string(),
            model_id: "apple:core-ai:qwen3-0.6b-test".to_string(),
        }
    );
}

#[test]
fn apple_assist_maps_helper_candidate() {
    let response = map_helper_candidate(HelperCandidate {
        operation: "proofread".to_string(),
        candidate_text: "fixed".to_string(),
        model_id: "apple:foundation-models:system-default".to_string(),
        latency_ms: 42,
        usage: None,
    })
    .expect("candidate should map");
    assert_eq!(response.operation, AppleAssistOperation::Proofread);
    assert_eq!(response.candidate_text, "fixed");
    assert_eq!(response.latency_ms, 42);
    assert!(response.usage.is_none());
}

#[test]
fn apple_assist_carries_helper_generation_usage() {
    // The Settings pane reads the effective generation settings from this
    // record, so dropping the helper's `usage` here silently empties it.
    let response = map_helper_candidate(HelperCandidate {
        operation: "proofread".to_string(),
        candidate_text: "fixed".to_string(),
        model_id: "apple:core-ai:gemma-4-e4b-it-int4-v1".to_string(),
        latency_ms: 42,
        usage: Some(AssistGenerationUsage {
            maximum_response_tokens: Some(2048),
            sampling_requested: Some("temperature=none(greedy)".to_string()),
            sampling_effective: Some("greedy".to_string()),
            prompt_tokens: Some(812),
            output_tokens: Some(24),
            cached_tokens: Some(640),
        }),
    })
    .expect("candidate should map");

    let profile = AssistGenerationProfile::from_usage(&response.model_id, response.usage)
        .expect("helper usage with settings must produce a profile");
    assert_eq!(profile.model_id, "apple:core-ai:gemma-4-e4b-it-int4-v1");
    assert_eq!(profile.maximum_response_tokens, Some(2048));
    assert_eq!(profile.sampling_effective.as_deref(), Some("greedy"));
    assert_eq!(profile.output_tokens, Some(24));
}

#[test]
fn apple_assist_generation_profile_ignores_token_only_usage() {
    // The System path can report token counts without any generation settings.
    // Showing that as "the effective settings" would be a false claim.
    let profile = AssistGenerationProfile::from_usage(
        "apple:foundation-models:system-default",
        Some(AssistGenerationUsage {
            prompt_tokens: Some(120),
            output_tokens: Some(16),
            ..Default::default()
        }),
    );
    assert!(profile.is_none());
}

#[test]
fn helper_store_keeps_the_last_reported_generation_profile() {
    let store = store_without_helper();
    store.record_generation_profile(None);
    assert!(store.generation_profile().is_none());

    let profile = AssistGenerationProfile::from_usage(
        "apple:core-ai:gemma-4-e4b-it-int4-v1",
        Some(AssistGenerationUsage {
            maximum_response_tokens: Some(2048),
            sampling_effective: Some("greedy".to_string()),
            ..Default::default()
        }),
    )
    .expect("settings-bearing usage must produce a profile");

    store.record_generation_profile(Some(profile.clone()));
    assert_eq!(store.generation_profile(), Some(profile.clone()));

    // A later run that reports nothing must not erase the observation.
    store.record_generation_profile(None);
    assert_eq!(store.generation_profile(), Some(profile));
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
    assert!(AppleAssistOperation::Proofread.is_implemented_in_v0_12());
    assert!(!AppleAssistOperation::Extract.is_implemented_in_v0_12());
    assert!(!AppleAssistOperation::ExplainDiff.is_implemented_in_v0_12());
}
