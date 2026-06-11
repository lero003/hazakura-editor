// Tests for the workspace command surface: tree listing, image
// open, paste/import image flow, and the assets-folder
// symlink-outside-workspace guard.
use super::*;

use std::fs::File;

#[test]
fn workspace_tree_skips_heavy_and_hidden_directories() {
    let dir = unique_test_dir("workspace_tree");
    fs::create_dir_all(dir.join("notes")).expect("create notes dir");
    fs::create_dir_all(dir.join("node_modules/pkg")).expect("create node_modules dir");
    fs::create_dir_all(dir.join(".git/objects")).expect("create git dir");
    fs::create_dir_all(dir.join("target/debug")).expect("create target dir");
    fs::create_dir_all(dir.join("dist/assets")).expect("create dist dir");
    fs::write(dir.join("notes/today.md"), "# Today\n").expect("write note");
    fs::write(dir.join("README.md"), "# Readme\n").expect("write readme");

    let tree = list_workspace_tree_with_label(MAIN_WINDOW_LABEL, dir.to_string_lossy().to_string())
        .expect("list workspace");
    let names = tree
        .children
        .iter()
        .map(|entry| entry.name.as_str())
        .collect::<Vec<_>>();

    assert!(names.contains(&"notes"));
    assert!(names.contains(&"README.md"));
    assert!(!names.contains(&"node_modules"));
    assert!(!names.contains(&".git"));
    assert!(!names.contains(&"target"));
    assert!(!names.contains(&"dist"));
    assert!(tree.children_loaded);
    assert!(!tree.children_truncated);

    let notes = tree
        .children
        .iter()
        .find(|entry| entry.name == "notes")
        .expect("notes dir");
    assert!(!notes.children_loaded);
    assert!(notes.children.is_empty());

    let notes_tree = list_workspace_directory_with_label(
        MAIN_WINDOW_LABEL,
        dir.to_string_lossy().to_string(),
        notes.path.to_string(),
    )
    .expect("list notes dir");
    assert_eq!(notes_tree.children[0].name, "today.md");
    assert!(notes_tree.children_loaded);

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn workspace_tree_uses_per_directory_cap_without_failing_root() {
    let dir = unique_test_dir("workspace_tree_cap");
    fs::create_dir_all(&dir).expect("create test dir");

    for index in 0..(MAX_WORKSPACE_ENTRIES + 5) {
        fs::write(dir.join(format!("{index:04}.md")), "# Note\n").expect("write note");
    }

    let tree = list_workspace_tree_with_label(MAIN_WINDOW_LABEL, dir.to_string_lossy().to_string())
        .expect("list workspace");

    assert_eq!(tree.children.len(), MAX_WORKSPACE_ENTRIES);
    assert!(tree.children_truncated);

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn workspace_directory_rejects_paths_outside_root() {
    let root = unique_test_dir("workspace_root");
    let outside = unique_test_dir("workspace_outside");
    fs::create_dir_all(&root).expect("create root dir");
    fs::create_dir_all(&outside).expect("create outside dir");

    let err = list_workspace_directory_with_label(
        MAIN_WINDOW_LABEL,
        root.to_string_lossy().to_string(),
        outside.to_string_lossy().to_string(),
    )
    .expect_err("outside folder should fail");

    assert!(err.contains("outside the workspace root"));

    let _ = fs::remove_dir_all(root);
    let _ = fs::remove_dir_all(outside);
}

#[test]
fn open_workspace_image_returns_data_url_for_supported_image() {
    let dir = unique_test_dir("workspace_image");
    fs::create_dir_all(&dir).expect("create test dir");
    let path = dir.join("tiny.png");
    fs::write(&path, b"\x89PNG\r\n\x1a\n").expect("write png fixture");

    let image = open_workspace_image_with_label(
        MAIN_WINDOW_LABEL,
        dir.to_string_lossy().to_string(),
        path.to_string_lossy().to_string(),
    )
    .expect("open workspace image");

    assert_eq!(image.name, "tiny.png");
    assert_eq!(image.data_url, "data:image/png;base64,iVBORw0KGgo=");

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn open_image_file_returns_data_url_without_workspace_root() {
    let outside = unique_test_dir("direct_image_outside_workspace");
    fs::create_dir_all(&outside).expect("create outside dir");
    let path = outside.join("tiny.png");
    fs::write(&path, b"\x89PNG\r\n\x1a\n").expect("write png fixture");

    let image = open_image_file_with_label(MAIN_WINDOW_LABEL, path.to_string_lossy().to_string())
        .expect("open direct image");

    assert_eq!(image.name, "tiny.png");
    assert_eq!(image.path, path.to_string_lossy());
    assert_eq!(image.data_url, "data:image/png;base64,iVBORw0KGgo=");

    let _ = fs::remove_dir_all(outside);
}

#[test]
fn open_workspace_image_accepts_supported_signatures_by_extension() {
    let dir = unique_test_dir("workspace_image_signatures");
    fs::create_dir_all(&dir).expect("create test dir");

    let cases = [
        (
            "tiny.jpeg",
            b"\xff\xd8\xff\xe0".as_slice(),
            "data:image/jpeg;base64,",
        ),
        ("tiny.gif", b"GIF89a".as_slice(), "data:image/gif;base64,"),
        (
            "tiny.webp",
            b"RIFF\x04\x00\x00\x00WEBP".as_slice(),
            "data:image/webp;base64,",
        ),
    ];

    for (file_name, bytes, expected_prefix) in cases {
        let path = dir.join(file_name);
        fs::write(&path, bytes).expect("write image fixture");

        let image = open_workspace_image_with_label(
            MAIN_WINDOW_LABEL,
            dir.to_string_lossy().to_string(),
            path.to_string_lossy().to_string(),
        )
        .expect("open workspace image");

        assert_eq!(image.name, file_name);
        assert!(
            image.data_url.starts_with(expected_prefix),
            "{}",
            image.data_url
        );
    }

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn open_workspace_image_rejects_paths_outside_root() {
    let root = unique_test_dir("workspace_image_root");
    let outside = unique_test_dir("workspace_image_outside");
    fs::create_dir_all(&root).expect("create root dir");
    fs::create_dir_all(&outside).expect("create outside dir");
    let outside_image = outside.join("outside.jpg");
    fs::write(&outside_image, b"fake jpg").expect("write outside image");

    let err = open_workspace_image_with_label(
        MAIN_WINDOW_LABEL,
        root.to_string_lossy().to_string(),
        outside_image.to_string_lossy().to_string(),
    )
    .expect_err("outside image should be rejected");

    assert!(err.contains("outside the workspace root"), "{err}");

    let _ = fs::remove_dir_all(root);
    let _ = fs::remove_dir_all(outside);
}

#[test]
fn open_workspace_image_rejects_supported_extension_with_non_image_bytes() {
    let dir = unique_test_dir("workspace_image_non_image");
    fs::create_dir_all(&dir).expect("create test dir");
    let path = dir.join("not-an-image.png");
    fs::write(&path, b"# Not an image\n").expect("write fake image");

    let err = open_workspace_image_with_label(
        MAIN_WINDOW_LABEL,
        dir.to_string_lossy().to_string(),
        path.to_string_lossy().to_string(),
    )
    .expect_err("non-image bytes should be rejected");

    assert!(
        err.contains("contents do not match a supported image type"),
        "{err}"
    );

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn open_workspace_image_rejects_extension_signature_mismatch() {
    let dir = unique_test_dir("workspace_image_mismatch");
    fs::create_dir_all(&dir).expect("create test dir");
    let path = dir.join("jpeg-bytes.png");
    fs::write(&path, b"\xff\xd8\xff\xe0").expect("write mismatched image");

    let err = open_workspace_image_with_label(
        MAIN_WINDOW_LABEL,
        dir.to_string_lossy().to_string(),
        path.to_string_lossy().to_string(),
    )
    .expect_err("mismatched extension and signature should be rejected");

    assert!(
        err.contains("contents do not match a supported image type"),
        "{err}"
    );

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn open_workspace_image_rejects_oversized_image_before_preview() {
    let dir = unique_test_dir("workspace_image_oversized");
    fs::create_dir_all(&dir).expect("create test dir");
    let path = dir.join("oversized.png");
    let file = File::create(&path).expect("create oversized image fixture");
    file.set_len(MAX_IMAGE_PREVIEW_BYTES + 1)
        .expect("resize oversized image fixture");

    let err = open_workspace_image_with_label(
        MAIN_WINDOW_LABEL,
        dir.to_string_lossy().to_string(),
        path.to_string_lossy().to_string(),
    )
    .expect_err("oversized image should be rejected");

    assert!(err.contains("preview limit of 20 MB"), "{err}");

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn save_pasted_image_writes_supported_image_inside_assets() {
    let dir = unique_test_dir("pasted_image");
    fs::create_dir_all(&dir).expect("create test dir");

    let relative = save_pasted_image_with_label(
        MAIN_WINDOW_LABEL,
        dir.to_string_lossy().to_string(),
        "iVBORw0KGgo=".to_string(),
        "../pasted.png".to_string(),
    )
    .expect("save pasted image");

    assert!(
        relative.starts_with("assets/") && relative.ends_with(".png"),
        "Expected assets/<hash>.png, got: {relative}",
    );
    assert!(
        dir.join(&relative).is_file(),
        "File should exist at {relative}",
    );

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn save_pasted_image_reuses_existing_hash_asset_for_duplicate_paste() {
    let dir = unique_test_dir("pasted_image_duplicate");
    fs::create_dir_all(&dir).expect("create test dir");

    let first = save_pasted_image_with_label(
        MAIN_WINDOW_LABEL,
        dir.to_string_lossy().to_string(),
        "iVBORw0KGgo=".to_string(),
        "first-name.png".to_string(),
    )
    .expect("save first pasted image");
    let second = save_pasted_image_with_label(
        MAIN_WINDOW_LABEL,
        dir.to_string_lossy().to_string(),
        "iVBORw0KGgo=".to_string(),
        "second-name.png".to_string(),
    )
    .expect("save duplicate pasted image");

    assert_eq!(first, second);

    let asset_files = fs::read_dir(dir.join("assets"))
        .expect("read assets dir")
        .filter_map(Result::ok)
        .filter(|entry| entry.path().is_file())
        .count();
    assert_eq!(asset_files, 1);

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn save_pasted_image_rejects_non_image_bytes() {
    let dir = unique_test_dir("pasted_non_image");
    fs::create_dir_all(&dir).expect("create test dir");

    let error = save_pasted_image_with_label(
        MAIN_WINDOW_LABEL,
        dir.to_string_lossy().to_string(),
        "SGVsbG8=".to_string(),
        "pasted.png".to_string(),
    )
    .expect_err("non-image paste should be rejected");

    assert!(error.contains("supported image type"), "{error}");

    let _ = fs::remove_dir_all(dir);
}

#[cfg(unix)]
#[test]
fn save_pasted_image_rejects_assets_symlink_outside_workspace() {
    use std::os::unix::fs::symlink;

    let root = unique_test_dir("pasted_symlink_root");
    let outside = unique_test_dir("pasted_symlink_outside");
    fs::create_dir_all(&root).expect("create root");
    fs::create_dir_all(&outside).expect("create outside");
    symlink(&outside, root.join("assets")).expect("create assets symlink");

    let error = save_pasted_image_with_label(
        MAIN_WINDOW_LABEL,
        root.to_string_lossy().to_string(),
        "iVBORw0KGgo=".to_string(),
        "pasted.png".to_string(),
    )
    .expect_err("assets symlink should be rejected");

    assert!(error.contains("outside the workspace root"), "{error}");
    assert!(!outside.join("pasted.png").exists());

    let _ = fs::remove_dir_all(root);
    let _ = fs::remove_dir_all(outside);
}

#[test]
fn import_image_from_path_writes_supported_image_inside_assets() {
    let root = unique_test_dir("import_image_root");
    let source_dir = unique_test_dir("import_image_source");
    fs::create_dir_all(&root).expect("create root");
    fs::create_dir_all(&source_dir).expect("create source dir");
    let source = source_dir.join("Dropped Image!.png");
    fs::write(
        &source,
        decode_base64("iVBORw0KGgo=").expect("decode png header"),
    )
    .expect("write source image");

    let relative = import_image_from_path_with_label(
        MAIN_WINDOW_LABEL,
        root.to_string_lossy().to_string(),
        source.to_string_lossy().to_string(),
    )
    .expect("import image");

    assert!(
        relative.starts_with("assets/") && relative.ends_with(".png"),
        "Expected assets/<hash>.png, got: {relative}",
    );
    assert!(
        root.join(&relative).is_file(),
        "File should exist at {relative}",
    );
    let _ = fs::remove_dir_all(root);
    let _ = fs::remove_dir_all(source_dir);
}

#[test]
fn import_image_from_path_rejects_non_image_bytes() {
    let root = unique_test_dir("import_non_image_root");
    let source_dir = unique_test_dir("import_non_image_source");
    fs::create_dir_all(&root).expect("create root");
    fs::create_dir_all(&source_dir).expect("create source dir");
    let source = source_dir.join("not-image.png");
    fs::write(&source, b"not an image").expect("write source file");

    let error = import_image_from_path_with_label(
        MAIN_WINDOW_LABEL,
        root.to_string_lossy().to_string(),
        source.to_string_lossy().to_string(),
    )
    .expect_err("non-image import should be rejected");

    assert!(error.contains("supported image type"), "{error}");

    let _ = fs::remove_dir_all(root);
    let _ = fs::remove_dir_all(source_dir);
}

#[cfg(unix)]
#[test]
fn import_image_from_path_rejects_assets_symlink_outside_workspace() {
    use std::os::unix::fs::symlink;

    let root = unique_test_dir("import_symlink_root");
    let outside = unique_test_dir("import_symlink_outside");
    let source_dir = unique_test_dir("import_symlink_source");
    fs::create_dir_all(&root).expect("create root");
    fs::create_dir_all(&outside).expect("create outside");
    fs::create_dir_all(&source_dir).expect("create source dir");
    symlink(&outside, root.join("assets")).expect("create assets symlink");
    let source = source_dir.join("pasted.png");
    fs::write(
        &source,
        decode_base64("iVBORw0KGgo=").expect("decode png header"),
    )
    .expect("write source image");

    let error = import_image_from_path_with_label(
        MAIN_WINDOW_LABEL,
        root.to_string_lossy().to_string(),
        source.to_string_lossy().to_string(),
    )
    .expect_err("assets symlink should be rejected");

    assert!(error.contains("outside the workspace root"), "{error}");
    assert!(!outside.join("pasted.png").exists());

    let _ = fs::remove_dir_all(root);
    let _ = fs::remove_dir_all(outside);
    let _ = fs::remove_dir_all(source_dir);
}

#[test]
fn workspace_tree_rejects_file_root() {
    let dir = unique_test_dir("workspace_file_root");
    fs::create_dir_all(&dir).expect("create test dir");
    let path = dir.join("note.md");
    fs::write(&path, "# Not a folder\n").expect("write file");

    let err = list_workspace_tree_with_label(MAIN_WINDOW_LABEL, path.to_string_lossy().to_string())
        .expect_err("file root should fail");

    assert!(err.contains("not a folder"));

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn rename_workspace_entry_renames_file_in_same_directory() {
    let root = unique_test_dir("rename_same_dir");
    fs::create_dir_all(&root).expect("create root");
    let src = root.join("old.md");
    let dst = root.join("new.md");
    fs::write(&src, "# old\n").expect("write src");

    rename_workspace_entry_with_label(
        MAIN_WINDOW_LABEL,
        &src.to_string_lossy(),
        &dst.to_string_lossy(),
        &root.to_string_lossy(),
    )
    .expect("rename within dir");

    assert!(!src.exists());
    assert!(dst.exists());
    assert_eq!(fs::read_to_string(&dst).expect("read renamed"), "# old\n");

    let _ = fs::remove_dir_all(root);
}

#[test]
fn rename_workspace_entry_rekeys_auto_backup_dir() {
    let root = unique_test_dir("rename_rekey_backup");
    fs::create_dir_all(&root).expect("create root");
    let src = root.join("old.md");
    let dst = root.join("new.md");
    fs::write(&src, "# old\n").expect("write src");

    crate::auto_backup::save_auto_backup(&root.to_string_lossy(), "old.md", "# v1\n")
        .expect("save backup before rename");
    let old_backup_dir = root.join(".hazakura").join("backups").join("old.md");
    assert!(old_backup_dir.is_dir());

    rename_workspace_entry_with_label(
        MAIN_WINDOW_LABEL,
        &src.to_string_lossy(),
        &dst.to_string_lossy(),
        &root.to_string_lossy(),
    )
    .expect("rename should rekey backup dir");

    assert!(!old_backup_dir.exists(), "old backup dir should be gone");
    let new_backup_dir = root.join(".hazakura").join("backups").join("new.md");
    assert!(
        new_backup_dir.is_dir(),
        "new backup dir should follow rename"
    );
    let entries = crate::auto_backup::list_auto_backups(&root.to_string_lossy(), "new.md")
        .expect("list after rekey");
    assert_eq!(entries.len(), 1, "backup should follow the rename");

    let _ = fs::remove_dir_all(root);
}

#[test]
fn move_workspace_entry_rekeys_auto_backup_dir() {
    let root = unique_test_dir("move_rekey_backup");
    let source_dir = root.join("notes");
    let dest_dir = root.join("archive");
    fs::create_dir_all(&source_dir).expect("create source");
    fs::create_dir_all(&dest_dir).expect("create dest");
    let src = source_dir.join("today.md");
    let dst = dest_dir.join("today.md");
    fs::write(&src, "# today\n").expect("write src");

    crate::auto_backup::save_auto_backup(&root.to_string_lossy(), "notes/today.md", "# v1\n")
        .expect("save backup before move");

    let old_backup_dir = root
        .join(".hazakura")
        .join("backups")
        .join("notes")
        .join("today.md");
    assert!(old_backup_dir.is_dir());

    move_workspace_entry_with_label(
        MAIN_WINDOW_LABEL,
        &src.to_string_lossy(),
        &dst.to_string_lossy(),
        &root.to_string_lossy(),
    )
    .expect("move should rekey backup dir");

    assert!(!old_backup_dir.exists(), "old backup dir should be gone");
    let new_backup_dir = root
        .join(".hazakura")
        .join("backups")
        .join("archive")
        .join("today.md");
    assert!(new_backup_dir.is_dir(), "new backup dir should follow move");

    let _ = fs::remove_dir_all(root);
}

#[test]
fn move_workspace_entry_to_trash_clears_auto_backup_dir() {
    let root = unique_test_dir("trash_clear_backup");
    fs::create_dir_all(&root).expect("create root");
    let path = root.join("doomed.md");
    fs::write(&path, "# doomed\n").expect("write doomed");

    crate::auto_backup::save_auto_backup(&root.to_string_lossy(), "doomed.md", "# v1\n")
        .expect("save backup before trash");
    let backup_dir = root.join(".hazakura").join("backups").join("doomed.md");
    assert!(backup_dir.is_dir());

    move_workspace_entry_to_trash_with_label(
        MAIN_WINDOW_LABEL,
        &path.to_string_lossy(),
        &root.to_string_lossy(),
    )
    .expect("trash should clear backup dir");

    assert!(
        !backup_dir.exists(),
        "backup dir should be cleared after trash"
    );

    let _ = fs::remove_dir_all(root);
}

#[test]
fn rename_workspace_entry_rekeys_descendant_auto_backup_tree() {
    let root = unique_test_dir("rename_folder_rekey_backup");
    fs::create_dir_all(&root).expect("create root");
    let src_folder = root.join("notes");
    fs::create_dir_all(&src_folder).expect("create notes folder");
    let dst_folder = root.join("archive");
    fs::write(src_folder.join("today.md"), "# today\n").expect("write today");
    fs::write(src_folder.join("tomorrow.md"), "# tomorrow\n").expect("write tomorrow");

    crate::auto_backup::save_auto_backup(&root.to_string_lossy(), "notes/today.md", "# v1\n")
        .expect("save today backup");
    crate::auto_backup::save_auto_backup(&root.to_string_lossy(), "notes/tomorrow.md", "# v1\n")
        .expect("save tomorrow backup");

    rename_workspace_entry_with_label(
        MAIN_WINDOW_LABEL,
        &src_folder.to_string_lossy(),
        &dst_folder.to_string_lossy(),
        &root.to_string_lossy(),
    )
    .expect("rename folder should rekey descendant backup tree");

    let old_tree_root = root.join(".hazakura").join("backups").join("notes");
    assert!(
        !old_tree_root.exists(),
        "old backup tree root should be gone after folder rename"
    );
    let new_today = root
        .join(".hazakura")
        .join("backups")
        .join("archive")
        .join("today.md");
    let new_tomorrow = root
        .join(".hazakura")
        .join("backups")
        .join("archive")
        .join("tomorrow.md");
    assert!(new_today.is_dir(), "today backup should follow the folder");
    assert!(
        new_tomorrow.is_dir(),
        "tomorrow backup should follow the folder"
    );

    let _ = fs::remove_dir_all(root);
}

#[test]
fn rename_workspace_entry_handles_case_only_rename() {
    let root = unique_test_dir("rename_case_only");
    fs::create_dir_all(&root).expect("create root");
    let src = root.join("README.md");
    let dst = root.join("readme.md");
    fs::write(&src, "# readme\n").expect("write src");

    rename_workspace_entry_with_label(
        MAIN_WINDOW_LABEL,
        &src.to_string_lossy(),
        &dst.to_string_lossy(),
        &root.to_string_lossy(),
    )
    .expect("case-only rename should succeed on APFS");

    // On case-insensitive filesystems the src and dst paths
    // resolve to the same file; verify via the canonicalized
    // destination instead of relying on existence.
    let canonical_dst = fs::canonicalize(&dst).expect("canonicalize dst");
    assert_eq!(
        fs::read_to_string(&canonical_dst).expect("read renamed file"),
        "# readme\n"
    );

    let _ = fs::remove_dir_all(root);
}

#[test]
fn rename_workspace_entry_rejects_existing_destination() {
    let root = unique_test_dir("rename_existing_dst");
    fs::create_dir_all(&root).expect("create root");
    let src = root.join("a.md");
    let dst = root.join("b.md");
    fs::write(&src, "# a\n").expect("write src");
    fs::write(&dst, "# b\n").expect("write dst");

    let err = rename_workspace_entry_with_label(
        MAIN_WINDOW_LABEL,
        &src.to_string_lossy(),
        &dst.to_string_lossy(),
        &root.to_string_lossy(),
    )
    .expect_err("existing target should be rejected");

    assert!(err.contains("already exists"), "{err}");
    assert!(src.exists());
    assert!(dst.exists());
    assert_eq!(fs::read_to_string(&dst).expect("read protected"), "# b\n");

    let _ = fs::remove_dir_all(root);
}

#[test]
fn rename_workspace_entry_renames_directory() {
    let root = unique_test_dir("rename_directory");
    fs::create_dir_all(&root).expect("create root");
    let src = root.join("old-folder");
    fs::create_dir_all(&src).expect("create src folder");
    fs::write(src.join("inside.md"), "# inside\n").expect("write inside");
    let dst = root.join("new-folder");

    rename_workspace_entry_with_label(
        MAIN_WINDOW_LABEL,
        &src.to_string_lossy(),
        &dst.to_string_lossy(),
        &root.to_string_lossy(),
    )
    .expect("rename directory");

    assert!(!src.exists());
    assert!(dst.is_dir());
    assert!(dst.join("inside.md").exists());

    let _ = fs::remove_dir_all(root);
}

#[test]
fn move_workspace_entry_moves_file_across_directories() {
    let root = unique_test_dir("move_across_dirs");
    let source_dir = root.join("source");
    let dest_dir = root.join("dest");
    fs::create_dir_all(&root).expect("create root");
    fs::create_dir_all(&source_dir).expect("create source");
    fs::create_dir_all(&dest_dir).expect("create dest");
    let src = source_dir.join("note.md");
    let dst = dest_dir.join("note.md");
    fs::write(&src, "# note\n").expect("write src");

    move_workspace_entry_with_label(
        MAIN_WINDOW_LABEL,
        &src.to_string_lossy(),
        &dst.to_string_lossy(),
        &root.to_string_lossy(),
    )
    .expect("move across directories");

    assert!(!src.exists());
    assert!(dst.exists());
    assert_eq!(fs::read_to_string(&dst).expect("read moved"), "# note\n");

    let _ = fs::remove_dir_all(root);
}

#[test]
fn move_workspace_entry_rejects_existing_destination() {
    let root = unique_test_dir("move_existing_dst");
    let source_dir = root.join("source");
    let dest_dir = root.join("dest");
    fs::create_dir_all(&root).expect("create root");
    fs::create_dir_all(&source_dir).expect("create source");
    fs::create_dir_all(&dest_dir).expect("create dest");
    let src = source_dir.join("note.md");
    let colliding = dest_dir.join("note.md");
    fs::write(&src, "# source\n").expect("write src");
    fs::write(&colliding, "# existing\n").expect("write colliding");

    let err = move_workspace_entry_with_label(
        MAIN_WINDOW_LABEL,
        &src.to_string_lossy(),
        &colliding.to_string_lossy(),
        &root.to_string_lossy(),
    )
    .expect_err("move onto existing target should fail");

    assert!(err.contains("already exists"), "{err}");
    assert!(src.exists());
    assert!(colliding.exists());
    assert_eq!(
        fs::read_to_string(&colliding).expect("read protected"),
        "# existing\n"
    );

    let _ = fs::remove_dir_all(root);
}

#[test]
fn move_workspace_entry_rejects_missing_destination_parent() {
    let root = unique_test_dir("move_missing_parent");
    let source_dir = root.join("source");
    fs::create_dir_all(&root).expect("create root");
    fs::create_dir_all(&source_dir).expect("create source");
    let src = source_dir.join("note.md");
    fs::write(&src, "# note\n").expect("write src");
    let dst = root.join("does/not/exist/note.md");

    let err = move_workspace_entry_with_label(
        MAIN_WINDOW_LABEL,
        &src.to_string_lossy(),
        &dst.to_string_lossy(),
        &root.to_string_lossy(),
    )
    .expect_err("missing destination parent should fail");

    assert!(
        err.contains("not a folder") || err.contains("Cannot rename"),
        "{err}"
    );
    assert!(src.exists());

    let _ = fs::remove_dir_all(root);
}

#[test]
fn move_workspace_entry_to_trash_rejects_agent_window_label() {
    let root = unique_test_dir("trash_label");
    fs::create_dir_all(&root).expect("create root");
    let src = root.join("note.md");
    fs::write(&src, "# note\n").expect("write src");

    let err = move_workspace_entry_to_trash_with_label(
        AGENT_WINDOW_LABEL,
        &src.to_string_lossy(),
        &root.to_string_lossy(),
    )
    .expect_err("agent window must not be allowed to trash");

    assert!(
        err.contains("main window") || err.contains("label") || err.contains("not allowed"),
        "{err}"
    );
    assert!(src.exists());

    let _ = fs::remove_dir_all(root);
}

#[test]
fn move_workspace_entry_to_trash_rejects_outside_workspace_root() {
    let workspace_root = unique_test_dir("trash_outside_root");
    let outside = unique_test_dir("trash_outside");
    fs::create_dir_all(&workspace_root).expect("create root");
    fs::create_dir_all(&outside).expect("create outside");
    let src = outside.join("note.md");
    fs::write(&src, "# note\n").expect("write src");

    let err = move_workspace_entry_to_trash_with_label(
        MAIN_WINDOW_LABEL,
        &src.to_string_lossy(),
        &workspace_root.to_string_lossy(),
    )
    .expect_err("outside-root path must be rejected");

    assert!(err.contains("outside"), "{err}");
    assert!(src.exists());

    let _ = fs::remove_dir_all(workspace_root);
    let _ = fs::remove_dir_all(outside);
}

#[test]
fn move_workspace_entry_to_trash_rejects_missing_path() {
    let root = unique_test_dir("trash_missing");
    fs::create_dir_all(&root).expect("create root");
    let missing = root.join("does-not-exist.md");

    let err = move_workspace_entry_to_trash_with_label(
        MAIN_WINDOW_LABEL,
        &missing.to_string_lossy(),
        &root.to_string_lossy(),
    )
    .expect_err("missing path must be rejected");

    assert!(
        err.contains("Cannot read") || err.contains("cannot be trashed"),
        "{err}"
    );

    let _ = fs::remove_dir_all(root);
}

#[cfg(target_os = "macos")]
#[test]
fn move_workspace_entry_to_trash_removes_file_on_macos() {
    // macOS-only happy path: hand a real file to the native
    // Trash API and assert it disappears from the workspace
    // root. Skipped on non-macOS because the backend relies on
    // the macOS Trash path.
    let root = unique_test_dir("trash_happy");
    fs::create_dir_all(&root).expect("create root");
    let src = root.join("note.md");
    fs::write(&src, "# note\n").expect("write src");

    move_workspace_entry_to_trash_with_label(
        MAIN_WINDOW_LABEL,
        &src.to_string_lossy(),
        &root.to_string_lossy(),
    )
    .expect("finder trash should accept a workspace file");

    assert!(
        !src.exists(),
        "trashed file should be gone from the workspace"
    );

    let _ = fs::remove_dir_all(root);
}
