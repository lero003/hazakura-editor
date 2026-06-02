use std::env;
use std::ffi::OsStr;
use std::fs::{self, OpenOptions};
use std::path::PathBuf;
use std::process::Command;
use std::sync::atomic::Ordering;
use tauri::window::Color;
use tauri::{Emitter, Manager, Theme, TitleBarStyle, WebviewUrl, WebviewWindowBuilder};

pub(crate) mod types;
use crate::types::*;
pub(crate) mod util;
use crate::util::*;
pub(crate) mod agent;
use crate::agent::*;
pub(crate) mod menu;
use crate::menu::*;
pub(crate) mod auto_backup;

#[cfg(test)]
pub(crate) mod tests;

// The Tauri capability model gates plugins / core APIs (events,
// windows, menus) by window label, but custom `#[tauri::command]`
// functions are auto-allowlisted for any window listed in a
// capability file. The detached Agent window is listed in
// `capabilities/agent-window.json` so it can call the four Agent
// session commands it needs (`get_agent_workbench_session_state`,
// `stop_agent_workbench_session`, `write_agent_workbench_session_input`,
// `resize_agent_workbench_terminal` — the PTY resize that the xterm
// fit addon drives from the detached window's ResizeObserver), but
// that also lets it call every other custom command — file I/O,
// workspace tree, save, menu state, app restart, etc. The
// `core:default` permission set expands to event / menu / window /
// webview defaults, which lets the agent webview emit global menu
// events that the main window's `useAppMenuActionListener` trusts.
//
// These helpers add the missing server-side caller-window check
// (defense in depth on top of the capability split). Sensitive
// commands — anything that touches the filesystem, the workspace,
// menu state, app lifecycle, or the launch surface — must come
// from the `main` window. The four Agent session commands plus
// `set_agent_window_theme` (so the main window can push theme
// changes to the agent window and the agent window can sync its
// own title-bar / background on mount) and `open_main_agent_pane`
// (so the detached agent window's "Show in main pane" footer link
// can ask the main window to focus itself and switch the right
// pane to Agent) may additionally be called from the `agent`
// window. All other window labels are rejected. See
// docs/assist-surface-strategy.md and
// docs/agent-workbench-boundary.md.

pub(crate) const MAIN_WINDOW_LABEL: &str = "main";
pub(crate) const AGENT_WINDOW_LABEL: &str = "agent";

fn ensure_main_window<R: tauri::Runtime>(window: &tauri::WebviewWindow<R>) -> Result<(), String> {
    if window.label() != MAIN_WINDOW_LABEL {
        return Err(format!(
            "Command is not allowed from window '{}'.",
            window.label()
        ));
    }
    Ok(())
}

// Label-only check used by the `*_with_label` bodies. Mirrors the
// `*_window` helpers above but takes a `&str` so unit tests can call
// the bodies without a Tauri `WebviewWindow` instance.
fn ensure_label_is_main(label: &str) -> Result<(), String> {
    if label != MAIN_WINDOW_LABEL {
        return Err(format!("Command is not allowed from window '{label}'."));
    }
    Ok(())
}

fn ensure_label_is_main_or_agent(label: &str) -> Result<(), String> {
    if label != MAIN_WINDOW_LABEL && label != AGENT_WINDOW_LABEL {
        return Err(format!("Command is not allowed from window '{label}'."));
    }
    Ok(())
}

// Map the in-app theme preference (the same string the main window
// stores under THEME_STORAGE_KEY) to the agent window's initial
// `background_color`. The agent window uses a `Transparent` title bar
// (set in `open_agent_window`'s builder) so the OS chrome shows this
// color through; matching the main window's per-theme `backgroundColor`
// keeps the two surfaces visually consistent. Hex values mirror
// `windowBackgroundColorForTheme` in `src/hooks/useAppPreferences.ts`
// and the new `set_agent_window_theme` command.
fn agent_window_background_color(theme: &str) -> Color {
    match theme {
        "dark" => Color(0x0f, 0x14, 0x12, 0xff),
        "sakura" => Color(0xf8, 0xf1, 0xf3, 0xff),
        "yakou" => Color(0x0d, 0x0d, 0x12, 0xff),
        "shokou" => Color(0xee, 0xf7, 0xff, 0xff),
        "kouyou" => Color(0xf7, 0xef, 0xe4, 0xff),
        "light" => Color(0xf3, 0xf6, 0xf4, 0xff),
        _ => Color(0x0f, 0x14, 0x12, 0xff),
    }
}

