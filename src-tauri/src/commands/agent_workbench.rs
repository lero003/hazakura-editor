// Tauri command surface for the Agent Workbench.
//
// This file is the thin glue between the window-label gate
// (`security::window_guard`) and the in-process session state
// machine (now living in `crate::agent`). The `*_with_label`
// wrappers own the label check + the construction of the
// `RealAgentRuntimeAdapter`; everything below the line — the
// store mutation, the exit refresh, the preflight validation —
// has moved to `crate::agent` so the state machine is testable
// without going through a Tauri command context.
use crate::agent::*;
use crate::distribution::*;
use crate::security::window_guard::*;
use crate::types::*;
use crate::util::*;

#[tauri::command]
pub(crate) fn start_agent_workbench_session<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    session_store: tauri::State<'_, AgentWorkbenchSessionStore>,
    agent_workbench_enabled: bool,
    consent_acknowledged: bool,
    provider: String,
    workspace_root: String,
    terminal_columns: Option<u16>,
    terminal_rows: Option<u16>,
) -> Result<AgentWorkbenchSessionStartResult, String> {
    start_agent_workbench_session_with_label(
        window.label(),
        session_store.inner(),
        agent_workbench_enabled,
        consent_acknowledged,
        provider,
        workspace_root,
        terminal_columns,
        terminal_rows,
    )
}

pub(crate) fn start_agent_workbench_session_with_label(
    label: &str,
    session_store: &AgentWorkbenchSessionStore,
    agent_workbench_enabled: bool,
    consent_acknowledged: bool,
    provider: String,
    workspace_root: String,
    terminal_columns: Option<u16>,
    terminal_rows: Option<u16>,
) -> Result<AgentWorkbenchSessionStartResult, String> {
    // The detached Agent window is now the only Agent surface
    // (v0.8+ slice), and it owns the Start flow via
    // useAgentLaunchGate. Gate widens from main-only to
    // main|agent so the agent window can call this command
    // directly. The session itself is process-singleton — the
    // Rust session store serializes concurrent starts — so the
    // widened gate does not introduce a race.
    ensure_label_is_main_or_agent(label)?;
    ensure_agent_workbench_allowed_by_distribution()?;
    let path_var = agent_provider_app_search_path();
    let adapter = RealAgentRuntimeAdapter::new(session_store);

    start_agent_workbench_session_with_store(
        session_store,
        &adapter,
        agent_workbench_enabled,
        consent_acknowledged,
        provider,
        workspace_root,
        path_var.as_deref(),
        terminal_columns,
        terminal_rows,
    )
}

#[tauri::command]
pub(crate) fn stop_agent_workbench_session<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    session_store: tauri::State<'_, AgentWorkbenchSessionStore>,
) -> Result<AgentWorkbenchSessionState, String> {
    stop_agent_workbench_session_with_label(window.label(), session_store.inner())
}

pub(crate) fn stop_agent_workbench_session_with_label(
    label: &str,
    session_store: &AgentWorkbenchSessionStore,
) -> Result<AgentWorkbenchSessionState, String> {
    ensure_label_is_main_or_agent(label)?;
    ensure_agent_workbench_allowed_by_distribution()?;
    let adapter = RealAgentRuntimeAdapter::new(session_store);

    stop_agent_workbench_session_with_store(session_store, &adapter)
}

#[tauri::command]
pub(crate) fn get_agent_workbench_session_state<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    session_store: tauri::State<'_, AgentWorkbenchSessionStore>,
    last_seen_seq: Option<u64>,
) -> Result<AgentWorkbenchSessionState, String> {
    get_agent_workbench_session_state_with_label(
        window.label(),
        session_store.inner(),
        last_seen_seq,
    )
}

pub(crate) fn get_agent_workbench_session_state_with_label(
    label: &str,
    session_store: &AgentWorkbenchSessionStore,
    last_seen_seq: Option<u64>,
) -> Result<AgentWorkbenchSessionState, String> {
    ensure_label_is_main_or_agent(label)?;
    ensure_agent_workbench_allowed_by_distribution()?;
    match last_seen_seq {
        Some(seq) => get_agent_workbench_session_state_since_with_store(session_store, seq),
        None => get_agent_workbench_session_state_with_store(session_store),
    }
}

#[tauri::command]
pub(crate) fn write_agent_workbench_session_input<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    session_store: tauri::State<'_, AgentWorkbenchSessionStore>,
    input: String,
) -> Result<(), String> {
    write_agent_workbench_session_input_with_label(window.label(), session_store.inner(), input)
}

