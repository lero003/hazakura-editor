//! One-shot Import Assist helper process (JSON line request/response).
//!
//! Unlike Local Assist, each import call spawns the helper, sends one
//! request, reads one response, and exits. That keeps the spike free of
//! a long-lived supervisor while reusing the same fixed-binary trust
//! model (path never comes from the frontend).

use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use crate::helper_transport::{kill_child, rust_target_triple, ReadWatchdog};

use super::draft::{assemble_import_markdown_draft, ImportPageText};
use super::path::validate_import_source_path;
use super::pdf_text::{extract_pdf_text_layer, pages_have_meaningful_text, prefer_better_pages};
use super::stage::stage_import_source_for_helper;

const HELPER_TIMEOUT: Duration = Duration::from_secs(120);

/// Serializes tests that temporarily set `HAZAKURA_IMPORT_ASSIST_HELPER`.
/// Process environment is process-global; parallel tests must not race it.
#[cfg(test)]
pub(crate) static IMPORT_ASSIST_HELPER_ENV_LOCK: Mutex<()> = Mutex::new(());

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ImportDraftResult {
    pub markdown: String,
    pub source_name: String,
    pub page_count: usize,
    pub used_ocr: bool,
    pub fixture: bool,
}

#[derive(Debug, Serialize)]
struct HelperRequest<'a> {
    action: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    path: Option<&'a str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    languages: Option<&'a [&'a str]>,
    #[serde(skip_serializing_if = "Option::is_none")]
    page: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "maxPixels")]
    max_pixels: Option<u64>,
}

