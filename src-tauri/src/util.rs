use crate::types::*;
use std::env;
use std::ffi::{OsStr, OsString};
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

pub(crate) fn readable_text_metadata(path: &Path) -> Result<fs::Metadata, String> {
    let metadata = fs::metadata(path).map_err(|err| format!("Cannot read file: {err}"))?;

    if !metadata.is_file() {
        return Err("Selected path is not a file.".to_string());
    }

    if metadata.len() > MAX_EDITABLE_BYTES {
        return Err("File is larger than the prototype editing limit of 10 MB.".to_string());
    }

    if looks_binary(path)? {
        return Err("Binary-looking files are not opened by this editor.".to_string());
    }

    Ok(metadata)
}

pub(crate) fn image_mime_type(path: &Path, bytes: &[u8]) -> Option<&'static str> {
    let extension = path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.to_ascii_lowercase());

    match extension.as_deref() {
        Some("png") if bytes.starts_with(b"\x89PNG\r\n\x1a\n") => Some("image/png"),
        Some("jpg") | Some("jpeg") if bytes.starts_with(&[0xff, 0xd8, 0xff]) => Some("image/jpeg"),
        Some("gif") if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") => {
            Some("image/gif")
        }
        Some("webp")
            if bytes.len() >= 12 && bytes.starts_with(b"RIFF") && &bytes[8..12] == b"WEBP" =>
        {
            Some("image/webp")
        }
        _ => None,
    }
}

/// Detect image format from magic bytes only (ignoring filename).
/// Returns the file extension, e.g. "png", "jpg", "gif", "webp".
pub(crate) fn image_ext_from_bytes(bytes: &[u8]) -> Option<&'static str> {
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        Some("png")
    } else if bytes.starts_with(&[0xff, 0xd8, 0xff]) {
        Some("jpg")
    } else if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        Some("gif")
    } else if bytes.len() >= 12 && bytes.starts_with(b"RIFF") && &bytes[8..12] == b"WEBP" {
        Some("webp")
    } else {
        None
    }
}

pub(crate) fn encode_base64(bytes: &[u8]) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut encoded = String::with_capacity(bytes.len().div_ceil(3) * 4);

    for chunk in bytes.chunks(3) {
        let first = chunk[0];
        let second = *chunk.get(1).unwrap_or(&0);
        let third = *chunk.get(2).unwrap_or(&0);

        encoded.push(TABLE[(first >> 2) as usize] as char);
        encoded.push(TABLE[(((first & 0b0000_0011) << 4) | (second >> 4)) as usize] as char);

        if chunk.len() > 1 {
            encoded.push(TABLE[(((second & 0b0000_1111) << 2) | (third >> 6)) as usize] as char);
        } else {
            encoded.push('=');
        }

        if chunk.len() > 2 {
            encoded.push(TABLE[(third & 0b0011_1111) as usize] as char);
        } else {
            encoded.push('=');
        }
    }

    encoded
}

/// Decode a base64-encoded string into bytes (standard alphabet).
pub(crate) fn decode_base64(encoded: &str) -> Result<Vec<u8>, String> {
    const DECODE: [i8; 256] = {
        let mut table = [-1i8; 256];
        let alphabet = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        let mut i = 0usize;
        while i < 64 {
            table[alphabet[i] as usize] = i as i8;
            i += 1;
        }
        table
    };

    let cleaned: Vec<u8> = encoded
        .bytes()
        .filter(|b| !b.is_ascii_whitespace())
        .collect();
    if cleaned.is_empty() {
        return Ok(Vec::new());
    }
    if cleaned.len() % 4 != 0 {
        return Err("Invalid base64 input length".to_string());
    }

    let mut decoded = Vec::with_capacity(cleaned.len() / 4 * 3);
    let last_chunk_index = cleaned.len() / 4 - 1;
    let decode = |byte: u8| -> Result<u16, String> {
        let value = DECODE.get(byte as usize).copied().unwrap_or(-1);
        if value < 0 {
            Err("Invalid base64 character".to_string())
        } else {
            Ok(value as u16)
        }
    };

    for (chunk_index, chunk) in cleaned.chunks(4).enumerate() {
        let is_last_chunk = chunk_index == last_chunk_index;

        if (chunk[0] == b'=' || chunk[1] == b'=')
            || (!is_last_chunk && (chunk[2] == b'=' || chunk[3] == b'='))
            || (chunk[2] == b'=' && chunk[3] != b'=')
        {
            return Err("Invalid base64 padding".to_string());
        }

        let a = decode(chunk[0])?;
        let b = decode(chunk[1])?;

        decoded.push(((a << 2) | (b >> 4)) as u8);

        if chunk[2] == b'=' {
            continue;
        }

        let c = decode(chunk[2])?;
        decoded.push((((b & 0x0f) << 4) | (c >> 2)) as u8);

        if chunk[3] == b'=' {
            continue;
        }

        let d = decode(chunk[3])?;
        decoded.push((((c & 0x03) << 6) | d) as u8);
    }

    Ok(decoded)
}