// Map the in-app theme preference to the agent window's OS chrome
// `Theme` (controls whether the title-bar / traffic-lights paint
// light or dark). Matches the `BaseTheme` derivation in
// `useAppPreferences.ts`: `dark` / `yakou` → Dark, everything else → Light.
fn agent_window_os_theme(theme: &str) -> Theme {
    match theme {
        "dark" | "yakou" => Theme::Dark,
        _ => Theme::Light,
    }
}

#[tauri::command]
fn open_text_file<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    path: String,
) -> Result<TextFileDocument, String> {
    open_text_file_with_label(window.label(), path)
}

fn open_text_file_with_label(label: &str, path: String) -> Result<TextFileDocument, String> {
    ensure_label_is_main(label)?;
    let path_buf = PathBuf::from(&path);
    let metadata = fs::metadata(&path_buf).map_err(|err| format!("Cannot read file: {err}"))?;

    if !metadata.is_file() {
        return Err("Selected path is not a file.".to_string());
    }

    if metadata.len() > MAX_EDITABLE_BYTES {
        return Err("File is larger than the prototype editing limit of 10 MB.".to_string());
    }

    if looks_binary(&path_buf)? {
        return Err("Binary-looking files are not opened by this editor.".to_string());
    }

    let bytes = fs::read(&path_buf).map_err(|err| format!("Cannot read file: {err}"))?;
    let line_ending = detect_line_ending(&bytes);
    let contents = String::from_utf8(bytes)
        .map_err(|err| format!("File is not readable as UTF-8 text: {err}"))?;
    let name = path_buf
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("untitled")
        .to_string();

    Ok(TextFileDocument {
        path,
        name,
        contents,
        line_ending,
        size: metadata.len(),
        modified_ms: modified_ms(&metadata),
        fingerprint: metadata_fingerprint(&metadata),
        large_file_warning: metadata.len() >= LARGE_FILE_WARNING_BYTES,
    })
}

#[tauri::command]
fn reveal_path_in_file_manager<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    path: String,
) -> Result<(), String> {
    reveal_path_in_file_manager_with_label(window.label(), path)
}

fn reveal_path_in_file_manager_with_label(label: &str, path: String) -> Result<(), String> {
    ensure_label_is_main(label)?;
    let path_buf = PathBuf::from(&path);

    fs::metadata(&path_buf).map_err(|err| format!("Cannot reveal path: {err}"))?;

    #[cfg(target_os = "macos")]
    {
        let status = Command::new("/usr/bin/open")
            .arg("-R")
            .arg(&path_buf)
            .status()
            .map_err(|err| format!("Cannot open Finder: {err}"))?;

        if status.success() {
            return Ok(());
        }

        return Err(format!("Finder reveal failed with status {status}."));
    }

    #[cfg(target_os = "windows")]
    {
        let status = Command::new("explorer")
            .arg("/select,")
            .arg(&path_buf)
            .status()
            .map_err(|err| format!("Cannot open file manager: {err}"))?;

        if status.success() {
            return Ok(());
        }

        return Err(format!("File manager reveal failed with status {status}."));
    }

    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    {
        let directory = if path_buf.is_dir() {
            path_buf.as_path()
        } else {
            path_buf
                .parent()
                .ok_or_else(|| "Cannot find containing folder.".to_string())?
        };
        let status = Command::new("xdg-open")
            .arg(directory)
            .status()
            .map_err(|err| format!("Cannot open file manager: {err}"))?;

        if status.success() {
            return Ok(());
        }

        Err(format!("File manager open failed with status {status}."))
    }
}

/// Open a temporary HTML file in the default browser for printing.
#[tauri::command]
fn open_temp_print_html<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    html_content: String,
    file_name: String,
) -> Result<String, String> {
    open_temp_print_html_with_label(window.label(), html_content, file_name)
}

