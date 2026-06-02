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
