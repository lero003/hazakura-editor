use crate::security::window_guard::*;
use crate::types::*;
use crate::util::*;

use std::fs;
use std::path::PathBuf;
#[tauri::command]
pub(crate) fn open_workspace_image<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    root: String,
    path: String,
) -> Result<ImagePreviewDocument, String> {
    open_workspace_image_with_label(window.label(), root, path)
}

#[tauri::command]
pub(crate) fn open_image_file<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    path: String,
) -> Result<ImagePreviewDocument, String> {
    open_image_file_with_label(window.label(), path)
}

pub(crate) fn open_workspace_image_with_label(
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

    read_image_preview_document(path, image_path)
}

pub(crate) fn open_image_file_with_label(
    label: &str,
    path: String,
) -> Result<ImagePreviewDocument, String> {
    ensure_label_is_main(label)?;
    let image_path = PathBuf::from(&path);

    read_image_preview_document(path, image_path)
}

fn read_image_preview_document(
    path: String,
    image_path: PathBuf,
) -> Result<ImagePreviewDocument, String> {
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

#[tauri::command]
pub(crate) fn save_pasted_image<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    workspace_root: String,
    data_base64: String,
    file_name: String,
) -> Result<String, String> {
    save_pasted_image_with_label(window.label(), workspace_root, data_base64, file_name)
}

pub(crate) fn save_pasted_image_with_label(
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

#[tauri::command]
pub(crate) fn import_image_from_path<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    workspace_root: String,
    source_path: String,
) -> Result<String, String> {
    import_image_from_path_with_label(window.label(), workspace_root, source_path)
}

pub(crate) fn import_image_from_path_with_label(
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
