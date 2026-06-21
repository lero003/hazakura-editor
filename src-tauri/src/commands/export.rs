use crate::os_handoff::{
    build_os_handoff_command, normalize_print_handoff_file_name, run_os_handoff, OsHandoffTarget,
};
use crate::security::window_guard::*;

use std::fs;
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

    let file_name = normalize_print_handoff_file_name(&file_name)?;
    let file_path = temp_dir.join(file_name);
    let mut file = fs::File::create(&file_path)
        .map_err(|err| format!("Cannot create print temp file: {err}"))?;
    file.write_all(html_content.as_bytes())
        .map_err(|err| format!("Cannot write print temp file: {err}"))?;

    let command = build_os_handoff_command(OsHandoffTarget::PrintHtml(&file_path));
    run_os_handoff(command, "open print HTML in browser")?;

    let path_str = file_path.to_string_lossy().to_string();
    Ok(path_str)
}