pub(crate) fn ensure_workspace_root(root_path: &Path) -> Result<PathBuf, String> {
    let metadata =
        fs::metadata(root_path).map_err(|err| format!("Cannot read workspace folder: {err}"))?;

    if !metadata.is_dir() {
        return Err("Selected workspace path is not a folder.".to_string());
    }

    fs::canonicalize(root_path).map_err(|err| format!("Cannot read workspace folder: {err}"))
}

/// Resolve `path` and confirm it lives inside the canonicalized
/// workspace root. If `path` does not yet exist (e.g. a new folder
/// being created), the parent is canonicalized instead and the
/// resulting child path is returned. Rejects symlinks whose
/// canonical target escapes the root.
pub(crate) fn ensure_path_inside_workspace_root(
    path: &Path,
    root: &Path,
) -> Result<PathBuf, String> {
    let canonical_root = ensure_workspace_root(root)?;

    let (canonical_base, is_existing) = if path.exists() {
        (
            fs::canonicalize(path).map_err(|err| format!("Cannot resolve path: {err}"))?,
            true,
        )
    } else {
        let parent = path
            .parent()
            .ok_or_else(|| "Path has no parent directory.".to_string())?;
        if !parent.is_dir() {
            return Err("Selected parent is not a folder.".to_string());
        }
        (
            fs::canonicalize(parent).map_err(|err| format!("Cannot resolve path: {err}"))?,
            false,
        )
    };

    if !canonical_base.starts_with(&canonical_root) {
        return Err("Path is outside the workspace root.".to_string());
    }

    if is_existing {
        Ok(canonical_base)
    } else {
        let name = path
            .file_name()
            .ok_or_else(|| "Path has no file name.".to_string())?;
        Ok(canonical_base.join(name))
    }
}

/// Rename (or move, when `src` and `dst` are in different
/// directories) a workspace entry. Both endpoints must live
/// inside `root`; the destination must not already exist; the
/// source must not be a symlink whose canonical target escapes
/// the root. Reuses `fs::rename` for atomicity and cross-
/// directory moves.
pub(crate) fn rename_workspace_entry_util(
    src: &Path,
    dst: &Path,
    root: &Path,
) -> Result<(), String> {
    if !src.exists() {
        return Err("Source path does not exist.".to_string());
    }

    if dst.exists() {
        return Err("A file or folder already exists at the destination.".to_string());
    }

    let _ = ensure_path_inside_workspace_root(src, root)?;
    let _ = ensure_path_inside_workspace_root(dst, root)?;

    fs::rename(src, dst).map_err(|err| format!("Cannot rename entry: {err}"))
}

pub(crate) fn find_allowlisted_agent_provider_in_path_env(
    provider: &str,
    path_var: &OsStr,
) -> Option<PathBuf> {
    if !is_allowlisted_agent_provider(provider) {
        return None;
    }

    env::split_paths(path_var).find_map(|directory| {
        let candidate = directory.join(provider);

        if is_executable_file(&candidate) {
            Some(candidate)
        } else {
            None
        }
    })
}

pub(crate) fn is_allowlisted_agent_provider(provider: &str) -> bool {
    matches!(
        provider,
        crate::types::AGENT_PROVIDER_CODEX
            | crate::types::AGENT_PROVIDER_OPENCODE
            | crate::types::AGENT_PROVIDER_PI
            | crate::types::AGENT_PROVIDER_CLAUDE
    )
}

pub(crate) fn agent_provider_app_search_path() -> Option<OsString> {
    build_agent_provider_search_path(
        env::var_os("PATH").as_deref(),
        env::var_os("HOME").as_deref(),
    )
}

