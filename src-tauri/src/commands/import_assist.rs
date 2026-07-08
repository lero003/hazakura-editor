// Tauri surface for Import Assist Phase 1 MVP.
//
// Main window only. Accepts an absolute path chosen by the native
// open dialog (frontend never picks the helper binary). Returns an
// unsaved Markdown draft string for the editor to open as a dirty tab.

use crate::import_assist::helper::{import_source_path_to_markdown, ImportDraftResult};
use crate::security::window_guard::{ensure_label_is_main, ensure_main_window};
use std::path::PathBuf;
use tauri::WebviewWindow;

#[tauri::command]
pub(crate) fn import_source_to_markdown<R: tauri::Runtime>(
    window: WebviewWindow<R>,
    path: String,
) -> Result<ImportDraftResult, String> {
    ensure_main_window(&window)?;
    import_source_to_markdown_with_label(window.label(), path)
}

pub(crate) fn import_source_to_markdown_with_label(
    label: &str,
    path: String,
) -> Result<ImportDraftResult, String> {
    ensure_label_is_main(label)?;
    if path.trim().is_empty() {
        return Err("Import path is empty.".into());
    }
    let path_buf = PathBuf::from(&path);
    import_source_path_to_markdown(&path_buf)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_non_main_window() {
        let err = import_source_to_markdown_with_label("agent", "/tmp/a.pdf".into())
            .expect_err("agent window must be rejected");
        assert!(err.contains("not allowed"));
    }

    #[test]
    fn rejects_empty_path_on_main() {
        let err = import_source_to_markdown_with_label("main", "  ".into())
            .expect_err("empty path rejected");
        assert!(err.contains("empty"));
    }
}
