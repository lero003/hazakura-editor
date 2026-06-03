use crate::security::window_guard::*;
use crate::types::*;
use crate::util::*;

use std::fs;
use std::path::{Path, PathBuf};

// `search_workspace_files` is a bounded, case-insensitive substring
// grep over the active workspace. It is the back-end for the v0.8
// "Find in Files" command-palette entry (Cmd+Shift+F) and is
// intentionally cheap: no regex, no fuzzy, no indexing, no ranking
// across files. The caps in `MAX_WORKSPACE_SEARCH_*` keep the walk
// responsive on a prototype machine even when the user pastes a
// broad query. Files are visited in lexicographic order so the
// front-end sees a stable result list across runs.
//
// Files are skipped when they:
//   * sit inside a directory in `should_skip_workspace_dir`
//     (`.git`, `node_modules`, `target`, etc. — see `EXCLUDED_
//     WORKSPACE_DIRS`).
//   * are (or are reached through) a symlink. The walk uses
//     `entry.file_type()` (which does NOT follow symlinks) and
//     then `fs::symlink_metadata` before opening the file, so a
//     symlink inside the workspace cannot route reads outside the
//     canonical root. The companion auto-backup slice applied the
//     same hardening for the same reason.
//   * fail the `looks_binary` sniff (NUL byte in the first
//     `BINARY_SNIFF_BYTES`).
//   * are larger than `MAX_EDITABLE_BYTES` (matches the editor's
//     own size limit, so the result list never points at a file
//     the open path would refuse).
//
// Matches are 1-based line + 1-based column. The line text is
// trimmed to `MAX_WORKSPACE_SEARCH_LINE_BYTES` so a long log
// line does not blow up the response payload.
#[tauri::command]
pub(crate) fn search_workspace_files<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    root: String,
    query: String,
) -> Result<WorkspaceSearchResult, String> {
    search_workspace_files_with_label(window.label(), root, query)
}

pub(crate) fn search_workspace_files_with_label(
    label: &str,
    root: String,
    query: String,
) -> Result<WorkspaceSearchResult, String> {
    ensure_label_is_main(label)?;

    let trimmed_query = query.trim();
    if trimmed_query.is_empty() {
        return Ok(WorkspaceSearchResult {
            files: Vec::new(),
            total_matches: 0,
            total_files_scanned: 0,
            truncated: false,
        });
    }

    let root_path = Path::new(&root);
    let canonical_root = ensure_workspace_root(root_path)?;

    let needle = trimmed_query.to_lowercase();
    let mut files: Vec<WorkspaceSearchFileResult> = Vec::new();
    let mut total_matches: usize = 0;
    let mut total_files_scanned: usize = 0;
    let mut truncated = false;

    let mut stack: Vec<PathBuf> = vec![canonical_root.clone()];

    while let Some(directory) = stack.pop() {
        if total_files_scanned >= MAX_WORKSPACE_SEARCH_FILES || truncated {
            truncated = true;
            break;
        }

        let entries = match fs::read_dir(&directory) {
            Ok(entries) => entries,
            Err(_) => continue,
        };

        let mut collected: Vec<(PathBuf, std::fs::FileType)> = Vec::new();
        for entry in entries.flatten() {
            // `entry.file_type()` does not follow symlinks, so it
            // returns `is_symlink()` for links without resolving
            // them. This keeps the walk from descending into or
            // reading through a symlink that points outside the
            // canonical workspace root.
            if let Ok(file_type) = entry.file_type() {
                collected.push((entry.path(), file_type));
            }
        }
        collected.sort_by(|left, right| left.0.cmp(&right.0));

        for (child_path, file_type) in collected {
            if total_files_scanned >= MAX_WORKSPACE_SEARCH_FILES {
                truncated = true;
                break;
            }

            if file_type.is_symlink() {
                continue;
            }

            if file_type.is_dir() {
                let name = child_path
                    .file_name()
                    .and_then(|name| name.to_str())
                    .unwrap_or("");
                if should_skip_workspace_dir(name) {
                    continue;
                }
                stack.push(child_path);
                continue;
            }

            if !file_type.is_file() {
                continue;
            }

            total_files_scanned += 1;

            // `fs::metadata` follows symlinks, so re-check with
            // `symlink_metadata` to defend against a symlink
            // racing into place after `entry.file_type()` was
            // cached. If it is now a symlink, skip it.
            let metadata = match fs::symlink_metadata(&child_path) {
                Ok(metadata) => metadata,
                Err(_) => continue,
            };
            if metadata.file_type().is_symlink() {
                continue;
            }
            if !metadata.is_file() || metadata.len() > MAX_EDITABLE_BYTES {
                continue;
            }
            if looks_binary(&child_path).unwrap_or(true) {
                continue;
            }

            let contents = match fs::read_to_string(&child_path) {
                Ok(contents) => contents,
                Err(_) => continue,
            };

            let mut matches: Vec<WorkspaceSearchMatch> = Vec::new();
            for (line_index, line) in contents.lines().enumerate() {
                if matches.len() >= MAX_WORKSPACE_SEARCH_MATCHES_PER_FILE {
                    truncated = true;
                    break;
                }
                if total_matches >= MAX_WORKSPACE_SEARCH_TOTAL_MATCHES {
                    truncated = true;
                    break;
                }

                let line_lower = line.to_lowercase();
                let Some(byte_offset) = line_lower.find(&needle) else {
                    continue;
                };

                // `find` returns a byte index; convert to a 1-based
                // character column so the front-end can render it
                // without re-counting. The `chars().take(...)` is
                // bounded by `line.len()` so it cannot allocate
                // unboundedly.
                let column = line[..byte_offset].chars().count() + 1;
                let trimmed_text = truncate_text(line, MAX_WORKSPACE_SEARCH_LINE_BYTES);

                matches.push(WorkspaceSearchMatch {
                    line: line_index + 1,
                    column,
                    text: trimmed_text,
                });
                total_matches += 1;
            }

            if matches.is_empty() {
                continue;
            }

            let relative_path = child_path
                .strip_prefix(&canonical_root)
                .map(|path| path.to_string_lossy().to_string())
                .unwrap_or_else(|_| {
                    child_path
                        .file_name()
                        .map(|name| name.to_string_lossy().to_string())
                        .unwrap_or_default()
                });

            let file_truncated = matches.len() >= MAX_WORKSPACE_SEARCH_MATCHES_PER_FILE;
            files.push(WorkspaceSearchFileResult {
                path: child_path.to_string_lossy().to_string(),
                relative_path,
                matches,
                truncated: file_truncated,
            });
        }
    }

    Ok(WorkspaceSearchResult {
        files,
        total_matches,
        total_files_scanned,
        truncated,
    })
}

fn truncate_text(text: &str, max_bytes: usize) -> String {
    if text.len() <= max_bytes {
        return text.to_string();
    }
    // Walk back to the nearest char boundary so we never slice in
    // the middle of a multi-byte UTF-8 sequence. `floor_char_boundary`
    // is not stable yet, so we hand-roll the equivalent.
    let mut end = max_bytes;
    while end > 0 && !text.is_char_boundary(end) {
        end -= 1;
    }
    let mut out = text[..end].to_string();
    out.push('…');
    out
}
