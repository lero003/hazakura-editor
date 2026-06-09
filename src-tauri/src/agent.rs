use crate::types::*;
use crate::util::*;
use std::ffi::CStr;
use std::fs::{File, OpenOptions};
use std::io::Read;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;

#[cfg(unix)]
use std::os::fd::{AsRawFd, FromRawFd, RawFd};
#[cfg(unix)]
use std::os::raw::{c_char, c_int, c_ulong};

impl AgentRuntimeAdapter for RealAgentRuntimeAdapter<'_> {
    fn start(&self, request: AgentRuntimeLaunchRequest<'_>) -> Result<AgentRuntimeHandle, String> {
        let mut runtime = self
            .session_store
            .runtime
            .lock()
            .map_err(|_| "Agent Workbench runtime state is unavailable.".to_string())?;

        if runtime.is_some() {
            return Err("Agent Workbench runtime is already active.".to_string());
        }

        append_agent_output(
            &self.session_store.output,
            &self.session_store.next_output_seq,
            AgentWorkbenchOutputStream::System,
            format!(
                "Starting {} in {}\n",
                request.provider, request.workspace_root
            ),
        );

        let runtime_process = match self.terminal_mode {
            AgentRuntimeTerminalMode::Pipe => {
                start_agent_pipe_process(request, self.session_store)?
            }
            AgentRuntimeTerminalMode::Pty => start_agent_pty_process(request, self.session_store)?,
        };

        *runtime = Some(runtime_process);

        Ok(AgentRuntimeHandle {
            provider: request.provider.to_string(),
            workspace_root: request.workspace_root.to_string(),
            provider_path: request.provider_path.to_string(),
            status: AgentRuntimeStatus::Running,
        })
    }

    fn stop(&self, handle: &AgentRuntimeHandle) -> Result<AgentRuntimeHandle, String> {
        let mut runtime = self
            .session_store
            .runtime
            .lock()
            .map_err(|_| "Agent Workbench runtime state is unavailable.".to_string())?;

        if let Some(mut process) = runtime.take() {
            process.stdin.take();
            match process
                .child
                .try_wait()
                .map_err(|err| format!("Cannot inspect provider process: {err}"))?
            {
                Some(status) => {
                    append_agent_output(
                        &self.session_store.output,
                        &self.session_store.next_output_seq,
                        AgentWorkbenchOutputStream::System,
                        format!("Provider process already exited: {status}\n"),
                    );
                }
                None => {
                    process
                        .child
                        .kill()
                        .map_err(|err| format!("Cannot stop provider process: {err}"))?;
                    let _ = process.child.wait();
                    append_agent_output(
                        &self.session_store.output,
                        &self.session_store.next_output_seq,
                        AgentWorkbenchOutputStream::System,
                        "Provider process stopped by user.\n".to_string(),
                    );
                }
            }
        }

        Ok(AgentRuntimeHandle {
            provider: handle.provider.clone(),
            workspace_root: handle.workspace_root.clone(),
            provider_path: handle.provider_path.clone(),
            status: AgentRuntimeStatus::Stopped,
        })
    }
}

pub(crate) fn build_agent_runtime_command(request: AgentRuntimeLaunchRequest<'_>) -> Command {
    let mut command = Command::new(request.provider_path);
    command.current_dir(request.workspace_root);

    if let Some(path_env) = request.path_env {
        command.env("PATH", path_env);
    }

    command.env("TERM", "xterm-256color");
    command
}

pub(crate) fn start_agent_pipe_process(
    request: AgentRuntimeLaunchRequest<'_>,
    session_store: &AgentWorkbenchSessionStore,
) -> Result<AgentRuntimeProcess, String> {
    let mut command = build_agent_runtime_command(request);
    command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = command
        .spawn()
        .map_err(|err| format!("Cannot start allowlisted provider CLI: {err}"))?;

    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| "Cannot open provider stdin.".to_string())?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Cannot open provider stdout.".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Cannot open provider stderr.".to_string())?;

    spawn_agent_output_reader(
        stdout,
        AgentWorkbenchOutputStream::Stdout,
        Arc::clone(&session_store.output),
        Arc::clone(&session_store.next_output_seq),
    );
    spawn_agent_output_reader(
        stderr,
        AgentWorkbenchOutputStream::Stderr,
        Arc::clone(&session_store.output),
        Arc::clone(&session_store.next_output_seq),
    );

    Ok(AgentRuntimeProcess {
        child,
        stdin: Some(Box::new(stdin)),
        pty_control: None,
    })
}

