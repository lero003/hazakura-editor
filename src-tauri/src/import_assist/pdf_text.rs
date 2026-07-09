//! PDF text-layer extraction helpers.
//!
//! Primary quality path for Japanese (and general) text-layer PDFs is
//! **PDFKit via the live Import Assist helper**. Pure-Rust `pdf-extract` is
//! a fallback only — it often drops CJK glyphs and collapses page structure
//! (observed on real 日本語メモ PDFs).

use super::draft::ImportPageText;
use std::path::Path;

/// Pure-Rust fallback. Prefer PDFKit when the live helper is available.
pub fn extract_pdf_text_layer(path: &Path) -> Result<Option<Vec<ImportPageText>>, String> {
    let raw = pdf_extract::extract_text(path)
        .map_err(|e| format!("PDF text-layer extract failed: {e}"))?;
    let pages = split_pdf_text_into_pages(&raw);
    if !pages_have_meaningful_text(&pages) {
        return Ok(None);
    }
    Ok(Some(pages))
}

pub fn split_pdf_text_into_pages(raw: &str) -> Vec<ImportPageText> {
    let normalized = raw.replace("\r\n", "\n").replace('\r', "\n");
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
        .collect()
}

pub fn pages_have_meaningful_text(pages: &[ImportPageText]) -> bool {
    pages.iter().any(|p| !p.text.trim().is_empty())
}

/// Heuristic quality score. Higher is better.
/// Japanese text-layer PDFs should heavily prefer extracts with more CJK.
pub fn page_text_quality_score(pages: &[ImportPageText]) -> u64 {
    let mut score: u64 = 0;
    score += (pages.len() as u64).saturating_mul(500);
    for page in pages {
        let t = page.text.as_str();
        let chars = t.chars().count() as u64;
        let cjk = t.chars().filter(|c| is_cjk(*c)).count() as u64;
        let letters = t.chars().filter(|c| c.is_ascii_alphabetic()).count() as u64;
        score = score.saturating_add(chars);
        score = score.saturating_add(cjk.saturating_mul(12));
        // Mild boost for Latin so English PDFs still score, but not enough
        // to beat a full Japanese extract.
        score = score.saturating_add(letters);
    }
    score
}

fn is_cjk(c: char) -> bool {
    matches!(
        c,
        '\u{3040}'..='\u{30ff}' // Hiragana + Katakana
            | '\u{3400}'..='\u{4dbf}' // CJK ext A
            | '\u{4e00}'..='\u{9fff}' // CJK unified
            | '\u{f900}'..='\u{faff}' // CJK compatibility
            | '\u{ff66}'..='\u{ff9d}' // halfwidth katakana
    )
}

/// Choose the higher-quality page extract.
pub fn prefer_better_pages(a: Vec<ImportPageText>, b: Vec<ImportPageText>) -> Vec<ImportPageText> {
    if page_text_quality_score(&a) >= page_text_quality_score(&b) {
        a
    } else {
        b
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;

    #[test]
    fn rejects_non_pdf_bytes() {
        let path: PathBuf =
            std::env::temp_dir().join(format!("hazakura-not-pdf-{}.pdf", std::process::id()));
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
    fn prefers_cjk_rich_extract() {
        let weak = vec![ImportPageText {
            index: 0,
            text: "1. Homebrew\n/bin/bash -c\n2.\nAntigravity".into(),
        }];
        let strong = vec![
            ImportPageText {
                index: 0,
                text: "新マシンセットアップメモ\n1. Homebrew インストール".into(),
            },
            ImportPageText {
                index: 1,
                text: "3. macOS セキュリティ設定".into(),
            },
        ];
        let chosen = prefer_better_pages(weak.clone(), strong.clone());
        assert_eq!(chosen.len(), 2);
        assert!(chosen[0].text.contains("新マシン"));
        assert!(page_text_quality_score(&strong) > page_text_quality_score(&weak));
    }
}
