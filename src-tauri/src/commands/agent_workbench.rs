use crate::agent::*;
use crate::security::window_guard::*;
use crate::types::*;
use crate::util::*;

use std::ffi::OsStr;
use std::path::PathBuf;
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
    resize_agent_workbench_terminal_with_store(session_store, columns, rows)
}

pub(crate) fn start_agent_workbench_session_with_store(
    session_store: &AgentWorkbenchSessionStore,
    runtime_adapter: &dyn AgentRuntimeAdapter,
    agent_workbench_enabled: bool,
    consent_acknowledged: bool,
    provider: String,
    workspace_root: String,
    path_var: Option<&OsStr>,
    terminal_columns: Option<u16>,
    terminal_rows: Option<u16>,
) -> Result<AgentWorkbenchSessionStartResult, String> {
    refresh_agent_workbench_session_exit(session_store)?;

    let preflight = build_agent_workbench_preflight(
        agent_workbench_enabled,
        consent_acknowledged,
        provider,
        workspace_root,
        path_var,
    )?;

    let Some(provider_path) = preflight.provider_path.clone() else {
        return Ok(AgentWorkbenchSessionStartResult {
            preflight,
            session: None,
            output: snapshot_agent_output(session_store)?,
        });
    };

    let mut current_session = session_store
        .session
        .lock()
        .map_err(|_| "Agent Workbench session state is unavailable.".to_string())?;

    if current_session
        .as_ref()
        .is_some_and(|session| session.status == AgentWorkbenchSessionStatus::Active)
    {
        return Err("Agent Workbench session is already active.".to_string());
    }

    let runtime = runtime_adapter.start(AgentRuntimeLaunchRequest {
        provider: &preflight.provider,
        workspace_root: &preflight.workspace_root,
        provider_path: &provider_path,
        path_env: path_var,
        terminal_columns,
        terminal_rows,
    })?;

    let session = AgentWorkbenchSession {
        provider: preflight.provider.clone(),
        workspace_root: preflight.workspace_root.clone(),
        provider_path,
        created_at_ms: current_time_ms(),
        status: AgentWorkbenchSessionStatus::Active,
        runtime,
    };

    *current_session = Some(session.clone());

    Ok(AgentWorkbenchSessionStartResult {
        preflight,
        session: Some(session),
        output: snapshot_agent_output(session_store)?,
    })
}

pub(crate) fn stop_agent_workbench_session_with_store(
    session_store: &AgentWorkbenchSessionStore,
    runtime_adapter: &dyn AgentRuntimeAdapter,
) -> Result<AgentWorkbenchSessionState, String> {
    refresh_agent_workbench_session_exit(session_store)?;

    let mut current_session = session_store
        .session
        .lock()
        .map_err(|_| "Agent Workbench session state is unavailable.".to_string())?;

    if let Some(session) = current_session.as_mut() {
        if session.status == AgentWorkbenchSessionStatus::Active {
            let stopped_runtime = runtime_adapter.stop(&session.runtime)?;
            session.runtime = stopped_runtime;
            session.status = AgentWorkbenchSessionStatus::Stopped;
        }
    }

    Ok(AgentWorkbenchSessionState {
        session: current_session.clone(),
        output: snapshot_agent_output(session_store)?,
    })
}

pub(crate) fn get_agent_workbench_session_state_with_store(
    session_store: &AgentWorkbenchSessionStore,
) -> Result<AgentWorkbenchSessionState, String> {
    refresh_agent_workbench_session_exit(session_store)?;

    let current_session = session_store
        .session
        .lock()
        .map_err(|_| "Agent Workbench session state is unavailable.".to_string())?;

    Ok(AgentWorkbenchSessionState {
        session: current_session.clone(),
        output: snapshot_agent_output(session_store)?,
    })
}

pub(crate) fn get_agent_workbench_session_state_since_with_store(
    session_store: &AgentWorkbenchSessionStore,
    last_seen_seq: u64,
) -> Result<AgentWorkbenchSessionState, String> {
    refresh_agent_workbench_session_exit(session_store)?;

    let current_session = session_store
        .session
        .lock()
        .map_err(|_| "Agent Workbench session state is unavailable.".to_string())?;

    Ok(AgentWorkbenchSessionState {
        session: current_session.clone(),
        output: snapshot_agent_output_since(session_store, last_seen_seq)?,
    })
}

