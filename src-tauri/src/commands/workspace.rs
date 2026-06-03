use crate::security::window_guard::*;
use crate::types::*;
use crate::util::*;

use std::fs;
use std::path::PathBuf;
#[tauri::command]
pub(crate) fn list_workspace_tree<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    root: String,
) -> Result<WorkspaceTreeEntry, String> {
    list_workspace_tree_with_label(window.label(), root)
}

pub(crate) fn list_workspace_tree_with_label(
    label: &str,
    root: String,
) -> Result<WorkspaceTreeEntry, String> {
    ensure_label_is_main(label)?;
    let root_path = PathBuf::from(&root);
    ensure_workspace_root(&root_path)?;

    build_workspace_directory(&root_path)
}

#[tauri::command]
pub(crate) fn list_workspace_directory<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    root: String,
    directory: String,
) -> Result<WorkspaceTreeEntry, String> {
    list_workspace_directory_with_label(window.label(), root, directory)
}

pub(crate) fn list_workspace_directory_with_label(
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
pub(crate) fn rename_workspace_entry<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    src: String,
    dst: String,
    workspace_root: String,
) -> Result<(), String> {
    rename_workspace_entry_with_label(window.label(), &src, &dst, &workspace_root)
}

pub(crate) fn rename_workspace_entry_with_label(
    label: &str,
    src: &str,
    dst: &str,
    workspace_root: &str,
) -> Result<(), String> {
    ensure_label_is_main(label)?;
    let root_path = PathBuf::from(workspace_root);
    crate::util::rename_workspace_entry_util(&PathBuf::from(src), &PathBuf::from(dst), &root_path)
}

#[tauri::command]
pub(crate) fn move_workspace_entry<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    src: String,
    dst: String,
    workspace_root: String,
) -> Result<(), String> {
    move_workspace_entry_with_label(window.label(), &src, &dst, &workspace_root)
}

pub(crate) fn move_workspace_entry_with_label(
    label: &str,
    src: &str,
    dst: &str,
    workspace_root: &str,
) -> Result<(), String> {
    ensure_label_is_main(label)?;
    let dst_path = PathBuf::from(dst);
    if let Some(parent) = dst_path.parent() {
        if !parent.as_os_str().is_empty() && !parent.is_dir() {
            return Err("Destination parent is not a folder.".to_string());
        }
    }
    rename_workspace_entry_with_label(label, src, dst, workspace_root)
}

#[tauri::command]
pub(crate) fn move_workspace_entry_to_trash<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    path: String,
    workspace_root: String,
) -> Result<(), String> {
    move_workspace_entry_to_trash_with_label(window.label(), &path, &workspace_root)
}

pub(crate) fn move_workspace_entry_to_trash_with_label(
    label: &str,
    path: &str,
    workspace_root: &str,
) -> Result<(), String> {
    ensure_label_is_main(label)?;
    let root_path = PathBuf::from(workspace_root);
    let src_path = PathBuf::from(path);
    // Reject if `path` is not inside the canonical workspace
    // root — uses the same containment helper as create/rename/
    // move so a malicious IPC payload can't trash arbitrary
    // system paths.
    crate::util::ensure_path_inside_workspace_root(&src_path, &root_path)?;
    let metadata =
        fs::metadata(&src_path).map_err(|err| format!("Cannot read workspace entry: {err}"))?;
    if !metadata.is_file() && !metadata.is_dir() {
        return Err("Selected workspace entry cannot be trashed.".to_string());
    }
    move_to_finder_trash(&src_path)
}

// macOS-only: use NSFileManager through JavaScript for
// Automation's ObjC bridge so the entry lands in the user's
// Trash without waiting on Finder AppleEvents, which can time
// out in release automation.
fn move_to_finder_trash(path: &std::path::Path) -> Result<(), String> {
    let path_str = path.to_string_lossy().to_string();
    let escaped = serde_json::to_string(&path_str)
        .map_err(|err| format!("Cannot encode workspace entry path for Trash: {err}"))?;
    let script = format!(
        "ObjC.import('Foundation');\
         const url = $.NSURL.fileURLWithPath({});\
         const ok = $.NSFileManager.defaultManager.trashItemAtURLResultingItemURLError(url, null, null);\
         if (!ok) throw new Error('NSFileManager refused to trash entry');",
        escaped
    );
    let output = std::process::Command::new("osascript")
        .arg("-l")
        .arg("JavaScript")
        .arg("-e")
        .arg(&script)
        .output()
        .map_err(|err| format!("Cannot invoke macOS Trash API: {err}"))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).into_owned();
        return Err(format!("macOS Trash API refused entry: {}", stderr.trim()));
    }
    Ok(())
}
