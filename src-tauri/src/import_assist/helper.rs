//! One-shot Import Assist helper process (JSON line request/response).
//!
//! Unlike Local Assist, each import call spawns the helper, sends one
//! request, reads one response, and exits. That keeps the spike free of
//! a long-lived supervisor while reusing the same fixed-binary trust
//! model (path never comes from the frontend).

use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::Duration;

use super::draft::{assemble_import_markdown_draft, ImportPageText};
use super::path::validate_import_source_path;

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
    let helper = resolve_import_assist_helper_path()?;
    let source_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("import")
        .to_string();
    let path_str = path.to_string_lossy();

    let probe = round_trip_helper(
        &helper,
        &HelperRequest {
            action: "probe",
            path: None,
            languages: None,
        },
    )?;
    let fixture = match probe.kind.as_str() {
        "probe" => serde_json::from_value::<ProbeValue>(probe.value)
            .map(|v| v.fixture)
            .unwrap_or(false),
        "error" => {
            let err: ErrorValue = serde_json::from_value(probe.value)
                .unwrap_or(ErrorValue {
                    error: "Helper probe failed.".into(),
                    kind: "failed".into(),
                });
            return Err(err.error);
        }
        other => return Err(format!("Unexpected helper probe kind: {other}")),
    };

    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    if ext == "pdf" {
        let envelope = round_trip_helper(
            &helper,
            &HelperRequest {
                action: "extract_pdf_text",
                path: Some(path_str.as_ref()),
                languages: None,
            },
        )?;
        match envelope.kind.as_str() {
            "pdf_text" => {
                let value: PdfTextValue = serde_json::from_value(envelope.value)
                    .map_err(|e| format!("Invalid pdf_text payload: {e}"))?;
                let pages: Vec<ImportPageText> = value
                    .pages
                    .into_iter()
                    .map(|p| ImportPageText {
                        index: p.index,
                        text: p.text,
                    })
                    .collect();
                // Prefer PDFKit text. If every page is empty, fall back to a
                // single OCR note (full page-image OCR is a later slice).
                let all_empty = pages.iter().all(|p| p.text.trim().is_empty());
                if all_empty {
                    return Err(
                        "PDF has no extractable text layer. Scanned-page OCR is not wired in this MVP slice yet."
                            .into(),
                    );
                }
                let markdown = assemble_import_markdown_draft(&source_name, &pages);
                Ok(ImportDraftResult {
                    markdown,
                    source_name,
                    page_count: value.page_count.max(pages.len()),
                    used_ocr: false,
                    fixture,
                })
            }
            "error" => {
                let err: ErrorValue = serde_json::from_value(envelope.value)
                    .unwrap_or(ErrorValue {
                        error: "PDF extract failed.".into(),
                        kind: "failed".into(),
                    });
                Err(err.error)
            }
            other => Err(format!("Unexpected helper kind: {other}")),
        }
    } else {
        // Image → Vision OCR
        let envelope = round_trip_helper(
            &helper,
            &HelperRequest {
                action: "ocr_image",
                path: Some(path_str.as_ref()),
                languages: Some(&["ja-JP", "en-US"]),
            },
        )?;
        match envelope.kind.as_str() {
            "ocr_text" => {
                let value: OcrTextValue = serde_json::from_value(envelope.value)
                    .map_err(|e| format!("Invalid ocr_text payload: {e}"))?;
                let pages = [ImportPageText {
                    index: 0,
                    text: value.text,
                }];
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
                let err: ErrorValue = serde_json::from_value(envelope.value)
                    .unwrap_or(ErrorValue {
                        error: "OCR failed.".into(),
                        kind: "failed".into(),
                    });
                Err(err.error)
            }
            other => Err(format!("Unexpected helper kind: {other}")),
        }
    }
}

fn round_trip_helper(helper: &Path, request: &HelperRequest<'_>) -> Result<HelperEnvelope, String> {
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
        // Drop stdin by ending this block so the helper sees EOF after one line.
    }
    // Close stdin explicitly so the helper loop ends after one request.
    drop(child.stdin.take());

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Import Assist helper stdout is not piped.".to_string())?;
    let mut reader = BufReader::new(stdout);
    let mut line = String::new();

    let start = std::time::Instant::now();
    loop {
        if start.elapsed() > HELPER_TIMEOUT {
            let _ = child.kill();
            return Err("Import Assist helper timed out.".into());
        }
        line.clear();
        let n = reader
            .read_line(&mut line)
            .map_err(|e| format!("Failed to read helper response: {e}"))?;
        if n == 0 {
            let _ = child.wait();
            return Err("Import Assist helper closed without a response.".into());
        }
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let envelope: HelperEnvelope = serde_json::from_str(trimmed)
            .map_err(|e| format!("Invalid helper JSON: {e}: {trimmed}"))?;
        let _ = child.kill();
        let _ = child.wait();
        return Ok(envelope);
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

/// Resolve the fixed Import Assist helper binary.
/// Never accepts a path from the frontend.
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

    let filename = import_assist_helper_filename();
    let base = "hazakura-import-assist-helper";
    let mut candidates: Vec<PathBuf> = Vec::new();

    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            candidates.push(dir.join(&filename));
            candidates.push(dir.join(base));
        }
    }

    // Local dev: `npm run build:import-assist-helper:fixture` writes to repo binaries/.
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

    for candidate in &candidates {
        if candidate.exists() {
            return Ok(candidate.clone());
        }
    }

    Err(format!(
        "Import Assist helper is not available. Build it with `npm run build:import-assist-helper:fixture` (looked for {}).",
        filename
    ))
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
    fn import_image_via_fixture_helper_when_available() {
        let helper = match resolve_import_assist_helper_path() {
            Ok(path) => path,
            Err(_) => {
                // Helper not built in this environment — skip.
                return;
            }
        };
        // Ensure executable bit for scripts that copy without +x in some envs.
        let _ = fs::set_permissions(&helper, fs::Permissions::from_mode(0o755));

        let dir = std::env::temp_dir();
        let path = dir.join(format!("hazakura-import-mvp-{}.png", std::process::id()));
        fs::write(&path, b"png-fixture").expect("write temp image");
        // Point resolver via env for isolation.
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
}