fn open_temp_print_html_with_label(
    label: &str,
    html_content: String,
    file_name: String,
) -> Result<String, String> {
    ensure_label_is_main(label)?;
    use std::io::Write;

    let temp_dir = std::env::temp_dir().join("hazakura-note-print");
    fs::create_dir_all(&temp_dir).map_err(|err| format!("Cannot create print temp dir: {err}"))?;

    let file_path = temp_dir.join(&file_name);
    let mut file = fs::File::create(&file_path)
        .map_err(|err| format!("Cannot create print temp file: {err}"))?;
    file.write_all(html_content.as_bytes())
        .map_err(|err| format!("Cannot write print temp file: {err}"))?;

    // Open in default browser
    #[cfg(target_os = "macos")]
    {
        let status = Command::new("/usr/bin/open")
            .arg(&file_path)
            .status()
            .map_err(|err| format!("Cannot open file in browser: {err}"))?;

        if !status.success() {
            return Err(format!("Open failed with status {status}."));
        }
    }

    #[cfg(target_os = "windows")]
    {
        let status = Command::new("cmd")
            .args(["/C", "start", ""])
            .arg(&file_path)
            .status()
            .map_err(|err| format!("Cannot open file in browser: {err}"))?;

        if !status.success() {
            return Err(format!("Open failed with status {status}."));
        }
    }

    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    {
        let status = Command::new("xdg-open")
            .arg(&file_path)
            .status()
            .map_err(|err| format!("Cannot open file in browser: {err}"))?;

        if !status.success() {
            return Err(format!("Open failed with status {status}."));
        }
    }

    let path_str = file_path.to_string_lossy().to_string();
    Ok(path_str)
}

#[tauri::command]
fn create_text_file<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    path: String,
) -> Result<TextFileDocument, String> {
    create_text_file_with_label(window.label(), path)
}

fn create_text_file_with_label(label: &str, path: String) -> Result<TextFileDocument, String> {
    ensure_label_is_main(label)?;
    let path_buf = PathBuf::from(&path);

    if path_buf.exists() {
        return Err("A file already exists at the selected path.".to_string());
    }

    let parent = path_buf
        .parent()
        .ok_or_else(|| "Cannot create a file without a parent directory.".to_string())?;

    if !parent.is_dir() {
        return Err("Selected folder does not exist.".to_string());
    }

    path_buf
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "Cannot create a file with an invalid name.".to_string())?;

    let file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&path_buf)
        .map_err(|err| format!("Cannot create file: {err}"))?;
    file.sync_all()
        .map_err(|err| format!("Cannot sync created file: {err}"))?;

    open_text_file_with_label(label, path)
}

#[tauri::command]
fn get_file_metadata<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    path: String,
) -> Result<FileMetadataState, String> {
    get_file_metadata_with_label(window.label(), path)
}

fn get_file_metadata_with_label(label: &str, path: String) -> Result<FileMetadataState, String> {
    ensure_label_is_main(label)?;
    let path_buf = PathBuf::from(&path);
    let metadata = readable_text_metadata(&path_buf)?;

    Ok(FileMetadataState {
        path,
        size: metadata.len(),
        modified_ms: modified_ms(&metadata),
        fingerprint: metadata_fingerprint(&metadata),
        large_file_warning: metadata.len() >= LARGE_FILE_WARNING_BYTES,
    })
}

#[tauri::command]
fn save_text_file<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    path: String,
    contents: String,
    expected_fingerprint: String,
    line_ending: String,
) -> Result<SavedFileState, String> {
    save_text_file_with_label(
        window.label(),
        path,
        contents,
        expected_fingerprint,
        line_ending,
    )
}

fn save_text_file_with_label(
    label: &str,
    path: String,
    contents: String,
    expected_fingerprint: String,
    line_ending: String,
) -> Result<SavedFileState, String> {
    ensure_label_is_main(label)?;
    let path_buf = PathBuf::from(&path);
    let metadata = readable_text_metadata(&path_buf)?;

    if has_external_change(&metadata, &expected_fingerprint) {
        return Err(
            "Save conflict: the file changed on disk after it was opened. Reopen the file before saving."
                .to_string(),
        );
    }

    let normalized_contents = normalize_line_endings(&contents, &line_ending);
    atomic_write(&path_buf, normalized_contents.as_bytes())?;

    let metadata =
        fs::metadata(&path_buf).map_err(|err| format!("Cannot verify saved file: {err}"))?;

    Ok(SavedFileState {
        path,
        line_ending: line_ending_for_save(&line_ending).to_string(),
        size: metadata.len(),
        modified_ms: modified_ms(&metadata),
        fingerprint: metadata_fingerprint(&metadata),
    })
}

#[tauri::command]
fn save_text_file_as<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    path: String,
    contents: String,
    line_ending: String,
) -> Result<TextFileDocument, String> {
    save_text_file_as_with_label(window.label(), path, contents, line_ending)
}

