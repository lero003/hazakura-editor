//! v1.11 OKF Draft Compatibility Preview — explicit bounded discovery.
//!
//! Reads a user-selected bundle root once, returns Markdown disk snapshots
//! for the TypeScript pure model. Does not interpret YAML, advice, or UI.
//!
//! The Tauri command arms cancel before `spawn_blocking` so a concurrent
//! `cancel_okf_bundle_scan` cannot race the worker start.

use crate::security::window_guard::*;
use crate::types::*;
use crate::util::*;

use std::fs::{self, File, Metadata, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

/// Shared cancel / occupancy flag for the active OKF discovery scan.
/// At most one scan may be armed at a time.
#[derive(Default)]
pub(crate) struct OkfDiscoveryCancelStore {
    active: Mutex<Option<Arc<AtomicBool>>>,
}

impl OkfDiscoveryCancelStore {
    /// Arm a new cancel flag, or reject when another scan is already running.
    pub(crate) fn try_arm(&self) -> Result<Arc<AtomicBool>, String> {
        let mut guard = self
            .active
            .lock()
            .map_err(|_| "OKF scan state is unavailable.".to_string())?;
        if guard.is_some() {
            return Err("An OKF scan is already running.".to_string());
        }
        let flag = Arc::new(AtomicBool::new(false));
        *guard = Some(Arc::clone(&flag));
        Ok(flag)
    }

    pub(crate) fn disarm(&self) {
        if let Ok(mut guard) = self.active.lock() {
            *guard = None;
        }
    }

    pub(crate) fn cancel_active(&self) -> bool {
        if let Ok(guard) = self.active.lock() {
            if let Some(flag) = guard.as_ref() {
                flag.store(true, Ordering::SeqCst);
                return true;
            }
        }
        false
    }
}

#[tauri::command]
pub(crate) fn cancel_okf_bundle_scan<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    store: tauri::State<'_, Arc<OkfDiscoveryCancelStore>>,
) -> Result<bool, String> {
    ensure_main_window(&window)?;
    Ok(store.cancel_active())
}

/// Explicit, main-window-only OKF disk snapshot.
/// Arms cancel first, then runs the walk on a blocking thread.
#[tauri::command]
pub(crate) async fn scan_okf_bundle<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    store: tauri::State<'_, Arc<OkfDiscoveryCancelStore>>,
    workspace_root: String,
    bundle_root: String,
) -> Result<OkfDiscoveryResult, String> {
    ensure_main_window(&window)?;
    let store = Arc::clone(store.inner());
    // Arm before spawn so cancel is never lost while the worker starts.
    let cancel_flag = store.try_arm()?;
    let label = window.label().to_string();

    let result = tauri::async_runtime::spawn_blocking(move || {
        scan_okf_bundle_prepared(
            &label,
            &workspace_root,
            &bundle_root,
            Some(cancel_flag.as_ref()),
            None,
        )
    })
    .await;

    store.disarm();

    result.map_err(|err| format!("OKF scan task failed: {err}"))?
}

/// Testable body with optional cancel store (arms/disarms around the walk).
#[cfg_attr(not(test), allow(dead_code))]
pub(crate) fn scan_okf_bundle_with_label(
    label: &str,
    cancel_store: Option<&OkfDiscoveryCancelStore>,
    workspace_root: String,
    bundle_root: String,
) -> Result<OkfDiscoveryResult, String> {
    ensure_label_is_main(label)?;

    let cancel_flag = match cancel_store {
        Some(store) => Some(store.try_arm()?),
        None => None,
    };

    let result = scan_okf_bundle_prepared(
        label,
        &workspace_root,
        &bundle_root,
        cancel_flag.as_deref(),
        None,
    );

    if let Some(store) = cancel_store {
        store.disarm();
    }
    result
}

