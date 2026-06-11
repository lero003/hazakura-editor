use crate::auto_backup;
use crate::security::window_guard::*;
use crate::types::*;
use crate::util::*;

use std::fs::{self, OpenOptions};
use std::path::PathBuf;
use std::process::Command;
#[tauri::command]
pub(crate) fn open_text_file<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    path: String,
) -> Result<TextFileDocument, String> {
    open_text_file_with_label(window.label(), path)
}

pub(crate) fn open_text_file_with_label(
    label: &str,
    path: String,
) -> Result<TextFileDocument, String> {
    ensure_label_is_main(label)?;
    let path_buf = PathBuf::from(&path);
    let metadata = readable_text_metadata(&path_buf)?;

    let bytes = fs::read(&path_buf).map_err(|err| format!("Cannot read file: {err}"))?;
    let line_ending = detect_line_ending(&bytes);
    let encoding = detect_text_encoding(&bytes).to_string();
    let contents = decode_text_bytes(&bytes, &encoding)?.into_owned();
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
        encoding,
        size: metadata.len(),
        modified_ms: modified_ms(&metadata),
        fingerprint: metadata_fingerprint(&metadata),
        large_file_warning: metadata.len() >= LARGE_FILE_WARNING_BYTES,
    })
}

#[tauri::command]
pub(crate) fn reveal_path_in_file_manager<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    path: String,
) -> Result<(), String> {
    reveal_path_in_file_manager_with_label(window.label(), path)
}

pub(crate) fn reveal_path_in_file_manager_with_label(
    label: &str,
    path: String,
) -> Result<(), String> {
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

        Err(format!("Finder reveal failed with status {status}."))
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

#[tauri::command]
pub(crate) fn create_text_file<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    path: String,
    workspace_root: Option<String>,
) -> Result<TextFileDocument, String> {
    create_text_file_with_label(window.label(), path, workspace_root)
}

pub(crate) fn create_text_file_with_label(
    label: &str,
    path: String,
    workspace_root: Option<String>,
) -> Result<TextFileDocument, String> {
    ensure_label_is_main(label)?;
    let path_buf = PathBuf::from(&path);

    if let Some(root) = workspace_root.as_deref() {
        ensure_path_inside_workspace_root(&path_buf, &PathBuf::from(root))?;
    }

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
pub(crate) fn create_text_folder<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    path: String,
    workspace_root: String,
) -> Result<(), String> {
    create_text_folder_with_label(window.label(), &path, &workspace_root)
}

pub(crate) fn create_text_folder_with_label(
    label: &str,
    path: &str,
    workspace_root: &str,
) -> Result<(), String> {
    ensure_label_is_main(label)?;
    let path_buf = PathBuf::from(path);
    let root_buf = PathBuf::from(workspace_root);

    if path_buf.exists() {
        return Err("A folder already exists at the selected path.".to_string());
    }

    path_buf
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "Cannot create a folder with an invalid name.".to_string())?;

    ensure_path_inside_workspace_root(&path_buf, &root_buf)?;

    fs::create_dir(&path_buf).map_err(|err| format!("Cannot create folder: {err}"))?;
    Ok(())
}

#[tauri::command]
pub(crate) fn get_file_metadata<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    path: String,
) -> Result<FileMetadataState, String> {
    get_file_metadata_with_label(window.label(), path)
}

pub(crate) fn get_file_metadata_with_label(
    label: &str,
    path: String,
) -> Result<FileMetadataState, String> {
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
pub(crate) fn save_text_file<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    path: String,
    contents: String,
    expected_fingerprint: String,
    line_ending: String,
    encoding: String,
) -> Result<SavedFileState, String> {
    save_text_file_with_label(
        window.label(),
        path,
        contents,
        expected_fingerprint,
        line_ending,
        encoding,
    )
}

pub(crate) fn save_text_file_with_label(
    label: &str,
    path: String,
    contents: String,
    expected_fingerprint: String,
    line_ending: String,
    encoding: String,
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
    let encoded_bytes = encode_text(&normalized_contents, &encoding)?;
    write_existing_file_with_atomic_fallback(&path_buf, &encoded_bytes)?;

    let metadata =
        fs::metadata(&path_buf).map_err(|err| format!("Cannot verify saved file: {err}"))?;

    Ok(SavedFileState {
        path,
        line_ending: line_ending_for_save(&line_ending).to_string(),
        encoding: encoding_for_save(&encoding).to_string(),
        size: metadata.len(),
        modified_ms: modified_ms(&metadata),
        fingerprint: metadata_fingerprint(&metadata),
    })
}

#[tauri::command]
pub(crate) fn save_text_file_as<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    path: String,
    contents: String,
    line_ending: String,
    encoding: String,
    workspace_root: Option<String>,
) -> Result<TextFileDocument, String> {
    save_text_file_as_with_label(
        window.label(),
        path,
        contents,
        line_ending,
        encoding,
        workspace_root,
    )
}

pub(crate) fn save_text_file_as_with_label(
    label: &str,
    path: String,
    contents: String,
    line_ending: String,
    encoding: String,
    workspace_root: Option<String>,
) -> Result<TextFileDocument, String> {
    ensure_label_is_main(label)?;
    let path_buf = PathBuf::from(&path);

    if let Some(root) = workspace_root.as_deref() {
        ensure_path_inside_workspace_root(&path_buf, &PathBuf::from(root))?;
    }

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
    let encoded_bytes = encode_text(&normalized_contents, &encoding)?;
    write_new_file(&path_buf, &encoded_bytes)?;

    open_text_file_with_label(label, path)
}

#[tauri::command]
pub(crate) fn save_auto_backup<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    workspace_root: String,
    relative_file_path: String,
    content: String,
) -> Result<String, String> {
    ensure_main_window(&window)?;
    auto_backup::save_auto_backup(&workspace_root, &relative_file_path, &content)
}

#[tauri::command]
pub(crate) fn list_auto_backups<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    workspace_root: String,
    relative_file_path: String,
) -> Result<Vec<AutoBackupEntry>, String> {
    ensure_main_window(&window)?;
    auto_backup::list_auto_backups(&workspace_root, &relative_file_path)
}

#[tauri::command]
pub(crate) fn read_auto_backup<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    workspace_root: String,
    relative_file_path: String,
    backup_name: String,
) -> Result<String, String> {
    ensure_main_window(&window)?;
    auto_backup::read_auto_backup(&workspace_root, &relative_file_path, &backup_name)
}

#[tauri::command]
pub(crate) fn prune_auto_backups<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    workspace_root: String,
    relative_file_path: String,
    keep_count: usize,
) -> Result<usize, String> {
    ensure_main_window(&window)?;
    auto_backup::prune_auto_backups(&workspace_root, &relative_file_path, keep_count)
}
