// Tauri command surface for Apple Local Assist.
//
// Apple Local Assist is an Assist Surface provider class for
// on-device document help. It is NOT a CLI-agent provider and
// does NOT share the External Agent Workbench trust boundary.
// The commands here only:
//   1. Probe whether Foundation Models is reachable
//      (probe_apple_assist_availability).
//   2. Generate a candidate text for a single selected-text
//      operation (generate_apple_assist_candidate).
//
// Both are gated to the main window only. The
// `*_with_label` shim pattern mirrors `commands::agent_workbench`
// for testability, but the gate helper is
// `ensure_label_is_main` (not `..._or_agent`) — the agent
// window must not be able to invoke Apple Local Assist. v0.12
// ships a Rust-only stub for both commands; the real
// Foundation Models binding lives behind the `*_with_platform`
// shims so it can be swapped in without touching the command
// surface or the test surface.
//
// See docs/apple-local-assist-distribution-plan.md and
// docs/apple-local-assist-v0.12-design-review.md.
use crate::security::window_guard::*;
use serde::{Deserialize, Serialize};

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
            AppleAssistOperation::Summarize | AppleAssistOperation::Rephrase,
        )
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
pub struct AppleAssistRequest {
    pub operation: AppleAssistOperation,
    pub selected_text: String,
    pub document_context: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AppleAssistResponse {
    pub operation: AppleAssistOperation,
    pub candidate_text: String,
    pub model_id: String,
    pub latency_ms: u64,
}

pub const APPLE_ASSIST_MAX_SELECTED_CHARS: usize = 4000;
pub const APPLE_ASSIST_MAX_CONTEXT_CHARS: usize = 8000;

#[tauri::command]
pub(crate) fn probe_apple_assist_availability<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
) -> Result<AppleAssistAvailability, String> {
    probe_apple_assist_availability_with_label(window.label())
}

pub(crate) fn probe_apple_assist_availability_with_label(
    label: &str,
) -> Result<AppleAssistAvailability, String> {
    ensure_label_is_main(label)?;
    Ok(probe_apple_assist_availability_with_platform())
}

// Platform-bound probe stub. A future slice that wires a real
// Foundation Models binding replaces the body; the signature
// stays the same so callers and tests do not change.
//
// v0.12 behavior is intentionally "gate-default-hidden":
//   - macOS: report Unavailable with an explicit reason. The
//     Foundation Models binding is not yet wired in this build
//     (slice 5 only proved the SwiftPM helper fixture). Saying
//     Available here would surface the command palette entries
//     on real Mac hardware and let the UI fire stub candidates
//     as if the feature were real. Until the live binding
//     lands, the probe must say Unavailable so the React side
//     keeps the entries hidden.
//   - non-macOS: report Unsupported. Foundation Models does not
//     exist on the platform, and there is no Swift path to
//     prove it.
pub(crate) fn probe_apple_assist_availability_with_platform() -> AppleAssistAvailability {
    #[cfg(target_os = "macos")]
    {
        AppleAssistAvailability::Unavailable {
            reason: "Foundation Models binding is not yet implemented in this build.".to_string(),
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        AppleAssistAvailability::Unsupported
    }
}

#[tauri::command]
pub(crate) fn generate_apple_assist_candidate<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    request: AppleAssistRequest,
) -> Result<AppleAssistResponse, String> {
    generate_apple_assist_candidate_with_label(window.label(), request)
}

pub(crate) fn generate_apple_assist_candidate_with_label(
    label: &str,
    request: AppleAssistRequest,
) -> Result<AppleAssistResponse, String> {
    ensure_label_is_main(label)?;
    validate_request(&request)?;
    Ok(generate_apple_assist_candidate_with_stub(&request))
}

// Pure validation. The `with_label` wrapper is the gate; this
// function is the contract. Tests exercise the contract
// directly without going through a Tauri command context.
pub(crate) fn validate_request(request: &AppleAssistRequest) -> Result<(), String> {
    if !request.operation.is_implemented_in_v0_12() {
        return Err(format!(
            "Apple Local Assist operation '{:?}' is not implemented in v0.12 (deferred).",
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
    Ok(())
}

// Stub candidate generation. v0.12 never calls Foundation
// Models. The stub returns the selected text with a leading
// marker so the Review Desk can show the candidate without it
// being identical to the input. Future slices replace this with
// a real Foundation Models binding; the signature stays the
// same so the slice 3 hook does not change.
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
