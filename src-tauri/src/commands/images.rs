use crate::security::window_guard::*;
use crate::types::*;
use crate::util::*;

use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::Duration;

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

/// Open a local image only when its canonical path stays under one of the
/// caller-supplied approved roots (Theme G M1). Not a general disk open.
#[tauri::command]
pub(crate) fn open_local_image_under_roots<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    path: String,
    allowed_roots: Vec<String>,
) -> Result<ImagePreviewDocument, String> {
    open_local_image_under_roots_with_label(window.label(), path, allowed_roots)
}

/// Bounded https image fetch for Preview / export materialize (Theme G M2/M3).
/// Default product Preference is Off; callers must gate on user consent.
#[tauri::command]
pub(crate) fn fetch_remote_image<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    url: String,
) -> Result<ImagePreviewDocument, String> {
    fetch_remote_image_with_label(window.label(), url)
}

pub(crate) fn open_workspace_image_with_label(
    label: &str,
    root: String,
    path: String,
) -> Result<ImagePreviewDocument, String> {
    ensure_label_is_main(label)?;
    let root_path = PathBuf::from(&root);
    let image_path = PathBuf::from(&path);
    ensure_path_inside_workspace_root(&image_path, &root_path).map_err(|err| {
        if err.contains("outside the workspace root") {
            "Selected image is outside the workspace root.".to_string()
        } else {
            format!("Cannot read image: {err}")
        }
    })?;

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

pub(crate) fn open_local_image_under_roots_with_label(
    label: &str,
    path: String,
    allowed_roots: Vec<String>,
) -> Result<ImagePreviewDocument, String> {
    ensure_label_is_main(label)?;
    if allowed_roots.is_empty() {
        return Err("No approved image roots were provided.".to_string());
    }
    let image_path = PathBuf::from(&path);
    let canonical = ensure_path_under_any_root(&image_path, &allowed_roots)?;
    read_image_preview_document(canonical.to_string_lossy().to_string(), canonical)
}

pub(crate) fn fetch_remote_image_with_label(
    label: &str,
    url: String,
) -> Result<ImagePreviewDocument, String> {
    ensure_label_is_main(label)?;
    let trimmed = url.trim();
    if trimmed.is_empty() {
        return Err("Remote image URL is empty.".to_string());
    }
    if !trimmed.to_ascii_lowercase().starts_with("https://") {
        return Err("Only https remote images are allowed.".to_string());
    }
    // Reject credentials / userinfo and obvious non-http schemes after trim.
    if trimmed.contains('@') {
        return Err("Remote image URLs with credentials are not allowed.".to_string());
    }

    let agent = ureq::AgentBuilder::new()
        .timeout_connect(Duration::from_secs(8))
        .timeout_read(Duration::from_secs(12))
        // Redirects are disabled so an https URL cannot make a native request
        // through an intermediate http hop before the final URL is checked.
        .redirects(0)
        .build();

    let response = agent
        .get(trimmed)
        .set(
            "User-Agent",
            "HazakuraEditor/1.13 (local preview image fetch)",
        )
        .set(
            "Accept",
            "image/png,image/jpeg,image/gif,image/webp,image/*;q=0.8",
        )
        .call()
        .map_err(|err| format!("Remote image fetch failed: {err}"))?;

    if let Some(message) = remote_image_redirect_error(response.status()) {
        return Err(message);
    }

    let final_url = response.get_url().to_string();
    if !final_url.to_ascii_lowercase().starts_with("https://") {
        return Err("Remote image redirected away from https.".to_string());
    }

    let content_type = response
        .header("Content-Type")
        .unwrap_or("")
        .to_ascii_lowercase();
    if !content_type.is_empty()
        && !content_type.starts_with("image/")
        && !content_type.starts_with("application/octet-stream")
    {
        return Err(format!(
            "Remote response is not an image (Content-Type: {content_type})."
        ));
    }

    let mut bytes: Vec<u8> = Vec::new();
    response
        .into_reader()
        .take(MAX_IMAGE_PREVIEW_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|err| format!("Remote image read failed: {err}"))?;
    if bytes.len() as u64 > MAX_IMAGE_PREVIEW_BYTES {
        return Err(format!(
            "Remote image is larger than the preview limit of {} MB.",
            MAX_IMAGE_PREVIEW_BYTES / (1024 * 1024)
        ));
    }

    let mime_type = image_mime_type_from_bytes(&bytes)
        .ok_or_else(|| "Remote image contents do not match a supported image type.".to_string())?;
    let name = remote_image_name_from_url(&final_url);

    Ok(ImagePreviewDocument {
        path: final_url,
        name,
        data_url: format!("data:{mime_type};base64,{}", encode_base64(&bytes)),
        size: bytes.len() as u64,
    })
}

pub(crate) fn remote_image_redirect_error(status: u16) -> Option<String> {
    (300..400)
        .contains(&status)
        .then(|| "Remote image redirects are not followed; use the final https URL.".to_string())
}

/// Ensure `path` resolves under at least one approved root (canonical).
pub(crate) fn ensure_path_under_any_root(
    path: &Path,
    allowed_roots: &[String],
) -> Result<PathBuf, String> {
    if !path.exists() {
        return Err("Selected image path does not exist.".to_string());
    }
    let canonical =
        fs::canonicalize(path).map_err(|err| format!("Cannot resolve image path: {err}"))?;
    if !canonical.is_file() {
        return Err("Selected path is not an image file.".to_string());
    }

    for root in allowed_roots {
        let root_path = PathBuf::from(root);
        if !root_path.exists() {
            continue;
        }
        let canonical_root = match fs::canonicalize(&root_path) {
            Ok(value) => value,
            Err(_) => continue,
        };
        if canonical == canonical_root || canonical.starts_with(&canonical_root) {
            return Ok(canonical);
        }
    }

    Err("Selected image is outside the approved local roots.".to_string())
}

fn remote_image_name_from_url(url: &str) -> String {
    url.rsplit('/')
        .next()
        .and_then(|segment| {
            let cleaned = segment.split('?').next().unwrap_or(segment);
            if cleaned.is_empty() {
                None
            } else {
                Some(cleaned.to_string())
            }
        })
        .unwrap_or_else(|| "remote-image".to_string())
}

fn image_mime_type_from_bytes(bytes: &[u8]) -> Option<&'static str> {
    image_ext_from_bytes(bytes).map(|ext| match ext {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        _ => "application/octet-stream",
    })
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

    let decoded_len = decoded_base64_len(&data_base64)?;
    if decoded_len as u64 > MAX_IMAGE_PREVIEW_BYTES {
        return Err(format!(
            "Pasted image is larger than the image limit of {} MB.",
            MAX_IMAGE_PREVIEW_BYTES / (1024 * 1024)
        ));
    }

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

    // Create assets directory and confirm it stays inside the workspace.
    let assets_dir = canonical_root.join("assets");
    fs::create_dir_all(&assets_dir).map_err(|e| format!("Cannot create assets folder: {e}"))?;
    let canonical_assets =
        ensure_path_inside_workspace_root(&assets_dir, &root).map_err(|err| {
            if err.contains("outside the workspace root") {
                "Assets folder is outside the workspace root.".to_string()
            } else {
                format!("Cannot verify assets folder: {err}")
            }
        })?;

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
        ensure_path_inside_workspace_root(&assets_dir, &root).map_err(|err| {
            if err.contains("outside the workspace root") {
                "Assets folder is outside the workspace root.".to_string()
            } else {
                format!("Cannot verify assets folder: {err}")
            }
        })?;

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
