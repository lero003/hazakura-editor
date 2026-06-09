use serde::{Deserialize, Serialize};
use std::ffi::OsStr;
use std::fs::File;
use std::io::Write;
use std::process::Child;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};

pub(crate) const LARGE_FILE_WARNING_BYTES: u64 = 5 * 1024 * 1024;
pub(crate) const MAX_EDITABLE_BYTES: u64 = 10 * 1024 * 1024;
pub(crate) const MAX_IMAGE_PREVIEW_BYTES: u64 = 20 * 1024 * 1024;
pub(crate) const BINARY_SNIFF_BYTES: u64 = 8192;
pub(crate) const MAX_WORKSPACE_ENTRIES: usize = 2000;
// Bounded workspace search caps. These keep `search_workspace_files`
// responsive on a prototype machine: a 500-file ceiling is enough to
// cover daily-editor workspaces (notes, drafts, scratch) without
// ever spinning on a large monorepo. The per-file and total-match
// caps surface a "truncated" flag to the front-end so the modal can
// hint that the user should narrow the query.
pub(crate) const MAX_WORKSPACE_SEARCH_FILES: usize = 500;
pub(crate) const MAX_WORKSPACE_SEARCH_MATCHES_PER_FILE: usize = 10;
pub(crate) const MAX_WORKSPACE_SEARCH_TOTAL_MATCHES: usize = 200;
pub(crate) const MAX_WORKSPACE_SEARCH_LINE_BYTES: usize = 4096;
pub(crate) const AGENT_WORKBENCH_MAX_OUTPUT_CHUNKS: usize = 500;
pub(crate) const AGENT_PROVIDER_CODEX: &str = "codex";
pub(crate) const AGENT_PROVIDER_OPENCODE: &str = "opencode";
pub(crate) const AGENT_PROVIDER_PI: &str = "pi";
pub(crate) const AGENT_PROVIDER_CLAUDE: &str = "claude";
pub(crate) const AGENT_ALLOWLISTED_PROVIDERS: &[&str] = &[
    AGENT_PROVIDER_CODEX,
    AGENT_PROVIDER_OPENCODE,
    AGENT_PROVIDER_PI,
    AGENT_PROVIDER_CLAUDE,
];
pub(crate) const AGENT_PROVIDER_GUI_SEARCH_DIRS: &[&str] = &[
    "/opt/homebrew/bin",
    "/opt/homebrew/sbin",
    "/opt/local/bin",
    "/opt/local/sbin",
    "/usr/local/bin",
    "/usr/bin",
    "/bin",
    "/usr/sbin",
    "/sbin",
];
pub(crate) const AGENT_PROVIDER_HOME_BIN_DIRS: &[&str] = &[
    ".local/bin",
    ".cargo/bin",
    ".npm-global/bin",
    "bin",
    ".bun/bin",
    ".deno/bin",
    ".volta/bin",
    "go/bin",
    ".local/share/pnpm",
    ".asdf/shims",
];
#[cfg(target_os = "macos")]
pub(crate) const O_RDWR_FLAG: i32 = 0x0002;
#[cfg(target_os = "macos")]
pub(crate) const O_NOCTTY_FLAG: i32 = 0x00020000;
pub(crate) const MENU_ACTION_EVENT: &str = "hazakura-note://menu-action";
pub(crate) const OPENED_FILES_EVENT: &str = "hazakura-note://opened-files";
pub(crate) const OPEN_MAIN_AGENT_PANE_EVENT: &str = "hazakura-note://open-main-agent-pane";
// v0.17 app-store-quality: save-restore-regression slice 1.4.
// `Cmd+Q` (macOS) and the Quit menu item both fire
// `RunEvent::ExitRequested` in Tauri 2. The Rust run loop
// catches that event, calls `api.prevent_exit()` to abort
// the bare exit, and emits this event to the main window
// so the frontend can either (a) confirm-and-exit on a
// clean state, or (b) surface the existing `AppCloseDialog`
// and, after Save/Discard All, actually exit via the
// `exit_app` IPC (which uses `std::process::exit(0)` to
// avoid re-firing `ExitRequested`). The constant is the
// single source of truth; the TS mirror lives in
// `src/types.ts`.
pub(crate) const APP_EXIT_REQUESTED_EVENT: &str = "hazakura-note://app-exit-requested";
// v0.12+ Apple Local Assist Writing Companion mock (slice 2+).
// Companion slot: the Apple Assist window and the Agent window
// normally replace each other. The Apple Assist window emits
// `APPLY_AI_EDIT_TRANSACTION_EVENT` to ask the main window to
// apply an AI edit transaction. The main window answers the
// `REQUEST_AI_EDIT_TARGET_EVENT` round-trip with a bounded
// target (selection / paragraph / block / section).
//
// The Rust constants are the source of truth for the event
// names; the TS mirror in `src/types.ts` re-states them so
// the webviews can `emit()` / `listen()` on them. The Rust
// commands consume these in slice 3+ when the main window's
// `APPLY_AI_EDIT_TRANSACTION_EVENT` listener is wired up —
// keep the `dead_code` allow until then.
#[allow(dead_code)]
pub(crate) const APPLY_AI_EDIT_TRANSACTION_EVENT: &str =
    "hazakura-note://apply-ai-edit-transaction";
