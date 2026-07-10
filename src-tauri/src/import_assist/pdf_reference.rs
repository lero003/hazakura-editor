//! v1.7 R0 — PDF reference session (opaque handle + bounded page raster).
//!
//! Frontend never sees staged paths or chooses the helper binary. At most
//! one active PDF reference exists in the MVP.

use super::helper::{helper_pdf_info, helper_render_pdf_page, HelperPdfInfo, HelperPdfPageImage};
use super::path::MAX_IMPORT_SOURCE_BYTES;
use super::stage::{stage_import_source_for_helper, StagedImportFile};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

/// Hard ceiling for rendered page width * height (matches helper).
pub const PDF_RENDER_MAX_PIXELS: u64 = 4_000_000;

/// Soft cap on base64 payload characters returned to the frontend.
pub const PDF_PAGE_IMAGE_MAX_BASE64_CHARS: usize = 12 * 1024 * 1024;

static REFERENCE_SEQ: AtomicU64 = AtomicU64::new(1);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PdfReferenceOpenResult {
    pub reference_id: String,
    pub page_count: usize,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PdfReferencePageImage {
    pub reference_id: String,
    pub page: usize,
    pub width: u32,
    pub height: u32,
    pub mime: String,
    /// PNG bytes as base64 (no data: URL prefix).
    pub data_base64: String,
}

struct ActivePdfReference {
    id: String,
    /// Shared so in-flight renders keep the staged copy alive even if
    /// close/replace drops the active session first.
    staged: Arc<StagedImportFile>,
    page_count: usize,
    name: String,
}

static ACTIVE: Mutex<Option<ActivePdfReference>> = Mutex::new(None);

/// Validate an absolute PDF path for Reference Compare (R0).
pub fn validate_pdf_reference_path(path: &Path) -> Result<(), String> {
    if path.as_os_str().is_empty() {
        return Err("PDF reference path is empty.".to_string());
    }
    if !path.is_absolute() {
        return Err("PDF reference path must be absolute.".to_string());
    }
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .unwrap_or_default();
    if ext != "pdf" {
        return Err("Only PDF files can be opened as a PDF reference.".to_string());
    }
    let meta = std::fs::metadata(path).map_err(|_| "PDF reference file not found.".to_string())?;
    if !meta.is_file() {
        return Err("PDF reference path is not a regular file.".to_string());
    }
    if meta.len() > MAX_IMPORT_SOURCE_BYTES {
        return Err(format!(
            "PDF reference exceeds the {} MB size limit.",
            MAX_IMPORT_SOURCE_BYTES / (1024 * 1024)
        ));
    }
    Ok(())
}

pub fn clamp_render_max_pixels(requested: Option<u64>) -> u64 {
    match requested {
        None | Some(0) => PDF_RENDER_MAX_PIXELS,
        Some(value) => value.min(PDF_RENDER_MAX_PIXELS),
    }
}

fn next_reference_id() -> String {
    let seq = REFERENCE_SEQ.fetch_add(1, Ordering::Relaxed);
    format!("pdf-ref-{}-{}", std::process::id(), seq)
}

/// Open a PDF reference: stage, read page count via helper, store one handle.
pub fn open_pdf_reference(path: &Path) -> Result<PdfReferenceOpenResult, String> {
    validate_pdf_reference_path(path)?;
    let name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("document.pdf")
        .to_string();

    let staged = Arc::new(stage_import_source_for_helper(path)?);
    let info: HelperPdfInfo = helper_pdf_info(staged.path())?;
    if info.page_count == 0 {
        return Err("PDF has no pages.".to_string());
    }

    let id = next_reference_id();
    let result = PdfReferenceOpenResult {
        reference_id: id.clone(),
        page_count: info.page_count,
        name: name.clone(),
    };

    let mut guard = ACTIVE
        .lock()
        .map_err(|_| "PDF reference store is unavailable.".to_string())?;
    // Replacing drops the previous staged copy when its last Arc releases.
    *guard = Some(ActivePdfReference {
        id,
        staged,
        page_count: info.page_count,
        name,
    });
    Ok(result)
}

pub fn render_pdf_reference_page(
    reference_id: &str,
    page_index: usize,
    max_pixels: Option<u64>,
) -> Result<PdfReferencePageImage, String> {
    if reference_id.trim().is_empty() {
        return Err("PDF reference id is empty.".to_string());
    }
    let max_pixels = clamp_render_max_pixels(max_pixels);

    // Clone Arc so close/replace during helper work cannot delete the path.
    let staged = {
        let guard = ACTIVE
            .lock()
            .map_err(|_| "PDF reference store is unavailable.".to_string())?;
        let active = guard
            .as_ref()
            .ok_or_else(|| "No active PDF reference.".to_string())?;
        if active.id != reference_id {
            return Err("Unknown or stale PDF reference id.".to_string());
        }
        if page_index >= active.page_count {
            return Err(format!(
                "PDF page index out of range (0..{}).",
                active.page_count
            ));
        }
        active.staged.clone()
    };

    let image: HelperPdfPageImage = helper_render_pdf_page(staged.path(), page_index, max_pixels)?;
    // Keep staged alive until after helper response validation.
    let _staged_alive = staged;

    if image.page != page_index {
        return Err(format!(
            "Helper returned page {} but {} was requested.",
            image.page, page_index
        ));
    }
    if image.mime != "image/png" {
        return Err(format!(
            "Unsupported PDF page image mime type: {}.",
            image.mime
        ));
    }
    if image.data_base64.len() > PDF_PAGE_IMAGE_MAX_BASE64_CHARS {
        return Err("Rendered PDF page exceeds the response size limit.".to_string());
    }
    if image.width == 0 || image.height == 0 {
        return Err("Rendered PDF page has invalid dimensions.".to_string());
    }
    let pixels = u64::from(image.width).saturating_mul(u64::from(image.height));
    if pixels > PDF_RENDER_MAX_PIXELS {
        return Err("Rendered PDF page exceeds the pixel budget.".to_string());
    }

    Ok(PdfReferencePageImage {
        reference_id: reference_id.to_string(),
        page: page_index,
        width: image.width,
        height: image.height,
        mime: image.mime,
        data_base64: image.data_base64,
    })
}

pub fn close_pdf_reference(reference_id: &str) -> Result<(), String> {
    if reference_id.trim().is_empty() {
        return Err("PDF reference id is empty.".to_string());
    }
    let mut guard = ACTIVE
        .lock()
        .map_err(|_| "PDF reference store is unavailable.".to_string())?;
    match guard.as_ref() {
        Some(active) if active.id == reference_id => {
            *guard = None;
            Ok(())
        }
        Some(_) => Err("Unknown or stale PDF reference id.".to_string()),
        None => Err("No active PDF reference.".to_string()),
    }
}

/// Test / cleanup helper: drop any active reference without an id check.
#[cfg(test)]
pub fn clear_pdf_reference_for_tests() {
    if let Ok(mut guard) = ACTIVE.lock() {
        *guard = None;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use std::path::PathBuf;

    #[test]
    fn validates_pdf_only_absolute_paths() {
        assert!(validate_pdf_reference_path(Path::new("rel.pdf")).is_err());
        assert!(validate_pdf_reference_path(Path::new("/tmp/a.png")).is_err());
        assert!(validate_pdf_reference_path(Path::new("/no/such/x.pdf")).is_err());

        let path = std::env::temp_dir().join(format!(
            "hazakura-pdf-ref-validate-{}.pdf",
            std::process::id()
        ));
        {
            let mut f = std::fs::File::create(&path).expect("create");
            writeln!(f, "%PDF-1.4 fixture").expect("write");
        }
        let ok = validate_pdf_reference_path(&path);
        let _ = std::fs::remove_file(&path);
        assert!(ok.is_ok(), "{ok:?}");
    }

    #[test]
    fn clamps_max_pixels() {
        assert_eq!(clamp_render_max_pixels(None), PDF_RENDER_MAX_PIXELS);
        assert_eq!(clamp_render_max_pixels(Some(0)), PDF_RENDER_MAX_PIXELS);
        assert_eq!(clamp_render_max_pixels(Some(1000)), 1000);
        assert_eq!(
            clamp_render_max_pixels(Some(PDF_RENDER_MAX_PIXELS * 10)),
            PDF_RENDER_MAX_PIXELS
        );
    }

    #[test]
    fn rejects_stale_and_empty_reference_ids() {
        clear_pdf_reference_for_tests();
        assert!(render_pdf_reference_page("", 0, None).is_err());
        assert!(render_pdf_reference_page("missing", 0, None).is_err());
        assert!(close_pdf_reference("missing").is_err());
        assert!(close_pdf_reference("").is_err());
    }

    /// Prefer a known helper binary so an older build without `pdf_info`
    /// cannot shadow the R0 contract during unit tests.
    fn pin_test_helper_binary() -> Option<PathBuf> {
        let triple = match (std::env::consts::ARCH, std::env::consts::OS) {
            ("aarch64", "macos") => "aarch64-apple-darwin",
            ("x86_64", "macos") => "x86_64-apple-darwin",
            _ => return None,
        };
        let name = format!("hazakura-import-assist-helper-{triple}");
        let candidates = [
            PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("..")
                .join("binaries")
                .join(&name),
            PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("..")
                .join("binaries")
                .join("hazakura-import-assist-helper"),
            PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("..")
                .join("src-helpers/import-assist/.build/debug/HazakuraImportAssist"),
            PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("..")
                .join("src-helpers/import-assist/.build/release/HazakuraImportAssist"),
        ];
        candidates.into_iter().find(|p| p.exists())
    }

    /// Helper open → render page 0 → close. Skips when no helper binary exists.
    #[test]
    fn fixture_helper_open_render_close_round_trip() {
        clear_pdf_reference_for_tests();
        let Some(helper) = pin_test_helper_binary() else {
            eprintln!("skip: import assist helper not available");
            return;
        };
        std::env::set_var("HAZAKURA_IMPORT_ASSIST_HELPER", &helper);

        // Minimal one-page PDF body so live PDFKit can open it; fixture mode
        // only requires an existing path.
        let path =
            std::env::temp_dir().join(format!("hazakura-pdf-ref-rt-{}.pdf", std::process::id()));
        {
            let mut f = std::fs::File::create(&path).expect("create");
            f.write_all(
                b"%PDF-1.1\n\
1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n\
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n\
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>endobj\n\
trailer<< /Size 4 /Root 1 0 R >>\n\
%%EOF\n",
            )
            .expect("write pdf");
        }

        let opened = open_pdf_reference(&path).unwrap_or_else(|err| {
            let _ = std::fs::remove_file(&path);
            std::env::remove_var("HAZAKURA_IMPORT_ASSIST_HELPER");
            clear_pdf_reference_for_tests();
            panic!("open_pdf_reference failed with pinned helper: {err}");
        });
        assert!(!opened.reference_id.is_empty());
        assert!(opened.page_count >= 1);
        assert_eq!(opened.name, path.file_name().unwrap().to_string_lossy());

        let page = render_pdf_reference_page(&opened.reference_id, 0, Some(10_000))
            .expect("render page 0");
        assert_eq!(page.reference_id, opened.reference_id);
        assert_eq!(page.page, 0);
        assert!(page.width >= 1 && page.height >= 1);
        assert_eq!(page.mime, "image/png");
        assert!(!page.data_base64.is_empty());

        assert!(render_pdf_reference_page(&opened.reference_id, opened.page_count, None).is_err());

        close_pdf_reference(&opened.reference_id).expect("close");
        assert!(
            render_pdf_reference_page(&opened.reference_id, 0, None).is_err(),
            "closed id must be stale"
        );

        let _ = std::fs::remove_file(&path);
        std::env::remove_var("HAZAKURA_IMPORT_ASSIST_HELPER");
        clear_pdf_reference_for_tests();
    }
}