fn save_text_file_as_with_label(
    label: &str,
    path: String,
    contents: String,
    line_ending: String,
) -> Result<TextFileDocument, String> {
    ensure_label_is_main(label)?;
    let path_buf = PathBuf::from(&path);

    if path_buf.exists() {
        return Err("A file already exists at the selected path.".to_string());
    }

    let parent = path_buf
        .parent()
        .ok_or_else(|| "Cannot save a file without a parent directory.".to_string())?;

    if !parent.is_dir() {
        return Err("Selected folder does not exist.".to_string());
    }

    path_buf
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "Cannot save a file with an invalid name.".to_string())?;

    let normalized_contents = normalize_line_endings(&contents, &line_ending);
    write_new_file(&path_buf, normalized_contents.as_bytes())?;

    open_text_file_with_label(label, path)
}

#[tauri::command]
fn save_auto_backup<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    workspace_root: String,
    relative_file_path: String,
    content: String,
) -> Result<String, String> {
    ensure_main_window(&window)?;
    auto_backup::save_auto_backup(&workspace_root, &relative_file_path, &content)
}

#[tauri::command]
fn list_auto_backups<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    workspace_root: String,
    relative_file_path: String,
) -> Result<Vec<AutoBackupEntry>, String> {
    ensure_main_window(&window)?;
    auto_backup::list_auto_backups(&workspace_root, &relative_file_path)
}

#[tauri::command]
fn read_auto_backup<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    workspace_root: String,
    relative_file_path: String,
    backup_name: String,
) -> Result<String, String> {
    ensure_main_window(&window)?;
    auto_backup::read_auto_backup(&workspace_root, &relative_file_path, &backup_name)
}

#[tauri::command]
fn prune_auto_backups<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    workspace_root: String,
    relative_file_path: String,
    keep_count: usize,
) -> Result<usize, String> {
    ensure_main_window(&window)?;
    auto_backup::prune_auto_backups(&workspace_root, &relative_file_path, keep_count)
}

#[tauri::command]
fn list_workspace_tree<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    root: String,
) -> Result<WorkspaceTreeEntry, String> {
    list_workspace_tree_with_label(window.label(), root)
}

fn list_workspace_tree_with_label(label: &str, root: String) -> Result<WorkspaceTreeEntry, String> {
    ensure_label_is_main(label)?;
    let root_path = PathBuf::from(&root);
    ensure_workspace_root(&root_path)?;

    build_workspace_directory(&root_path)
}

#[tauri::command]
fn list_workspace_directory<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    root: String,
    directory: String,
) -> Result<WorkspaceTreeEntry, String> {
    list_workspace_directory_with_label(window.label(), root, directory)
}

fn list_workspace_directory_with_label(
    label: &str,
    root: String,
    directory: String,
) -> Result<WorkspaceTreeEntry, String> {
    ensure_label_is_main(label)?;
    let root_path = PathBuf::from(&root);
    let directory_path = PathBuf::from(&directory);
    let canonical_root = ensure_workspace_root(&root_path)?;
    let canonical_directory = fs::canonicalize(&directory_path)
        .map_err(|err| format!("Cannot read workspace folder: {err}"))?;

    if !canonical_directory.starts_with(&canonical_root) {
        return Err("Selected folder is outside the workspace root.".to_string());
    }

    let metadata = fs::metadata(&directory_path)
        .map_err(|err| format!("Cannot read workspace folder: {err}"))?;

    if !metadata.is_dir() {
        return Err("Selected workspace path is not a folder.".to_string());
    }

    build_workspace_directory(&directory_path)
}

#[tauri::command]
fn open_workspace_image<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    root: String,
    path: String,
) -> Result<ImagePreviewDocument, String> {
    open_workspace_image_with_label(window.label(), root, path)
}

fn open_workspace_image_with_label(
    label: &str,
    root: String,
    path: String,
) -> Result<ImagePreviewDocument, String> {
    ensure_label_is_main(label)?;
    let root_path = PathBuf::from(&root);
    let image_path = PathBuf::from(&path);
    let canonical_root = ensure_workspace_root(&root_path)?;
    let canonical_image =
        fs::canonicalize(&image_path).map_err(|err| format!("Cannot read image: {err}"))?;

    if !canonical_image.starts_with(&canonical_root) {
        return Err("Selected image is outside the workspace root.".to_string());
    }

    let metadata = fs::metadata(&image_path).map_err(|err| format!("Cannot read image: {err}"))?;

    if !metadata.is_file() {
        return Err("Selected path is not an image file.".to_string());
    }

    if metadata.len() > MAX_IMAGE_PREVIEW_BYTES {
        return Err("Image is larger than the preview limit of 20 MB.".to_string());
    }

    let bytes = fs::read(&image_path).map_err(|err| format!("Cannot read image: {err}"))?;
    let mime_type = image_mime_type(&image_path, &bytes).ok_or_else(|| {
        "Selected image contents do not match a supported image type.".to_string()
    })?;
    let name = image_path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("image")
        .to_string();

    Ok(ImagePreviewDocument {
        path,
        name,
        data_url: format!("data:{mime_type};base64,{}", encode_base64(&bytes)),
        size: metadata.len(),
    })
}