/// Path validation + walk. Cancel flag must already be armed when provided.
pub(crate) fn scan_okf_bundle_prepared(
    label: &str,
    workspace_root: &str,
    bundle_root: &str,
    cancel_flag: Option<&AtomicBool>,
    progress: Option<&dyn Fn(OkfScanProgress)>,
) -> Result<OkfDiscoveryResult, String> {
    ensure_label_is_main(label)?;

    let workspace_path = Path::new(workspace_root);
    let canonical_workspace = ensure_workspace_root(workspace_path)?;

    let bundle_path = Path::new(bundle_root);
    // Reject symlink roots before canonicalize loses the link identity.
    if fs::symlink_metadata(bundle_path)
        .map(|meta| meta.file_type().is_symlink())
        .unwrap_or(false)
    {
        return Err("OKF bundle root must not be a symlink.".to_string());
    }

    let canonical_bundle = ensure_path_inside_workspace_root(bundle_path, &canonical_workspace)?;
    let bundle_meta = fs::metadata(&canonical_bundle)
        .map_err(|err| format!("Cannot read OKF bundle folder: {err}"))?;
    if !bundle_meta.is_dir() {
        return Err("Selected OKF bundle path is not a folder.".to_string());
    }

    scan_okf_bundle_inner(&canonical_bundle, cancel_flag, progress)
}

/// Progress snapshot for deterministic cancel tests (and future UI).
#[derive(Debug, Clone, Copy)]
#[allow(dead_code)] // fields are read from test hooks
pub(crate) struct OkfScanProgress {
    pub scanned_entries: usize,
    pub scanned_markdown_files: usize,
}

