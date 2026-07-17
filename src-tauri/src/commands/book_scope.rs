//! v2 Book Scope Alpha — explicit ordered Markdown selection validation.

use crate::security::window_guard::*;
use crate::types::*;
use crate::util::{ensure_workspace_root, readable_text_metadata};

use std::collections::HashSet;
use std::fs;
use std::path::{Component, Path, PathBuf};

const MARKDOWN_EXTENSIONS: &[&str] = &["md", "markdown", "mdown", "mkd", "mdx"];

#[tauri::command]
pub(crate) fn resolve_book_scope<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    workspace_root: String,
    chapter_relative_paths: Vec<String>,
) -> Result<BookScopeResolveResult, String> {
    resolve_book_scope_with_label(window.label(), workspace_root, chapter_relative_paths)
}

pub(crate) fn resolve_book_scope_with_label(
    label: &str,
    workspace_root: String,
    chapter_relative_paths: Vec<String>,
) -> Result<BookScopeResolveResult, String> {
    ensure_label_is_main(label)?;
    if chapter_relative_paths.len() > MAX_BOOK_SCOPE_CHAPTERS {
        return Err(format!(
            "Book Scope accepts at most {MAX_BOOK_SCOPE_CHAPTERS} chapters."
        ));
    }

    let root = ensure_workspace_root(&PathBuf::from(workspace_root))?;
    let mut seen = HashSet::new();
    let mut chapters = Vec::new();
    let mut unavailable = Vec::new();

    for relative_path in chapter_relative_paths {
        if !seen.insert(relative_path.clone()) {
            unavailable.push(unavailable_entry(relative_path, "duplicate"));
            continue;
        }

        let relative = Path::new(&relative_path);
        if !is_safe_relative_path(relative, &relative_path) {
            unavailable.push(unavailable_entry(relative_path, "invalid-path"));
            continue;
        }
        if !is_markdown_path(relative) {
            unavailable.push(unavailable_entry(relative_path, "unsupported-extension"));
            continue;
        }

        let candidate = root.join(relative);
        if contains_symlink_component(&root, relative) {
            unavailable.push(unavailable_entry(relative_path, "symlink"));
            continue;
        }
        let metadata = match fs::symlink_metadata(&candidate) {
            Ok(metadata) => metadata,
            Err(err) if err.kind() == std::io::ErrorKind::NotFound => {
                unavailable.push(unavailable_entry(relative_path, "missing"));
                continue;
            }
            Err(_) => {
                unavailable.push(unavailable_entry(relative_path, "unreadable"));
                continue;
            }
        };
        if metadata.file_type().is_symlink() {
            unavailable.push(unavailable_entry(relative_path, "symlink"));
            continue;
        }
        if !metadata.is_file() {
            unavailable.push(unavailable_entry(relative_path, "not-file"));
            continue;
        }

        let canonical = match fs::canonicalize(&candidate) {
            Ok(path) if path.starts_with(&root) => path,
            Ok(_) => {
                unavailable.push(unavailable_entry(relative_path, "outside-workspace"));
                continue;
            }
            Err(_) => {
                unavailable.push(unavailable_entry(relative_path, "unreadable"));
                continue;
            }
        };
        if readable_text_metadata(&canonical).is_err() {
            unavailable.push(unavailable_entry(relative_path, "unreadable"));
            continue;
        }

        let name = canonical
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("chapter.md")
            .to_string();
        chapters.push(BookScopeChapter {
            path: canonical.to_string_lossy().to_string(),
            relative_path,
            name,
        });
    }

    Ok(BookScopeResolveResult {
        chapters,
        unavailable,
    })
}

fn unavailable_entry(relative_path: String, reason: &str) -> BookScopeUnavailableEntry {
    BookScopeUnavailableEntry {
        relative_path,
        reason: reason.to_string(),
    }
}

fn is_safe_relative_path(path: &Path, raw: &str) -> bool {
    !raw.is_empty()
        && !raw.contains('\\')
        && !path.is_absolute()
        && path
            .components()
            .all(|component| matches!(component, Component::Normal(_)))
}

fn is_markdown_path(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| {
            MARKDOWN_EXTENSIONS
                .iter()
                .any(|allowed| extension.eq_ignore_ascii_case(allowed))
        })
        .unwrap_or(false)
}

fn contains_symlink_component(root: &Path, relative: &Path) -> bool {
    let mut current = root.to_path_buf();
    for component in relative.components() {
        let Component::Normal(part) = component else {
            return true;
        };
        current.push(part);
        if fs::symlink_metadata(&current)
            .map(|metadata| metadata.file_type().is_symlink())
            .unwrap_or(false)
        {
            return true;
        }
    }
    false
}
