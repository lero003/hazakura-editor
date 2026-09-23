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
        std::fs::metadata(&path).map_err(|err| format!("Cannot read selected path: {err}"))?;

    let url = if metadata.is_dir() {
        NSURL::from_directory_path(&path)
    } else if metadata.is_file() {
        NSURL::from_file_path(&path)
    } else {
        return Err("Selected path is not a regular file or folder.".to_string());
    }
    .ok_or_else(|| "Cannot create selected path URL.".to_string())?;
    let bookmark = url
        .bookmarkDataWithOptions_includingResourceValuesForKeys_relativeToURL_error(
            NSURLBookmarkCreationOptions::WithSecurityScope,
            None,
            None,
        )
        .map_err(|err| format!("Cannot create security-scoped bookmark: {err}"))?;

    Ok(bookmark.to_vec())
}

/// Model folders are granted read-only. The registry stores this persistent
/// bookmark; each helper request receives a separate implicit bookmark.
#[cfg(target_os = "macos")]
pub(crate) fn create_read_only_model_bookmark(path: &std::path::Path) -> Result<Vec<u8>, String> {
    use objc2_foundation::{NSURLBookmarkCreationOptions, NSURL};

    if !std::fs::metadata(path)
        .map_err(|error| format!("Cannot read selected model folder: {error}"))?
        .is_dir()
    {
        return Err("Select a Core AI model folder, not a file.".into());
    }
    let url = NSURL::from_directory_path(path)
        .ok_or_else(|| "Cannot create selected model folder URL.".to_string())?;
    let options = NSURLBookmarkCreationOptions::WithSecurityScope
        | NSURLBookmarkCreationOptions::SecurityScopeAllowOnlyReadAccess;
    url.bookmarkDataWithOptions_includingResourceValuesForKeys_relativeToURL_error(
        options, None, None,
    )
    .map(|data| data.to_vec())
    .map_err(|error| format!("Cannot remember selected model folder: {error}"))
}

#[cfg(target_os = "macos")]
pub(crate) struct ScopedModelBookmark {
    pub(crate) path: std::path::PathBuf,
    url: objc2::rc::Retained<objc2_foundation::NSURL>,
}

#[cfg(target_os = "macos")]
impl Drop for ScopedModelBookmark {
    fn drop(&mut self) {
        unsafe { self.url.stopAccessingSecurityScopedResource() };
    }
}

#[cfg(target_os = "macos")]
impl ScopedModelBookmark {
    /// A stored app-scoped bookmark is for this process. The helper receives
    /// a fresh implicit bookmark while this process holds the resolved scope.
    pub(crate) fn implicit_bookmark_for_helper(&self) -> Result<Vec<u8>, String> {
        use objc2_foundation::NSURLBookmarkCreationOptions;
        self.url
            .bookmarkDataWithOptions_includingResourceValuesForKeys_relativeToURL_error(
                NSURLBookmarkCreationOptions::empty(),
                None,
                None,
            )
            .map(|data| data.to_vec())
            .map_err(|error| format!("Cannot grant the helper access to the model folder: {error}"))
    }
}

#[cfg(target_os = "macos")]
pub(crate) fn resolve_model_bookmark(bookmark: &[u8]) -> Result<ScopedModelBookmark, String> {
    use objc2::runtime::Bool;
    use objc2_foundation::{NSData, NSURLBookmarkResolutionOptions, NSURL};

    if bookmark.is_empty() || bookmark.len() > 64 * 1024 {
        return Err("The saved model folder permission is invalid.".into());
    }
    let mut stale = Bool::NO;
    let url = unsafe {
        NSURL::URLByResolvingBookmarkData_options_relativeToURL_bookmarkDataIsStale_error(
            &NSData::with_bytes(bookmark),
            NSURLBookmarkResolutionOptions::WithSecurityScope,
            None,
            &mut stale,
        )
    }
    .map_err(|error| format!("Cannot reopen model folder permission: {error}"))?;
    if stale.as_bool() {
        return Err("The saved model folder permission expired. Select the folder again.".into());
    }
    require_security_scope_started(unsafe { url.startAccessingSecurityScopedResource() })?;
    let path = match url.to_file_path() {
        Some(path) => path,
        None => {
            unsafe { url.stopAccessingSecurityScopedResource() };
            return Err("The saved model folder permission has no file path.".into());
        }
    };
    Ok(ScopedModelBookmark { path, url })
}

#[cfg(not(target_os = "macos"))]
pub(crate) fn create_read_only_model_bookmark(_path: &std::path::Path) -> Result<Vec<u8>, String> {
    Err("External Core AI model folders require macOS.".into())
}

#[cfg(not(target_os = "macos"))]
pub(crate) struct ScopedModelBookmark {
    pub(crate) path: std::path::PathBuf,
}

#[cfg(not(target_os = "macos"))]
pub(crate) fn resolve_model_bookmark(_bookmark: &[u8]) -> Result<ScopedModelBookmark, String> {
    Err("External Core AI model folders require macOS.".into())
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

    start_restored_bookmark_process_access(&url)?;
    let path = url
        .to_file_path()
        .ok_or_else(|| "Cannot resolve bookmark to a file path.".to_string())?;

    Ok(path.to_string_lossy().to_string())
}

#[cfg(target_os = "macos")]
fn start_restored_bookmark_process_access(url: &objc2_foundation::NSURL) -> Result<(), String> {
    // The restore command returns a path that later file/tree commands
    // use during the same app process. Pairing start/stop inside this
    // function would close the grant before those commands run, so this
    // is intentionally a process-lifetime access model for restored
    // bookmarks. App exit releases the security scope.
    let access_started = unsafe { url.startAccessingSecurityScopedResource() };
    require_security_scope_started(access_started)
}

#[cfg(target_os = "macos")]
pub(crate) fn require_security_scope_started(started: bool) -> Result<(), String> {
    if started {
        Ok(())
    } else {
        Err("Cannot start security-scoped resource access.".to_string())
    }
}
