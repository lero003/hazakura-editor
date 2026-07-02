// Tauri command surface for Hazakura Local Assist.
//
// Hazakura Local Assist is an Assist Surface provider class for
// on-device document help. It is NOT a CLI-agent provider and
// does NOT share the External Agent Workbench trust boundary.
// The commands here only:
//   1. Probe whether Foundation Models is reachable
//      (probe_apple_assist_availability).
//   2. Generate a candidate text for a single selected-text
//      operation (generate_apple_assist_candidate).
//
// Candidate generation is gated to the main window only. The
// read-only availability probe is also allowed from the detached
// Hazakura Local Assist window so the companion can disable itself when
// Foundation Models is unavailable. The `*_with_label` shim
// pattern mirrors `commands::agent_workbench` for testability,
// but neither command uses `..._or_agent` — the agent window must
// not be able to invoke Hazakura Local Assist. v0.12 uses the
// bundled Swift helper supervisor for live Foundation Models
// availability and candidate generation. The Rust-only stub
// remains only as a pure test fixture.
//
// See docs/apple-local-assist-distribution-plan.md and
// docs/apple-local-assist-v0.12-design-review.md.
use crate::commands::apple_assist_supervisor::{
    generate_candidate_stream_via_helper, generate_candidate_via_helper,
    probe_availability_via_helper, AppleAssistHelperStore, HelperAvailability, HelperCandidate,
    HelperCandidatePartial, WireEnvelope,
};
use crate::distribution::*;
use crate::security::window_guard::*;
use crate::types::APPLE_ASSIST_APPLY_STATUS_EVENT;
use crate::util::current_time_ms;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::Emitter;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AppleAssistOperation {
    Summarize,
    Rephrase,
    Extract,
    Proofread,
    ExplainDiff,
}

impl AppleAssistOperation {
    // Single source of truth for the v0.12 operation allowlist.
    // Other operations are well-formed in the enum but rejected
    // by `validate_request` until a future slice implements them.
    // The check uses a single match so adding a new operation
    // here is a one-line change; the compiler will flag every
    // callsite that still needs to handle the new variant.
    pub fn is_implemented_in_v0_12(self) -> bool {
        matches!(
            self,
            AppleAssistOperation::Summarize
                | AppleAssistOperation::Rephrase
                | AppleAssistOperation::Proofread,
        )
    }

