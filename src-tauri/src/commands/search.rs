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
//   * cannot be decoded losslessly using the same supported text
//     encodings as file open: UTF-8, UTF-8 BOM, Shift-JIS, or
//     EUC-JP.
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
            total_files_matched: 0,
            truncated: false,
        });
    }

    let root_path = Path::new(&root);
    let canonical_root = ensure_workspace_root(root_path)?;

    let needle = trimmed_query.to_lowercase();
    let mut files: Vec<WorkspaceSearchFileResult> = Vec::new();
    let mut total_matches: usize = 0;
    let mut total_files_scanned: usize = 0;
    let mut total_files_matched: usize = 0;
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

            let bytes = match fs::read(&child_path) {
                Ok(bytes) => bytes,
                Err(_) => continue,
            };
            let encoding = detect_text_encoding(&bytes);
            let contents = match decode_text_bytes(&bytes, encoding) {
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

                // `find` returns a byte index into the **folded** line. Map
                // that span back to character offsets in the original line so
                // the front-end can render it without re-counting (Unicode
                // scalar values, which is what JS `Array.from` yields too).
                let (match_start_char, match_end_char) =
                    char_span_for_folded_bytes(line, byte_offset, byte_offset + needle.len());
                let column = match_start_char + 1;
                let match_length = match_end_char.saturating_sub(match_start_char);
                let line_length = line.chars().count();
                // 一致位置を中心に切り出す。行頭から切ると、長い行の後方で
                // 一致したときに一致箇所が payload から落ちる（レビューP2）。
                let (snippet, snippet_start, _) = build_match_snippet(
                    line,
                    match_start_char,
                    match_end_char,
                    MAX_WORKSPACE_SEARCH_LINE_BYTES,
                );

                matches.push(WorkspaceSearchMatch {
                    line: line_index + 1,
                    column,
                    text: snippet,
                    snippet_start: snippet_start + 1,
                    match_length,
                    line_length,
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

            total_files_matched += 1;
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
        total_files_matched,
        truncated,
    })
}

/// 折り畳んだ（小文字化した）バイト範囲が覆う、原文上の文字範囲を返す。
/// 終端は排他。大文字小文字変換で長さが変わる文字があっても、原文の文字数を
/// 数えて返すので front-end のコードポイント位置と一致する。
fn char_span_for_folded_bytes(line: &str, start_byte: usize, end_byte: usize) -> (usize, usize) {
    let mut folded = 0usize;
    let mut span_start: Option<usize> = None;
    let mut span_end = 0usize;
    for (index, ch) in line.chars().enumerate() {
        folded += ch.to_lowercase().map(char::len_utf8).sum::<usize>();
        if span_start.is_none() && folded > start_byte {
            span_start = Some(index);
        }
        if folded >= end_byte {
            span_end = index + 1;
            break;
        }
    }
    let start = span_start.unwrap_or(0);
    (start, span_end.max(start))
}

/// 一致位置を中心にした snippet を作る。
///
/// 戻り値は (snippet, snippet の開始文字位置（0-based）, 行末を切ったか)。
/// 一致の終端が予算内に入るまで、開始位置を1文字ずつ手前へ広げるので、
/// **一致箇所が payload から落ちることはない**。
fn build_match_snippet(
    line: &str,
    match_start_char: usize,
    match_end_char: usize,
    max_bytes: usize,
) -> (String, usize, bool) {
    if line.len() <= max_bytes {
        return (line.to_string(), 0, false);
    }
    let chars: Vec<char> = line.chars().collect();
    let total = chars.len();
    const CONTEXT_CHARS_BEFORE: usize = 60;
    let mut start = match_start_char.saturating_sub(CONTEXT_CHARS_BEFORE);
    loop {
        let mut bytes = 0usize;
        let mut end = start;
        while end < total {
            let next = chars[end].len_utf8();
            if bytes + next > max_bytes {
                break;
            }
            bytes += next;
            end += 1;
        }
        let covers_match = end >= match_end_char.min(total);
        if covers_match || start == 0 {
            let snippet: String = chars[start..end].iter().collect();
            return (snippet, start, end < total);
        }
        start -= 1;
    }
}
