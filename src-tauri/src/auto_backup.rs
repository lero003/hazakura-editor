use crate::types::*;
use crate::util::*;
use std::fs;
use std::io::ErrorKind;
use std::path::{Component, Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

/// Save an auto-backup of a file to
/// `.hazakura/backups/<relative-path>/hazakura-backup-<timestamp>.bak`.
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

    if let Some(existing_path) = latest_backup_path_with_content(&backup_dir, content)? {
        return Ok(existing_path.to_string_lossy().to_string());
    }

    let timestamp = current_timestamp_for_filename();
    let backup_path = unique_backup_path(&backup_dir, &timestamp)?;
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

    files.sort_by(|a, b| {
        b.1.cmp(&a.1)
            .then_with(|| file_name_for_sort(&b.0).cmp(&file_name_for_sort(&a.0)))
    });
    Ok(files)
}

fn unique_backup_path(backup_dir: &Path, timestamp: &str) -> Result<PathBuf, String> {
    for collision_index in 0..10_000 {
        let file_name = if collision_index == 0 {
            format!("hazakura-backup-{timestamp}.bak")
        } else {
            format!("hazakura-backup-{timestamp}_{collision_index:04}.bak")
        };
        let path = backup_dir.join(file_name);
        if !path.exists() {
            return Ok(path);
        }
    }

    Err("Cannot choose a unique backup file name.".to_string())
}

fn latest_backup_path_with_content(
    backup_dir: &Path,
    content: &str,
) -> Result<Option<PathBuf>, String> {
    let Some((latest_path, _)) = collect_backup_files_sorted(backup_dir)?.into_iter().next() else {
        return Ok(None);
    };

    reject_symlink(&latest_path)?;
    let Ok(latest_content) = fs::read_to_string(&latest_path) else {
        return Ok(None);
    };

    if latest_content == content {
        return Ok(Some(latest_path));
    }

    Ok(None)
}

fn file_name_for_sort(path: &Path) -> String {
    path.file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_default()
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

/// Move an existing backup directory from the old relative path
/// to the new one, keeping the captured backup files attached to
/// the new path. No-op if the source backup dir is
/// missing (freshly created or already cleaned up) or if source
/// and destination resolve to the same path. Refuses to clobber
/// a backup dir that already exists at the destination.
///
/// The function is intentionally single-file: folder descendants
/// are handled by the caller (folder rekey fans out to every
/// descendant's backup dir).
pub(crate) fn rekey_auto_backup_dir(
    workspace_root: &str,
    old_relative_file_path: &str,
    new_relative_file_path: &str,
) -> Result<(), String> {
    let old_dir = backup_dir_for(workspace_root, old_relative_file_path)?;
    if !old_dir.is_dir() {
        return Ok(());
    }

    let new_dir = backup_dir_for(workspace_root, new_relative_file_path)?;
    if new_dir == old_dir {
        return Ok(());
    }
    if new_dir.exists() {
        return Err("Backup directory already exists at the new path.".to_string());
    }

    if let Some(parent) = new_dir.parent() {
        fs::create_dir_all(parent).map_err(|err| format!("Cannot prepare backup parent: {err}"))?;
    }

    fs::rename(&old_dir, &new_dir).map_err(|err| format!("Cannot rekey backup dir: {err}"))
}

/// Remove the backup directory for a relative file path. No-op
/// if the backup dir is missing. Refuses to follow a symlinked
/// backup dir off the workspace; callers should treat the
/// "symlink" case as "no backup to remove" since `save` would
/// also have rejected the symlinked tree.
pub(crate) fn remove_auto_backup_dir(
    workspace_root: &str,
    relative_file_path: &str,
) -> Result<(), String> {
    let dir = backup_dir_for(workspace_root, relative_file_path)?;
    if !dir.is_dir() {
        return Ok(());
    }
    fs::remove_dir_all(&dir).map_err(|err| format!("Cannot remove backup dir: {err}"))
}

/// Walk every backup directory under
/// `<workspace>/.hazakura/backups/<old_prefix>/` and rekey it
/// to its counterpart under `<workspace>/.hazakura/backups/<new_prefix>/`.
/// No-op if the source backup tree is missing or empty. Used by
/// folder rename / move so every descendant's backup dir
/// follows the new folder location. The empty source dir is
/// cleaned up after the fan-out so the workspace's
/// `.hazakura/backups/` tree mirrors the actual workspace.
pub(crate) fn rekey_auto_backup_tree(
    workspace_root: &str,
    old_prefix: &str,
    new_prefix: &str,
) -> Result<(), String> {
    let old_root = backup_dir_for(workspace_root, old_prefix)?;
    if !old_root.is_dir() {
        return Ok(());
    }

    let entries: Vec<PathBuf> = fs::read_dir(&old_root)
        .map_err(|err| format!("Cannot list backup tree root: {err}"))?
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let path = entry.path();
            if path.is_dir() {
                Some(path)
            } else {
                None
            }
        })
        .collect();

    for entry_dir in entries {
        let name = entry_dir
            .file_name()
            .and_then(|name| name.to_str())
            .ok_or_else(|| "Backup tree entry has an invalid name.".to_string())?;
        let old_relative = format!("{old_prefix}/{name}");
        let new_relative = format!("{new_prefix}/{name}");
        rekey_auto_backup_dir(workspace_root, &old_relative, &new_relative)?;
    }

    let _ = fs::remove_dir(&old_root);
    Ok(())
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
    // Q-STR-5: reuse shared path containment (preserve backup-specific wording).
    ensure_path_inside_workspace_root(path, &PathBuf::from(workspace_root)).map_err(|err| {
        if err.contains("outside the workspace root") {
            "Backup path must stay inside the workspace.".to_string()
        } else {
            format!("Cannot verify backup path: {err}")
        }
    })?;
    Ok(())
}

fn current_timestamp_for_filename() -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let secs = now.as_secs();
    let millis = now.subsec_millis();
    // Format: YYYYMMDD_HHMMSS_mmm
    // We can't use chrono, so do a simple calculation
    let (year, month, day, hour, min, sec) = timestamp_components(secs);
    format!("{year}{month:02}{day:02}_{hour:02}{min:02}{sec:02}_{millis:03}")
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
