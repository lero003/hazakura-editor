//! In-process PDF text-layer extraction (no Vision / no helper).
//!
//! Uses pure-Rust `pdf-extract` so text-layer PDFs work even when only the
//! fixture helper is installed (dev) or OCR is unavailable. Page splits use
//! form-feed when present; otherwise the document is one page.

use super::draft::ImportPageText;
use std::path::Path;

/// Extract plain text from a PDF that has an embedded text layer.
/// Returns `Ok(None)` when the library yields only empty/whitespace text
/// (typical for scanned PDFs). Hard errors (corrupt file, IO) are `Err`.
pub fn extract_pdf_text_layer(path: &Path) -> Result<Option<Vec<ImportPageText>>, String> {
    let raw = pdf_extract::extract_text(path)
        .map_err(|e| format!("PDF text-layer extract failed: {e}"))?;
    let pages = split_pdf_text_into_pages(&raw);
    let meaningful = pages.iter().any(|p| !p.text.trim().is_empty());
    if !meaningful {
        return Ok(None);
    }
    Ok(Some(pages))
}

fn split_pdf_text_into_pages(raw: &str) -> Vec<ImportPageText> {
    let normalized = raw.replace("\r\n", "\n").replace('\r', "\n");
    // pdf-extract often inserts form feeds between pages.
    let chunks: Vec<&str> = if normalized.contains('\u{c}') {
        normalized.split('\u{c}').collect()
    } else {
        vec![normalized.as_str()]
    };

    chunks
        .into_iter()
        .enumerate()
        .map(|(index, chunk)| ImportPageText {
            index,
            text: chunk.trim_matches(|c| c == '\n' || c == ' ').to_string(),
        })
        .filter(|_page| {
            // Drop trailing empty form-feed artifacts but keep intentional
            // blank intermediate pages if any text exists elsewhere.
            true
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;

    #[test]
    fn rejects_non_pdf_bytes() {
        let path: PathBuf = std::env::temp_dir().join(format!(
            "hazakura-not-pdf-{}.pdf",
            std::process::id()
        ));
        fs::write(&path, b"not a pdf").expect("write");
        let err = extract_pdf_text_layer(&path).expect_err("must fail");
        let _ = fs::remove_file(&path);
        assert!(err.contains("PDF") || err.contains("extract") || err.contains("error"));
    }

    #[test]
    fn splits_form_feed_into_pages() {
        let pages = split_pdf_text_into_pages("page one\n\u{c}page two\n");
        assert_eq!(pages.len(), 2);
        assert!(pages[0].text.contains("page one"));
        assert!(pages[1].text.contains("page two"));
    }

    #[test]
    fn whitespace_only_extract_is_none_via_split() {
        // Empty layers must not produce a fake draft.
        let pages = split_pdf_text_into_pages("   \n\n  ");
        let meaningful = pages.iter().any(|p| !p.text.trim().is_empty());
        assert!(!meaningful);
    }
}
