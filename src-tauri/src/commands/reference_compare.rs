// Tauri surface for v1.7 Reference Compare R0 (PDF reference spike).
//
// Main window only. Frontend supplies a user/workspace-selected absolute
// PDF path and later an opaque reference id — never a helper path or
// staged container path.

use crate::import_assist::path::MAX_IMPORT_SOURCE_BYTES;
use crate::import_assist::pdf_reference::{
    close_pdf_reference as close_pdf_reference_session,
    open_pdf_reference as open_pdf_reference_session,
    render_pdf_reference_page as render_pdf_reference_page_session, PdfReferenceOpenResult,
    PdfReferencePageImage,
};
use crate::security::window_guard::{ensure_label_is_main, ensure_main_window};
use crate::types::FileMetadataState;
use crate::util::{metadata_fingerprint, modified_ms, readable_regular_file_metadata};
use std::path::PathBuf;
use tauri::WebviewWindow;

#[tauri::command]
pub(crate) fn open_pdf_reference<R: tauri::Runtime>(
    window: WebviewWindow<R>,
    path: String,
) -> Result<PdfReferenceOpenResult, String> {
    ensure_main_window(&window)?;
    open_pdf_reference_with_label(window.label(), path)
}

pub(crate) fn open_pdf_reference_with_label(
    label: &str,
    path: String,
) -> Result<PdfReferenceOpenResult, String> {
    ensure_label_is_main(label)?;
    if path.trim().is_empty() {
        return Err("PDF reference path is empty.".into());
    }
    open_pdf_reference_session(PathBuf::from(path.trim()).as_path())
}

#[tauri::command]
pub(crate) fn render_pdf_reference_page<R: tauri::Runtime>(
    window: WebviewWindow<R>,
    reference_id: String,
    page_index: usize,
    max_pixels: Option<u64>,
) -> Result<PdfReferencePageImage, String> {
    ensure_main_window(&window)?;
    render_pdf_reference_page_with_label(window.label(), reference_id, page_index, max_pixels)
}

pub(crate) fn render_pdf_reference_page_with_label(
    label: &str,
    reference_id: String,
    page_index: usize,
    max_pixels: Option<u64>,
) -> Result<PdfReferencePageImage, String> {
    ensure_label_is_main(label)?;
    render_pdf_reference_page_session(&reference_id, page_index, max_pixels)
}

#[tauri::command]
pub(crate) fn close_pdf_reference<R: tauri::Runtime>(
    window: WebviewWindow<R>,
    reference_id: String,
) -> Result<(), String> {
    ensure_main_window(&window)?;
    close_pdf_reference_with_label(window.label(), reference_id)
}

pub(crate) fn close_pdf_reference_with_label(
    label: &str,
    reference_id: String,
) -> Result<(), String> {
    ensure_label_is_main(label)?;
    close_pdf_reference_session(&reference_id)
}

/// Disk fingerprint for any reference path (text / PDF / image).
/// Unlike `get_file_metadata`, this does not reject binary-looking files
/// and uses the import/reference size ceiling rather than the 10 MB text limit.
#[tauri::command]
pub(crate) fn get_reference_file_metadata<R: tauri::Runtime>(
    window: WebviewWindow<R>,
    path: String,
) -> Result<FileMetadataState, String> {
    ensure_main_window(&window)?;
    get_reference_file_metadata_with_label(window.label(), path)
}

pub(crate) fn get_reference_file_metadata_with_label(
    label: &str,
    path: String,
) -> Result<FileMetadataState, String> {
    ensure_label_is_main(label)?;
    if path.trim().is_empty() {
        return Err("Reference path is empty.".into());
    }
    let path_buf = PathBuf::from(path.trim());
    let metadata = readable_regular_file_metadata(&path_buf, MAX_IMPORT_SOURCE_BYTES)?;

    Ok(FileMetadataState {
        path: path_buf.to_string_lossy().to_string(),
        size: metadata.len(),
        modified_ms: modified_ms(&metadata),
        fingerprint: metadata_fingerprint(&metadata),
        large_file_warning: false,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn rejects_non_main_window_for_open() {
        let err = open_pdf_reference_with_label("agent", "/tmp/a.pdf".into())
            .expect_err("agent window must be rejected");
        assert!(err.contains("not allowed"));
    }

    #[test]
    fn rejects_empty_path_on_main() {
        let err = open_pdf_reference_with_label("main", "  ".into()).expect_err("empty path");
        assert!(err.contains("empty"));
    }

    #[test]
    fn rejects_non_main_for_render_and_close() {
        let err = render_pdf_reference_page_with_label("agent", "id".into(), 0, None)
            .expect_err("agent render rejected");
        assert!(err.contains("not allowed"));
        let err = close_pdf_reference_with_label("apple-assist", "id".into())
            .expect_err("assist close rejected");
        assert!(err.contains("not allowed"));
    }

    #[test]
    fn reference_metadata_accepts_binary_looking_files() {
        use crate::util::readable_text_metadata;

        let path =
            std::env::temp_dir().join(format!("hazakura-ref-meta-{}.pdf", std::process::id()));
        {
            let mut f = std::fs::File::create(&path).expect("create");
            // NUL makes looks_binary() true so readable_text_metadata rejects this
            // path. Reference metadata must still accept it.
            f.write_all(b"%PDF-1.4\0binary-looking reference fixture\n")
                .expect("write");
        }
        assert!(
            readable_text_metadata(&path).is_err(),
            "fixture must fail the text/binary gate so this test is not a no-op"
        );
        let meta =
            get_reference_file_metadata_with_label("main", path.to_string_lossy().to_string())
                .expect("binary reference metadata");
        assert!(!meta.fingerprint.is_empty());
        assert!(meta.size > 0);
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn reference_metadata_rejects_agent_window_and_missing() {
        let err = get_reference_file_metadata_with_label("agent", "/tmp/a.pdf".into())
            .expect_err("agent rejected");
        assert!(err.contains("not allowed"));
        let err = get_reference_file_metadata_with_label(
            "main",
            "/tmp/hazakura-missing-ref-meta-xyz.pdf".into(),
        )
        .expect_err("missing file");
        assert!(err.contains("Cannot read") || err.contains("not a file") || !err.is_empty());
    }
}