#[cfg(unix)]
pub(crate) fn start_agent_pty_process(
    request: AgentRuntimeLaunchRequest<'_>,
    session_store: &AgentWorkbenchSessionStore,
) -> Result<AgentRuntimeProcess, String> {
    let pty = open_agent_pty()?;
    if let (Some(columns), Some(rows)) = (request.terminal_columns, request.terminal_rows) {
        resize_agent_pty(&pty.master, columns, rows)?;
    }
    let input = pty
        .master
        .try_clone()
        .map_err(|err| format!("Cannot clone provider PTY input: {err}"))?;
    let output = pty
        .master
        .try_clone()
        .map_err(|err| format!("Cannot clone provider PTY output: {err}"))?;
    let pty_control = pty
        .master
        .try_clone()
        .map_err(|err| format!("Cannot clone provider PTY control: {err}"))?;
    let stdin = pty
        .slave
        .try_clone()
        .map_err(|err| format!("Cannot clone provider PTY stdin: {err}"))?;
    let stdout = pty
        .slave
        .try_clone()
        .map_err(|err| format!("Cannot clone provider PTY stdout: {err}"))?;
    let stderr = pty
        .slave
        .try_clone()
        .map_err(|err| format!("Cannot clone provider PTY stderr: {err}"))?;

    let mut command = build_agent_runtime_command(request);
    command
        .stdin(Stdio::from(stdin))
        .stdout(Stdio::from(stdout))
        .stderr(Stdio::from(stderr));

    let child = command
        .spawn()
        .map_err(|err| format!("Cannot start allowlisted provider CLI with PTY: {err}"))?;

    drop(pty.slave);
    spawn_agent_output_reader(
        output,
        AgentWorkbenchOutputStream::Stdout,
        Arc::clone(&session_store.output),
        Arc::clone(&session_store.next_output_seq),
    );

    Ok(AgentRuntimeProcess {
        child,
        stdin: Some(Box::new(input)),
        pty_control: Some(pty_control),
    })
}

#[cfg(not(unix))]
pub(crate) fn start_agent_pty_process(
    request: AgentRuntimeLaunchRequest<'_>,
    session_store: &AgentWorkbenchSessionStore,
) -> Result<AgentRuntimeProcess, String> {
    start_agent_pipe_process(request, session_store)
}

#[cfg(unix)]
pub(crate) struct AgentPty {
    master: File,
    slave: File,
}

#[cfg(unix)]
pub(crate) fn open_agent_pty() -> Result<AgentPty, String> {
    let master_fd = unsafe { posix_openpt(O_RDWR_FLAG | O_NOCTTY_FLAG) };
    if master_fd < 0 {
        return Err("Cannot open provider PTY master.".to_string());
    }

    if unsafe { grantpt(master_fd) } != 0 {
        close_fd(master_fd);
        return Err("Cannot grant provider PTY.".to_string());
    }

    if unsafe { unlockpt(master_fd) } != 0 {
        close_fd(master_fd);
        return Err("Cannot unlock provider PTY.".to_string());
    }

    let slave_name = unsafe {
        let raw_name = ptsname(master_fd);
        if raw_name.is_null() {
            close_fd(master_fd);
            return Err("Cannot resolve provider PTY slave.".to_string());
        }
        CStr::from_ptr(raw_name).to_string_lossy().to_string()
    };

    let slave = OpenOptions::new()
        .read(true)
        .write(true)
        .open(slave_name)
        .map_err(|err| {
            close_fd(master_fd);
            format!("Cannot open provider PTY slave: {err}")
        })?;
    let master = unsafe { File::from_raw_fd(master_fd) };

    Ok(AgentPty { master, slave })
}

#[cfg(unix)]
pub(crate) fn close_fd(fd: RawFd) {
    let _ = unsafe { close(fd) };
}

#[cfg(all(unix, target_os = "macos"))]
const TIOCSWINSZ_REQUEST: c_ulong = 0x8008_7467;

#[cfg(all(unix, target_os = "linux"))]
const TIOCSWINSZ_REQUEST: c_ulong = 0x5414;

#[cfg(all(unix, not(any(target_os = "macos", target_os = "linux"))))]
const TIOCSWINSZ_REQUEST: c_ulong = 0x5414;

#[cfg(unix)]
#[repr(C)]
pub(crate) struct AgentPtyWindowSize {
    ws_row: u16,
    ws_col: u16,
    ws_xpixel: u16,
    ws_ypixel: u16,
}

#[cfg(unix)]
pub(crate) fn resize_agent_pty(pty: &File, columns: u16, rows: u16) -> Result<(), String> {
    let size = AgentPtyWindowSize {
        ws_row: rows,
        ws_col: columns,
        ws_xpixel: 0,
        ws_ypixel: 0,
    };
    let result = unsafe { ioctl(pty.as_raw_fd(), TIOCSWINSZ_REQUEST, &size) };
    if result != 0 {
        return Err(format!(
            "Cannot resize provider PTY: {}",
            std::io::Error::last_os_error()
        ));
    }

    Ok(())
}

#[cfg(unix)]
const SIGWINCH_SIGNAL: c_int = 28;

#[cfg(unix)]
pub(crate) fn notify_agent_pty_resized(child: &Child) {
    let _ = unsafe { kill(child.id() as c_int, SIGWINCH_SIGNAL) };
}

#[cfg(not(unix))]
pub(crate) fn resize_agent_pty(_pty: &File, _columns: u16, _rows: u16) -> Result<(), String> {
    Ok(())
}

