//! PDF text-layer extraction helpers.
//!
//! Primary quality path for Japanese (and general) text-layer PDFs is
//! **PDFKit via the live Import Assist helper**. An in-process PDFKit bridge
//! also reads the original user-selected path, preserving text-layer import
//! when the nested helper is absent or cannot read its staged copy.

use super::draft::ImportPageText;
use std::path::Path;

/// Native text-layer fallback, independent of the nested helper process.
pub fn extract_pdf_text_layer(path: &Path) -> Result<Option<Vec<ImportPageText>>, String> {
    super::path::validate_import_source_path(path)?;
    #[cfg(target_os = "macos")]
    {
        platform::extract(path)
    }
    #[cfg(not(target_os = "macos"))]
    {
        Err("Native PDF text-layer extraction is available only on macOS.".into())
    }
}

#[cfg(target_os = "macos")]
mod platform {
    use super::*;
    use serde::Deserialize;
    use std::ffi::CString;
    use std::os::raw::c_char;
    use std::os::unix::ffi::OsStrExt;

    const MAX_PAGES: usize = 16_384;
    const MAX_TEXT_BYTES: usize = 16 * 1024 * 1024;
    const MAX_JSON_BYTES: usize = 128 * 1024 * 1024;

    #[repr(C)]
    struct NativeResult {
        json: *mut u8,
        length: usize,
        status: u32,
    }

    unsafe extern "C" {
        fn hz_pdf_text_extract(
            path: *const c_char,
            max_pages: usize,
            max_text_bytes: usize,
            max_json_bytes: usize,
            result: *mut NativeResult,
        );
        fn hz_pdf_text_result_free(result: *mut NativeResult);
    }

    impl Drop for NativeResult {
        fn drop(&mut self) {
            // The bridge initializes all fields and owns this buffer until free.
            unsafe { hz_pdf_text_result_free(self) };
        }
    }

    #[derive(Deserialize)]
    struct NativePage {
        index: usize,
        text: String,
    }

    #[derive(Deserialize)]
    struct NativePayload {
        #[serde(default)]
        pages: Vec<NativePage>,
        error: Option<String>,
    }

