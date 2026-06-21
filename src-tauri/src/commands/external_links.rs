use crate::os_handoff::{
    build_os_handoff_command, normalize_external_url, run_os_handoff, OsHandoffTarget,
};
use crate::security::window_guard::*;

#[tauri::command]
pub(crate) fn open_external_url<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    url: String,
) -> Result<(), String> {
    open_external_url_with_label(window.label(), url)
}

pub(crate) fn open_external_url_with_label(label: &str, url: String) -> Result<(), String> {
    ensure_label_is_main(label)?;
    let url = normalize_external_url(&url)?;
    let command = build_os_handoff_command(OsHandoffTarget::ExternalUrl(&url));
    run_os_handoff(command, "open external link")
}
