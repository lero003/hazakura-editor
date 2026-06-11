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
    let was_file = metadata.is_file();
    // Capture the canonical path before trashing so the
    // post-trash backup-dir cleanup can compute the relative
    // path from the canonical workspace root.
    let src_canon = if was_file {
        fs::canonicalize(&src_path).ok()
    } else {
        None
    };
    let canonical_root = if was_file {
        crate::util::ensure_workspace_root(&root_path).ok()
    } else {
        None
    };
    move_to_macos_trash(&src_path)?;

    // For a single-file trash, drop the auto-backup dir so the
    // entry doesn't linger in `.hazakura/backups/` after the
    // file is gone. Folder descendants are out of scope here;
    // the folder rekey lane would walk the whole subtree.
    if was_file {
        if let (Some(root), Some(canon)) = (canonical_root, src_canon) {
            if let Ok(rel) = canon.strip_prefix(&root) {
                crate::auto_backup::remove_auto_backup_dir(workspace_root, &rel.to_string_lossy())?;
            }
        }
    }

    Ok(())
}

#[cfg(target_os = "macos")]
fn move_to_macos_trash(path: &std::path::Path) -> Result<(), String> {
    use objc2::runtime::{AnyObject, Bool};
    use objc2::{class, msg_send};
    use objc2_foundation::NSURL;
    use std::ptr;

    let url = if path.is_dir() {
        NSURL::from_directory_path(path)
    } else {
        NSURL::from_file_path(path)
    }
    .ok_or_else(|| "Cannot create workspace entry URL for Trash.".to_string())?;

    let file_manager: &AnyObject = unsafe { msg_send![class!(NSFileManager), defaultManager] };
    let result: Bool = unsafe {
        msg_send![
            file_manager,
            trashItemAtURL: &*url,
            resultingItemURL: ptr::null_mut::<*mut AnyObject>(),
            error: ptr::null_mut::<*mut AnyObject>()
        ]
    };

    if !result.as_bool() {
        return Err("macOS Trash API refused entry.".to_string());
    }

    Ok(())
}

#[cfg(not(target_os = "macos"))]
fn move_to_macos_trash(_path: &std::path::Path) -> Result<(), String> {
    Err("macOS Trash API is only available on macOS.".to_string())
}