/// Pure discovery walk used by tests without a cancel store.
pub(crate) fn scan_okf_bundle_inner(
    canonical_bundle: &Path,
    cancel_flag: Option<&AtomicBool>,
    progress: Option<&dyn Fn(OkfScanProgress)>,
) -> Result<OkfDiscoveryResult, String> {
    let mut files: Vec<OkfDiscoveryFile> = Vec::new();
    let mut scanned_entries: usize = 0;
    let mut scanned_markdown_files: usize = 0;
    let mut total_bytes_read: u64 = 0;
    let mut truncated = false;
    let mut truncation_reason: Option<String> = None;
    let mut cancelled = false;

    // Stack of (directory, depth relative to bundle root).
    let mut stack: Vec<(PathBuf, usize)> = vec![(canonical_bundle.to_path_buf(), 0)];

    while let Some((directory, depth)) = stack.pop() {
        if cancelled {
            break;
        }
        if cancel_flag.is_some_and(|flag| flag.load(Ordering::SeqCst)) {
            cancelled = true;
            break;
        }

        if scanned_entries >= MAX_OKF_WALK_ENTRIES {
            truncated = true;
            truncation_reason = Some("walk-entries".to_string());
            break;
        }

        let entries = match fs::read_dir(&directory) {
            Ok(entries) => entries,
            Err(_) => continue,
        };

        let mut collected: Vec<(PathBuf, std::fs::FileType)> = Vec::new();
        for entry in entries.flatten() {
            scanned_entries += 1;
            if scanned_entries > MAX_OKF_WALK_ENTRIES {
                truncated = true;
                truncation_reason = Some("walk-entries".to_string());
                break;
            }
            if let Ok(file_type) = entry.file_type() {
                collected.push((entry.path(), file_type));
            }
            if let Some(hook) = progress {
                hook(OkfScanProgress {
                    scanned_entries,
                    scanned_markdown_files,
                });
            }
            if cancel_flag.is_some_and(|flag| flag.load(Ordering::SeqCst)) {
                cancelled = true;
                break;
            }
        }
        if cancelled {
            break;
        }
        collected.sort_by(|left, right| left.0.cmp(&right.0));

        let mut child_dirs: Vec<(PathBuf, usize)> = Vec::new();

        for (child_path, file_type) in collected {
            if cancel_flag.is_some_and(|flag| flag.load(Ordering::SeqCst)) {
                cancelled = true;
                break;
            }
            if truncated {
                break;
            }

            // Never follow symlinks (files or directories).
            if file_type.is_symlink() {
                continue;
            }

            if file_type.is_dir() {
                let name = child_path
                    .file_name()
                    .and_then(|name| name.to_str())
                    .unwrap_or("");
                if should_skip_workspace_dir(name) {
                    continue;
                }
                let child_depth = depth + 1;
                if child_depth > MAX_OKF_DEPTH {
                    truncated = true;
                    truncation_reason = Some("depth".to_string());
                    continue;
                }
                child_dirs.push((child_path, child_depth));
                continue;
            }

            if !file_type.is_file() {
                continue;
            }

            if !is_markdown_file_name(&child_path) {
                continue;
            }

            if scanned_markdown_files >= MAX_OKF_MARKDOWN_FILES {
                truncated = true;
                truncation_reason = Some("markdown-files".to_string());
                break;
            }

            let metadata = match fs::symlink_metadata(&child_path) {
                Ok(metadata) => metadata,
                Err(_) => {
                    files.push(unreadable_file(
                        &child_path,
                        canonical_bundle,
                        0,
                        "io-error",
                    ));
                    scanned_markdown_files += 1;
                    continue;
                }
            };
            if metadata.file_type().is_symlink() || !metadata.is_file() {
                continue;
            }

            let reported_len = metadata.len();
            scanned_markdown_files += 1;

            // Re-resolve immediately before open. This rejects a parent
            // directory replaced by a symlink after read_dir collected it.
            let canonical_child = match fs::canonicalize(&child_path) {
                Ok(path) => path,
                Err(_) => {
                    files.push(unreadable_file(
                        &child_path,
                        canonical_bundle,
                        reported_len,
                        "io-error",
                    ));
                    continue;
                }
            };
            if canonical_child != child_path || !canonical_child.starts_with(canonical_bundle) {
                files.push(unreadable_file(
                    &child_path,
                    canonical_bundle,
                    reported_len,
                    "io-error",
                ));
                continue;
            }

            if reported_len > MAX_OKF_FILE_BYTES {
                files.push(unreadable_file(
                    &child_path,
                    canonical_bundle,
                    reported_len,
                    "over-budget",
                ));
                truncated = true;
                truncation_reason = Some("file-bytes".to_string());
                if let Some(hook) = progress {
                    hook(OkfScanProgress {
                        scanned_entries,
                        scanned_markdown_files,
                    });
                }
                continue;
            }

            let remaining_total = MAX_OKF_TOTAL_BYTES.saturating_sub(total_bytes_read);
            if remaining_total == 0 {
                files.push(unreadable_file(
                    &child_path,
                    canonical_bundle,
                    reported_len,
                    "over-budget",
                ));
                truncated = true;
                truncation_reason = Some("total-bytes".to_string());
                break;
            }

            // Bound the actual OS read: never allocate more than allowed + 1.
            let max_allowed = remaining_total.min(MAX_OKF_FILE_BYTES);
            let bounded = match read_file_bounded(&child_path, max_allowed, &metadata) {
                Ok(bounded) => bounded,
                Err(_) => {
                    files.push(unreadable_file(
                        &child_path,
                        canonical_bundle,
                        reported_len,
                        "io-error",
                    ));
                    if let Some(hook) = progress {
                        hook(OkfScanProgress {
                            scanned_entries,
                            scanned_markdown_files,
                        });
                    }
                    continue;
                }
            };

            // Count every byte that entered the buffer (including the +1 probe).
            total_bytes_read = total_bytes_read.saturating_add(bounded.bytes_read);

            if bounded.over_budget {
                files.push(unreadable_file(
                    &child_path,
                    canonical_bundle,
                    bounded.bytes_read,
                    "over-budget",
                ));
                // Distinguish which budget the probe exceeded.
                if max_allowed < MAX_OKF_FILE_BYTES
                    || total_bytes_read > MAX_OKF_TOTAL_BYTES
                    || bounded.bytes_read > MAX_OKF_FILE_BYTES
                {
                    truncated = true;
                    truncation_reason = Some(if remaining_total < MAX_OKF_FILE_BYTES {
                        "total-bytes".to_string()
                    } else {
                        "file-bytes".to_string()
                    });
                } else {
                    truncated = true;
                    truncation_reason = Some("file-bytes".to_string());
                }
                if truncation_reason.as_deref() == Some("total-bytes") {
                    break;
                }
                if let Some(hook) = progress {
                    hook(OkfScanProgress {
                        scanned_entries,
                        scanned_markdown_files,
                    });
                }
                continue;
            }

            let actual_len = bounded.bytes.len() as u64;
            match String::from_utf8(bounded.bytes) {
                Ok(content) => {
                    files.push(OkfDiscoveryFile {
                        path: child_path.to_string_lossy().to_string(),
                        relative_path: relative_posix_path(&child_path, canonical_bundle),
                        content: Some(content),
                        byte_length: actual_len,
                        unreadable_reason: None,
                    });
                }
                Err(_) => {
                    files.push(unreadable_file(
                        &child_path,
                        canonical_bundle,
                        actual_len,
                        "non-utf8",
                    ));
                }
            }

            if let Some(hook) = progress {
                hook(OkfScanProgress {
                    scanned_entries,
                    scanned_markdown_files,
                });
            }
        }

        if cancelled || truncated {
            if !cancelled && truncation_reason.as_deref() == Some("depth") {
                // Depth truncation is local; other siblings at this level may still be fine.
            } else if cancelled
                || matches!(
                    truncation_reason.as_deref(),
                    Some("walk-entries" | "markdown-files" | "total-bytes" | "file-bytes")
                )
            {
                continue;
            }
        }

        child_dirs.sort_by(|left, right| left.0.cmp(&right.0));
        for entry in child_dirs.into_iter().rev() {
            stack.push(entry);
        }
    }

    files.sort_by(|left, right| left.relative_path.cmp(&right.relative_path));

    Ok(OkfDiscoveryResult {
        bundle_root: canonical_bundle.to_string_lossy().to_string(),
        files,
        scanned_entries,
        scanned_markdown_files,
        total_bytes_read,
        truncated,
        truncation_reason,
        cancelled,
        source: "disk".to_string(),
    })
}