pub(crate) fn build_agent_provider_search_path(
    path_var: Option<&OsStr>,
    home_var: Option<&OsStr>,
) -> Option<OsString> {
    let mut paths = Vec::new();

    if let Some(path_var) = path_var {
        for path in env::split_paths(path_var) {
            push_unique_existing_directory(&mut paths, path);
        }
    }

    if let Some(home_var) = home_var {
        let home = PathBuf::from(home_var);
        for directory in AGENT_PROVIDER_HOME_BIN_DIRS {
            push_unique_existing_directory(&mut paths, home.join(directory));
        }
    }

    for directory in AGENT_PROVIDER_GUI_SEARCH_DIRS {
        push_unique_existing_directory(&mut paths, PathBuf::from(directory));
    }

    env::join_paths(paths).ok()
}

#[cfg(test)]
pub(crate) fn build_agent_provider_search_path_dirs(
    path_var: Option<&OsStr>,
    home_var: Option<&OsStr>,
) -> Vec<String> {
    let mut paths = Vec::new();

    if let Some(path_var) = path_var {
        for path in env::split_paths(path_var) {
            push_unique_existing_directory(&mut paths, path);
        }
    }

    if let Some(home_var) = home_var {
        let home = PathBuf::from(home_var);
        for directory in AGENT_PROVIDER_HOME_BIN_DIRS {
            push_unique_existing_directory(&mut paths, home.join(directory));
        }
    }

    for directory in AGENT_PROVIDER_GUI_SEARCH_DIRS {
        push_unique_existing_directory(&mut paths, PathBuf::from(directory));
    }

    paths
        .into_iter()
        .map(|path| path.to_string_lossy().to_string())
        .collect()
}

pub(crate) fn agent_provider_search_path_dirs_from_path_env(
    path_var: Option<&OsStr>,
) -> Vec<String> {
    let mut paths = Vec::new();

    if let Some(path_var) = path_var {
        for path in env::split_paths(path_var) {
            push_unique_existing_directory(&mut paths, path);
        }
    }

    paths
        .into_iter()
        .map(|path| path.to_string_lossy().to_string())
        .collect()
}

pub(crate) fn push_unique_existing_directory(paths: &mut Vec<PathBuf>, path: PathBuf) {
    if !path.is_dir() || paths.iter().any(|candidate| candidate == &path) {
        return;
    }

    paths.push(path);
}

pub(crate) fn is_executable_file(path: &Path) -> bool {
    let Ok(metadata) = fs::metadata(path) else {
        return false;
    };

    if !metadata.is_file() {
        return false;
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;

        metadata.permissions().mode() & 0o111 != 0
    }

    #[cfg(not(unix))]
    {
        true
    }
}

pub(crate) fn current_time_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().min(u64::MAX as u128) as u64)
        .unwrap_or(0)
}

pub(crate) fn build_workspace_directory(path: &Path) -> Result<WorkspaceTreeEntry, String> {
    let name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or_else(|| path.to_str().unwrap_or("workspace"))
        .to_string();
    let mut children = Vec::new();
    let mut children_truncated = false;

    let mut entries = fs::read_dir(path)
        .map_err(|err| format!("Cannot list workspace folder contents: {err}"))?
        .map(|entry| {
            let entry =
                entry.map_err(|err| format!("Cannot list workspace folder contents: {err}"))?;
            let file_type = entry
                .file_type()
                .map_err(|err| format!("Cannot inspect workspace entry: {err}"))?;
            Ok((entry, file_type))
        })
        .collect::<Result<Vec<_>, String>>()?;

    entries.sort_by(|(left, left_type), (right, right_type)| {
        let left_is_dir = left_type.is_dir();
        let right_is_dir = right_type.is_dir();

        right_is_dir
            .cmp(&left_is_dir)
            .then_with(|| left.file_name().cmp(&right.file_name()))
    });

    for (entry, file_type) in entries {
        let child_path = entry.path();
        let child_name = entry.file_name().to_string_lossy().to_string();

        if file_type.is_dir() && should_skip_workspace_dir(&child_name) {
            continue;
        }

        if !file_type.is_dir() && !file_type.is_file() {
            continue;
        }

        if children.len() >= MAX_WORKSPACE_ENTRIES {
            children_truncated = true;
            continue;
        }

        children.push(WorkspaceTreeEntry {
            name: child_name,
            path: child_path.to_string_lossy().to_string(),
            kind: if file_type.is_dir() {
                WorkspaceEntryKind::Directory
            } else {
                WorkspaceEntryKind::File
            },
            children: Vec::new(),
            children_loaded: file_type.is_file(),
            children_truncated: false,
        });
    }

    Ok(WorkspaceTreeEntry {
        name,
        path: path.to_string_lossy().to_string(),
        kind: WorkspaceEntryKind::Directory,
        children,
        children_loaded: true,
        children_truncated,
    })
}

