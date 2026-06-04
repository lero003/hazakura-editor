use crate::types::*;
use crate::util::*;
use std::fs;
use std::io::ErrorKind;
use std::path::{Component, Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

/// Save an auto-backup of a file to `.hazakura/backups/<relative-path>/<timestamp>_<filename>`.
/// Returns the backup file path on success.
pub(crate) fn save_auto_backup(
    workspace_root: &str,
    relative_file_path: &str,
    content: &str,
) -> Result<String, String> {
    let backup_dir = backup_dir_for(workspace_root, relative_file_path)?;
    fs::create_dir_all(&backup_dir)
        .map_err(|err| format!("Cannot create backup directory: {err}"))?;
    ensure_path_stays_inside_workspace(workspace_root, &backup_dir)?;

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
    let backup_dir = backup_dir_for(workspace_root, relative_file_path)?;
    let files = collect_backup_files_sorted(&backup_dir)?;

    Ok(files
        .into_iter()
        .filter_map(|(path, modified_at_ms)| {
            let metadata = fs::metadata(&path).ok()?;
            let name = path
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("unnamed")
                .to_string();
            Some(AutoBackupEntry {
                path: path.to_string_lossy().to_string(),
                name,
                modified_at_ms,
                size: metadata.len(),
            })
        })
        .collect())
}

/// Read the content of a backup file.
pub(crate) fn read_auto_backup(
    workspace_root: &str,
    relative_file_path: &str,
    backup_name: &str,
) -> Result<String, String> {
    let backup_dir = backup_dir_for(workspace_root, relative_file_path)?;
    let backup_file_name = safe_backup_file_name(backup_name)?;
    let backup_path = backup_dir.join(backup_file_name);
    reject_symlink(&backup_path)?;

    fs::read_to_string(backup_path).map_err(|err| format!("Cannot read backup: {err}"))
}

/// Delete old backups, keeping only the `keep_count` most recent.
/// Returns the number of deleted files.
pub(crate) fn prune_auto_backups(
    workspace_root: &str,
    relative_file_path: &str,
    keep_count: usize,
) -> Result<usize, String> {
    let backup_dir = backup_dir_for(workspace_root, relative_file_path)?;
    let files = collect_backup_files_sorted(&backup_dir)?;

    let mut deleted = 0;
    for (path, _) in files.iter().skip(keep_count) {
        if fs::remove_file(path).is_ok() {
            deleted += 1;
        }
    }

    Ok(deleted)
}

// Walk a backup directory and return each regular file as
// (path, modified_ms), sorted by modified time descending. A
// missing or non-directory backup dir is reported as an empty
// list so callers don't have to special-case it. Pulling the
// metadata from the `read_dir` entry (rather than a second
// `fs::metadata` syscall per file) keeps both the list and
// prune paths on a single stat-per-file budget.
fn collect_backup_files_sorted(backup_dir: &Path) -> Result<Vec<(PathBuf, u64)>, String> {
    if !backup_dir.is_dir() {
        return Ok(Vec::new());
    }

    let mut files: Vec<(PathBuf, u64)> = fs::read_dir(backup_dir)
        .map_err(|err| format!("Cannot list backups: {err}"))?
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let metadata = entry.metadata().ok()?;
            if !metadata.is_file() {
                return None;
            }
            let modified_at_ms = modified_ms(&metadata).unwrap_or(0);
            Some((entry.path(), modified_at_ms))
        })
        .collect();

    files.sort_by(|a, b| b.1.cmp(&a.1));
    Ok(files)
}

fn backup_dir_for(workspace_root: &str, relative_file_path: &str) -> Result<PathBuf, String> {
    let root = PathBuf::from(workspace_root);
    let canonical_root = ensure_workspace_root(&root)?;
    let safe_relative = safe_relative_file_path(relative_file_path)?;
    let backup_relative = Path::new(".hazakura").join("backups").join(&safe_relative);
    reject_existing_symlink_components(&canonical_root, &backup_relative)?;

    Ok(canonical_root
        .join(".hazakura")
        .join("backups")
        .join(safe_relative))
}

fn safe_relative_file_path(relative_file_path: &str) -> Result<PathBuf, String> {
    let path = Path::new(relative_file_path);

    if relative_file_path.trim().is_empty() {
        return Err("Backup path is empty.".to_string());
    }

    let mut safe_path = PathBuf::new();
    for component in path.components() {
        match component {
            Component::Normal(part) => safe_path.push(part),
            _ => return Err("Backup path must stay inside the workspace.".to_string()),
        }
    }

    if safe_path.as_os_str().is_empty() {
        return Err("Backup path is empty.".to_string());
    }

    Ok(safe_path)
}

fn safe_backup_file_name(backup_name: &str) -> Result<&str, String> {
    let path = Path::new(backup_name);

    if backup_name.trim().is_empty()
        || path.components().count() != 1
        || !matches!(path.components().next(), Some(Component::Normal(_)))
    {
        return Err("Backup file name must not contain path separators.".to_string());
    }

    Ok(backup_name)
}

fn reject_existing_symlink_components(
    canonical_root: &Path,
    relative_path: &Path,
) -> Result<(), String> {
    let mut current = canonical_root.to_path_buf();

    for component in relative_path.components() {
        let Component::Normal(part) = component else {
            return Err("Backup path must stay inside the workspace.".to_string());
        };

        current.push(part);
        match fs::symlink_metadata(&current) {
            Ok(metadata) => {
                if metadata.file_type().is_symlink() {
                    return Err("Backup path must not contain symlinks.".to_string());
                }
            }
            Err(err) if err.kind() == ErrorKind::NotFound => return Ok(()),
            Err(err) => return Err(format!("Cannot inspect backup path: {err}")),
        }
    }

    Ok(())
}

fn reject_symlink(path: &Path) -> Result<(), String> {
    match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.file_type().is_symlink() => {
            Err("Backup path must not contain symlinks.".to_string())
        }
        Ok(_) => Ok(()),
        Err(err) if err.kind() == ErrorKind::NotFound => Ok(()),
        Err(err) => Err(format!("Cannot inspect backup path: {err}")),
    }
}

fn ensure_path_stays_inside_workspace(workspace_root: &str, path: &Path) -> Result<(), String> {
    let canonical_root = ensure_workspace_root(&PathBuf::from(workspace_root))?;
    let canonical_path =
        fs::canonicalize(path).map_err(|err| format!("Cannot verify backup path: {err}"))?;

    if !canonical_path.starts_with(&canonical_root) {
        return Err("Backup path must stay inside the workspace.".to_string());
    }

    Ok(())
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

    (y as u64, (month + 1) as u64, (d + 1) as u64, hour, min, sec)
}

fn is_leap_year(y: i64) -> bool {
    (y % 4 == 0 && y % 100 != 0) || y % 400 == 0
}