#[derive(Debug)]
pub(crate) struct BoundedFileRead {
    /// Content when within budget (over_budget false). Empty when over.
    bytes: Vec<u8>,
    /// True when more than `max_bytes` were available to read.
    over_budget: bool,
    /// Bytes actually pulled into memory (includes the +1 probe byte).
    bytes_read: u64,
}

/// Read at most `max_bytes + 1` so a race that grows the file cannot allocate unboundedly.
pub(crate) fn read_file_bounded(
    path: &Path,
    max_bytes: u64,
    expected_metadata: &Metadata,
) -> Result<BoundedFileRead, String> {
    let file =
        File::open(path).map_err(|err| format!("Cannot open Markdown file for OKF scan: {err}"))?;
    ensure_opened_file_identity(&file, expected_metadata)?;
    let mut limited = file.take(max_bytes.saturating_add(1));
    let mut buf = Vec::new();
    limited
        .read_to_end(&mut buf)
        .map_err(|err| format!("Cannot read Markdown file for OKF scan: {err}"))?;

    let bytes_read = buf.len() as u64;
    if bytes_read > max_bytes {
        // Drop payload; callers only need the over-budget signal and size.
        return Ok(BoundedFileRead {
            bytes: Vec::new(),
            over_budget: true,
            bytes_read,
        });
    }

    Ok(BoundedFileRead {
        bytes: buf,
        over_budget: false,
        bytes_read,
    })
}

fn ensure_opened_file_identity(file: &File, expected: &Metadata) -> Result<(), String> {
    let opened = file
        .metadata()
        .map_err(|err| format!("Cannot inspect opened Markdown file: {err}"))?;
    if !opened.is_file() {
        return Err("Markdown file changed during OKF scan.".to_string());
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        if opened.dev() != expected.dev() || opened.ino() != expected.ino() {
            return Err("Markdown file changed during OKF scan.".to_string());
        }
    }

    #[cfg(not(unix))]
    {
        if opened.len() != expected.len() || opened.modified().ok() != expected.modified().ok() {
            return Err("Markdown file changed during OKF scan.".to_string());
        }
    }

    Ok(())
}

fn is_markdown_file_name(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.eq_ignore_ascii_case("md"))
        .unwrap_or(false)
}