/// Save a pasted image from the clipboard (base64) to the workspace assets folder.
#[tauri::command]
fn save_pasted_image<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    workspace_root: String,
    data_base64: String,
    file_name: String,
) -> Result<String, String> {
    save_pasted_image_with_label(window.label(), workspace_root, data_base64, file_name)
}

fn save_pasted_image_with_label(
    label: &str,
    workspace_root: String,
    data_base64: String,
    file_name: String,
) -> Result<String, String> {
    ensure_label_is_main(label)?;
    // Keep the parameter for Tauri command compatibility (frontend sends it)
    let _ = &file_name;
    let root = PathBuf::from(&workspace_root);
    let canonical_root = ensure_workspace_root(&root)?;

    // Decode the base64 image data FIRST
    let bytes = decode_base64(&data_base64)?;

    // Validate image type from bytes only (magic bytes check)
    let ext = image_ext_from_bytes(&bytes)
        .ok_or_else(|| "Unsupported image type.".to_string())?
        .to_string();

    // Compute content hash for deduplication (deterministic FNV-1a)
    let hash = bytes.iter().fold(0xcbf29ce484222325u64, |mut h, &b| {
        h ^= b as u64;
        h.wrapping_mul(0x100000001b3)
    });
    let hash_hex = format!("{:016x}", hash);
    let safe_name = format!("{hash_hex}.{ext}");

    // Create assets directory
    let assets_dir = canonical_root.join("assets");
    fs::create_dir_all(&assets_dir).map_err(|e| format!("Cannot create assets folder: {e}"))?;
    let canonical_assets =
        fs::canonicalize(&assets_dir).map_err(|e| format!("Cannot verify assets folder: {e}"))?;

    if !canonical_assets.starts_with(&canonical_root) {
        return Err("Assets folder is outside the workspace root.".to_string());
    }

    let dest = canonical_assets.join(&safe_name);

    // If a file with this content hash already exists, return its path
    // without overwriting (dedup).
    if dest.exists() {
        let relative = dest
            .strip_prefix(&canonical_root)
            .unwrap_or(&dest)
            .to_string_lossy()
            .replace(std::path::MAIN_SEPARATOR, "/");
        return Ok(relative);
    }

    // Write the new image file
    fs::write(&dest, &bytes).map_err(|e| format!("Cannot write image file: {e}"))?;

    // Return the relative path (for markdown insertion)
    let relative = dest
        .strip_prefix(&canonical_root)
        .unwrap_or(&dest)
        .to_string_lossy()
        .replace(std::path::MAIN_SEPARATOR, "/");
    Ok(relative)
}

/// Import an image from an arbitrary file path into the workspace assets folder.
/// Uses content hash for deduplication: importing the same image twice
/// returns the existing path without creating a duplicate.
#[tauri::command]
fn import_image_from_path<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    workspace_root: String,
    source_path: String,
) -> Result<String, String> {
    import_image_from_path_with_label(window.label(), workspace_root, source_path)
}