    pub(super) fn extract(path: &Path) -> Result<Option<Vec<ImportPageText>>, String> {
        let path = CString::new(path.as_os_str().as_bytes())
            .map_err(|_| "PDF path contains an embedded NUL byte.".to_string())?;
        let mut result = NativeResult {
            json: std::ptr::null_mut(),
            length: 0,
            status: 0,
        };
        // The path and output storage stay alive throughout this synchronous
        // call. The bridge contains Objective-C exceptions inside the C ABI.
        unsafe {
            hz_pdf_text_extract(
                path.as_ptr(),
                MAX_PAGES,
                MAX_TEXT_BYTES,
                MAX_JSON_BYTES,
                &mut result,
            )
        };
        if result.json.is_null() || result.length == 0 || result.length > MAX_JSON_BYTES {
            return Err("PDF text-layer bridge returned an invalid response size.".into());
        }
        // The length-delimited allocation is owned by result; Drop frees it on
        // every error and success path after deserialization owns its strings.
        let bytes = unsafe { std::slice::from_raw_parts(result.json, result.length) };
        let payload: NativePayload = serde_json::from_slice(bytes)
            .map_err(|error| format!("Invalid PDF text-layer bridge response: {error}"))?;
        if result.status != 0 || payload.error.is_some() {
            return Err(payload
                .error
                .unwrap_or_else(|| "PDF text-layer extraction failed.".into()));
        }
        if payload.pages.len() > MAX_PAGES {
            return Err("PDF text-layer bridge exceeded the page limit.".into());
        }
        let mut text_bytes = 0usize;
        let mut pages = Vec::with_capacity(payload.pages.len());
        for (index, page) in payload.pages.into_iter().enumerate() {
            text_bytes = text_bytes.saturating_add(page.text.len());
            if page.index != index || text_bytes > MAX_TEXT_BYTES {
                return Err("PDF text-layer bridge returned invalid page data.".into());
            }
            pages.push(ImportPageText::new(index, page.text));
        }
        Ok(pages_have_meaningful_text(&pages).then_some(pages))
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn rejects_embedded_nul_before_crossing_the_native_abi() {
            let error = extract(Path::new("/tmp/example\0.pdf")).expect_err("NUL path");
            assert!(error.contains("embedded NUL"));
        }
    }
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
        .map(|(index, chunk)| {
            ImportPageText::new(
                index,
                chunk.trim_matches(|c| c == '\n' || c == ' ').to_string(),
            )
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
pub(crate) mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;

    // Self-authored Base14-font PDF; no embedded font or external fixture asset.
    #[cfg(target_os = "macos")]
    pub(crate) fn fixture_pdf(name: &str, contents: &[&str]) -> PathBuf {
        let mut objects = vec![
            b"<< /Type /Catalog /Pages 2 0 R >>".to_vec(),
            Vec::new(),
            b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /StandardEncoding >>"
                .to_vec(),
        ];
        let mut kids = Vec::new();
        for text in contents {
            let page = objects.len() + 1;
            kids.push(format!("{page} 0 R"));
            objects.push(format!("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 3 0 R >> >> /Contents {} 0 R >>", page + 1).into_bytes());
            let stream = format!("BT /F1 18 Tf 50 740 Td ({text}) Tj ET");
            objects.push(
                format!(
                    "<< /Length {} >>\nstream\n{stream}\nendstream",
                    stream.len()
                )
                .into_bytes(),
            );
        }
        objects[1] = format!(
            "<< /Type /Pages /Kids [{}] /Count {} >>",
            kids.join(" "),
            contents.len()
        )
        .into_bytes();
        let mut output = b"%PDF-1.4\n".to_vec();
        let mut offsets = vec![0];
        for (index, object) in objects.iter().enumerate() {
            offsets.push(output.len());
            output.extend(format!("{} 0 obj\n", index + 1).as_bytes());
            output.extend(object);
            output.extend(b"\nendobj\n");
        }
        let xref = output.len();
        output.extend(format!("xref\n0 {}\n0000000000 65535 f \n", objects.len() + 1).as_bytes());
        for offset in offsets.into_iter().skip(1) {
            output.extend(format!("{offset:010} 00000 n \n").as_bytes());
        }
        output.extend(
            format!(
                "trailer\n<< /Size {} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n",
                objects.len() + 1
            )
            .as_bytes(),
        );
        let path = std::env::temp_dir().join(format!(
            "hazakura-native-pdf-{name}-{}.pdf",
            std::process::id()
        ));
        fs::write(&path, output).expect("write fixture");
        path
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn extracts_standard_encoding_without_panicking() {
        let path = fixture_pdf("standard", &["Standard encoding preserves this text."]);
        let result = extract_pdf_text_layer(&path);
        let _ = fs::remove_file(path);
        let pages = result.expect("extract valid PDF").expect("text layer");
        assert_eq!(
            pages[0].text.trim(),
            "Standard encoding preserves this text."
        );
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn preserves_page_order_and_empty_middle_page() {
        let path = fixture_pdf("pages", &["FIRST PAGE", "", "THIRD PAGE"]);
        let result = extract_pdf_text_layer(&path);
        let _ = fs::remove_file(path);
        let pages = result.expect("extract valid PDF").expect("text layer");
        assert_eq!(pages.len(), 3);
        assert_eq!(pages[0].text.trim(), "FIRST PAGE");
        assert!(pages[1].text.trim().is_empty());
        assert_eq!(pages[2].text.trim(), "THIRD PAGE");
        assert_eq!(
            pages.iter().map(|page| page.index).collect::<Vec<_>>(),
            vec![0, 1, 2]
        );
    }

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
        let weak = vec![ImportPageText::new(
            0,
            "1. Homebrew\n/bin/bash -c\n2.\nAntigravity",
        )];
        let strong = vec![
            ImportPageText::new(0, "新マシンセットアップメモ\n1. Homebrew インストール"),
            ImportPageText::new(1, "3. macOS セキュリティ設定"),
        ];
        let chosen = prefer_better_pages(weak.clone(), strong.clone());
        assert_eq!(chosen.len(), 2);
        assert!(chosen[0].text.contains("新マシン"));
        assert!(page_text_quality_score(&strong) > page_text_quality_score(&weak));
    }
}
