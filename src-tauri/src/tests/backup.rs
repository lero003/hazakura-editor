// Tests for the auto-backup command surface (save/read/prune).
// Covers in-workspace writes, the workspace-boundary guard, and
// the symlinked `.hazakura/backups` rejection on unix.
use super::*;

#[test]
fn auto_backup_writes_and_reads_inside_workspace_backup_dir() {
    let dir = unique_test_dir("auto_backup_safe");
    fs::create_dir_all(dir.join("notes")).expect("create test dir");

    let backup_path =
        auto_backup::save_auto_backup(&dir.to_string_lossy(), "notes/today.md", "# Draft\n")
            .expect("save backup");

    let backup_name = Path::new(&backup_path)
        .file_name()
        .and_then(|name| name.to_str())
        .expect("backup file name");
    let content =
        auto_backup::read_auto_backup(&dir.to_string_lossy(), "notes/today.md", backup_name)
            .expect("read backup");

    assert_eq!(content, "# Draft\n");
    assert!(backup_path.contains(".hazakura/backups/notes/today.md/"));

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn auto_backup_rejects_paths_outside_workspace_boundary() {
    let dir = unique_test_dir("auto_backup_boundary");
    fs::create_dir_all(&dir).expect("create test dir");

    let absolute_err =
        auto_backup::save_auto_backup(&dir.to_string_lossy(), "/tmp/outside.md", "# Draft\n")
            .expect_err("absolute backup path should be rejected");
    assert!(absolute_err.contains("inside the workspace"));

    let parent_err =
        auto_backup::save_auto_backup(&dir.to_string_lossy(), "../outside.md", "# Draft\n")
            .expect_err("parent backup path should be rejected");
    assert!(parent_err.contains("inside the workspace"));

    let read_err =
        auto_backup::read_auto_backup(&dir.to_string_lossy(), "notes/today.md", "../outside.bak")
            .expect_err("backup name with separator should be rejected");
    assert!(read_err.contains("path separators"));

    let _ = fs::remove_dir_all(dir);
}

#[cfg(unix)]
#[test]
fn auto_backup_rejects_symlinked_backup_directory() {
    let dir = unique_test_dir("auto_backup_symlink");
    let outside = unique_test_dir("auto_backup_symlink_outside");
    fs::create_dir_all(&dir).expect("create test dir");
    fs::create_dir_all(&outside).expect("create outside dir");
    std::os::unix::fs::symlink(&outside, dir.join(".hazakura")).expect("create symlink");

    let err = auto_backup::save_auto_backup(&dir.to_string_lossy(), "note.md", "# Draft\n")
        .expect_err("symlinked backup directory should be rejected");

    assert!(err.contains("symlinks"), "{err}");

    let _ = fs::remove_dir_all(dir);
    let _ = fs::remove_dir_all(outside);
}

#[test]
fn auto_backup_prune_keeps_only_recent_files() {
    let dir = unique_test_dir("auto_backup_prune");
    fs::create_dir_all(&dir).expect("create test dir");

    // Write 5 backups. Each backup filename embeds a
    // seconds-resolution timestamp, so we need >1s between
    // writes for the filenames (and therefore the files) to
    // differ. 1.1s is enough on every supported platform.
    for index in 0..5 {
        auto_backup::save_auto_backup(
            &dir.to_string_lossy(),
            "note.md",
            format!("# v{index}\n").as_str(),
        )
        .expect("save backup");
        std::thread::sleep(Duration::from_millis(1100));
    }

    let backup_dir = dir.join(".hazakura").join("backups").join("note.md");

    let deleted = auto_backup::prune_auto_backups(&dir.to_string_lossy(), "note.md", 2)
        .expect("prune backups");

    assert_eq!(deleted, 3, "prune should keep the 2 newest of 5");
    let remaining: Vec<PathBuf> = fs::read_dir(&backup_dir)
        .expect("read backup dir after prune")
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let path = entry.path();
            if path.is_file() {
                Some(path)
            } else {
                None
            }
        })
        .collect();
    assert_eq!(remaining.len(), 2, "prune should leave 2 files behind");

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn auto_backup_prune_returns_zero_when_backup_dir_is_missing() {
    let dir = unique_test_dir("auto_backup_prune_empty");
    fs::create_dir_all(&dir).expect("create test dir");

    let deleted = auto_backup::prune_auto_backups(&dir.to_string_lossy(), "missing/note.md", 5)
        .expect("prune empty dir should be a no-op");

    assert_eq!(deleted, 0);

    let _ = fs::remove_dir_all(dir);
}