fn relative_posix_path(path: &Path, root: &Path) -> String {
    path.strip_prefix(root)
        .map(|relative| relative.to_string_lossy().replace('\\', "/"))
        .unwrap_or_else(|_| {
            path.file_name()
                .map(|name| name.to_string_lossy().to_string())
                .unwrap_or_default()
        })
}

fn unreadable_file(path: &Path, root: &Path, byte_length: u64, reason: &str) -> OkfDiscoveryFile {
    OkfDiscoveryFile {
        path: path.to_string_lossy().to_string(),
        relative_path: relative_posix_path(path, root),
        content: None,
        byte_length,
        unreadable_reason: Some(reason.to_string()),
    }
}

/// v1.12: create a new folder under `parent_path` and write scaffold files.
/// Templates live in TypeScript; this command enforces path and write bounds.
#[tauri::command]
pub(crate) fn create_okf_scaffold<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    workspace_root: String,
    parent_path: String,
    folder_name: String,
    files: Vec<OkfScaffoldFileInput>,
    open_relative_path: Option<String>,
) -> Result<OkfScaffoldResult, String> {
    create_okf_scaffold_with_label(
        window.label(),
        &workspace_root,
        &parent_path,
        &folder_name,
        files,
        open_relative_path.as_deref(),
    )
}

pub(crate) fn create_okf_scaffold_with_label(
    label: &str,
    workspace_root: &str,
    parent_path: &str,
    folder_name: &str,
    files: Vec<OkfScaffoldFileInput>,
    open_relative_path: Option<&str>,
) -> Result<OkfScaffoldResult, String> {
    ensure_label_is_main(label)?;

    if files.is_empty() {
        return Err("Scaffold must include at least one file.".to_string());
    }
    if files.len() > MAX_OKF_SCAFFOLD_FILES {
        return Err(format!(
            "Scaffold may include at most {} files.",
            MAX_OKF_SCAFFOLD_FILES
        ));
    }

    validate_scaffold_folder_name(folder_name)?;

    let root_buf = PathBuf::from(workspace_root);
    let parent_buf = PathBuf::from(parent_path);
    let parent_resolved = ensure_path_inside_workspace_root(&parent_buf, &root_buf)?;
    if !parent_resolved.is_dir() {
        return Err("Selected parent folder does not exist.".to_string());
    }

    let scaffold_root = parent_resolved.join(folder_name);
    // scaffold_root does not exist yet; validate by parent + name only.
    // Nested create paths also do not exist — do not call
    // ensure_path_inside_workspace_root on them (it requires an existing parent).
    if !scaffold_root.starts_with(&parent_resolved)
        || scaffold_root
            .strip_prefix(&parent_resolved)
            .ok()
            .and_then(|rest| rest.to_str())
            != Some(folder_name)
    {
        return Err("Scaffold folder path is invalid.".to_string());
    }
    if scaffold_root.exists() {
        return Err("A file or folder already exists at the scaffold path.".to_string());
    }

    let mut planned: Vec<(PathBuf, String, String)> = Vec::with_capacity(files.len());
    let mut total_bytes = 0usize;
    let mut seen = std::collections::BTreeSet::new();

    for file in &files {
        let relative = normalize_scaffold_relative_path(&file.relative_path)?;
        if !seen.insert(relative.clone()) {
            return Err(format!("Duplicate scaffold path: {relative}"));
        }
        let content_len = file.contents.len();
        if content_len > MAX_OKF_SCAFFOLD_FILE_BYTES {
            return Err(format!(
                "Scaffold file exceeds the {} byte limit: {relative}",
                MAX_OKF_SCAFFOLD_FILE_BYTES
            ));
        }
        total_bytes = total_bytes.saturating_add(content_len);
        if total_bytes > MAX_OKF_SCAFFOLD_TOTAL_BYTES {
            return Err(format!(
                "Scaffold total size exceeds the {} byte limit.",
                MAX_OKF_SCAFFOLD_TOTAL_BYTES
            ));
        }
        let absolute = scaffold_relative_absolute(&scaffold_root, &relative)?;
        planned.push((absolute, relative, file.contents.clone()));
    }

    let open_path = match open_relative_path {
        Some(raw) if !raw.trim().is_empty() => {
            let relative = normalize_scaffold_relative_path(raw)?;
            if !seen.contains(&relative) {
                return Err(format!(
                    "openRelativePath is not part of the scaffold: {relative}"
                ));
            }
            Some(scaffold_root.join(relative).to_string_lossy().to_string())
        }
        _ => planned
            .iter()
            .find(|(_, relative, _)| relative == "index.md")
            .map(|(path, _, _)| path.to_string_lossy().to_string()),
    };

    fs::create_dir(&scaffold_root)
        .map_err(|err| format!("Cannot create scaffold folder: {err}"))?;

    let mut created_files: Vec<String> = Vec::with_capacity(planned.len());
    for (absolute, relative, contents) in &planned {
        if let Some(parent) = absolute.parent() {
            fs::create_dir_all(parent).map_err(|err| {
                let _ = fs::remove_dir_all(&scaffold_root);
                format!("Cannot create scaffold directories: {err}")
            })?;
        }
        match OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(absolute)
        {
            Ok(mut handle) => {
                if let Err(err) = handle.write_all(contents.as_bytes()) {
                    let _ = fs::remove_dir_all(&scaffold_root);
                    return Err(format!("Cannot write scaffold file {relative}: {err}"));
                }
                if let Err(err) = handle.sync_all() {
                    let _ = fs::remove_dir_all(&scaffold_root);
                    return Err(format!("Cannot sync scaffold file {relative}: {err}"));
                }
                created_files.push(absolute.to_string_lossy().to_string());
            }
            Err(err) => {
                let _ = fs::remove_dir_all(&scaffold_root);
                return Err(format!("Cannot create scaffold file {relative}: {err}"));
            }
        }
    }

    created_files.sort();
    Ok(OkfScaffoldResult {
        root_path: scaffold_root.to_string_lossy().to_string(),
        created_files,
        open_path,
    })
}