#[allow(dead_code)]
pub(crate) const REQUEST_AI_EDIT_TARGET_EVENT: &str = "hazakura-note://request-ai-edit-target";
#[allow(dead_code)]
pub(crate) const AI_EDIT_TARGET_RESULT_EVENT: &str = "hazakura-note://ai-edit-target-result";
// `MAIN_APPLE_ASSIST_TARGET_CHANGED_EVENT` is broadcast by the
// main window whenever the inferred Apple Assist target moves
// (selection change, cursor move, document switch). The
// detached Apple Assist window subscribes to keep its
// "active target" panel live without polling. See
// `commands/apple_assist_target.rs` and
// `docs/apple-local-assist-writing-companion-plan.md`.
pub(crate) const MAIN_APPLE_ASSIST_TARGET_CHANGED_EVENT: &str =
    "hazakura-note://main-apple-assist-target-changed";
pub(crate) const MAIN_WORKSPACE_CHANGED_EVENT: &str = "hazakura-note://main-workspace-changed";
pub(crate) const MENU_NEW_FILE: &str = "new-file";
pub(crate) const MENU_OPEN_FILE: &str = "open-file";
pub(crate) const MENU_OPEN_FOLDER: &str = "open-folder";
pub(crate) const MENU_SAVE: &str = "save";
pub(crate) const MENU_SAVE_AS: &str = "save-as";
pub(crate) const MENU_CLOSE_WINDOW: &str = "close-window";
pub(crate) const MENU_EXPORT_HTML: &str = "export-html";
pub(crate) const MENU_EXPORT_PDF: &str = "export-pdf";
pub(crate) const MENU_TOGGLE_PREVIEW: &str = "toggle-preview";
pub(crate) const MENU_TOGGLE_L_MODE: &str = "toggle-l-mode";
pub(crate) const MENU_TOGGLE_WRAP: &str = "toggle-wrap";
pub(crate) const MENU_TOGGLE_INVISIBLES: &str = "toggle-invisibles";
pub(crate) const MENU_TOGGLE_SPELLCHECK: &str = "toggle-spellcheck";
pub(crate) const MENU_THEME_LIGHT: &str = "theme-light";
pub(crate) const MENU_THEME_DARK: &str = "theme-dark";
pub(crate) const MENU_THEME_SAKURA: &str = "theme-sakura";
pub(crate) const MENU_THEME_YAKOU: &str = "theme-yakou";
pub(crate) const MENU_THEME_SHOKOU: &str = "theme-shokou";
pub(crate) const MENU_PREFERENCES: &str = "preferences";
pub(crate) const MENU_AGENT_WORKBENCH: &str = "agent-workbench";
pub(crate) const MENU_OPEN_AGENT_WINDOW: &str = "open-agent-window";
pub(crate) const MENU_OPEN_APPLE_ASSIST_WINDOW: &str = "open-apple-assist-window";
pub(crate) const MENU_RECENT_FILE_PREFIX: &str = "recent-file-";
pub(crate) const MENU_RECENT_FOLDER_PREFIX: &str = "recent-folder-";
pub(crate) const EXCLUDED_WORKSPACE_DIRS: &[&str] = &[
    ".git",
    ".hg",
    ".svn",
    ".next",
    ".turbo",
    "node_modules",
    "target",
    "dist",
    "build",
    ".cache",
];