impl<'a> HelperRequest<'a> {
    /// A request for `action` with every optional field cleared.
    /// Callers override only the fields their action needs, so the
    /// wire shape stays `{"action": ...}` plus the used fields.
    fn new(action: &'a str) -> Self {
        Self {
            action,
            path: None,
            languages: None,
            page: None,
            max_pixels: None,
        }
    }
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct HelperPdfInfo {
    pub page_count: usize,
    #[allow(dead_code)]
    pub file_name: String,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct HelperPdfPageImage {
    pub page: usize,
    pub width: u32,
    pub height: u32,
    pub mime: String,
    pub data_base64: String,
}

#[derive(Debug, Deserialize)]
struct HelperEnvelope {
    kind: String,
    value: serde_json::Value,
}

/// Decode the `error` arm of a helper envelope. `fallback` is the
/// action-specific message used when the payload itself does not
/// deserialize (mirroring the helper's own failure text).
fn decode_error_envelope(value: serde_json::Value, fallback: &str) -> ErrorValue {
    serde_json::from_value(value).unwrap_or(ErrorValue {
        error: fallback.to_string(),
        kind: "failed".into(),
    })
}

/// Decode the success arm of a one-shot helper envelope whose `kind`
/// must be `expected_kind`. An `error` envelope becomes
/// `Err(<helper message>)` using `error_fallback`; any other kind is
/// the shared "Unexpected helper kind" error.
fn expect_kind<T: DeserializeOwned>(
    envelope: HelperEnvelope,
    expected_kind: &str,
    error_fallback: &str,
) -> Result<T, String> {
    match envelope.kind.as_str() {
        kind if kind == expected_kind => serde_json::from_value::<T>(envelope.value)
            .map_err(|e| format!("Invalid {expected_kind} payload: {e}")),
        "error" => Err(decode_error_envelope(envelope.value, error_fallback).error),
        other => Err(format!("Unexpected helper kind: {other}")),
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PdfTextValue {
    pages: Vec<PdfPageValue>,
    page_count: usize,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PdfPageValue {
    index: usize,
    text: String,
    #[allow(dead_code)]
    char_count: usize,
    /// Optional per-page OCR confidence from the helper.
    confidence: Option<f64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OcrTextValue {
    text: String,
    #[allow(dead_code)]
    confidence: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProbeValue {
    #[allow(dead_code)]
    pdf_kit: bool,
    #[allow(dead_code)]
    vision: bool,
    fixture: bool,
}

#[derive(Debug, Deserialize)]
struct ErrorValue {
    error: String,
    #[allow(dead_code)]
    kind: String,
}

pub(crate) fn import_source_path_to_markdown(path: &Path) -> Result<ImportDraftResult, String> {
    validate_import_source_path(path)?;
    let source_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("import")
        .to_string();

    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    if ext == "pdf" {
        // Prefer PDFKit (live helper) for Japanese text-layer quality.
        // The in-process PDFKit path also works without the nested helper.
        let mut best: Option<Vec<ImportPageText>> = None;

        // Q-IMP-2: stage into container temp before nested helper paths.
        let staged = stage_import_source_for_helper(path)?;
        let staged_str = staged.path().to_string_lossy();

        match try_pdfkit_text_pages(staged_str.as_ref()) {
            Ok(Some(pages)) if pages_have_meaningful_text(&pages) => {
                best = Some(pages);
            }
            Ok(_) => {}
            Err(err) => {
                // Keep going to native fallback; surface only if both fail.
                let _ = err;
            }
        }

        // In-process PDFKit can still read the original user path.
        match extract_pdf_text_layer(path) {
            Ok(Some(pages)) => {
                best = Some(match best.take() {
                    Some(existing) => prefer_better_pages(existing, pages),
                    None => pages,
                });
            }
            Ok(None) => {}
            Err(err) => {
                if best.is_none() {
                    return Err(err);
                }
            }
        }

        if let Some(pages) = best {
            let page_count = pages.len();
            let markdown = assemble_import_markdown_draft(&source_name, &pages);
            return Ok(ImportDraftResult {
                markdown,
                source_name,
                page_count,
                used_ocr: false,
                fixture: false,
            });
        }

        // No usable text layer → page-image OCR (scans) on staged path.
        match try_pdf_page_ocr(staged_str.as_ref()) {
            Ok(Some(pages)) if pages_have_meaningful_text(&pages) => {
                let page_count = pages.len();
                let markdown = assemble_import_markdown_draft(&source_name, &pages);
                return Ok(ImportDraftResult {
                    markdown,
                    source_name,
                    page_count,
                    used_ocr: true,
                    fixture: false,
                });
            }
            Ok(_) => {
                return Err("PDF has no extractable text and page OCR returned empty text.".into());
            }
            Err(err) => return Err(err),
        }
    }

    // Images need Vision OCR via the native helper (staged for sandbox inherit).
    let staged = stage_import_source_for_helper(path)?;
    let staged_str = staged.path().to_string_lossy();
    let helper = resolve_import_assist_helper_path()?;
    let probe = round_trip_helper(&helper, &HelperRequest::new("probe"))?;
    let fixture = match probe.kind.as_str() {
        "probe" => serde_json::from_value::<ProbeValue>(probe.value)
            .map(|v| v.fixture)
            .unwrap_or(false),
        "error" => {
            return Err(decode_error_envelope(probe.value, "Helper probe failed.").error);
        }
        other => return Err(format!("Unexpected helper probe kind: {other}")),
    };

    {
        // Image → Vision OCR
        let mut request = HelperRequest::new("ocr_image");
        request.path = Some(staged_str.as_ref());
        request.languages = Some(&["ja-JP", "en-US"]);
        let envelope = round_trip_helper(&helper, &request)?;
        let value: OcrTextValue = expect_kind(envelope, "ocr_text", "OCR failed.")?;
        let pages = [ImportPageText::with_confidence(
            0,
            value.text,
            value.confidence,
        )];
        // Q-IMP-4: do not open an empty-marker draft when OCR found nothing.
        if !pages_have_meaningful_text(&pages) {
            return Err(
                "文字を抽出できませんでした。画像が不鮮明か、テキストが含まれていない可能性があります。"
                    .into(),
            );
        }
        let markdown = assemble_import_markdown_draft(&source_name, &pages);
        Ok(ImportDraftResult {
            markdown,
            source_name,
            page_count: 1,
            used_ocr: true,
            fixture,
        })
    }
}

/// PDFKit extract via live helper only. Fixture helpers are skipped so we
/// never invent canned English for a real Japanese PDF.
fn try_pdfkit_text_pages(path: &str) -> Result<Option<Vec<ImportPageText>>, String> {
    let helper = match resolve_import_assist_helper_path() {
        Ok(path) => path,
        Err(_) => return Ok(None),
    };

    let probe = round_trip_helper(&helper, &HelperRequest::new("probe"))?;
    let fixture = match probe.kind.as_str() {
        "probe" => serde_json::from_value::<ProbeValue>(probe.value)
            .map(|v| v.fixture)
            .unwrap_or(true),
        _ => true,
    };
    if fixture {
        // Try release/live binary next to the fixture if present.
        if let Some(live) = resolve_live_import_assist_helper_path_excluding(&helper) {
            return pdfkit_pages_from_helper(&live, path);
        }
        return Ok(None);
    }

    pdfkit_pages_from_helper(&helper, path)
}

fn pdfkit_pages_from_helper(
    helper: &Path,
    path: &str,
) -> Result<Option<Vec<ImportPageText>>, String> {
    pages_from_helper_action(helper, "extract_pdf_text", path, None)
}

fn try_pdf_page_ocr(path: &str) -> Result<Option<Vec<ImportPageText>>, String> {
    let helper = match resolve_import_assist_helper_path() {
        Ok(path) => path,
        Err(err) => return Err(err),
    };
    // Allow fixture for CI; live uses Vision on rendered pages.
    pages_from_helper_action(&helper, "ocr_pdf_pages", path, Some(&["ja-JP", "en-US"]))
}

fn pages_from_helper_action(
    helper: &Path,
    action: &str,
    path: &str,
    languages: Option<&[&str]>,
) -> Result<Option<Vec<ImportPageText>>, String> {
    let mut request = HelperRequest::new(action);
    request.path = Some(path);
    request.languages = languages;
    let envelope = round_trip_helper(helper, &request)?;
    let value = expect_kind::<PdfTextValue>(envelope, "pdf_text", &format!("{action} failed."))?;
    let pages: Vec<ImportPageText> = value
        .pages
        .into_iter()
        .map(|p| match p.confidence {
            Some(c) => ImportPageText::with_confidence(p.index, p.text, c),
            None => ImportPageText::new(p.index, p.text),
        })
        .collect();
    if pages_have_meaningful_text(&pages) {
        Ok(Some(pages))
    } else {
        Ok(None)
    }
}

/// Prefer a non-fixture helper binary when the first candidate is fixture.
fn resolve_live_import_assist_helper_path_excluding(exclude: &Path) -> Option<PathBuf> {
    let candidates = import_assist_helper_candidates();
    for candidate in candidates {
        if candidate == *exclude || !candidate.exists() {
            continue;
        }
        // Probe quickly; accept only non-fixture.
        if let Ok(env) = round_trip_helper(&candidate, &HelperRequest::new("probe")) {
            if env.kind == "probe" {
                if let Ok(v) = serde_json::from_value::<ProbeValue>(env.value) {
                    if !v.fixture {
                        return Some(candidate);
                    }
                }
            }
        }
    }
    None
}

fn round_trip_helper(helper: &Path, request: &HelperRequest<'_>) -> Result<HelperEnvelope, String> {
    round_trip_helper_with_timeout(helper, request, HELPER_TIMEOUT)
}

/// One-shot helper RPC with a **wall-clock** watchdog (Q-IMP-8).
///
/// A naive loop that only checks elapsed time *between* `read_line`
/// calls cannot unbound a blocked read. Mirror Local Assist: a
/// watchdog thread kills the child after `timeout`, which unblocks
/// `read_line` via closed pipes.
fn round_trip_helper_with_timeout(
    helper: &Path,
    request: &HelperRequest<'_>,
    timeout: Duration,
) -> Result<HelperEnvelope, String> {
    let serialized = serde_json::to_string(request)
        .map_err(|e| format!("Failed to serialize helper request: {e}"))?;
    let mut child = Command::new(helper)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn Import Assist helper: {e}"))?;

    {
        let stdin = child
            .stdin
            .as_mut()
            .ok_or_else(|| "Import Assist helper stdin is not piped.".to_string())?;
        stdin
            .write_all(serialized.as_bytes())
            .and_then(|_| stdin.write_all(b"\n"))
            .map_err(|e| format!("Failed to write helper request: {e}"))?;
    }
    drop(child.stdin.take());

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Import Assist helper stdout is not piped.".to_string())?;
    let mut reader = BufReader::new(stdout);
    let child = Arc::new(Mutex::new(child));

    let watchdog = ReadWatchdog::arm("import-assist-helper-watchdog", child.clone(), timeout)
        .map_err(|e| format!("Failed to spawn Import Assist watchdog: {e}"))?;

    let mut line = String::new();
    let outcome = (|| loop {
        if watchdog.timed_out() {
            return Err(format!(
                "Import Assist helper timed out after {}s.",
                timeout.as_secs()
            ));
        }
        line.clear();
        let n = reader
            .read_line(&mut line)
            .map_err(|e| format!("Failed to read helper response: {e}"))?;
        if watchdog.timed_out() {
            return Err(format!(
                "Import Assist helper timed out after {}s.",
                timeout.as_secs()
            ));
        }
        if n == 0 {
            return Err("Import Assist helper closed without a response.".into());
        }
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let envelope: HelperEnvelope = serde_json::from_str(trimmed)
            .map_err(|e| format!("Invalid helper JSON: {e}: {trimmed}"))?;
        return Ok(envelope);
    })();

    // Signal the watchdog that the loop finished (it exits without
    // killing if it had not already fired) and join it before the
    // child is reaped.
    let timed_out = watchdog.finish();
    kill_child(&child);

    if timed_out {
        return Err(format!(
            "Import Assist helper timed out after {}s.",
            timeout.as_secs()
        ));
    }
    outcome
}

/// v1.7 R0: PDFKit page count / file name via the fixed helper.
pub(crate) fn helper_pdf_info(path: &Path) -> Result<HelperPdfInfo, String> {
    let helper = resolve_import_assist_helper_path()?;
    let path_str = path.to_string_lossy();
    let mut request = HelperRequest::new("pdf_info");
    request.path = Some(path_str.as_ref());
    let envelope = round_trip_helper(&helper, &request)?;
    expect_kind::<HelperPdfInfo>(envelope, "pdf_info", "pdf_info failed.")
}

/// v1.7 R0: one-page bounded PNG raster via the fixed helper.
pub(crate) fn helper_render_pdf_page(
    path: &Path,
    page: usize,
    max_pixels: u64,
) -> Result<HelperPdfPageImage, String> {
    let helper = resolve_import_assist_helper_path()?;
    let path_str = path.to_string_lossy();
    let mut request = HelperRequest::new("render_pdf_page");
    request.path = Some(path_str.as_ref());
    request.page = Some(page);
    request.max_pixels = Some(max_pixels);
    let envelope = round_trip_helper(&helper, &request)?;
    expect_kind::<HelperPdfPageImage>(envelope, "pdf_page_image", "render_pdf_page failed.")
}

pub(crate) fn import_assist_helper_filename() -> String {
    format!("hazakura-import-assist-helper-{}", rust_target_triple())
}

fn import_assist_helper_candidates() -> Vec<PathBuf> {
    let filename = import_assist_helper_filename();
    let base = "hazakura-import-assist-helper";
    let mut candidates: Vec<PathBuf> = Vec::new();

    // Prefer release live builds from the Swift package when present.
    candidates.push(
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("src-helpers/import-assist/.build/release/HazakuraImportAssist"),
    );

    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            candidates.push(dir.join(&filename));
            candidates.push(dir.join(base));
        }
    }

    candidates.push(PathBuf::from("binaries").join(&filename));
    candidates.push(PathBuf::from("binaries").join(base));
    candidates.push(
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("binaries")
            .join(&filename),
    );
    candidates.push(
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("binaries")
            .join(base),
    );
    candidates
}

/// Resolve the fixed Import Assist helper binary.
/// Never accepts a path from the frontend.
/// Prefers a **live** (non-fixture) binary when multiple candidates exist.
pub(crate) fn resolve_import_assist_helper_path() -> Result<PathBuf, String> {
    #[cfg(test)]
    {
        if let Ok(path) = std::env::var("HAZAKURA_IMPORT_ASSIST_HELPER") {
            let p = PathBuf::from(path);
            if p.exists() {
                return Ok(p);
            }
            return Err(format!(
                "HAZAKURA_IMPORT_ASSIST_HELPER points at a missing file: {}",
                p.display()
            ));
        }
    }

    let candidates = import_assist_helper_candidates();
    let mut fixture_fallback: Option<PathBuf> = None;

    for candidate in &candidates {
        if !candidate.exists() {
            continue;
        }
        match round_trip_helper(candidate, &HelperRequest::new("probe")) {
            Ok(env) if env.kind == "probe" => {
                let fixture = serde_json::from_value::<ProbeValue>(env.value)
                    .map(|v| v.fixture)
                    .unwrap_or(true);
                if !fixture {
                    return Ok(candidate.clone());
                }
                if fixture_fallback.is_none() {
                    fixture_fallback = Some(candidate.clone());
                }
            }
            // Unprobeable but exists — keep as last-resort later.
            _ => {
                if fixture_fallback.is_none() {
                    fixture_fallback = Some(candidate.clone());
                }
            }
        }
    }

    fixture_fallback.ok_or_else(|| {
        format!(
            "Import Assist helper is not available. Build live with `npm run build:import-assist-helper:live` or fixture with `npm run build:import-assist-helper:fixture` (looked for {}).",
            import_assist_helper_filename()
        )
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::os::unix::fs::PermissionsExt;

    #[test]
    fn helper_filename_uses_sidecar_convention() {
        let name = import_assist_helper_filename();
        assert!(name.starts_with("hazakura-import-assist-helper-"));
    }

    #[test]
    fn empty_ocr_pages_are_not_meaningful() {
        assert!(!pages_have_meaningful_text(&[]));
        assert!(!pages_have_meaningful_text(&[ImportPageText::new(
            0, "  \n\t"
        )]));
        assert!(pages_have_meaningful_text(&[ImportPageText::new(0, "あ")]));
    }

    /// Q-IMP-8: hanging helper must not block past the wall-clock budget.
    #[test]
    fn round_trip_helper_watchdog_kills_hanging_child() {
        let dir = std::env::temp_dir().join(format!("hazakura-import-hang-{}", std::process::id()));
        let _ = fs::create_dir_all(&dir);
        let script = dir.join("hang.sh");
        // Read one request line, then hang without writing a response.
        // `exec sleep` so the helper is a single process: killing the
        // child closes stdout. A bare `sleep` under sh can leave the
        // pipe open and keep `read_line` blocked.
        fs::write(&script, "#!/bin/sh\nread _line || true\nexec sleep 120\n")
            .expect("write hang script");
        let _ = fs::set_permissions(&script, fs::Permissions::from_mode(0o755));

        let started = std::time::Instant::now();
        let err = round_trip_helper_with_timeout(
            &script,
            &HelperRequest::new("probe"),
            Duration::from_millis(400),
        )
        .expect_err("hanging helper must time out");
        let elapsed = started.elapsed();
        let _ = fs::remove_dir_all(&dir);

        assert!(
            err.contains("timed out"),
            "expected timeout error, got: {err}"
        );
        assert!(
            elapsed < Duration::from_secs(5),
            "watchdog took too long: {elapsed:?}"
        );
    }

    #[test]
    fn import_text_layer_pdf_without_helper() {
        // Invalid input must report a PDF error. The tests below cover full
        // valid-PDF imports when the helper is missing or extraction fails.
        let dir = std::env::temp_dir();
        let path = dir.join(format!("hazakura-flow-{}.pdf", std::process::id()));
        fs::write(&path, b"%PDF-1.4 not fully valid").expect("write");
        // Invalid PDF → extract error or empty, not a helper-missing error.
        let err = import_source_path_to_markdown(&path).expect_err("invalid pdf");
        let _ = fs::remove_file(&path);
        assert!(
            !err.contains("helper is not available") || err.contains("PDF"),
            "unexpected: {err}"
        );
    }

    #[test]
    fn import_image_via_fixture_helper_when_available() {
        // Explicit fixture binary (debug + FIXTURE_MODE). Live helpers
        // will reject the non-image temp file used here.
        let helper = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../src-helpers/import-assist/.build/debug/HazakuraImportAssist");
        if !helper.exists() {
            return;
        }
        let _ = fs::set_permissions(&helper, fs::Permissions::from_mode(0o755));

        let dir = std::env::temp_dir();
        let path = dir.join(format!("hazakura-import-mvp-{}.png", std::process::id()));
        fs::write(&path, b"png-fixture").expect("write temp image");

        let _env_guard = super::IMPORT_ASSIST_HELPER_ENV_LOCK
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        // SAFETY: held under IMPORT_ASSIST_HELPER_ENV_LOCK so parallel tests
        // cannot race this process-global override.
        unsafe {
            std::env::set_var("HAZAKURA_IMPORT_ASSIST_HELPER", &helper);
        }
        let result = import_source_path_to_markdown(&path);
        let _ = fs::remove_file(&path);
        unsafe {
            std::env::remove_var("HAZAKURA_IMPORT_ASSIST_HELPER");
        }
        drop(_env_guard);

        let draft = result.expect("import should succeed with fixture helper");
        assert!(draft.used_ocr);
        assert!(draft.markdown.contains("Fixture OCR") || draft.fixture);
        assert!(draft.markdown.contains("hazakura:import"));
        assert_ne!(draft.markdown.trim(), "");
    }

    #[test]
    fn prefers_pdfkit_quality_on_real_memo_pdf_when_helper_live() {
        let pdf = PathBuf::from("/Users/keisetsu/マイドライブ/アプリメモ2.pdf");
        if !pdf.exists() {
            return;
        }
        let draft = import_source_path_to_markdown(&pdf).expect("import memo pdf");
        assert!(
            draft.page_count >= 2,
            "expected multi-page extract, got {}",
            draft.page_count
        );
        assert!(
            draft.markdown.contains("Homebrew") && draft.markdown.contains("セットアップ"),
            "Japanese text layer missing; sample: {}",
            draft.markdown.chars().take(400).collect::<String>()
        );
        assert!(!draft.used_ocr);
    }
    #[cfg(target_os = "macos")]
    #[test]
    fn valid_text_pdf_imports_when_helper_is_missing() {
        let _env_guard = IMPORT_ASSIST_HELPER_ENV_LOCK
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let path = super::super::pdf_text::tests::fixture_pdf(
            "missing-helper",
            &["Valid PDF imports without a helper."],
        );
        let before = fs::read(&path).expect("read fixture");
        let absent = path.with_extension("missing-helper");
        // SAFETY: every helper override test holds the process-global mutex.
        unsafe { std::env::set_var("HAZAKURA_IMPORT_ASSIST_HELPER", &absent) };
        let result = import_source_path_to_markdown(&path);
        unsafe { std::env::remove_var("HAZAKURA_IMPORT_ASSIST_HELPER") };
        assert_eq!(before, fs::read(&path).expect("read unchanged source"));
        let _ = fs::remove_file(&path);
        let draft = result.expect("native fallback imports valid PDF");
        assert!(draft
            .markdown
            .contains("Valid PDF imports without a helper."));
        assert_eq!(draft.page_count, 1);
        assert!(!draft.used_ocr);
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn valid_text_pdf_imports_when_helper_extraction_fails() {
        let _env_guard = IMPORT_ASSIST_HELPER_ENV_LOCK
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let path = super::super::pdf_text::tests::fixture_pdf(
            "failing-helper",
            &["Native fallback keeps the original text."],
        );
        let before = fs::read(&path).expect("read fixture");
        let helper = path.with_extension("helper.sh");
        fs::write(&helper, br##"#!/bin/sh
read request
case "$request" in
*probe*) printf '%s\n' '{"kind":"probe","value":{"pdfKit":true,"vision":true,"fixture":false}}' ;;
*) printf '%s\n' '{"kind":"error","value":{"error":"Synthetic extraction failure","kind":"pdf_extract_failed"}}' ;;
esac
"##).expect("write fixed test helper");
        fs::set_permissions(&helper, fs::Permissions::from_mode(0o700)).expect("make executable");
        // SAFETY: every helper override test holds the process-global mutex.
        unsafe { std::env::set_var("HAZAKURA_IMPORT_ASSIST_HELPER", &helper) };
        let result = import_source_path_to_markdown(&path);
        unsafe { std::env::remove_var("HAZAKURA_IMPORT_ASSIST_HELPER") };
        assert_eq!(before, fs::read(&path).expect("read unchanged source"));
        let _ = fs::remove_file(&path);
        let _ = fs::remove_file(&helper);
        let draft = result.expect("native fallback survives helper extraction failure");
        assert!(draft
            .markdown
            .contains("Native fallback keeps the original text."));
        assert_eq!(draft.page_count, 1);
        assert!(!draft.used_ocr);
    }
}