pub(crate) fn write_agent_workbench_session_input_with_store(
    session_store: &AgentWorkbenchSessionStore,
    input: String,
) -> Result<(), String> {
    refresh_agent_workbench_session_exit(session_store)?;

    if input.is_empty() {
        return Ok(());
    }

    let session_is_active = session_store
        .session
        .lock()
        .map_err(|_| "Agent Workbench session state is unavailable.".to_string())?
        .as_ref()
        .is_some_and(|session| session.status == AgentWorkbenchSessionStatus::Active);

    if !session_is_active {
        return Err("Agent Workbench session is not active.".to_string());
    }

    let mut runtime = session_store
        .runtime
        .lock()
        .map_err(|_| "Agent Workbench runtime state is unavailable.".to_string())?;
    let process = runtime
        .as_mut()
        .ok_or_else(|| "Agent Workbench runtime is not active.".to_string())?;
    let stdin = process
        .stdin
        .as_mut()
        .ok_or_else(|| "Agent Workbench stdin is unavailable.".to_string())?;

    stdin
        .write_all(input.as_bytes())
        .map_err(|err| format!("Cannot write to provider stdin: {err}"))?;
    stdin
        .flush()
        .map_err(|err| format!("Cannot flush provider stdin: {err}"))?;

    Ok(())
}

pub(crate) fn resize_agent_workbench_terminal_with_store(
    session_store: &AgentWorkbenchSessionStore,
    columns: u16,
    rows: u16,
) -> Result<AgentWorkbenchSessionState, String> {
    refresh_agent_workbench_session_exit(session_store)?;

    if columns == 0 || rows == 0 {
        return Err("Agent Workbench terminal size is invalid.".to_string());
    }

    let session_is_active = session_store
        .session
        .lock()
        .map_err(|_| "Agent Workbench session state is unavailable.".to_string())?
        .as_ref()
        .is_some_and(|session| session.status == AgentWorkbenchSessionStatus::Active);

    if session_is_active {
        let runtime = session_store
            .runtime
            .lock()
            .map_err(|_| "Agent Workbench runtime state is unavailable.".to_string())?;
        if let Some(process) = runtime.as_ref() {
            if let Some(pty_control) = process.pty_control.as_ref() {
                resize_agent_pty(pty_control, columns, rows)?;
                #[cfg(unix)]
                notify_agent_pty_resized(&process.child);
            }
        }
    }

    get_agent_workbench_session_state_with_store(session_store)
}

pub(crate) fn refresh_agent_workbench_session_exit(
    session_store: &AgentWorkbenchSessionStore,
) -> Result<(), String> {
    let exit_status = {
        let mut runtime = session_store
            .runtime
            .lock()
            .map_err(|_| "Agent Workbench runtime state is unavailable.".to_string())?;
        let Some(process) = runtime.as_mut() else {
            return Ok(());
        };

        match process
            .child
            .try_wait()
            .map_err(|err| format!("Cannot inspect provider process: {err}"))?
        {
            Some(status) => {
                runtime.take();
                Some(status.to_string())
            }
            None => None,
        }
    };

    if let Some(status) = exit_status {
        let mut current_session = session_store
            .session
            .lock()
            .map_err(|_| "Agent Workbench session state is unavailable.".to_string())?;

        if let Some(session) = current_session.as_mut() {
            if session.status == AgentWorkbenchSessionStatus::Active {
                session.status = AgentWorkbenchSessionStatus::Exited;
                session.runtime.status = AgentRuntimeStatus::Exited;
            }
        }

        append_agent_output(
            &session_store.output,
            &session_store.next_output_seq,
            AgentWorkbenchOutputStream::System,
            format!("Provider process exited: {status}\n"),
        );
    }

    Ok(())
}

pub(crate) fn build_agent_workbench_preflight(
    agent_workbench_enabled: bool,
    consent_acknowledged: bool,
    provider: String,
    workspace_root: String,
    path_var: Option<&OsStr>,
) -> Result<AgentWorkbenchPreflight, String> {
    let canonical_workspace = validate_agent_workbench_launch(
        agent_workbench_enabled,
        consent_acknowledged,
        &provider,
        &workspace_root,
    )?;
    let provider_path = path_var.and_then(|candidate_path| {
        find_allowlisted_agent_provider_in_path_env(&provider, candidate_path)
    });
    let searched_paths = agent_provider_search_path_dirs_from_path_env(path_var);

    Ok(AgentWorkbenchPreflight {
        provider,
        workspace_root: canonical_workspace.to_string_lossy().to_string(),
        provider_available: provider_path.is_some(),
        provider_path: provider_path.map(|path| path.to_string_lossy().to_string()),
        launch_implemented: true,
        searched_paths,
    })
}

pub(crate) fn validate_agent_workbench_launch(
    agent_workbench_enabled: bool,
    consent_acknowledged: bool,
    provider: &str,
    workspace_root: &str,
) -> Result<PathBuf, String> {
    if !agent_workbench_enabled {
        return Err(
            "Agent Workbench is disabled. Enable it in Preferences and restart before launching an agent."
                .to_string(),
        );
    }

    if !consent_acknowledged {
        return Err("Agent Workbench consent is required before launching an agent.".to_string());
    }

    if !is_allowlisted_agent_provider(provider) {
        return Err("Agent provider is not allowlisted.".to_string());
    }

    let workspace_root_path = PathBuf::from(workspace_root);
    let canonical_workspace = ensure_workspace_root(&workspace_root_path)?;

    Ok(canonical_workspace)
}