#[derive(Debug, Serialize)]
pub(crate) struct TextFileDocument {
    pub(crate) path: String,
    pub(crate) name: String,
    pub(crate) contents: String,
    pub(crate) line_ending: String,
    pub(crate) encoding: String,
    pub(crate) size: u64,
    pub(crate) modified_ms: Option<u64>,
    pub(crate) fingerprint: String,
    pub(crate) large_file_warning: bool,
}

#[derive(Debug, Serialize)]
pub(crate) struct SavedFileState {
    pub(crate) path: String,
    pub(crate) line_ending: String,
    pub(crate) encoding: String,
    pub(crate) size: u64,
    pub(crate) modified_ms: Option<u64>,
    pub(crate) fingerprint: String,
}

#[derive(Debug, Serialize)]
pub(crate) struct FileMetadataState {
    pub(crate) path: String,
    pub(crate) size: u64,
    pub(crate) modified_ms: Option<u64>,
    pub(crate) fingerprint: String,
    pub(crate) large_file_warning: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AutoBackupEntry {
    pub(crate) path: String,
    pub(crate) name: String,
    pub(crate) modified_at_ms: u64,
    pub(crate) size: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ImagePreviewDocument {
    pub(crate) path: String,
    pub(crate) name: String,
    pub(crate) data_url: String,
    pub(crate) size: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentWorkbenchPreflight {
    pub(crate) provider: String,
    pub(crate) workspace_root: String,
    pub(crate) provider_available: bool,
    pub(crate) provider_path: Option<String>,
    pub(crate) launch_implemented: bool,
    pub(crate) searched_paths: Vec<String>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentProviderAvailability {
    pub(crate) provider: String,
    pub(crate) available: bool,
    pub(crate) path: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum AgentRuntimeStatus {
    Running,
    Stopped,
    Exited,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentRuntimeHandle {
    pub(crate) provider: String,
    pub(crate) workspace_root: String,
    pub(crate) provider_path: String,
    pub(crate) status: AgentRuntimeStatus,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum AgentWorkbenchSessionStatus {
    Active,
    Stopped,
    Exited,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentWorkbenchSession {
    pub(crate) provider: String,
    pub(crate) workspace_root: String,
    pub(crate) provider_path: String,
    pub(crate) created_at_ms: u64,
    pub(crate) status: AgentWorkbenchSessionStatus,
    pub(crate) runtime: AgentRuntimeHandle,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum AgentWorkbenchOutputStream {
    Stdout,
    Stderr,
    System,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentWorkbenchOutputChunk {
    pub(crate) seq: u64,
    pub(crate) stream: AgentWorkbenchOutputStream,
    pub(crate) text: String,
    pub(crate) received_at_ms: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentWorkbenchSessionStartResult {
    pub(crate) preflight: AgentWorkbenchPreflight,
    pub(crate) session: Option<AgentWorkbenchSession>,
    pub(crate) output: Vec<AgentWorkbenchOutputChunk>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentWorkbenchSessionState {
    pub(crate) session: Option<AgentWorkbenchSession>,
    pub(crate) output: Vec<AgentWorkbenchOutputChunk>,
}

pub(crate) struct AgentWorkbenchSessionStore {
    pub(crate) session: Mutex<Option<AgentWorkbenchSession>>,
    pub(crate) runtime: Mutex<Option<AgentRuntimeProcess>>,
    pub(crate) output: Arc<Mutex<Vec<AgentWorkbenchOutputChunk>>>,
    pub(crate) next_output_seq: Arc<Mutex<u64>>,
    pub(crate) agent_workbench_active: Arc<AtomicBool>,
    pub(crate) agent_workbench_consent: Arc<AtomicBool>,
}

#[derive(Default)]
pub(crate) struct OpenedFileStore(pub(crate) Mutex<Vec<String>>);

impl Default for AgentWorkbenchSessionStore {
    fn default() -> Self {
        Self {
            session: Mutex::new(None),
            runtime: Mutex::new(None),
            output: Arc::new(Mutex::new(Vec::new())),
            next_output_seq: Arc::new(Mutex::new(1)),
            agent_workbench_active: Arc::new(AtomicBool::new(false)),
            agent_workbench_consent: Arc::new(AtomicBool::new(false)),
        }
    }
}

impl Drop for AgentWorkbenchSessionStore {
    fn drop(&mut self) {
        if let Ok(mut runtime) = self.runtime.lock() {
            if let Some(mut process) = runtime.take() {
                let _ = process.child.kill();
                let _ = process.child.wait();
            }
        }
    }
}

pub(crate) struct AgentRuntimeProcess {
    pub(crate) child: Child,
    pub(crate) stdin: Option<Box<dyn Write + Send>>,
    pub(crate) pty_control: Option<File>,
}

#[derive(Clone, Copy)]
pub(crate) struct AgentRuntimeLaunchRequest<'a> {
    pub(crate) provider: &'a str,
    pub(crate) workspace_root: &'a str,
    pub(crate) provider_path: &'a str,
    pub(crate) path_env: Option<&'a OsStr>,
    pub(crate) terminal_columns: Option<u16>,
    pub(crate) terminal_rows: Option<u16>,
}

#[derive(Debug, Serialize)]
pub(crate) struct WorkspaceTreeEntry {
    pub(crate) name: String,
    pub(crate) path: String,
    pub(crate) kind: WorkspaceEntryKind,
    pub(crate) children: Vec<WorkspaceTreeEntry>,
    pub(crate) children_loaded: bool,
    pub(crate) children_truncated: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum WorkspaceEntryKind {
    Directory,
    File,
}

// `WorkspaceSearchMatch` is a single line-level hit inside a file.
// `line` is 1-based; `column` is 1-based; `text` is the trimmed line
// contents (capped) so the front-end can show context without having
// to re-read the file. Matches are intentionally narrow: just enough
// to render the row and jump to it.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkspaceSearchMatch {
    pub(crate) line: usize,
    pub(crate) column: usize,
    pub(crate) text: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkspaceSearchFileResult {
    pub(crate) path: String,
    pub(crate) relative_path: String,
    pub(crate) matches: Vec<WorkspaceSearchMatch>,
    pub(crate) truncated: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkspaceSearchResult {
    pub(crate) files: Vec<WorkspaceSearchFileResult>,
    pub(crate) total_matches: usize,
    pub(crate) total_files_scanned: usize,
    pub(crate) truncated: bool,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AppMenuState {
    pub(crate) has_active_tab: bool,
    pub(crate) active_dirty: bool,
    pub(crate) preview_visible: bool,
    pub(crate) wrap_lines: bool,
    pub(crate) show_invisibles: bool,
    pub(crate) spellcheck_enabled: bool,
    pub(crate) l_mode_enabled: bool,
    pub(crate) theme_preference: String,
    pub(crate) menu_language: String,
    pub(crate) recent_files: Vec<AppMenuRecentItem>,
    pub(crate) recent_folders: Vec<AppMenuRecentItem>,
    pub(crate) agent_workbench_active: bool,
    pub(crate) agent_workbench_consent: bool,
}

#[derive(Debug, Deserialize, Serialize)]
pub(crate) struct AppMenuRecentItem {
    pub(crate) label: String,
}

pub(crate) trait AgentRuntimeAdapter {
    fn start(&self, request: AgentRuntimeLaunchRequest<'_>) -> Result<AgentRuntimeHandle, String>;
    fn stop(&self, handle: &AgentRuntimeHandle) -> Result<AgentRuntimeHandle, String>;
}

pub(crate) struct RealAgentRuntimeAdapter<'a> {
    pub(crate) session_store: &'a AgentWorkbenchSessionStore,
    pub(crate) terminal_mode: AgentRuntimeTerminalMode,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[cfg_attr(not(test), allow(dead_code))]
pub(crate) enum AgentRuntimeTerminalMode {
    Pipe,
    Pty,
}

impl<'a> RealAgentRuntimeAdapter<'a> {
    pub(crate) fn new(session_store: &'a AgentWorkbenchSessionStore) -> Self {
        Self {
            session_store,
            terminal_mode: AgentRuntimeTerminalMode::Pty,
        }
    }

    #[cfg(test)]
    pub(crate) fn new_piped_for_tests(session_store: &'a AgentWorkbenchSessionStore) -> Self {
        Self {
            session_store,
            terminal_mode: AgentRuntimeTerminalMode::Pipe,
        }
    }
}
