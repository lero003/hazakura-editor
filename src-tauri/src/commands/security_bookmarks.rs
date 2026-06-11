use crate::security::window_guard::*;

#[tauri::command]
pub(crate) fn create_security_scoped_bookmark<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    path: String,
) -> Result<Option<Vec<u8>>, String> {
    ensure_label_is_main(window.label())?;
    create_security_scoped_bookmark_with_label(window.label(), &path)
}

pub(crate) fn create_security_scoped_bookmark_with_label(
    label: &str,
    path: &str,
) -> Result<Option<Vec<u8>>, String> {
    ensure_label_is_main(label)?;

    #[cfg(target_os = "macos")]
    {
        return create_security_scoped_bookmark_for_path(path).map(Some);
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = path;
        Ok(None)
    }
}

#[tauri::command]
pub(crate) fn resolve_security_scoped_bookmark<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    bookmark: Vec<u8>,
) -> Result<String, String> {
    ensure_label_is_main(window.label())?;
    resolve_security_scoped_bookmark_with_label(window.label(), &bookmark)
}

pub(crate) fn resolve_security_scoped_bookmark_with_label(
    label: &str,
    bookmark: &[u8],
) -> Result<String, String> {
    ensure_label_is_main(label)?;

    #[cfg(target_os = "macos")]
    {
        return resolve_security_scoped_bookmark_data(bookmark);
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = bookmark;
        Err("Security-scoped bookmarks are only available on macOS.".to_string())
    }
}

#[cfg(target_os = "macos")]
fn create_security_scoped_bookmark_for_path(path: &str) -> Result<Vec<u8>, String> {
    use objc2_foundation::{NSURLBookmarkCreationOptions, NSURL};
    use std::path::PathBuf;

    let path = PathBuf::from(path);
    let metadata =
        std::fs::metadata(&path).map_err(|err| format!("Cannot read workspace folder: {err}"))?;

    if !metadata.is_dir() {
        return Err("Selected workspace path is not a folder.".to_string());
    }

    let url = NSURL::from_directory_path(&path)
        .ok_or_else(|| "Cannot create workspace folder URL.".to_string())?;
    let bookmark = url
        .bookmarkDataWithOptions_includingResourceValuesForKeys_relativeToURL_error(
            NSURLBookmarkCreationOptions::WithSecurityScope,
            None,
            None,
        )
        .map_err(|err| format!("Cannot create security-scoped bookmark: {err}"))?;

    Ok(bookmark.to_vec())
}

#[cfg(target_os = "macos")]
fn resolve_security_scoped_bookmark_data(bookmark: &[u8]) -> Result<String, String> {
    use objc2::runtime::Bool;
    use objc2_foundation::{NSData, NSURLBookmarkResolutionOptions, NSURL};

    let bookmark_data = NSData::with_bytes(bookmark);
    let mut is_stale = Bool::NO;
    let url = unsafe {
        NSURL::URLByResolvingBookmarkData_options_relativeToURL_bookmarkDataIsStale_error(
            &bookmark_data,
            NSURLBookmarkResolutionOptions::WithSecurityScope,
            None,
            &mut is_stale,
        )
    }
    .map_err(|err| format!("Cannot resolve security-scoped bookmark: {err}"))?;

    let _access_started = unsafe { url.startAccessingSecurityScopedResource() };
    let path = url
        .to_file_path()
        .ok_or_else(|| "Cannot resolve bookmark to a file path.".to_string())?;

    Ok(path.to_string_lossy().to_string())
}
