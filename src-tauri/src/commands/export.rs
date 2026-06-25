use crate::security::window_guard::*;

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;

use std::fs;

const PDF_EXPORT_TIMEOUT_SECONDS: u64 = 30;
const PDF_CAPTURE_SIZE_SCRIPT: &str = r#"
JSON.stringify((() => {
  const body = document.body;
  const doc = document.documentElement;
  const width = Math.max(
    doc ? doc.scrollWidth : 0,
    body ? body.scrollWidth : 0,
    900
  );
  const height = Math.max(
    doc ? doc.scrollHeight : 0,
    body ? body.scrollHeight : 0,
    1200
  );
  return {
    width: Math.ceil(width),
    height: Math.ceil(height)
  };
})())
"#;
static PDF_EXPORT_WINDOW_COUNTER: AtomicU64 = AtomicU64::new(1);

#[cfg(target_os = "macos")]
#[derive(serde::Deserialize)]
struct PdfCaptureSize {
    width: f64,
    height: f64,
}

#[tauri::command]
pub(crate) async fn export_pdf<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    app: tauri::AppHandle<R>,
    html_content: String,
    path: String,
) -> Result<(), String> {
    let destination_path = validate_export_pdf_request(window.label(), &html_content, &path)?;
    export_pdf_file(app, html_content, destination_path).await
}

pub(crate) fn validate_export_pdf_request(
    label: &str,
    html_content: &str,
    path: &str,
) -> Result<PathBuf, String> {
    ensure_label_is_main(label)?;
    if html_content.trim().is_empty() {
        return Err("PDF export HTML content is empty.".to_string());
    }

    let trimmed_path = path.trim();
    if trimmed_path.is_empty() {
        return Err("PDF export path is empty.".to_string());
    }

    let destination_path = PathBuf::from(trimmed_path);
    let parent = destination_path
        .parent()
        .ok_or_else(|| "Cannot export PDF without a parent directory.".to_string())?;
    if !parent.is_dir() {
        return Err("Selected folder does not exist.".to_string());
    }

    let file_name = destination_path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("");
    let extension = destination_path
        .extension()
        .and_then(|extension| extension.to_str())
        .unwrap_or("");
    if file_name.is_empty() || !extension.eq_ignore_ascii_case("pdf") {
        return Err("PDF export destination must be a .pdf file.".to_string());
    }
    if destination_path.exists() && !destination_path.is_file() {
        return Err("Selected PDF export path is not a file.".to_string());
    }

    Ok(destination_path)
}

#[cfg(target_os = "macos")]
async fn export_pdf_file<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    html_content: String,
    destination_path: PathBuf,
) -> Result<(), String> {
    use std::sync::atomic::AtomicBool;
    use std::sync::mpsc;
    use tauri::webview::PageLoadEvent;
    use tauri::{Url, WebviewUrl, WebviewWindowBuilder};

    let export_id = PDF_EXPORT_WINDOW_COUNTER.fetch_add(1, Ordering::Relaxed);
    let label = format!("hazakura-pdf-export-{export_id}");
    let title = destination_path
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or("export")
        .to_string();
    let export_file_name = format!("{title}.html");
    let export_file_path = write_pdf_export_html_file(export_id, &export_file_name, &html_content)?;
    let export_url = Url::from_file_path(&export_file_path).map_err(|_| {
        format!(
            "Cannot create PDF export file URL: {}",
            export_file_path.display()
        )
    })?;

    let (export_tx, export_rx) = mpsc::channel::<Result<(), String>>();
    let exported = Arc::new(AtomicBool::new(false));
    let exported_for_load = Arc::clone(&exported);
    let abandoned = Arc::new(AtomicBool::new(false));
    let abandoned_for_load = Arc::clone(&abandoned);
    let destination_for_load = destination_path.clone();

    let pdf_window = WebviewWindowBuilder::new(&app, &label, WebviewUrl::External(export_url))
        .title(format!("Hazakura PDF Export - {title}"))
        .visible(false)
        .inner_size(900.0, 1200.0)
        .on_page_load(move |export_window, payload| {
            if payload.event() != PageLoadEvent::Finished {
                return;
            }
            if exported_for_load.swap(true, Ordering::SeqCst) {
                return;
            }

            let destination_path = destination_for_load.clone();
            let abandoned = Arc::clone(&abandoned_for_load);
            let export_tx = export_tx.clone();
            let export_tx_for_error = export_tx.clone();
            let with_result = export_window.with_webview(move |platform_webview| {
                if let Err(err) = start_pdf_save_operation(
                    platform_webview,
                    destination_path,
                    export_tx.clone(),
                    abandoned,
                ) {
                    let _ = export_tx.send(Err(err));
                }
            });
            if let Err(err) = with_result {
                let _ = export_tx_for_error
                    .send(Err(format!("Cannot access PDF export webview: {err}")));
            }
        })
        .build()
        .map_err(|err| {
            let _ = fs::remove_file(&export_file_path);
            format!("Cannot create PDF export webview: {err}")
        })?;

    let wait_result = tauri::async_runtime::spawn_blocking(move || {
        export_rx.recv_timeout(Duration::from_secs(PDF_EXPORT_TIMEOUT_SECONDS))
    })
    .await
    .map_err(|err| format!("PDF export wait failed: {err}"))?;
    let result = match wait_result {
        Ok(result) => result,
        Err(_) => {
            abandoned.store(true, Ordering::SeqCst);
            Err("PDF export timed out.".to_string())
        }
    };
    let _ = pdf_window.close();
    let _ = fs::remove_file(export_file_path);
    result
}

