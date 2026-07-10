//! One-shot Import Assist helper process (JSON line request/response).
//!
//! Unlike Local Assist, each import call spawns the helper, sends one
//! request, reads one response, and exits. That keeps the spike free of
//! a long-lived supervisor while reusing the same fixed-binary trust
//! model (path never comes from the frontend).

use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Condvar, Mutex};
use std::time::Duration;

use super::draft::{assemble_import_markdown_draft, ImportPageText};
use super::path::validate_import_source_path;
use super::pdf_text::{extract_pdf_text_layer, pages_have_meaningful_text, prefer_better_pages};
use super::stage::stage_import_source_for_helper;

const HELPER_TIMEOUT: Duration = Duration::from_secs(120);

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
        // pdf-extract is fallback only — it often drops CJK and collapses pages.
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
                // Keep going to pure-Rust fallback; surface only if both fail.
                let _ = err;
            }
        }

        // In-process pdf-extract can still read the original user path.
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
                return Err(
                    "PDF has no extractable text and page OCR returned empty text.".into(),
                );
            }
            Err(err) => return Err(err),
        }
    }

    // Images need Vision OCR via the native helper (staged for sandbox inherit).
    let staged = stage_import_source_for_helper(path)?;
    let staged_str = staged.path().to_string_lossy();
    let helper = resolve_import_assist_helper_path()?;
    let probe = round_trip_helper(
        &helper,
        &HelperRequest {
            action: "probe",
            path: None,
            languages: None,
            page: None,
            max_pixels: None,
        },
    )?;
    let fixture = match probe.kind.as_str() {
        "probe" => serde_json::from_value::<ProbeValue>(probe.value)
            .map(|v| v.fixture)
            .unwrap_or(false),
        "error" => {
            let err: ErrorValue = serde_json::from_value(probe.value).unwrap_or(ErrorValue {
                error: "Helper probe failed.".into(),
                kind: "failed".into(),
            });
            return Err(err.error);
        }
        other => return Err(format!("Unexpected helper probe kind: {other}")),
    };

    {
        // Image → Vision OCR
        let envelope = round_trip_helper(
            &helper,
            &HelperRequest {
                action: "ocr_image",
                path: Some(staged_str.as_ref()),
                languages: Some(&["ja-JP", "en-US"]),
                page: None,
                max_pixels: None,
            },
        )?;
        match envelope.kind.as_str() {
            "ocr_text" => {
                let value: OcrTextValue = serde_json::from_value(envelope.value)
                    .map_err(|e| format!("Invalid ocr_text payload: {e}"))?;
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
            "error" => {
                let err: ErrorValue =
                    serde_json::from_value(envelope.value).unwrap_or(ErrorValue {
                        error: "OCR failed.".into(),
                        kind: "failed".into(),
                    });
                Err(err.error)
            }
            other => Err(format!("Unexpected helper kind: {other}")),
        }
    }
}

