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
    assert!(
        backup_name.starts_with("hazakura-backup-"),
        "backup file name should be app-owned, got: {backup_name}"
    );
    assert!(
        !backup_name.contains("today.md"),
        "backup file name should not look like the source document"
    );

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn auto_backup_keeps_rapid_same_second_snapshots_distinct() {
    let dir = unique_test_dir("auto_backup_same_second_unique");
    fs::create_dir_all(&dir).expect("create test dir");

    wait_for_start_of_second_window();

    let first = auto_backup::save_auto_backup(&dir.to_string_lossy(), "note.md", "# v1\n")
        .expect("save first backup");
    let second = auto_backup::save_auto_backup(&dir.to_string_lossy(), "note.md", "# v2\n")
        .expect("save second backup");

    assert_ne!(
        first, second,
        "rapid auto-backups must not overwrite an earlier same-second snapshot"
    );

    let entries =
        auto_backup::list_auto_backups(&dir.to_string_lossy(), "note.md").expect("list backups");
    assert_eq!(
        entries.len(),
        2,
        "both same-second snapshots should remain restorable"
    );

    let _ = fs::remove_dir_all(dir);
}

fn wait_for_start_of_second_window() {
    for _ in 0..250 {
        let elapsed = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("system time");
        if elapsed.subsec_millis() < 100 {
            return;
        }
        std::thread::sleep(Duration::from_millis(5));
    }
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

    for index in 0..5 {
        auto_backup::save_auto_backup(
            &dir.to_string_lossy(),
            "note.md",
            format!("# v{index}\n").as_str(),
        )
        .expect("save backup");
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

#[test]
fn auto_backup_rekey_moves_backup_dir_to_new_path() {
    let dir = unique_test_dir("auto_backup_rekey");
    fs::create_dir_all(&dir).expect("create test dir");

    auto_backup::save_auto_backup(&dir.to_string_lossy(), "notes/today.md", "# v1\n")
        .expect("save backup");
    auto_backup::save_auto_backup(&dir.to_string_lossy(), "notes/today.md", "# v2\n")
        .expect("save second backup");

    let old_dir = dir
        .join(".hazakura")
        .join("backups")
        .join("notes")
        .join("today.md");
    assert!(old_dir.is_dir(), "old backup dir should exist before rekey");

    auto_backup::rekey_auto_backup_dir(
        &dir.to_string_lossy(),
        "notes/today.md",
        "notes/yesterday.md",
    )
    .expect("rekey backup dir");

    assert!(
        !old_dir.exists(),
        "old backup dir should be gone after rekey"
    );
    let new_dir = dir
        .join(".hazakura")
        .join("backups")
        .join("notes")
        .join("yesterday.md");
    assert!(new_dir.is_dir(), "new backup dir should exist after rekey");

    let entries = auto_backup::list_auto_backups(&dir.to_string_lossy(), "notes/yesterday.md")
        .expect("list after rekey");
    assert_eq!(entries.len(), 2, "all backups should follow the rekey");

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn auto_backup_rekey_is_noop_when_source_backup_missing() {
    let dir = unique_test_dir("auto_backup_rekey_missing");
    fs::create_dir_all(&dir).expect("create test dir");

    auto_backup::rekey_auto_backup_dir(
        &dir.to_string_lossy(),
        "missing/note.md",
        "missing/renamed.md",
    )
    .expect("rekey with missing source should be a no-op");

    let new_dir = dir
        .join(".hazakura")
        .join("backups")
        .join("missing")
        .join("renamed.md");
    assert!(
        !new_dir.exists(),
        "no new backup dir should be created when source is missing"
    );

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn auto_backup_rekey_refuses_to_clobber_existing_destination_backup() {
    let dir = unique_test_dir("auto_backup_rekey_clobber");
    fs::create_dir_all(&dir).expect("create test dir");

    auto_backup::save_auto_backup(&dir.to_string_lossy(), "a/note.md", "# a\n").expect("save a");
    auto_backup::save_auto_backup(&dir.to_string_lossy(), "b/note.md", "# b\n").expect("save b");

    let err = auto_backup::rekey_auto_backup_dir(&dir.to_string_lossy(), "a/note.md", "b/note.md")
        .expect_err("rekey into an occupied backup dir should be rejected");

    assert!(err.contains("already exists"), "{err}");

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn auto_backup_remove_clears_backup_dir() {
    let dir = unique_test_dir("auto_backup_remove");
    fs::create_dir_all(&dir).expect("create test dir");

    auto_backup::save_auto_backup(&dir.to_string_lossy(), "note.md", "# v1\n")
        .expect("save backup");
    let backup_dir = dir.join(".hazakura").join("backups").join("note.md");
    assert!(backup_dir.is_dir());

    auto_backup::remove_auto_backup_dir(&dir.to_string_lossy(), "note.md")
        .expect("remove backup dir");

    assert!(!backup_dir.exists());

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn auto_backup_remove_is_noop_when_missing() {
    let dir = unique_test_dir("auto_backup_remove_missing");
    fs::create_dir_all(&dir).expect("create test dir");

    auto_backup::remove_auto_backup_dir(&dir.to_string_lossy(), "never/created.md")
        .expect("remove on missing should be a no-op");

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn auto_backup_tree_rekey_moves_every_descendant() {
    let dir = unique_test_dir("auto_backup_tree_rekey");
    fs::create_dir_all(&dir).expect("create test dir");

    auto_backup::save_auto_backup(&dir.to_string_lossy(), "notes/today.md", "# today\n")
        .expect("save today");
    auto_backup::save_auto_backup(&dir.to_string_lossy(), "notes/tomorrow.md", "# tomorrow\n")
        .expect("save tomorrow");

    let old_notes_root = dir.join(".hazakura").join("backups").join("notes");
    assert!(old_notes_root.is_dir());

    auto_backup::rekey_auto_backup_tree(&dir.to_string_lossy(), "notes", "archive")
        .expect("rekey backup tree");

    let new_archive_root = dir.join(".hazakura").join("backups").join("archive");
    assert!(new_archive_root.is_dir());
    assert!(
        !old_notes_root.exists(),
        "old backup root should be cleaned up after tree rekey"
    );

    let today = auto_backup::list_auto_backups(&dir.to_string_lossy(), "archive/today.md")
        .expect("list archive/today");
    let tomorrow = auto_backup::list_auto_backups(&dir.to_string_lossy(), "archive/tomorrow.md")
        .expect("list archive/tomorrow");
    assert_eq!(today.len(), 1);
    assert_eq!(tomorrow.len(), 1);

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn auto_backup_tree_rekey_is_noop_when_source_tree_missing() {
    let dir = unique_test_dir("auto_backup_tree_rekey_missing");
    fs::create_dir_all(&dir).expect("create test dir");

    auto_backup::rekey_auto_backup_tree(&dir.to_string_lossy(), "missing", "renamed")
        .expect("rekey on missing tree should be a no-op");

    let new_root = dir.join(".hazakura").join("backups").join("renamed");
    assert!(!new_root.exists());

    let _ = fs::remove_dir_all(dir);
}
