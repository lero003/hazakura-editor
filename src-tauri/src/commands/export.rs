use crate::security::window_guard::*;

use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;

use std::fs;

const PRINT_WINDOW_CLOSE_DELAY_SECONDS: u64 = 300;
static PRINT_WINDOW_COUNTER: AtomicU64 = AtomicU64::new(1);

#[tauri::command]
pub(crate) fn print_html<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    app: tauri::AppHandle<R>,
    html_content: String,
    file_name: String,
) -> Result<(), String> {
    let normalized_file_name =
        validate_print_html_request(window.label(), &html_content, &file_name)?;
    open_native_print_window(app, html_content, normalized_file_name)
}

pub(crate) fn validate_print_html_request(
    label: &str,
    html_content: &str,
    file_name: &str,
) -> Result<String, String> {
    ensure_label_is_main(label)?;
    if html_content.trim().is_empty() {
        return Err("Print HTML content is empty.".to_string());
    }
    normalize_print_html_file_name(file_name)
}

fn normalize_print_html_file_name(file_name: &str) -> Result<String, String> {
    if file_name.is_empty() {
        return Err("print HTML file name is empty.".to_string());
    }

    if file_name
        .chars()
        .any(|character| character.is_ascii_control() || matches!(character, '/' | '\\' | ':'))
    {
        return Err("print HTML file name must be a plain .html file name.".to_string());
    }

    let path = std::path::Path::new(file_name);
    if path.file_name().and_then(|name| name.to_str()) != Some(file_name) {
        return Err("print HTML file name must be a plain .html file name.".to_string());
    }

    let stem = path
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or("");
    let extension = path
        .extension()
        .and_then(|extension| extension.to_str())
        .unwrap_or("");
    if stem.is_empty() || !extension.eq_ignore_ascii_case("html") {
        return Err("print HTML file name must be a plain .html file name.".to_string());
    }

    Ok(file_name.to_string())
}

#[cfg(target_os = "macos")]
fn open_native_print_window<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    html_content: String,
    file_name: String,
) -> Result<(), String> {
    use std::sync::atomic::AtomicBool;
    use tauri::webview::PageLoadEvent;
    use tauri::{Url, WebviewUrl, WebviewWindowBuilder};

    let print_id = PRINT_WINDOW_COUNTER.fetch_add(1, Ordering::Relaxed);
    let label = format!("hazakura-print-{print_id}");
    let title = file_name.trim_end_matches(".html").to_string();
    let print_file_path = write_native_print_html_file(print_id, &file_name, &html_content)?;
    let print_url = Url::from_file_path(&print_file_path).map_err(|_| {
        format!(
            "Cannot create print file URL: {}",
            print_file_path.display()
        )
    })?;

    let printed = Arc::new(AtomicBool::new(false));
    let printed_for_load = Arc::clone(&printed);
    let cleanup_file_path = print_file_path.clone();

    let _print_window = WebviewWindowBuilder::new(&app, &label, WebviewUrl::External(print_url))
        .title(format!("Hazakura Print - {title}"))
        .visible(false)
        .inner_size(900.0, 1200.0)
        .on_page_load(move |print_window, payload| {
            if payload.event() != PageLoadEvent::Finished {
                return;
            }
            if printed_for_load.swap(true, Ordering::SeqCst) {
                return;
            }

            let cleanup_file_path = cleanup_file_path.clone();
            if print_window.show().is_ok() {
                let _ = print_window.set_focus();
                let _ = print_window.print();
            }

            let cleanup_window = print_window.clone();
            std::thread::spawn(move || {
                std::thread::sleep(Duration::from_secs(PRINT_WINDOW_CLOSE_DELAY_SECONDS));
                let _ = cleanup_window.close();
                let _ = fs::remove_file(cleanup_file_path);
            });
        })
        .build()
        .map_err(|err| format!("Cannot create native print window: {err}"))?;

    Ok(())
}

#[cfg(target_os = "macos")]
pub(crate) fn write_native_print_html_file(
    print_id: u64,
    file_name: &str,
    html_content: &str,
) -> Result<PathBuf, String> {
    fs::create_dir_all(native_print_temp_dir())
        .map_err(|err| format!("Cannot create native print temp dir: {err}"))?;

    let file_path = native_print_temp_dir().join(format!("{print_id}-{file_name}"));
    fs::write(&file_path, html_content)
        .map_err(|err| format!("Cannot write native print HTML: {err}"))?;
    Ok(file_path)
}

#[cfg(target_os = "macos")]
fn native_print_temp_dir() -> PathBuf {
    std::env::temp_dir().join("hazakura-note-native-print")
}

#[cfg(test)]
pub(crate) fn native_print_temp_path_for_test(print_id: u64, file_name: &str) -> PathBuf {
    native_print_temp_dir().join(format!("{print_id}-{file_name}"))
}

#[cfg(not(target_os = "macos"))]
fn open_native_print_window<R: tauri::Runtime>(
    _app: tauri::AppHandle<R>,
    _html_content: String,
    _file_name: String,
) -> Result<(), String> {
    Err("Native print is only available on macOS.".to_string())
}
