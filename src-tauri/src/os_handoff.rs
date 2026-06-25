use std::ffi::OsString;
use std::path::Path;
use std::process::Command;

const ALLOWED_EXTERNAL_URL_SCHEMES: &[&str] = &["http", "https", "mailto", "tel"];

#[derive(Debug, PartialEq, Eq)]
pub(crate) struct OsHandoffCommand {
    pub(crate) program: OsString,
    pub(crate) args: Vec<OsString>,
}

#[derive(Debug, Clone, Copy)]
pub(crate) enum OsHandoffTarget<'a> {
    ExternalUrl(&'a str),
    RevealPath(&'a Path),
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

pub(crate) fn build_os_handoff_command(target: OsHandoffTarget<'_>) -> OsHandoffCommand {
    match target {
        OsHandoffTarget::ExternalUrl(url) => build_external_url_command(url),
        OsHandoffTarget::RevealPath(path) => build_reveal_path_command(path),
    }
}

pub(crate) fn run_os_handoff(command: OsHandoffCommand, action: &str) -> Result<(), String> {
    let status = Command::new(&command.program)
        .args(&command.args)
        .status()
        .map_err(|err| format!("Cannot {action}: {err}"))?;

    if status.success() {
        return Ok(());
    }

    Err(format!("{action} failed with status {status}."))
}

fn build_external_url_command(url: &str) -> OsHandoffCommand {
    #[cfg(target_os = "macos")]
    {
        OsHandoffCommand {
            program: OsString::from("/usr/bin/open"),
            args: vec![OsString::from(url)],
        }
    }

    #[cfg(target_os = "windows")]
    {
        OsHandoffCommand {
            program: OsString::from("cmd"),
            args: vec![
                OsString::from("/C"),
                OsString::from("start"),
                OsString::from(""),
                OsString::from(url),
            ],
        }
    }

    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    {
        OsHandoffCommand {
            program: OsString::from("xdg-open"),
            args: vec![OsString::from(url)],
        }
    }
}

fn build_reveal_path_command(path: &Path) -> OsHandoffCommand {
    #[cfg(target_os = "macos")]
    {
        OsHandoffCommand {
            program: OsString::from("/usr/bin/open"),
            args: vec![OsString::from("-R"), path.as_os_str().to_os_string()],
        }
    }

    #[cfg(target_os = "windows")]
    {
        OsHandoffCommand {
            program: OsString::from("explorer"),
            args: vec![OsString::from("/select,"), path.as_os_str().to_os_string()],
        }
    }

    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    {
        let directory = if path.is_dir() {
            path
        } else {
            path.parent().unwrap_or(path)
        };
        OsHandoffCommand {
            program: OsString::from("xdg-open"),
            args: vec![directory.as_os_str().to_os_string()],
        }
    }
}
