// Tests for small util helpers — binary detection, base64
// decoding, and the workspace-root containment / rename helpers.
use super::*;

#[test]
fn binary_detection_finds_nul_byte() {
    let dir = unique_test_dir("binary_detection");
    fs::create_dir_all(&dir).expect("create test dir");
    let path = dir.join("sample.bin");
    fs::write(&path, b"abc\0def").expect("write binary fixture");

    assert!(looks_binary(&path).expect("inspect file"));

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn base64_decoder_rejects_invalid_padding() {
    assert_eq!(
        decode_base64("iVBORw0KGgo=").expect("decode png header"),
        b"\x89PNG\r\n\x1a\n"
    );
    assert!(decode_base64("AA=A").is_err());
    assert!(decode_base64("AAAA=AAA").is_err());
    assert!(decode_base64("A===").is_err());
}

#[test]
fn ensure_path_inside_root_accepts_existing_path_inside() {
    let root = unique_test_dir("ensure_inside_existing");
    let nested = root.join("notes");
    fs::create_dir_all(&nested).expect("create nested dir");
    let leaf = nested.join("a.md");
    fs::write(&leaf, "# a\n").expect("write leaf fixture");

    let resolved = ensure_path_inside_workspace_root(&leaf, &root).expect("inside root");
    assert!(resolved.ends_with("a.md"));

    let _ = fs::remove_dir_all(root);
}

#[test]
fn ensure_path_inside_root_accepts_nonexistent_child_inside() {
    let root = unique_test_dir("ensure_inside_new");
    fs::create_dir_all(&root).expect("create root");
    let brand_new = root.join("brand-new-folder");

    let resolved = ensure_path_inside_workspace_root(&brand_new, &root)
        .expect("nonexistent child should resolve to canonical path");
    assert!(resolved.ends_with("brand-new-folder"));

    let _ = fs::remove_dir_all(root);
}

#[test]
fn ensure_path_inside_root_rejects_path_outside() {
    let root = unique_test_dir("ensure_outside_root");
    let outside = unique_test_dir("ensure_outside_target");
    fs::create_dir_all(&root).expect("create root");
    fs::create_dir_all(&outside).expect("create outside");

    let err = ensure_path_inside_workspace_root(&outside, &root)
        .expect_err("outside path should be rejected");
    assert!(err.contains("outside the workspace root"), "{err}");

    let _ = fs::remove_dir_all(root);
    let _ = fs::remove_dir_all(outside);
}

#[test]
fn rename_util_moves_within_same_directory() {
    let dir = unique_test_dir("rename_util_same_dir");
    fs::create_dir_all(&dir).expect("create dir");
    let src = dir.join("old.md");
    fs::write(&src, "# old\n").expect("write src");
    let dst = dir.join("new.md");

    rename_workspace_entry_util(&src, &dst, &dir).expect("rename within dir");
    assert!(!src.exists());
    assert!(dst.exists());
    assert_eq!(fs::read_to_string(&dst).expect("read renamed"), "# old\n");

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn rename_util_allows_case_only_rename() {
    let dir = unique_test_dir("rename_util_case_only");
    fs::create_dir_all(&dir).expect("create dir");
    let src = dir.join("README.md");
    let dst = dir.join("readme.md");
    fs::write(&src, "# readme\n").expect("write src");

    rename_workspace_entry_util(&src, &dst, &dir)
        .expect("case-only rename should succeed even when dst.exists() returns true");

    // On case-insensitive filesystems (APFS) `src.exists()` keeps
    // returning true after a case-only rename because the two
    // paths resolve to the same file. Verify the on-disk content
    // and the dst readable instead of relying on existence.
    assert_eq!(
        fs::read_to_string(&dst).expect("read renamed file"),
        "# readme\n"
    );
    assert_eq!(
        fs::read_to_string(&src).expect("read src path after rename"),
        "# readme\n"
    );

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn rename_util_rejects_existing_destination() {
    let dir = unique_test_dir("rename_util_existing_dst");
    fs::create_dir_all(&dir).expect("create dir");
    let src = dir.join("a.md");
    let dst = dir.join("b.md");
    fs::write(&src, "# a\n").expect("write src");
    fs::write(&dst, "# b\n").expect("write dst");

    let err = rename_workspace_entry_util(&src, &dst, &dir)
        .expect_err("rename onto existing target should fail");
    assert!(err.contains("already exists"), "{err}");
    assert!(src.exists());
    assert!(dst.exists());

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn rename_util_rejects_source_outside_root() {
    let root = unique_test_dir("rename_util_outside_root");
    let outside = unique_test_dir("rename_util_outside_src");
    fs::create_dir_all(&root).expect("create root");
    fs::create_dir_all(&outside).expect("create outside");
    let src = outside.join("escape.md");
    let dst = root.join("landed.md");
    fs::write(&src, "# escape\n").expect("write src");

    let err = rename_workspace_entry_util(&src, &dst, &root)
        .expect_err("source outside root should be rejected");
    assert!(err.contains("outside the workspace root"), "{err}");
    assert!(src.exists());
    assert!(!dst.exists());

    let _ = fs::remove_dir_all(root);
    let _ = fs::remove_dir_all(outside);
}

#[cfg(unix)]
#[test]
fn rename_util_rejects_symlink_escaping_root() {
    use std::os::unix::fs::symlink;

    let root = unique_test_dir("rename_util_symlink_root");
    let outside = unique_test_dir("rename_util_symlink_outside");
    fs::create_dir_all(&root).expect("create root");
    fs::create_dir_all(&outside).expect("create outside");
    let real = outside.join("real.md");
    fs::write(&real, "# real\n").expect("write real");
    let link_in_root = root.join("link.md");
    symlink(&real, &link_in_root).expect("create symlink inside root");
    let dst = root.join("moved-link.md");

    let err = rename_workspace_entry_util(&link_in_root, &dst, &root)
        .expect_err("symlink that resolves outside the root should be rejected");
    assert!(err.contains("outside the workspace root"), "{err}");
    assert!(link_in_root.exists());
    assert!(!dst.exists());

    let _ = fs::remove_dir_all(root);
    let _ = fs::remove_dir_all(outside);
}