#[cfg(unix)]
extern "C" {
    pub(crate) fn posix_openpt(oflag: i32) -> RawFd;
    pub(crate) fn grantpt(fd: RawFd) -> i32;
    pub(crate) fn unlockpt(fd: RawFd) -> i32;
    pub(crate) fn ptsname(fd: RawFd) -> *mut c_char;
    pub(crate) fn close(fd: RawFd) -> i32;
    pub(crate) fn ioctl(fd: RawFd, request: c_ulong, ...) -> i32;
    pub(crate) fn kill(pid: c_int, sig: c_int) -> c_int;
}

pub(crate) fn spawn_agent_output_reader<R>(
    mut reader: R,
    stream: AgentWorkbenchOutputStream,
    output: Arc<Mutex<Vec<AgentWorkbenchOutputChunk>>>,
    next_output_seq: Arc<Mutex<u64>>,
) where
    R: Read + Send + 'static,
{
    thread::spawn(move || {
        let mut buffer = [0_u8; 4096];

        loop {
            match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(bytes_read) => {
                    let text = String::from_utf8_lossy(&buffer[..bytes_read]).to_string();
                    append_agent_output(&output, &next_output_seq, stream.clone(), text);
                }
                Err(err) => {
                    append_agent_output(
                        &output,
                        &next_output_seq,
                        AgentWorkbenchOutputStream::System,
                        format!("Provider output read failed: {err}\n"),
                    );
                    break;
                }
            }
        }
    });
}

pub(crate) fn append_agent_output(
    output: &Arc<Mutex<Vec<AgentWorkbenchOutputChunk>>>,
    next_output_seq: &Arc<Mutex<u64>>,
    stream: AgentWorkbenchOutputStream,
    text: String,
) {
    if text.is_empty() {
        return;
    }

    let Ok(mut seq) = next_output_seq.lock() else {
        return;
    };
    let chunk = AgentWorkbenchOutputChunk {
        seq: *seq,
        stream,
        text,
        received_at_ms: current_time_ms(),
    };
    *seq += 1;

    if let Ok(mut chunks) = output.lock() {
        chunks.push(chunk);
        if chunks.len() > AGENT_WORKBENCH_MAX_OUTPUT_CHUNKS {
            let overflow = chunks.len() - AGENT_WORKBENCH_MAX_OUTPUT_CHUNKS;
            chunks.drain(0..overflow);
        }
    }
}

pub(crate) fn snapshot_agent_output_since(
    session_store: &AgentWorkbenchSessionStore,
    last_seen_seq: u64,
) -> Result<Vec<AgentWorkbenchOutputChunk>, String> {
    session_store
        .output
        .lock()
        .map(|chunks| {
            chunks
                .iter()
                .filter(|chunk| chunk.seq > last_seen_seq)
                .cloned()
                .collect()
        })
        .map_err(|_| "Agent Workbench output state is unavailable.".to_string())
}

pub(crate) fn snapshot_agent_output(
    session_store: &AgentWorkbenchSessionStore,
) -> Result<Vec<AgentWorkbenchOutputChunk>, String> {
    session_store
        .output
        .lock()
        .map(|chunks| chunks.clone())
        .map_err(|_| "Agent Workbench output state is unavailable.".to_string())
}

// ── Session state machine ───────────────────────────────────────
//
// These functions drive the in-process Agent Workbench session
// state (`AgentWorkbenchSessionStore`) and own the transition
// between idle / active / stopped / exited. They are the inner
// core of the Tauri command surface in `commands::agent_workbench`
// — the `*_with_label` wrappers and `#[tauri::command]` shims
// there are the thin label-gate + state-store layer above this
// code. Tests in `tests::agent_workbench` exercise these directly
// with the `RecordingRuntimeAdapter` and `RealAgentRuntimeAdapter`.

use std::ffi::OsStr;
use std::io::Write;
use std::path::PathBuf;

#[allow(clippy::too_many_arguments)]
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

// `list_agent_provider_availability_with_store` resolves each
// allowlisted Agent provider against the same search path the
// start-session preflight uses, returning a flat per-provider
// snapshot. The TS side surfaces it in the provider dropdown so
// the user can see which CLIs are installed before pressing
// Start. Takes the resolved `path_var` (rather than reading
// `env::var_os("PATH")` itself) so the shim is testable in
// isolation — the `*_with_label` shim calls
// `agent_provider_app_search_path()` and passes the result.
pub(crate) fn list_agent_provider_availability_with_store(
    path_var: Option<&OsStr>,
) -> Vec<AgentProviderAvailability> {
    AGENT_ALLOWLISTED_PROVIDERS
        .iter()
        .map(|provider| {
            let resolved = path_var
                .and_then(|candidate_path| {
                    find_allowlisted_agent_provider_in_path_env(provider, candidate_path)
                })
                .map(|path| path.to_string_lossy().to_string());
            AgentProviderAvailability {
                provider: (*provider).to_string(),
                available: resolved.is_some(),
                path: resolved.unwrap_or_default(),
            }
        })
        .collect()
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