#[cfg(target_os = "macos")]
fn start_pdf_save_operation(
    platform_webview: tauri::webview::PlatformWebview,
    destination_path: PathBuf,
    export_tx: std::sync::mpsc::Sender<Result<(), String>>,
    abandoned: Arc<std::sync::atomic::AtomicBool>,
) -> Result<(), String> {
    use block2::RcBlock;
    use objc2::runtime::{AnyObject, Bool};
    use objc2::{msg_send, sel};
    use objc2_foundation::{NSError, NSString};

    unsafe {
        let webview = platform_webview.inner().cast::<AnyObject>();
        if webview.is_null() {
            return Err("PDF export webview is unavailable.".to_string());
        }
        let webview = &*webview;
        let can_create_pdf: Bool = msg_send![
            webview,
            respondsToSelector: sel!(createPDFWithConfiguration:completionHandler:)
        ];
        if !can_create_pdf.as_bool() {
            return Err("WebKit PDF export is unavailable.".to_string());
        }

        let webview = webview as *const AnyObject as *mut AnyObject;
        let size_script = NSString::from_str(PDF_CAPTURE_SIZE_SCRIPT);
        let handler = RcBlock::new(move |value: *mut AnyObject, error: *mut NSError| {
            let result = if !error.is_null() {
                Err(format!(
                    "Cannot measure PDF export layout: {}",
                    ns_error_message(error)
                ))
            } else {
                match pdf_capture_size_from_js_value(value) {
                    Ok(capture_size) => create_pdf_from_webview(
                        webview,
                        capture_size,
                        destination_path.clone(),
                        export_tx.clone(),
                        Arc::clone(&abandoned),
                    ),
                    Err(err) => Err(err),
                }
            };

            if let Err(err) = result {
                let _ = export_tx.send(Err(err));
            }
        });

        let _: () = msg_send![
            &*webview,
            evaluateJavaScript: &*size_script,
            completionHandler: &*handler
        ];
    }

    Ok(())
}