/// PDFKit extract via live helper only. Fixture helpers are skipped so we
/// never invent canned English for a real Japanese PDF.
fn try_pdfkit_text_pages(path: &str) -> Result<Option<Vec<ImportPageText>>, String> {
    let helper = match resolve_import_assist_helper_path() {
        Ok(path) => path,
        Err(_) => return Ok(None),
    };

    let probe = round_trip_helper(
        &helper,
        &HelperRequest {
            action: "probe",
            path: None,
            languages: None,
            page: None,
            max_pixels: None,
        },
    )?;
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
    let envelope = round_trip_helper(
        helper,
        &HelperRequest {
            action,
            path: Some(path),
            languages,
            page: None,
            max_pixels: None,
        },
    )?;
    match envelope.kind.as_str() {
        "pdf_text" => {
            let value: PdfTextValue = serde_json::from_value(envelope.value)
                .map_err(|e| format!("Invalid pdf_text payload: {e}"))?;
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
        "error" => {
            let err: ErrorValue = serde_json::from_value(envelope.value).unwrap_or(ErrorValue {
                error: format!("{action} failed."),
                kind: "failed".into(),
            });
            Err(err.error)
        }
        other => Err(format!("Unexpected helper kind: {other}")),
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
        if let Ok(env) = round_trip_helper(
            &candidate,
            &HelperRequest {
                action: "probe",
                path: None,
                languages: None,
                page: None,
                max_pixels: None,
            },
        ) {
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

    let done_pair = Arc::new((Mutex::new(false), Condvar::new()));
    let done_pair_w = done_pair.clone();
    let child_w = child.clone();
    let timed_out = Arc::new(AtomicBool::new(false));
    let timed_out_w = timed_out.clone();

    let watchdog = std::thread::Builder::new()
        .name("import-assist-helper-watchdog".to_string())
        .spawn(move || {
            let (lock, cvar) = &*done_pair_w;
            let mut done = lock.lock().expect("import assist watchdog lock");
            if !*done {
                let (next_done, _) = cvar
                    .wait_timeout(done, timeout)
                    .expect("import assist watchdog wait_timeout");
                done = next_done;
            }
            if !*done {
                timed_out_w.store(true, Ordering::SeqCst);
                kill_import_helper_child(&child_w);
            }
        })
        .map_err(|e| format!("Failed to spawn Import Assist watchdog: {e}"))?;

    let mut line = String::new();
    let outcome = (|| loop {
        if timed_out.load(Ordering::SeqCst) {
            return Err(format!(
                "Import Assist helper timed out after {}s.",
                timeout.as_secs()
            ));
        }
        line.clear();
        let n = reader
            .read_line(&mut line)
            .map_err(|e| format!("Failed to read helper response: {e}"))?;
        if timed_out.load(Ordering::SeqCst) {
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

    {
        let (lock, cvar) = &*done_pair;
        let mut done = lock.lock().expect("import assist watchdog signal lock");
        *done = true;
        cvar.notify_all();
    }
    let _ = watchdog.join();
    kill_import_helper_child(&child);

    if timed_out.load(Ordering::SeqCst) {
        return Err(format!(
            "Import Assist helper timed out after {}s.",
            timeout.as_secs()
        ));
    }
    outcome
}

fn kill_import_helper_child(child: &Arc<Mutex<Child>>) {
    if let Ok(mut guard) = child.lock() {
        let _ = guard.kill();
        let _ = guard.wait();
    }
}

/// v1.7 R0: PDFKit page count / file name via the fixed helper.
pub(crate) fn helper_pdf_info(path: &Path) -> Result<HelperPdfInfo, String> {
    let helper = resolve_import_assist_helper_path()?;
    let path_str = path.to_string_lossy();
    let envelope = round_trip_helper(
        &helper,
        &HelperRequest {
            action: "pdf_info",
            path: Some(path_str.as_ref()),
            languages: None,
            page: None,
            max_pixels: None,
        },
    )?;
    match envelope.kind.as_str() {
        "pdf_info" => serde_json::from_value::<HelperPdfInfo>(envelope.value)
            .map_err(|e| format!("Invalid pdf_info payload: {e}")),
        "error" => {
            let err: ErrorValue = serde_json::from_value(envelope.value).unwrap_or(ErrorValue {
                error: "pdf_info failed.".into(),
                kind: "failed".into(),
            });
            Err(err.error)
        }
        other => Err(format!("Unexpected helper kind: {other}")),
    }
}

/// v1.7 R0: one-page bounded PNG raster via the fixed helper.
pub(crate) fn helper_render_pdf_page(
    path: &Path,
    page: usize,
    max_pixels: u64,
) -> Result<HelperPdfPageImage, String> {
    let helper = resolve_import_assist_helper_path()?;
    let path_str = path.to_string_lossy();
    let envelope = round_trip_helper(
        &helper,
        &HelperRequest {
            action: "render_pdf_page",
            path: Some(path_str.as_ref()),
            languages: None,
            page: Some(page),
            max_pixels: Some(max_pixels),
        },
    )?;
    match envelope.kind.as_str() {
        "pdf_page_image" => serde_json::from_value::<HelperPdfPageImage>(envelope.value)
            .map_err(|e| format!("Invalid pdf_page_image payload: {e}")),
        "error" => {
            let err: ErrorValue = serde_json::from_value(envelope.value).unwrap_or(ErrorValue {
                error: "render_pdf_page failed.".into(),
                kind: "failed".into(),
            });
            Err(err.error)
        }
        other => Err(format!("Unexpected helper kind: {other}")),
    }
}

pub(crate) fn import_assist_helper_filename() -> String {
    format!("hazakura-import-assist-helper-{}", rust_target_triple())
}

fn rust_target_triple() -> &'static str {
    match (std::env::consts::ARCH, std::env::consts::OS) {
        ("aarch64", "macos") => "aarch64-apple-darwin",
        ("x86_64", "macos") => "x86_64-apple-darwin",
        _ => "unknown-target",
    }
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
        match round_trip_helper(
            candidate,
            &HelperRequest {
                action: "probe",
                path: None,
                languages: None,
                page: None,
                max_pixels: None,
            },
        ) {
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
        assert!(!pages_have_meaningful_text(&[ImportPageText::new(0, "  \n\t")]));
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
            &HelperRequest {
                action: "probe",
                path: None,
                languages: None,
                page: None,
                max_pixels: None,
            },
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
        // A small real-world-ish PDF is hard to hand-author for every
        // pdf-extract version; this test pins the *control flow*: when
        // extract_pdf_text_layer returns pages, we never require the helper.
        // Integration against real PDFs is manual / product smoke.
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
        std::env::set_var("HAZAKURA_IMPORT_ASSIST_HELPER", &helper);
        let result = import_source_path_to_markdown(&path);
        let _ = fs::remove_file(&path);
        std::env::remove_var("HAZAKURA_IMPORT_ASSIST_HELPER");

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
}
