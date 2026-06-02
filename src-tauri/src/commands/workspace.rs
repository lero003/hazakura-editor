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