fn import_image_from_path_with_label(
    label: &str,
    workspace_root: String,
    source_path: String,
) -> Result<String, String> {
    ensure_label_is_main(label)?;
    let root = PathBuf::from(&workspace_root);
    let canonical_root = ensure_workspace_root(&root)?;

    let src = PathBuf::from(&source_path);
    let metadata = fs::metadata(&src).map_err(|e| format!("Cannot read source file: {e}"))?;
    if !metadata.is_file() {
        return Err("Source path is not a file".to_string());
    }
    if metadata.len() > MAX_IMAGE_PREVIEW_BYTES {
        return Err(format!(
            "File exceeds size limit of {} MB",
            MAX_IMAGE_PREVIEW_BYTES / (1024 * 1024)
        ));
    }

    let bytes = fs::read(&src).map_err(|e| format!("Cannot read source file: {e}"))?;

    // Detect format from magic bytes only (for security)
    let ext = image_ext_from_bytes(&bytes)
        .ok_or_else(|| "Unsupported image type.".to_string())?
        .to_string();

    // Compute content hash for deduplication (deterministic FNV-1a)
    let hash = bytes.iter().fold(0xcbf29ce484222325u64, |mut h, &b| {
        h ^= b as u64;
        h.wrapping_mul(0x100000001b3)
    });
    let hash_hex = format!("{:016x}", hash);
    let safe_name = format!("{hash_hex}.{ext}");

    let assets_dir = canonical_root.join("assets");
    fs::create_dir_all(&assets_dir).map_err(|e| format!("Cannot create assets folder: {e}"))?;
    let canonical_assets =
        fs::canonicalize(&assets_dir).map_err(|e| format!("Cannot verify assets folder: {e}"))?;

    if !canonical_assets.starts_with(&canonical_root) {
        return Err("Assets folder is outside the workspace root.".to_string());
    }

    let dest = canonical_assets.join(&safe_name);

    // Dedup: if a file with this hash already exists, return its path
    if dest.exists() {
        let relative = dest
            .strip_prefix(&canonical_root)
            .unwrap_or(&dest)
            .to_string_lossy()
            .replace(std::path::MAIN_SEPARATOR, "/");
        return Ok(relative);
    }

    // Copy the file
    fs::copy(&src, &dest).map_err(|e| format!("Cannot copy image file: {e}"))?;

    let relative = dest
        .strip_prefix(&canonical_root)
        .unwrap_or(&dest)
        .to_string_lossy()
        .replace(std::path::MAIN_SEPARATOR, "/");
    Ok(relative)
}

