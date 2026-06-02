// Shared fixtures and helper functions used by multiple
// per-feature test modules. Fixtures (RuntimeAdapterCall,
// FakeProviderFixture, RecordingRuntimeAdapter) are declared
// here so both agent_workbench tests and security tests can
// reference them. Helper functions (unique_test_dir, fake_
// provider_fixture, wait_for_agent_state, combined_agent_
// output, assert_agent_output_seq_strictly_increases, make_
// executable, process_exists, unique_label_path) are likewise
// shared across modules.
use super::*;

use std::ffi::OsString;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

// Re-export the std types the test modules reference directly
// (Path::new, Stdio::piped, Duration::from_millis, etc.) so the
// per-feature modules can keep `use super::*;` working.
pub(crate) use std::fs::File;
pub(crate) use std::path::Path;
pub(crate) use std::process::Stdio;
pub(crate) use std::time::Duration;

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct RuntimeAdapterCall {
    pub(crate) provider: String,
    pub(crate) workspace_root: String,
    pub(crate) provider_path: String,
    pub(crate) terminal_columns: Option<u16>,
    pub(crate) terminal_rows: Option<u16>,
}

pub(crate) struct FakeProviderFixture {
    dir: PathBuf,
    command_path: PathBuf,
    path_env: OsString,
}

impl FakeProviderFixture {
    pub(crate) fn workspace_root(&self) -> String {
        self.dir.to_str().expect("workspace path").to_string()
    }

    pub(crate) fn path_var(&self) -> &OsStr {
        self.path_env.as_os_str()
    }

    pub(crate) fn provider_path(&self) -> String {
        self.command_path.to_string_lossy().to_string()
    }

    pub(crate) fn cleanup(self) {
        let _ = fs::remove_dir_all(self.dir);
    }
}

#[derive(Default)]
pub(crate) struct RecordingRuntimeAdapter {
    start_calls: Mutex<Vec<RuntimeAdapterCall>>,
    stop_calls: Mutex<Vec<AgentRuntimeHandle>>,
    fail_start: bool,
    fail_stop: bool,
}

impl RecordingRuntimeAdapter {
    pub(crate) fn failing_start() -> Self {
        Self {
            start_calls: Mutex::new(Vec::new()),
            stop_calls: Mutex::new(Vec::new()),
            fail_start: true,
            fail_stop: false,
        }
    }

    pub(crate) fn failing_stop() -> Self {
        Self {
            start_calls: Mutex::new(Vec::new()),
            stop_calls: Mutex::new(Vec::new()),
            fail_start: false,
            fail_stop: true,
        }
    }

    pub(crate) fn start_calls(&self) -> Vec<RuntimeAdapterCall> {
        self.start_calls
            .lock()
            .expect("read runtime start calls")
            .clone()
    }

    pub(crate) fn stop_calls(&self) -> Vec<AgentRuntimeHandle> {
        self.stop_calls
            .lock()
            .expect("read runtime stop calls")
            .clone()
    }
}

impl AgentRuntimeAdapter for RecordingRuntimeAdapter {
    fn start(&self, request: AgentRuntimeLaunchRequest<'_>) -> Result<AgentRuntimeHandle, String> {
        self.start_calls
            .lock()
            .expect("record runtime call")
            .push(RuntimeAdapterCall {
                provider: request.provider.to_string(),
                workspace_root: request.workspace_root.to_string(),
                provider_path: request.provider_path.to_string(),
                terminal_columns: request.terminal_columns,
                terminal_rows: request.terminal_rows,
            });

        if self.fail_start {
            return Err("runtime adapter failed".to_string());
        }

        Ok(AgentRuntimeHandle {
            provider: request.provider.to_string(),
            workspace_root: request.workspace_root.to_string(),
            provider_path: request.provider_path.to_string(),
            status: AgentRuntimeStatus::Running,
        })
    }

    fn stop(&self, handle: &AgentRuntimeHandle) -> Result<AgentRuntimeHandle, String> {
        self.stop_calls
            .lock()
            .expect("record runtime stop call")
            .push(handle.clone());

        if self.fail_stop {
            return Err("runtime stop adapter failed".to_string());
        }

        Ok(AgentRuntimeHandle {
            provider: handle.provider.clone(),
            workspace_root: handle.workspace_root.clone(),
            provider_path: handle.provider_path.clone(),
            status: AgentRuntimeStatus::Stopped,
        })
    }
}

pub(crate) fn unique_test_dir(name: &str) -> PathBuf {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time")
        .as_nanos();

    std::env::temp_dir().join(format!("hazakura-note-{name}-{}-{now}", std::process::id()))
}

pub(crate) fn fake_provider_fixture(
    name: &str,
    provider: &str,
    script: &[u8],
) -> FakeProviderFixture {
    let dir = unique_test_dir(name);
    fs::create_dir_all(&dir).expect("create fake provider workspace");
    let command_path = dir.join(provider);
    fs::write(&command_path, script).expect("write fake provider");
    make_executable(&command_path);
    let mut paths = vec![dir.clone()];
    if let Some(parent_path) = env::var_os("PATH") {
        paths.extend(env::split_paths(&parent_path));
    }
    let path_env = env::join_paths(paths).expect("join fake provider PATH");

    FakeProviderFixture {
        dir,
        command_path,
        path_env,
    }
}

pub(crate) fn wait_for_agent_state(
    store: &AgentWorkbenchSessionStore,
    predicate: impl Fn(&AgentWorkbenchSessionState) -> bool,
) -> AgentWorkbenchSessionState {
    let mut state =
        get_agent_workbench_session_state_with_store(store).expect("read agent session state");

    for _ in 0..80 {
        if predicate(&state) {
            return state;
        }

        std::thread::sleep(Duration::from_millis(50));
        state =
            get_agent_workbench_session_state_with_store(store).expect("read agent session state");
    }

    state
}

pub(crate) fn combined_agent_output(state: &AgentWorkbenchSessionState) -> String {
    state
        .output
        .iter()
        .map(|chunk| chunk.text.as_str())
        .collect::<String>()
}

pub(crate) fn assert_agent_output_seq_strictly_increases(output: &[AgentWorkbenchOutputChunk]) {
    assert!(
        output
            .windows(2)
            .all(|window| window[0].seq < window[1].seq),
        "agent output sequence numbers should strictly increase",
    );
}

#[cfg(unix)]
pub(crate) fn make_executable(path: &Path) {
    use std::os::unix::fs::PermissionsExt;

    let mut permissions = fs::metadata(path)
        .expect("read fake command metadata")
        .permissions();
    permissions.set_mode(0o755);
    fs::set_permissions(path, permissions).expect("mark fake command executable");
}

#[cfg(not(unix))]
pub(crate) fn make_executable(_path: &Path) {}

#[cfg(unix)]
pub(crate) fn process_exists(pid: u32) -> bool {
    Command::new("kill")
        .arg("-0")
        .arg(pid.to_string())
        .stderr(Stdio::null())
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

pub(crate) fn unique_label_path(label: &str) -> PathBuf {
    unique_test_dir(&format!("label_gate_{label}"))
}