pub(crate) fn write_agent_workbench_session_input_with_label(
    label: &str,
    session_store: &AgentWorkbenchSessionStore,
    input: String,
) -> Result<(), String> {
    ensure_label_is_main_or_agent(label)?;
    ensure_agent_workbench_allowed_by_distribution()?;
    write_agent_workbench_session_input_with_store(session_store, input)
}

#[tauri::command]
pub(crate) fn resize_agent_workbench_terminal<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    session_store: tauri::State<'_, AgentWorkbenchSessionStore>,
    columns: u16,
    rows: u16,
) -> Result<AgentWorkbenchSessionState, String> {
    resize_agent_workbench_terminal_with_label(window.label(), session_store.inner(), columns, rows)
}

pub(crate) fn resize_agent_workbench_terminal_with_label(
    label: &str,
    session_store: &AgentWorkbenchSessionStore,
    columns: u16,
    rows: u16,
) -> Result<AgentWorkbenchSessionState, String> {
    ensure_label_is_main_or_agent(label)?;
    ensure_agent_workbench_allowed_by_distribution()?;
    resize_agent_workbench_terminal_with_store(session_store, columns, rows)
}

// `list_agent_provider_availability` is a read-only provider
// probe: it walks the same search path the start-session
// preflight uses and returns a flat availability snapshot for
// the dropdown. It deliberately does NOT take the session store
// or the runtime adapter — no session state is read or written.
// Gated to main|agent so the detached Agent window can fetch
// from its own mount, matching the other session commands.
#[tauri::command]
pub(crate) fn list_agent_provider_availability<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
) -> Result<Vec<AgentProviderAvailability>, String> {
    list_agent_provider_availability_with_label(window.label())
}

pub(crate) fn list_agent_provider_availability_with_label(
    label: &str,
) -> Result<Vec<AgentProviderAvailability>, String> {
    ensure_label_is_main_or_agent(label)?;
    ensure_agent_workbench_allowed_by_distribution()?;
    Ok(list_agent_provider_availability_with_store(
        agent_provider_app_search_path().as_deref(),
    ))
}

// The `*_with_label_for_lane` shims below are gate-only check
// surfaces. They let the `tests::security` App Store lane tests
// pin each Agent Workbench command's distribution-gate without
// driving the Tauri command body. Mirrors the pattern already
// used by `open_main_agent_pane_with_label_for_lane` and
// `set_agent_window_theme_with_label_for_lane` in
// `commands/app_window.rs`. The `#[cfg_attr(not(test),
// allow(dead_code))]` keeps the production build warning-free;
// the shims are only consumed by the unit-test binary.

#[cfg(desktop)]
#[cfg_attr(not(test), allow(dead_code))]
pub(crate) fn start_agent_workbench_session_with_label_for_lane(
    label: &str,
    lane: Option<&str>,
) -> Result<(), String> {
    ensure_label_is_main_or_agent(label)?;
    ensure_agent_workbench_allowed_for_lane(lane)
}

#[cfg(desktop)]
#[cfg_attr(not(test), allow(dead_code))]
pub(crate) fn stop_agent_workbench_session_with_label_for_lane(
    label: &str,
    lane: Option<&str>,
) -> Result<(), String> {
    ensure_label_is_main_or_agent(label)?;
    ensure_agent_workbench_allowed_for_lane(lane)
}

#[cfg(desktop)]
#[cfg_attr(not(test), allow(dead_code))]
pub(crate) fn get_agent_workbench_session_state_with_label_for_lane(
    label: &str,
    lane: Option<&str>,
) -> Result<(), String> {
    ensure_label_is_main_or_agent(label)?;
    ensure_agent_workbench_allowed_for_lane(lane)
}

#[cfg(desktop)]
#[cfg_attr(not(test), allow(dead_code))]
pub(crate) fn write_agent_workbench_session_input_with_label_for_lane(
    label: &str,
    lane: Option<&str>,
) -> Result<(), String> {
    ensure_label_is_main_or_agent(label)?;
    ensure_agent_workbench_allowed_for_lane(lane)
}

#[cfg(desktop)]
#[cfg_attr(not(test), allow(dead_code))]
pub(crate) fn resize_agent_workbench_terminal_with_label_for_lane(
    label: &str,
    lane: Option<&str>,
) -> Result<(), String> {
    ensure_label_is_main_or_agent(label)?;
    ensure_agent_workbench_allowed_for_lane(lane)
}

#[cfg(desktop)]
#[cfg_attr(not(test), allow(dead_code))]
pub(crate) fn list_agent_provider_availability_with_label_for_lane(
    label: &str,
    lane: Option<&str>,
) -> Result<(), String> {
    ensure_label_is_main_or_agent(label)?;
    ensure_agent_workbench_allowed_for_lane(lane)
}