pub(crate) fn should_skip_workspace_dir(name: &str) -> bool {
    name.starts_with('.') || EXCLUDED_WORKSPACE_DIRS.contains(&name)
}

pub(crate) fn has_external_change(metadata: &fs::Metadata, expected_fingerprint: &str) -> bool {
    metadata_fingerprint(metadata) != expected_fingerprint
}

pub(crate) fn looks_binary(path: &Path) -> Result<bool, String> {
    let mut file = File::open(path).map_err(|err| format!("Cannot inspect file: {err}"))?;
    let mut buffer = Vec::new();
    std::io::Read::by_ref(&mut file)
        .take(BINARY_SNIFF_BYTES)
        .read_to_end(&mut buffer)
        .map_err(|err| format!("Cannot inspect file contents: {err}"))?;

    Ok(buffer.contains(&0))
}

pub(crate) fn detect_line_ending(bytes: &[u8]) -> String {
    let mut crlf_count = 0;
    let mut lf_count = 0;
    let mut previous = None;

    for byte in bytes {
        if *byte == b'\n' {
            lf_count += 1;

            if previous == Some(b'\r') {
                crlf_count += 1;
            }
        }

        previous = Some(*byte);
    }

    let lone_lf_count = lf_count - crlf_count;

    if crlf_count > lone_lf_count {
        "crlf".to_string()
    } else {
        "lf".to_string()
    }
}

pub(crate) fn normalize_line_endings(contents: &str, requested_line_ending: &str) -> String {
    let line_ending = line_ending_for_save(requested_line_ending);

    if line_ending == "lf" {
        return contents.replace("\r\n", "\n");
    }

    let lf_contents = contents.replace("\r\n", "\n");
    lf_contents.replace('\n', "\r\n")
}

pub(crate) fn line_ending_for_save(requested_line_ending: &str) -> &'static str {
    if requested_line_ending == "crlf" {
        "crlf"
    } else {
        "lf"
    }
}

// `text_encoding` is a small set of helpers for the editor's encoding
// selector. The supported set is intentionally narrow: UTF-8 (no
// BOM), UTF-8 with BOM, Windows Shift-JIS, and EUC-JP. UTF-8 is the
// default for new files; the other labels are recognized on read and
// offered in the StatusBar selector. The on-disk round-trip is the
// contract — `detect_text_encoding` and `encode_text` are inverses for
// every supported label.

const UTF8_BOM: [u8; 3] = [0xEF, 0xBB, 0xBF];

pub(crate) fn detect_text_encoding(bytes: &[u8]) -> &'static str {
    if bytes.starts_with(&UTF8_BOM) {
        return "utf-8-bom";
    }

    let (_, _, utf8_malformed) = encoding_rs::UTF_8.decode(bytes);
    if !utf8_malformed {
        return "utf-8";
    }

    let (_, _, shift_jis_malformed) = encoding_rs::SHIFT_JIS.decode(bytes);
    if !shift_jis_malformed {
        return "shift-jis";
    }

    let (_, _, euc_jp_malformed) = encoding_rs::EUC_JP.decode(bytes);
    if !euc_jp_malformed {
        return "euc-jp";
    }

    // Fall back to UTF-8 even when it's lossy so the caller can show
    // a meaningful error rather than a panic. The caller checks the
    // declared label and rejects anything we couldn't decode cleanly.
    "utf-8"
}

pub(crate) fn encode_text(contents: &str, encoding: &str) -> Result<Vec<u8>, String> {
    match encoding_for_save(encoding) {
        "utf-8" => Ok(contents.as_bytes().to_vec()),
        "utf-8-bom" => {
            let mut out = UTF8_BOM.to_vec();
            out.extend_from_slice(contents.as_bytes());
            Ok(out)
        }
        "shift-jis" => {
            let (bytes, _, unmappable) = encoding_rs::SHIFT_JIS.encode(contents);
            if unmappable {
                return Err(
                    "Some characters cannot be encoded as Shift-JIS. Switch the encoding to UTF-8 before saving."
                        .to_string(),
                );
            }
            Ok(bytes.into_owned())
        }
        "euc-jp" => {
            let (bytes, _, unmappable) = encoding_rs::EUC_JP.encode(contents);
            if unmappable {
                return Err(
                    "Some characters cannot be encoded as EUC-JP. Switch the encoding to UTF-8 before saving."
                        .to_string(),
                );
            }
            Ok(bytes.into_owned())
        }
        other => Err(format!("Unsupported text encoding: {other}")),
    }
}