fn validate_scaffold_folder_name(folder_name: &str) -> Result<(), String> {
    let name = folder_name.trim();
    if name.is_empty() {
        return Err("Scaffold folder name is required.".to_string());
    }
    if name.chars().count() > MAX_OKF_SCAFFOLD_FOLDER_NAME_CHARS {
        return Err("Scaffold folder name is too long.".to_string());
    }
    if name == "." || name == ".." {
        return Err("Scaffold folder name is invalid.".to_string());
    }
    if name.contains('/') || name.contains('\\') || name.contains('\0') {
        return Err("Scaffold folder name must not contain path separators.".to_string());
    }
    Ok(())
}

fn normalize_scaffold_relative_path(raw: &str) -> Result<String, String> {
    let trimmed = raw.trim().trim_start_matches('/');
    if trimmed.is_empty() {
        return Err("Scaffold relative path is empty.".to_string());
    }
    if trimmed.contains('\\') || trimmed.contains('\0') {
        return Err(format!("Scaffold path is invalid: {raw}"));
    }
    let mut parts: Vec<&str> = Vec::new();
    for part in trimmed.split('/') {
        if part.is_empty() || part == "." {
            continue;
        }
        if part == ".." {
            return Err(format!("Scaffold path must not contain '..': {raw}"));
        }
        parts.push(part);
    }
    if parts.is_empty() {
        return Err(format!("Scaffold path is empty: {raw}"));
    }
    if parts.len() > MAX_OKF_SCAFFOLD_RELATIVE_DEPTH {
        return Err(format!(
            "Scaffold path is deeper than {} segments: {raw}",
            MAX_OKF_SCAFFOLD_RELATIVE_DEPTH
        ));
    }
    let file_name = parts.last().copied().unwrap_or("");
    if !file_name.ends_with(".md") {
        return Err(format!("Scaffold files must be Markdown (.md): {raw}"));
    }
    Ok(parts.join("/"))
}

fn scaffold_relative_absolute(scaffold_root: &Path, relative: &str) -> Result<PathBuf, String> {
    let mut absolute = scaffold_root.to_path_buf();
    for part in relative.split('/') {
        absolute.push(part);
    }
    if !absolute.starts_with(scaffold_root) {
        return Err(format!("Scaffold path escapes the new folder: {relative}"));
    }
    Ok(absolute)
}
