use crate::security::window_guard::*;

use std::fs;
use std::process::Command;
#[tauri::command]
pub(crate) fn open_temp_print_html<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    html_content: String,
    file_name: String,
) -> Result<String, String> {
    open_temp_print_html_with_label(window.label(), html_content, file_name)
}

pub(crate) fn open_temp_print_html_with_label(
    label: &str,
    html_content: String,
    file_name: String,
) -> Result<String, String> {
    ensure_label_is_main(label)?;
    use std::io::Write;

    let temp_dir = std::env::temp_dir().join("hazakura-note-print");
    fs::create_dir_all(&temp_dir).map_err(|err| format!("Cannot create print temp dir: {err}"))?;

    let file_path = temp_dir.join(&file_name);
    let mut file = fs::File::create(&file_path)
        .map_err(|err| format!("Cannot create print temp file: {err}"))?;
    file.write_all(html_content.as_bytes())
        .map_err(|err| format!("Cannot write print temp file: {err}"))?;

    // Open in default browser
    #[cfg(target_os = "macos")]
    {
        let status = Command::new("/usr/bin/open")
            .arg(&file_path)
            .status()
            .map_err(|err| format!("Cannot open file in browser: {err}"))?;

        if !status.success() {
            return Err(format!("Open failed with status {status}."));
        }
    }

    #[cfg(target_os = "windows")]
    {
        let status = Command::new("cmd")
            .args(["/C", "start", ""])
            .arg(&file_path)
            .status()
            .map_err(|err| format!("Cannot open file in browser: {err}"))?;

        if !status.success() {
            return Err(format!("Open failed with status {status}."));
        }
    }

    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    {
        let status = Command::new("xdg-open")
            .arg(&file_path)
            .status()
            .map_err(|err| format!("Cannot open file in browser: {err}"))?;

        if !status.success() {
            return Err(format!("Open failed with status {status}."));
        }
    }

    let path_str = file_path.to_string_lossy().to_string();
    Ok(path_str)
}