#[cfg(target_os = "macos")]
unsafe fn create_pdf_from_webview(
    webview: *mut objc2::runtime::AnyObject,
    capture_size: PdfCaptureSize,
    destination_path: PathBuf,
    export_tx: std::sync::mpsc::Sender<Result<(), String>>,
    abandoned: Arc<std::sync::atomic::AtomicBool>,
) -> Result<(), String> {
    use block2::RcBlock;
    use objc2::rc::Retained;
    use objc2::runtime::AnyObject;
    use objc2::{class, msg_send};
    use objc2_foundation::{NSData, NSError, NSPoint, NSRect, NSSize};

    if abandoned.load(Ordering::SeqCst) {
        return Ok(());
    }
    if webview.is_null() {
        return Err("PDF export webview is unavailable.".to_string());
    }

    let pdf_config: Retained<AnyObject> = unsafe { msg_send![class!(WKPDFConfiguration), new] };
    let capture_rect = NSRect::new(
        NSPoint::new(0.0, 0.0),
        NSSize::new(capture_size.width, capture_size.height),
    );
    let _: () = unsafe { msg_send![&*pdf_config, setRect: capture_rect] };

    let handler = RcBlock::new(move |pdf_data: *mut NSData, error: *mut NSError| {
        if abandoned.load(Ordering::SeqCst) {
            return;
        }

        let result = write_pdf_data(pdf_data, error, &destination_path);
        let _ = export_tx.send(result);
    });

    let _: () = unsafe {
        msg_send![
            &*webview,
            createPDFWithConfiguration: &*pdf_config,
            completionHandler: &*handler
        ]
    };
    Ok(())
}

#[cfg(target_os = "macos")]
fn pdf_capture_size_from_js_value(
    value: *mut objc2::runtime::AnyObject,
) -> Result<PdfCaptureSize, String> {
    use objc2_foundation::NSString;

    if value.is_null() {
        return Err("Cannot measure PDF export layout.".to_string());
    }

    let size_json = unsafe { &*value.cast::<NSString>() }.to_string();
    let size: PdfCaptureSize = serde_json::from_str(&size_json)
        .map_err(|err| format!("Cannot parse PDF export layout size: {err}"))?;
    if !size.width.is_finite()
        || !size.height.is_finite()
        || size.width <= 0.0
        || size.height <= 0.0
    {
        return Err("Cannot measure PDF export layout.".to_string());
    }

    Ok(size)
}

#[cfg(target_os = "macos")]
pub(crate) fn write_pdf_data(
    pdf_data: *mut objc2_foundation::NSData,
    error: *mut objc2_foundation::NSError,
    destination_path: &Path,
) -> Result<(), String> {
    if !error.is_null() {
        return Err(format!(
            "WebKit PDF export failed: {}",
            ns_error_message(error)
        ));
    }
    if pdf_data.is_null() {
        return Err("WebKit PDF export returned no data.".to_string());
    }

    let bytes = unsafe { &*pdf_data }.to_vec();
    if !bytes.starts_with(b"%PDF") {
        return Err("WebKit PDF export returned invalid PDF data.".to_string());
    }

    fs::write(destination_path, bytes).map_err(|err| format!("Cannot write PDF export: {err}"))?;
    if !destination_path.is_file() {
        return Err("PDF export finished without writing a file.".to_string());
    }

    Ok(())
}

#[cfg(target_os = "macos")]
fn ns_error_message(error: *mut objc2_foundation::NSError) -> String {
    if error.is_null() {
        return "unknown error".to_string();
    }

    unsafe { (&*error).localizedDescription().to_string() }
}

#[cfg(target_os = "macos")]
fn write_pdf_export_html_file(
    export_id: u64,
    file_name: &str,
    html_content: &str,
) -> Result<PathBuf, String> {
    fs::create_dir_all(pdf_export_temp_dir())
        .map_err(|err| format!("Cannot create PDF export temp dir: {err}"))?;

    let file_path = pdf_export_temp_dir().join(format!("{export_id}-{file_name}"));
    fs::write(&file_path, html_content)
        .map_err(|err| format!("Cannot write PDF export HTML: {err}"))?;
    Ok(file_path)
}

#[cfg(target_os = "macos")]
fn pdf_export_temp_dir() -> PathBuf {
    std::env::temp_dir().join("hazakura-editor-pdf-export")
}

#[cfg(not(target_os = "macos"))]
async fn export_pdf_file<R: tauri::Runtime>(
    _app: tauri::AppHandle<R>,
    _html_content: String,
    _destination_path: PathBuf,
) -> Result<(), String> {
    Err("PDF export is only available on macOS.".to_string())
}