pub(crate) fn encoding_for_save(requested_encoding: &str) -> &'static str {
    match requested_encoding {
        "utf-8-bom" => "utf-8-bom",
        "shift-jis" => "shift-jis",
        "euc-jp" => "euc-jp",
        // "utf-8" and any unknown / future label collapse to the UTF-8
        // literal so the storage key is always one of the four
        // supported values.
        _ => "utf-8",
    }
}

// `decode_text_bytes` decodes the raw bytes using the encoding that
// `detect_text_encoding` already validated. The caller is expected to
// detect first, then decode with the same label. The labels "utf-8"
// and "utf-8-bom" use the UTF-8 codec; "shift-jis" / "euc-jp" use
// their respective codecs. The decode is required to be lossless —
// any malformed / unmappable sequences are returned as an error so
// the file open path surfaces a clean message instead of silently
// injecting U+FFFD.
//
// For "utf-8-bom", the leading 3-byte BOM is stripped from the input
// before decoding so the in-memory string never contains U+FEFF. The
// BOM is re-prepended on save by `encode_text` based on the encoding
// label, which keeps the in-memory buffer clean and the on-disk
// bytes correct in a single round-trip.
pub(crate) fn decode_text_bytes<'a>(
    bytes: &'a [u8],
    encoding: &str,
) -> Result<std::borrow::Cow<'a, str>, String> {
    let label = encoding_for_save(encoding);
    let (codec, label_for_error) = match label {
        "utf-8" | "utf-8-bom" => (encoding_rs::UTF_8, "UTF-8"),
        "shift-jis" => (encoding_rs::SHIFT_JIS, "Shift-JIS"),
        "euc-jp" => (encoding_rs::EUC_JP, "EUC-JP"),
        _ => {
            return Err(format!("Unsupported text encoding: {label}"));
        }
    };
    let body: &[u8] = if label == "utf-8-bom" && bytes.starts_with(&UTF8_BOM) {
        &bytes[UTF8_BOM.len()..]
    } else {
        bytes
    };
    let (decoded, malformed) = codec.decode_without_bom_handling(body);
    if malformed {
        return Err(format!("File is not readable as {label_for_error} text."));
    }
    Ok(decoded)
}

pub(crate) fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "Cannot save a file without a parent directory.".to_string())?;
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "Cannot save a file with an invalid name.".to_string())?;
    let temp_path = parent.join(format!(".{file_name}.hazakura-note.tmp"));

    let mut temp_created = false;
    let write_result = (|| -> Result<(), String> {
        let mut temp_file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temp_path)
            .map_err(|err| format!("Cannot create temp file: {err}"))?;
        temp_created = true;
        temp_file
            .write_all(bytes)
            .map_err(|err| format!("Cannot write temp file: {err}"))?;
        temp_file
            .sync_all()
            .map_err(|err| format!("Cannot sync temp file: {err}"))?;

        fs::rename(&temp_path, path).map_err(|err| format!("Cannot replace saved file: {err}"))
    })();

    if write_result.is_err() && temp_created {
        let _ = fs::remove_file(&temp_path);
    }

    write_result?;

    Ok(())
}

pub(crate) fn write_new_file(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(|err| format!("Cannot create file: {err}"))?;

    file.write_all(bytes)
        .map_err(|err| format!("Cannot write file: {err}"))?;
    file.sync_all()
        .map_err(|err| format!("Cannot sync file: {err}"))?;

    Ok(())
}

pub(crate) fn modified_ms(metadata: &fs::Metadata) -> Option<u64> {
    metadata
        .modified()
        .ok()
        .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
        .and_then(|duration| u64::try_from(duration.as_millis()).ok())
}
pub(crate) fn metadata_fingerprint(metadata: &fs::Metadata) -> String {
    let modified_ns = metadata
        .modified()
        .ok()
        .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_nanos().to_string())
        .unwrap_or_else(|| "unknown".to_string());

    format!("{}:{modified_ns}", metadata.len())
}
