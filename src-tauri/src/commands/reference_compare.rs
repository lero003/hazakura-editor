// Tauri surface for v1.7 Reference Compare R0 (PDF reference spike).
//
// Main window only. Frontend supplies a user/workspace-selected absolute
// PDF path and later an opaque reference id — never a helper path or
// staged container path.

use crate::import_assist::pdf_reference::{
    close_pdf_reference as close_pdf_reference_session,
    open_pdf_reference as open_pdf_reference_session,
    render_pdf_reference_page as render_pdf_reference_page_session, PdfReferenceOpenResult,
    PdfReferencePageImage,
};
use crate::security::window_guard::{ensure_label_is_main, ensure_main_window};
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

#[cfg(test)]
mod tests {
    use super::*;

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
}