#[tauri::command]
fn start_agent_workbench_session<R: tauri::Runtime>(
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

fn start_agent_workbench_session_with_label(
    label: &str,
    session_store: &AgentWorkbenchSessionStore,
    agent_workbench_enabled: bool,
    consent_acknowledged: bool,
    provider: String,
    workspace_root: String,
    terminal_columns: Option<u16>,
    terminal_rows: Option<u16>,
) -> Result<AgentWorkbenchSessionStartResult, String> {
    ensure_label_is_main(label)?;
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
fn stop_agent_workbench_session<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    session_store: tauri::State<'_, AgentWorkbenchSessionStore>,
) -> Result<AgentWorkbenchSessionState, String> {
    stop_agent_workbench_session_with_label(window.label(), session_store.inner())
}

fn stop_agent_workbench_session_with_label(
    label: &str,
    session_store: &AgentWorkbenchSessionStore,
) -> Result<AgentWorkbenchSessionState, String> {
    ensure_label_is_main_or_agent(label)?;
    let adapter = RealAgentRuntimeAdapter::new(session_store);

    stop_agent_workbench_session_with_store(session_store, &adapter)
}

#[tauri::command]
fn get_agent_workbench_session_state<R: tauri::Runtime>(
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

fn get_agent_workbench_session_state_with_label(
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
fn write_agent_workbench_session_input<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    session_store: tauri::State<'_, AgentWorkbenchSessionStore>,
    input: String,
) -> Result<(), String> {
    write_agent_workbench_session_input_with_label(window.label(), session_store.inner(), input)
}

fn write_agent_workbench_session_input_with_label(
    label: &str,
    session_store: &AgentWorkbenchSessionStore,
    input: String,
) -> Result<(), String> {
    ensure_label_is_main_or_agent(label)?;
    write_agent_workbench_session_input_with_store(session_store, input)
}

#[tauri::command]
fn resize_agent_workbench_terminal<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    session_store: tauri::State<'_, AgentWorkbenchSessionStore>,
    columns: u16,
    rows: u16,
) -> Result<AgentWorkbenchSessionState, String> {
    resize_agent_workbench_terminal_with_label(window.label(), session_store.inner(), columns, rows)
}

fn resize_agent_workbench_terminal_with_label(
    label: &str,
    session_store: &AgentWorkbenchSessionStore,
    columns: u16,
    rows: u16,
) -> Result<AgentWorkbenchSessionState, String> {
    ensure_label_is_main_or_agent(label)?;
    resize_agent_workbench_terminal_with_store(session_store, columns, rows)
}

fn start_agent_workbench_session_with_store(
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

fn stop_agent_workbench_session_with_store(
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

fn get_agent_workbench_session_state_with_store(
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

fn get_agent_workbench_session_state_since_with_store(
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

fn write_agent_workbench_session_input_with_store(
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

fn resize_agent_workbench_terminal_with_store(
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

fn refresh_agent_workbench_session_exit(
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

fn build_agent_workbench_preflight(
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

fn validate_agent_workbench_launch(
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

#[cfg(desktop)]
#[tauri::command]
fn update_app_menu_state<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    app: tauri::AppHandle<R>,
    state: AppMenuState,
    session_store: tauri::State<'_, AgentWorkbenchSessionStore>,
) -> Result<(), String> {
    ensure_main_window(&window)?;
    // Mirror the Agent Workbench active + consent flags into the
    // process-singleton session store. The Rust `open_agent_window`
    // command reads these flags to gate the detached Agent Window
    // server-side (defense in depth — the menu item is also gated
    // client-side, but a direct IPC call must not be able to spawn
    // the agent window when Agent Workbench is disabled or consent
    // is missing).
    session_store
        .agent_workbench_active
        .store(state.agent_workbench_active, Ordering::SeqCst);
    session_store
        .agent_workbench_consent
        .store(state.agent_workbench_consent, Ordering::SeqCst);

    let menu = build_app_menu_with_state(&app, Some(&state))
        .map_err(|err| format!("Cannot build app menu: {err}"))?;
    app.set_menu(menu)
        .map_err(|err| format!("Cannot update app menu: {err}"))?;

    Ok(())
}

#[cfg(desktop)]
#[tauri::command]
fn open_agent_window<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    app: tauri::AppHandle<R>,
    session_store: tauri::State<'_, AgentWorkbenchSessionStore>,
    theme: Option<String>,
) -> Result<(), String> {
    ensure_main_window(&window)?;
    if !session_store.agent_workbench_active.load(Ordering::SeqCst) {
        return Err(
            "Agent Workbench is not active. Enable it in Preferences and restart before opening the Agent window."
                .to_string(),
        );
    }

    if !session_store.agent_workbench_consent.load(Ordering::SeqCst) {
        return Err(
            "Agent Workbench consent is required before opening the Agent window.".to_string(),
        );
    }

    let theme = theme.unwrap_or_else(|| "dark".to_string());

    if let Some(existing) = app.get_webview_window("agent") {
        // Window already open — refocus, then push the current theme so
        // the existing agent window catches up if the user changed
        // themes between launches.
        let _ = existing.set_focus();
        let bg = agent_window_background_color(&theme);
        let _ = existing.set_background_color(Some(bg));
        let _ = existing.set_theme(Some(agent_window_os_theme(&theme)));
        return Ok(());
    }

    // Transparent title bar + a per-theme `background_color` so the OS
    // chrome (title bar / traffic lights) shows the same dark or light
    // surface as the main window's chrome, matching the main window's
    // tauri.conf.json pattern. The per-theme color is taken from the
    // `theme` argument (the main window passes its current
    // `THEME_STORAGE_KEY` value), so the initial paint is already
    // correct — no flash of the wrong-color title bar.
    WebviewWindowBuilder::new(&app, "agent", WebviewUrl::App("agent.html".into()))
        .title("hazakura agent")
        .title_bar_style(TitleBarStyle::Transparent)
        .background_color(agent_window_background_color(&theme))
        .theme(Some(agent_window_os_theme(&theme)))
        // Narrow tool-window size (Photoshop / IDE panel proportions),
        // not a browser-popup size. The 380 × 520 floor is just enough
        // to keep the four-row chrome (header / info / terminal /
        // footer) readable; the xterm fit-addon will reflow to the new
        // columns on the first ResizeObserver tick after open.
        .inner_size(440.0, 760.0)
        .min_inner_size(380.0, 520.0)
        .center()
        .build()
        .map_err(|err| format!("Cannot open Agent window: {err}"))?;

    Ok(())
}

// Push the current theme to the already-open agent window (no-op if
// the window is not open). Called from two places:
//
//   1. The main window, when the user changes the theme via
//      Preferences — so the agent window's title-bar / traffic-lights
//      paint and the OS chrome behind the Transparent title bar
//      follow the new theme in real time.
//   2. The agent window itself, on mount and on the cross-window
//      `storage` event from the main window — so the agent window
//      picks up the main window's current theme preference, even if
//      it was changed before the agent window was opened.
//
// Gated on `main | agent` because both windows legitimately need to
// invoke it. The Rust side does all the per-window work via
// `app.get_webview_window("agent")`, so no JS-side core window
// permissions are required on the agent-window capability — the
// auto-allowlist for custom commands in capability-listed windows
// covers the IPC.
#[cfg(desktop)]
#[tauri::command]
fn set_agent_window_theme<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    app: tauri::AppHandle<R>,
    theme: String,
) -> Result<(), String> {
    ensure_label_is_main_or_agent(window.label())?;
    let bg = agent_window_background_color(&theme);
    let os_theme = agent_window_os_theme(&theme);

    if let Some(agent_window) = app.get_webview_window(AGENT_WINDOW_LABEL) {
        agent_window
            .set_background_color(Some(bg))
            .map_err(|err| format!("Cannot update agent window background color: {err}"))?;
        agent_window
            .set_theme(Some(os_theme))
            .map_err(|err| format!("Cannot update agent window OS theme: {err}"))?;
    }

    Ok(())
}

// Focus the main window and ask it to switch the right pane to
// Agent mode. Called from the detached agent window's "Show in
// main pane" footer link (and theoretically from the main window
// itself, where it's a no-op-ish "ensure main is focused + emit
// the event"). Gated on `main | agent` so the agent window can
// invoke it without going through the menu, and so the main
// window can self-trigger if it ever needs to. The targeted
// `emit_to(MAIN, ...)` keeps the signal off the agent window's
// own listener, so the agent window never re-triggers itself.
#[cfg(desktop)]
#[tauri::command]
fn open_main_agent_pane<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    app: tauri::AppHandle<R>,
) -> Result<(), String> {
    ensure_label_is_main_or_agent(window.label())?;
    if let Some(main_window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        let _ = main_window.set_focus();
    }
    let _ = app.emit_to(MAIN_WINDOW_LABEL, OPEN_MAIN_AGENT_PANE_EVENT, ());
    Ok(())
}

// Label-only check used by the `open_main_agent_pane` test suite.
// The `app.emit_to` and `app.get_webview_window` calls in the body
// need a real `AppHandle`; the gate is the only piece worth pinning
// in unit tests, mirroring the `*_with_label` shim pattern used by
// the other boundary tests.
#[cfg(desktop)]
#[cfg_attr(not(test), allow(dead_code))]
fn open_main_agent_pane_with_label(label: &str) -> Result<(), String> {
    ensure_label_is_main_or_agent(label)
}

#[tauri::command]
fn update_theme_menu_state<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    app: tauri::AppHandle<R>,
    theme_preference: String,
) -> Result<(), String> {
    ensure_main_window(&window)?;
    crate::menu::sync_theme_menu_state(&app, &theme_preference)
}

#[tauri::command]
fn drain_opened_files<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    store: tauri::State<'_, OpenedFileStore>,
) -> Result<Vec<String>, String> {
    ensure_main_window(&window)?;
    let mut paths = store
        .0
        .lock()
        .map_err(|_| "Cannot read pending opened files.".to_string())?;
    Ok(paths.drain(..).collect())
}

#[tauri::command]
fn request_app_restart<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    app: tauri::AppHandle<R>,
) -> Result<(), String> {
    ensure_main_window(&window)?;
    app.request_restart();
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .manage(AgentWorkbenchSessionStore::default())
        .manage(OpenedFileStore::default())
        .plugin(tauri_plugin_dialog::init());

    #[cfg(desktop)]
    let builder = builder
        .menu(build_app_menu)
        .on_menu_event(emit_app_menu_event);

    builder
        .invoke_handler(tauri::generate_handler![
            open_text_file,
            reveal_path_in_file_manager,
            create_text_file,
            get_file_metadata,
            list_workspace_directory,
            list_workspace_tree,
            open_workspace_image,
            start_agent_workbench_session,
            stop_agent_workbench_session,
            get_agent_workbench_session_state,
            write_agent_workbench_session_input,
            resize_agent_workbench_terminal,
            drain_opened_files,
            request_app_restart,
            save_text_file,
            save_text_file_as,
            update_app_menu_state,
            update_theme_menu_state,
            open_agent_window,
            set_agent_window_theme,
            open_main_agent_pane,
            save_pasted_image,
            import_image_from_path,
            open_temp_print_html,
            save_auto_backup,
            list_auto_backups,
            read_auto_backup,
            prune_auto_backups,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let tauri::RunEvent::Opened { urls } = event {
                let paths = urls
                    .into_iter()
                    .filter_map(|url| url.to_file_path().ok())
                    .filter(|path| path.is_file())
                    .map(|path| path.to_string_lossy().to_string())
                    .collect::<Vec<_>>();

                if paths.is_empty() {
                    return;
                }

                if let Some(store) = app.try_state::<OpenedFileStore>() {
                    if let Ok(mut pending_paths) = store.0.lock() {
                        pending_paths.extend(paths.clone());
                    }
                }

                let _ = app.emit(OPENED_FILES_EVENT, paths);
            }
        });
}
