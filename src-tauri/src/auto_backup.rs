use crate::types::*;
use crate::util::*;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

/// Save an auto-backup of a file to `.hazakura/backups/<relative-path>/<timestamp>_<filename>`.
/// Returns the backup file path on success.
pub(crate) fn save_auto_backup(
    workspace_root: &str,
    relative_file_path: &str,
    content: &str,
) -> Result<String, String> {
    let root = PathBuf::from(workspace_root);
    ensure_workspace_root(&root)?;

    let backup_dir = root.join(".hazakura").join("backups").join(relative_file_path);
    fs::create_dir_all(&backup_dir)
        .map_err(|err| format!("Cannot create backup directory: {err}"))?;

    let timestamp = current_timestamp_for_filename();
    let file_name = Path::new(relative_file_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unnamed");

    let backup_path = backup_dir.join(format!("{timestamp}_{file_name}.bak"));
    atomic_write(&backup_path, content.as_bytes())?;

    Ok(backup_path.to_string_lossy().to_string())
}

/// List all auto-backup entries for a given file.
/// Returns a list of `{ path, name, modified_at_ms, size }`.
pub(crate) fn list_auto_backups(
    workspace_root: &str,
    relative_file_path: &str,
) -> Result<Vec<AutoBackupEntry>, String> {
    let root = PathBuf::from(workspace_root);
    let backup_dir = root.join(".hazakura").join("backups").join(relative_file_path);

    if !backup_dir.is_dir() {
        return Ok(Vec::new());
    }

    let mut entries: Vec<AutoBackupEntry> = fs::read_dir(&backup_dir)
        .map_err(|err| format!("Cannot list backups: {err}"))?
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let path = entry.path();
            if !path.is_file() {
                return None;
            }
            let metadata = fs::metadata(&path).ok()?;
            let name = entry.file_name().to_string_lossy().to_string();
            let modified_at_ms = modified_ms(&metadata)?;
            let size = metadata.len();
            Some(AutoBackupEntry {
                path: path.to_string_lossy().to_string(),
                name,
                modified_at_ms,
                size,
            })
        })
        .collect();

    // Sort by modified time descending (newest first)
    entries.sort_by(|a, b| b.modified_at_ms.cmp(&a.modified_at_ms));

    Ok(entries)
}

/// Read the content of a backup file.
pub(crate) fn read_auto_backup(path: &str) -> Result<String, String> {
    fs::read_to_string(path).map_err(|err| format!("Cannot read backup: {err}"))
}

/// Delete old backups, keeping only the `keep_count` most recent.
/// Returns the number of deleted files.
pub(crate) fn prune_auto_backups(
    workspace_root: &str,
    relative_file_path: &str,
    keep_count: usize,
) -> Result<usize, String> {
    let root = PathBuf::from(workspace_root);
    let backup_dir = root.join(".hazakura").join("backups").join(relative_file_path);

    if !backup_dir.is_dir() {
        return Ok(0);
    }

    let mut files: Vec<PathBuf> = fs::read_dir(&backup_dir)
        .map_err(|err| format!("Cannot list backups: {err}"))?
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let path = entry.path();
            if path.is_file() { Some(path) } else { None }
        })
        .collect();

    // Sort by modified time descending (newest first)
    files.sort_by(|a, b| {
        let a_m = fs::metadata(a).ok().and_then(|m| modified_ms(&m)).unwrap_or(0);
        let b_m = fs::metadata(b).ok().and_then(|m| modified_ms(&m)).unwrap_or(0);
        b_m.cmp(&a_m)
    });

    let mut deleted = 0;
    for file in files.iter().skip(keep_count) {
        if fs::remove_file(file).is_ok() {
            deleted += 1;
        }
    }

    Ok(deleted)
}

fn current_timestamp_for_filename() -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let secs = now.as_secs();
    // Format: YYYYMMDD_HHMMSS
    // We can't use chrono, so do a simple calculation
    let (year, month, day, hour, min, sec) = timestamp_components(secs);
    format!("{year}{month:02}{day:02}_{hour:02}{min:02}{sec:02}")
}

fn timestamp_components(secs: u64) -> (u64, u64, u64, u64, u64, u64) {
    // Days since epoch
    let days = secs / 86400;
    let time_secs = secs % 86400;
    let hour = time_secs / 3600;
    let min = (time_secs % 3600) / 60;
    let sec = time_secs % 60;

    // Simple algorithm for Gregorian date from days since 1970-01-01
    let mut y = 1970i64;
    let mut d = days as i64;
    loop {
        let days_in_year = if is_leap_year(y) { 366 } else { 365 };
        if d < days_in_year {
            break;
        }
        d -= days_in_year;
        y += 1;
    }

    let leap = is_leap_year(y);
    let month_days: [i64; 12] = [
        31,
        if leap { 29 } else { 28 },
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
    ];

    let mut month = 0usize;
    for (i, &md) in month_days.iter().enumerate() {
        if d < md {
            month = i;
            break;
        }
        d -= md;
    }

    (
        y as u64,
        (month + 1) as u64,
        (d + 1) as u64,
        hour,
        min,
        sec,
    )
}

fn is_leap_year(y: i64) -> bool {
    (y % 4 == 0 && y % 100 != 0) || y % 400 == 0
}
