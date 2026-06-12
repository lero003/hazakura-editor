use crate::security::window_guard::*;

use std::process::Command;

const ALLOWED_EXTERNAL_URL_SCHEMES: &[&str] = &["http", "https", "mailto", "tel"];

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

    #[cfg(target_os = "macos")]
    {
        let status = Command::new("/usr/bin/open")
            .arg(&url)
            .status()
            .map_err(|err| format!("Cannot open external link: {err}"))?;

        if status.success() {
            return Ok(());
        }

        Err(format!("External link open failed with status {status}."))
    }

    #[cfg(target_os = "windows")]
    {
        let status = Command::new("cmd")
            .args(["/C", "start", ""])
            .arg(&url)
            .status()
            .map_err(|err| format!("Cannot open external link: {err}"))?;

        if status.success() {
            return Ok(());
        }

        Err(format!("External link open failed with status {status}."))
    }

    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    {
        let status = Command::new("xdg-open")
            .arg(&url)
            .status()
            .map_err(|err| format!("Cannot open external link: {err}"))?;

        if status.success() {
            return Ok(());
        }

        Err(format!("External link open failed with status {status}."))
    }
}

pub(crate) fn normalize_external_url(url: &str) -> Result<String, String> {
    let trimmed = url.trim();

    if trimmed.is_empty() {
        return Err("External link is empty.".to_string());
    }

    if trimmed
        .chars()
        .any(|character| character.is_ascii_control() || character.is_ascii_whitespace())
    {
        return Err("External link contains unsupported characters.".to_string());
    }

    let Some((scheme, remainder)) = trimmed.split_once(':') else {
        return Err("External link scheme is missing.".to_string());
    };

    let scheme = scheme.to_ascii_lowercase();
    if !ALLOWED_EXTERNAL_URL_SCHEMES.contains(&scheme.as_str()) {
        return Err("External link scheme is not allowed.".to_string());
    }

    if remainder.is_empty() {
        return Err("External link target is empty.".to_string());
    }

    if matches!(scheme.as_str(), "http" | "https") && !remainder.starts_with("//") {
        return Err("External web link must include a host.".to_string());
    }

    Ok(trimmed.to_string())
}