    pub(crate) fn as_wire_str(self) -> &'static str {
        match self {
            AppleAssistOperation::Summarize => "summarize",
            AppleAssistOperation::Rephrase => "rephrase",
            AppleAssistOperation::Extract => "extract",
            AppleAssistOperation::Proofread => "proofread",
            AppleAssistOperation::ExplainDiff => "explain_diff",
        }
    }

    pub(crate) fn from_wire_str(value: &str) -> Result<Self, String> {
        match value {
            "summarize" => Ok(AppleAssistOperation::Summarize),
            "rephrase" => Ok(AppleAssistOperation::Rephrase),
            "extract" => Ok(AppleAssistOperation::Extract),
            "proofread" => Ok(AppleAssistOperation::Proofread),
            "explain_diff" => Ok(AppleAssistOperation::ExplainDiff),
            other => Err(format!(
                "Hazakura Local Assist helper returned unknown operation: {other}"
            )),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case", tag = "kind")]
pub enum AppleAssistAvailability {
    Available,
    Unavailable { reason: String },
    Disabled,
    Unsupported,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AppleAssistRequest {
    pub operation: AppleAssistOperation,
    pub action_id: Option<String>,
    pub selected_text: String,
    pub document_context: Option<String>,
    pub instruction: Option<String>,
    pub additional_request: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AppleAssistResponse {
    pub operation: AppleAssistOperation,
    pub candidate_text: String,
    pub model_id: String,
    pub latency_ms: u64,
}

pub const APPLE_ASSIST_MAX_SELECTED_CHARS: usize = 4000;
pub const APPLE_ASSIST_MAX_CONTEXT_CHARS: usize = 8000;
pub const APPLE_ASSIST_MAX_INSTRUCTION_CHARS: usize = 1000;

#[tauri::command]
pub(crate) fn probe_apple_assist_availability<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    helper_store: tauri::State<'_, Arc<AppleAssistHelperStore>>,
) -> Result<AppleAssistAvailability, String> {
    probe_apple_assist_availability_with_label(window.label(), helper_store.inner().as_ref())
}

pub(crate) fn probe_apple_assist_availability_with_label(
    label: &str,
    helper_store: &AppleAssistHelperStore,
) -> Result<AppleAssistAvailability, String> {
    ensure_label_is_main_or_apple_assist(label)?;
    ensure_apple_assist_allowed_by_distribution()?;
    probe_apple_assist_availability_with_helper(helper_store)
}

pub(crate) fn probe_apple_assist_availability_with_helper(
    helper_store: &AppleAssistHelperStore,
) -> Result<AppleAssistAvailability, String> {
    #[cfg(target_os = "macos")]
    {
        match probe_availability_via_helper(helper_store)? {
            WireEnvelope::Availability(value) => Ok(map_helper_availability(value)),
            WireEnvelope::Error(error) => Ok(AppleAssistAvailability::Unavailable {
                reason: error.error,
            }),
            WireEnvelope::Candidate(_) | WireEnvelope::CandidatePartial(_) => Err(
                "Hazakura Local Assist helper returned a candidate envelope for an availability probe."
                    .to_string(),
            ),
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = helper_store;
        Ok(AppleAssistAvailability::Unsupported)
    }
}

#[tauri::command]
pub(crate) fn generate_apple_assist_candidate<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    helper_store: tauri::State<'_, Arc<AppleAssistHelperStore>>,
    request: AppleAssistRequest,
) -> Result<AppleAssistResponse, String> {
    generate_apple_assist_candidate_with_label(
        window.label(),
        helper_store.inner().as_ref(),
        request,
    )
}

pub(crate) fn generate_apple_assist_candidate_with_label(
    label: &str,
    helper_store: &AppleAssistHelperStore,
    request: AppleAssistRequest,
) -> Result<AppleAssistResponse, String> {
    ensure_label_is_main(label)?;
    ensure_apple_assist_allowed_by_distribution()?;
    validate_request(&request)?;
    generate_apple_assist_candidate_with_helper(helper_store, &request)
}

#[tauri::command]
pub(crate) async fn generate_apple_assist_candidate_streaming<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    app: tauri::AppHandle<R>,
    helper_store: tauri::State<'_, Arc<AppleAssistHelperStore>>,
    request: AppleAssistRequest,
    request_id: String,
    request_label: String,
) -> Result<AppleAssistResponse, String> {
    ensure_label_is_main(window.label())?;
    ensure_apple_assist_allowed_by_distribution()?;
    validate_request(&request)?;

    let helper_store = Arc::clone(helper_store.inner());
    tauri::async_runtime::spawn_blocking(move || {
        generate_apple_assist_candidate_with_helper_streaming(
            helper_store.as_ref(),
            &request,
            |partial| {
                emit_partial_status(&app, &request_id, &request_label, partial);
            },
        )
    })
    .await
    .map_err(|e| format!("Hazakura Local Assist streaming task failed: {e}"))?
}

/// Stop any in-flight Hazakura Local Assist generation. Kills the
/// helper child through the shared cancel handle so the blocking
/// `spawn_blocking` generation unblocks and resolves with a cancel
/// error. Idempotent: a no-op when no generation is active.
///
/// Allowed from both the main window and the detached Hazakura Local
/// Assist (`apple-assist`) window: the cancel button lives in the
/// companion window, while the window/tab-close shutdown paths fire
/// from the main window. The agent window and any other label are
/// rejected. `ensure_apple_assist_allowed_by_distribution` still
/// gates the App Store lane boundary.
#[tauri::command]
pub(crate) fn stop_apple_assist_candidate<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    helper_store: tauri::State<'_, Arc<AppleAssistHelperStore>>,
) -> Result<bool, String> {
    ensure_label_is_main_or_apple_assist(window.label())?;
    ensure_apple_assist_allowed_by_distribution()?;
    Ok(helper_store.inner().cancel_active())
}

#[cfg(desktop)]
#[cfg_attr(not(test), allow(dead_code))]
pub(crate) fn probe_apple_assist_availability_with_label_for_lane(
    label: &str,
    lane: Option<&str>,
) -> Result<(), String> {
    ensure_label_is_main_or_apple_assist(label)?;
    ensure_apple_assist_allowed_for_lane(lane)
}

#[cfg(desktop)]
#[cfg_attr(not(test), allow(dead_code))]
pub(crate) fn generate_apple_assist_candidate_with_label_for_lane(
    label: &str,
    lane: Option<&str>,
) -> Result<(), String> {
    ensure_label_is_main(label)?;
    ensure_apple_assist_allowed_for_lane(lane)
}

// Pure validation. The `with_label` wrapper is the gate; this
// function is the contract. Tests exercise the contract
// directly without going through a Tauri command context.
pub(crate) fn validate_request(request: &AppleAssistRequest) -> Result<(), String> {
    if !request.operation.is_implemented_in_v0_12() {
        return Err(format!(
            "Hazakura Local Assist operation '{:?}' is not implemented in v0.12 (deferred).",
            request.operation
        ));
    }
    if request.selected_text.chars().count() > APPLE_ASSIST_MAX_SELECTED_CHARS {
        return Err(format!(
            "Selected text exceeds the maximum length of {} characters.",
            APPLE_ASSIST_MAX_SELECTED_CHARS
        ));
    }
    if let Some(context) = &request.document_context {
        if context.chars().count() > APPLE_ASSIST_MAX_CONTEXT_CHARS {
            return Err(format!(
                "Document context exceeds the maximum length of {} characters.",
                APPLE_ASSIST_MAX_CONTEXT_CHARS
            ));
        }
    }
    if let Some(instruction) = &request.instruction {
        if instruction.chars().count() > APPLE_ASSIST_MAX_INSTRUCTION_CHARS {
            return Err(format!(
                "Hazakura Local Assist instruction exceeds the maximum length of {} characters.",
                APPLE_ASSIST_MAX_INSTRUCTION_CHARS
            ));
        }
    }
    if let Some(additional_request) = &request.additional_request {
        if additional_request.chars().count() > APPLE_ASSIST_MAX_INSTRUCTION_CHARS {
            return Err(format!(
                "Hazakura Local Assist additional request exceeds the maximum length of {} characters.",
                APPLE_ASSIST_MAX_INSTRUCTION_CHARS
            ));
        }
    }
    Ok(())
}

pub(crate) fn generate_apple_assist_candidate_with_helper(
    helper_store: &AppleAssistHelperStore,
    request: &AppleAssistRequest,
) -> Result<AppleAssistResponse, String> {
    #[cfg(target_os = "macos")]
    {
        match generate_candidate_via_helper(
            helper_store,
            request.operation.as_wire_str(),
            &request.selected_text,
            request.document_context.as_deref(),
            request.instruction.as_deref(),
            request.action_id.as_deref(),
            request.additional_request.as_deref(),
        )? {
            WireEnvelope::Candidate(value) => map_helper_candidate(value),
            WireEnvelope::Error(error) => Err(error.error),
            WireEnvelope::Availability(_) | WireEnvelope::CandidatePartial(_) => Err(
                "Hazakura Local Assist helper returned an availability envelope for candidate generation."
                    .to_string(),
            ),
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = helper_store;
        let _ = request;
        Err("Hazakura Local Assist is supported on macOS only.".to_string())
    }
}

pub(crate) fn generate_apple_assist_candidate_with_helper_streaming<F>(
    helper_store: &AppleAssistHelperStore,
    request: &AppleAssistRequest,
    on_partial: F,
) -> Result<AppleAssistResponse, String>
where
    F: FnMut(HelperCandidatePartial),
{
    #[cfg(target_os = "macos")]
    {
        match generate_candidate_stream_via_helper(
            helper_store,
            request.operation.as_wire_str(),
            &request.selected_text,
            request.document_context.as_deref(),
            request.instruction.as_deref(),
            request.action_id.as_deref(),
            request.additional_request.as_deref(),
            on_partial,
        )? {
            WireEnvelope::Candidate(value) => map_helper_candidate(value),
            WireEnvelope::Error(error) => Err(error.error),
            WireEnvelope::Availability(_) | WireEnvelope::CandidatePartial(_) => Err(
                "Hazakura Local Assist helper returned a non-final envelope for streaming candidate generation."
                    .to_string(),
            ),
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = helper_store;
        let _ = request;
        let _ = on_partial;
        Err("Hazakura Local Assist is supported on macOS only.".to_string())
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct AppleAssistApplyStatusPayload {
    phase: &'static str,
    request_id: String,
    message: String,
    request: String,
    partial_text: String,
    emitted_at_ms: u64,
}

fn emit_partial_status<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    request_id: &str,
    request_label: &str,
    partial: HelperCandidatePartial,
) {
    let payload = AppleAssistApplyStatusPayload {
        phase: "partial",
        request_id: request_id.to_string(),
        message: "Hazakura Local Assist partial candidate".to_string(),
        request: request_label.to_string(),
        partial_text: partial.candidate_text,
        emitted_at_ms: current_time_ms(),
    };
    let _ = app.emit_to(
        APPLE_ASSIST_WINDOW_LABEL,
        APPLE_ASSIST_APPLY_STATUS_EVENT,
        payload,
    );
}

pub(crate) fn map_helper_availability(value: HelperAvailability) -> AppleAssistAvailability {
    match value.kind.as_str() {
        "available" => AppleAssistAvailability::Available,
        "disabled" => AppleAssistAvailability::Disabled,
        "unsupported" => AppleAssistAvailability::Unsupported,
        "unavailable" => AppleAssistAvailability::Unavailable {
            reason: value
                .reason
                .unwrap_or_else(|| "Hazakura Local Assist is unavailable.".to_string()),
        },
        other => AppleAssistAvailability::Unavailable {
            reason: format!(
                "Hazakura Local Assist helper returned unknown availability kind: {other}"
            ),
        },
    }
}

pub(crate) fn map_helper_candidate(value: HelperCandidate) -> Result<AppleAssistResponse, String> {
    Ok(AppleAssistResponse {
        operation: AppleAssistOperation::from_wire_str(&value.operation)?,
        candidate_text: value.candidate_text,
        model_id: value.model_id,
        latency_ms: value.latency_ms,
    })
}

// Stub candidate generation. v0.12 never calls Foundation
// Models. The stub returns the selected text with a leading
// marker so the Review Desk can show the candidate without it
// being identical to the input. Future slices replace this with
// a real Foundation Models binding; the signature stays the
// same so the slice 3 hook does not change.
#[cfg(test)]
pub(crate) fn generate_apple_assist_candidate_with_stub(
    request: &AppleAssistRequest,
) -> AppleAssistResponse {
    let prefix = match request.operation {
        AppleAssistOperation::Summarize => "【要約案】\n",
        AppleAssistOperation::Rephrase => "【書き換え案】\n",
        AppleAssistOperation::Extract => "【抽出案】\n",
        AppleAssistOperation::Proofread => "【校正案】\n",
        AppleAssistOperation::ExplainDiff => "【差分説明案】\n",
    };
    AppleAssistResponse {
        operation: request.operation,
        candidate_text: format!("{}{}", prefix, request.selected_text),
        model_id: "stub:v0.12".to_string(),
        latency_ms: 0,
    }
}
