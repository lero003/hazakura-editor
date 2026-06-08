// Tests for the text-file open/create/save/metadata command
// surface. These cover binary rejection, atomic write failure
// recovery, the external-change conflict guard, and line-ending
// preservation across LF and CRLF inputs.
use super::*;

use std::fs::File;

#[test]
fn open_text_file_rejects_binary_looking_file() {
    let dir = unique_test_dir("open_binary");
    fs::create_dir_all(&dir).expect("create test dir");
    let path = dir.join("sample.md");
    fs::write(&path, b"# Title\n\0binary tail").expect("write binary fixture");

    let err = open_text_file_with_label(MAIN_WINDOW_LABEL, path.to_string_lossy().to_string())
        .expect_err("binary-looking markdown should fail");

    assert!(err.contains("Binary-looking"));

    let _ = fs::remove_dir_all(dir);
}

// App Store / App Sandbox path: a stored workspace state can
// reference a file path the OS will no longer open because the
// user moved it, deleted it, or revoked the file-picker grant on
// app restart. `open_text_file` must surface that as a clean
// error string the frontend can show in the restore-status
// message and the global error chip — never a panic, never a
// silent "tab reopened" reply. These regression tests pin the
// expected failure shapes for the most common restore-time
// breakages so future refactors do not regress the
// `useWorkspaceRestore` `Promise.allSettled` contract.

#[test]
fn open_text_file_reports_clean_error_for_missing_file() {
    let dir = unique_test_dir("open_missing");
    fs::create_dir_all(&dir).expect("create test dir");
    let path = dir.join("does-not-exist.md");

    let err = open_text_file_with_label(MAIN_WINDOW_LABEL, path.to_string_lossy().to_string())
        .expect_err("missing path should fail cleanly");

    assert!(err.contains("Cannot read file"), "got error: {err}");

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn open_text_file_rejects_directory_path() {
    let dir = unique_test_dir("open_directory");
    fs::create_dir_all(&dir).expect("create test dir");

    let err = open_text_file_with_label(MAIN_WINDOW_LABEL, dir.to_string_lossy().to_string())
        .expect_err("directory should fail cleanly");

    assert!(err.contains("not a file"), "got error: {err}");

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn open_text_file_rejects_oversized_file() {
    let dir = unique_test_dir("open_oversized");
    fs::create_dir_all(&dir).expect("create test dir");
    let path = dir.join("huge.md");
    let file = File::create(&path).expect("create large file");
    file.set_len(MAX_EDITABLE_BYTES + 1)
        .expect("resize large file");

    let err = open_text_file_with_label(MAIN_WINDOW_LABEL, path.to_string_lossy().to_string())
        .expect_err("oversized file should fail cleanly");

    assert!(err.contains("10 MB"), "got error: {err}");

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn open_text_file_rejects_empty_path() {
    let err = open_text_file_with_label(MAIN_WINDOW_LABEL, "".to_string())
        .expect_err("empty path should fail cleanly");

    assert!(err.contains("Cannot read file"), "got error: {err}");
}

#[test]
fn open_text_file_opens_utf8_json() {
    let dir = unique_test_dir("open_json_text_file");
    fs::create_dir_all(&dir).expect("create test dir");
    let path = dir.join("settings.json");
    fs::write(&path, "{\n  \"enabled\": true\n}\n").expect("write json fixture");

    let document = open_text_file_with_label(MAIN_WINDOW_LABEL, path.to_string_lossy().to_string())
        .expect("open json text file");

    assert_eq!(document.name, "settings.json");
    assert!(document.contents.contains("\"enabled\": true"));
    assert_eq!(document.line_ending, "lf");
}

#[test]
fn open_text_file_opens_source_and_extensionless_text() {
    let dir = unique_test_dir("open_source_and_extensionless_text");
    fs::create_dir_all(&dir).expect("create test dir");
    let source_path = dir.join("app.ts");
    let extensionless_path = dir.join("Makefile");
    fs::write(&source_path, "export const answer: number = 42;\n").expect("write source");
    fs::write(&extensionless_path, "build:\n\tnpm run build\n").expect("write extensionless");

    let source_document =
        open_text_file_with_label(MAIN_WINDOW_LABEL, source_path.to_string_lossy().to_string())
            .expect("open TypeScript text file");
    let extensionless_document = open_text_file_with_label(
        MAIN_WINDOW_LABEL,
        extensionless_path.to_string_lossy().to_string(),
    )
    .expect("open extensionless text file");

    assert_eq!(source_document.name, "app.ts");
    assert!(source_document.contents.contains("answer"));
    assert_eq!(extensionless_document.name, "Makefile");
    assert!(extensionless_document.contents.contains("npm run build"));

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn create_text_file_creates_empty_markdown_file() {
    let dir = unique_test_dir("create_text_file");
    fs::create_dir_all(&dir).expect("create test dir");
    let path = dir.join("fresh.md");

    let document =
        create_text_file_with_label(MAIN_WINDOW_LABEL, path.to_string_lossy().to_string(), None)
            .expect("create markdown file");

    assert_eq!(document.name, "fresh.md");
    assert_eq!(document.contents, "");
    assert_eq!(document.line_ending, "lf");
    assert_eq!(document.size, 0);
    assert!(path.exists());

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn create_text_file_rejects_existing_file() {
    let dir = unique_test_dir("create_existing_text_file");
    fs::create_dir_all(&dir).expect("create test dir");
    let path = dir.join("existing.md");
    fs::write(&path, "# Existing\n").expect("write fixture");

    let err =
        create_text_file_with_label(MAIN_WINDOW_LABEL, path.to_string_lossy().to_string(), None)
            .expect_err("existing file should not be overwritten");

    assert!(err.contains("already exists"));
    assert_eq!(
        fs::read_to_string(&path).expect("read protected file"),
        "# Existing\n"
    );

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn create_text_folder_creates_empty_folder_inside_workspace_root() {
    let root = unique_test_dir("create_folder_root");
    fs::create_dir_all(&root).expect("create root");
    let path = root.join("new-folder");

    create_text_folder_with_label(
        MAIN_WINDOW_LABEL,
        &path.to_string_lossy(),
        &root.to_string_lossy(),
    )
    .expect("create empty folder");

    assert!(path.exists());
    assert!(path.is_dir());

    let _ = fs::remove_dir_all(root);
}

#[test]
fn create_text_folder_rejects_existing_folder() {
    let root = unique_test_dir("create_folder_existing");
    fs::create_dir_all(&root).expect("create root");
    let path = root.join("already-here");
    fs::create_dir_all(&path).expect("create pre-existing folder");

    let err = create_text_folder_with_label(
        MAIN_WINDOW_LABEL,
        &path.to_string_lossy(),
        &root.to_string_lossy(),
    )
    .expect_err("existing folder should not be overwritten");

    assert!(err.contains("already exists"), "{err}");

    let _ = fs::remove_dir_all(root);
}

#[test]
fn create_text_folder_rejects_path_outside_workspace_root() {
    let root = unique_test_dir("create_folder_outside_root");
    let outside = unique_test_dir("create_folder_outside_target");
    fs::create_dir_all(&root).expect("create root");
    fs::create_dir_all(&outside).expect("create outside");
    let path = outside.join("escape-me");

    let err = create_text_folder_with_label(
        MAIN_WINDOW_LABEL,
        &path.to_string_lossy(),
        &root.to_string_lossy(),
    )
    .expect_err("path outside workspace root should be rejected");

    assert!(err.contains("outside the workspace root"), "{err}");
    assert!(!path.exists());

    let _ = fs::remove_dir_all(root);
    let _ = fs::remove_dir_all(outside);
}

#[test]
fn create_text_file_rejects_path_outside_workspace_root() {
    let root = unique_test_dir("create_file_outside_root");
    let outside = unique_test_dir("create_file_outside_target");
    fs::create_dir_all(&root).expect("create root");
    fs::create_dir_all(&outside).expect("create outside");
    let path = outside.join("escape-me.md");

    let err = create_text_file_with_label(
        MAIN_WINDOW_LABEL,
        path.to_string_lossy().to_string(),
        Some(root.to_string_lossy().to_string()),
    )
    .expect_err("path outside workspace root should be rejected");

    assert!(err.contains("outside the workspace root"), "{err}");
    assert!(!path.exists());

    let _ = fs::remove_dir_all(root);
    let _ = fs::remove_dir_all(outside);
}

#[test]
fn create_text_file_allows_path_inside_workspace_root() {
    let root = unique_test_dir("create_file_inside_root");
    fs::create_dir_all(&root).expect("create root");
    let path = root.join("inside.md");

    let document = create_text_file_with_label(
        MAIN_WINDOW_LABEL,
        path.to_string_lossy().to_string(),
        Some(root.to_string_lossy().to_string()),
    )
    .expect("path inside workspace root should be allowed");

    assert_eq!(document.name, "inside.md");
    assert!(path.exists());

    let _ = fs::remove_dir_all(root);
}

#[test]
fn create_text_file_skips_workspace_check_when_root_is_none() {
    let dir = unique_test_dir("create_file_no_root_constraint");
    fs::create_dir_all(&dir).expect("create dir");
    let path = dir.join("anywhere.md");

    let document =
        create_text_file_with_label(MAIN_WINDOW_LABEL, path.to_string_lossy().to_string(), None)
            .expect("no workspace constraint should be honored");

    assert_eq!(document.name, "anywhere.md");
    assert!(path.exists());

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn atomic_write_replaces_text_file() {
    let dir = unique_test_dir("atomic_write");
    fs::create_dir_all(&dir).expect("create test dir");
    let path = dir.join("note.md");
    fs::write(&path, "# Old\n").expect("write fixture");

    atomic_write(&path, b"# New\n").expect("atomic write");

    assert_eq!(
        fs::read_to_string(&path).expect("read saved file"),
        "# New\n"
    );
    assert!(!dir.join(".note.md.hazakura-note.tmp").exists());

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn atomic_write_removes_temp_file_after_replace_failure() {
    let dir = unique_test_dir("atomic_write_cleanup");
    fs::create_dir_all(&dir).expect("create test dir");
    let path = dir.join("note.md");
    fs::create_dir_all(&path).expect("create directory target");

    let err = atomic_write(&path, b"# New\n").expect_err("replace directory should fail");

    assert!(err.contains("Cannot replace saved file"));
    assert!(!dir.join(".note.md.hazakura-note.tmp").exists());

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn atomic_write_does_not_clobber_existing_temp_file() {
    let dir = unique_test_dir("atomic_write_existing_temp");
    fs::create_dir_all(&dir).expect("create test dir");
    let path = dir.join("note.md");
    let temp_path = dir.join(".note.md.hazakura-note.tmp");
    fs::write(&path, "# Old\n").expect("write fixture");
    fs::write(&temp_path, "# Existing temp\n").expect("write existing temp fixture");

    let err = atomic_write(&path, b"# New\n").expect_err("existing temp should fail safely");

    assert!(err.contains("Cannot create temp file"));
    assert_eq!(
        fs::read_to_string(&path).expect("read protected file"),
        "# Old\n"
    );
    assert_eq!(
        fs::read_to_string(&temp_path).expect("read existing temp file"),
        "# Existing temp\n"
    );

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn save_rejects_external_change_before_write() {
    let dir = unique_test_dir("save_conflict");
    fs::create_dir_all(&dir).expect("create test dir");
    let path = dir.join("note.md");
    fs::write(&path, "# Original\n").expect("write fixture");
    let opened_metadata = fs::metadata(&path).expect("read opened metadata");
    let opened_fingerprint = metadata_fingerprint(&opened_metadata);

    fs::write(&path, "# External change\n\nDo not overwrite.\n").expect("simulate external change");

    let result = save_text_file_with_label(
        MAIN_WINDOW_LABEL,
        path.to_string_lossy().to_string(),
        "# Editor change\n".to_string(),
        opened_fingerprint,
        "lf".to_string(),
        "utf-8".to_string(),
    );

    assert!(result
        .expect_err("save should reject conflict")
        .contains("Save conflict"));
    assert_eq!(
        fs::read_to_string(&path).expect("read protected file"),
        "# External change\n\nDo not overwrite.\n"
    );

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn save_preserves_crlf_line_endings() {
    let dir = unique_test_dir("save_crlf");
    fs::create_dir_all(&dir).expect("create test dir");
    let path = dir.join("note.md");
    fs::write(&path, b"# Title\r\n\r\nBody\r\n").expect("write crlf fixture");

    let document = open_text_file_with_label(MAIN_WINDOW_LABEL, path.to_string_lossy().to_string())
        .expect("open crlf fixture");

    assert_eq!(document.line_ending, "crlf");

    save_text_file_with_label(
        MAIN_WINDOW_LABEL,
        path.to_string_lossy().to_string(),
        "# Changed\n\nBody\n".to_string(),
        document.fingerprint,
        document.line_ending,
        "utf-8".to_string(),
    )
    .expect("save crlf document");

    assert_eq!(
        fs::read(&path).expect("read saved file"),
        b"# Changed\r\n\r\nBody\r\n"
    );

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn save_preserves_lf_trailing_newline_presence() {
    let dir = unique_test_dir("save_lf_trailing_newline");
    fs::create_dir_all(&dir).expect("create test dir");
    let with_newline_path = dir.join("with-newline.md");
    let without_newline_path = dir.join("without-newline.md");
    fs::write(&with_newline_path, b"# Title\n\nBody\n").expect("write lf fixture");
    fs::write(&without_newline_path, b"# Title\n\nBody").expect("write lf fixture");

    let with_newline_document = open_text_file_with_label(
        MAIN_WINDOW_LABEL,
        with_newline_path.to_string_lossy().to_string(),
    )
    .expect("open lf fixture with final newline");
    let without_newline_document = open_text_file_with_label(
        MAIN_WINDOW_LABEL,
        without_newline_path.to_string_lossy().to_string(),
    )
    .expect("open lf fixture without final newline");

    save_text_file_with_label(
        MAIN_WINDOW_LABEL,
        with_newline_path.to_string_lossy().to_string(),
        "# Changed\n\nBody\n".to_string(),
        with_newline_document.fingerprint,
        with_newline_document.line_ending,
        "utf-8".to_string(),
    )
    .expect("save lf document with final newline");
    save_text_file_with_label(
        MAIN_WINDOW_LABEL,
        without_newline_path.to_string_lossy().to_string(),
        "# Changed\n\nBody".to_string(),
        without_newline_document.fingerprint,
        without_newline_document.line_ending,
        "utf-8".to_string(),
    )
    .expect("save lf document without final newline");

    assert_eq!(
        fs::read(&with_newline_path).expect("read saved file"),
        b"# Changed\n\nBody\n"
    );
    assert_eq!(
        fs::read(&without_newline_path).expect("read saved file"),
        b"# Changed\n\nBody"
    );

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn save_preserves_crlf_without_trailing_newline() {
    let dir = unique_test_dir("save_crlf_no_trailing_newline");
    fs::create_dir_all(&dir).expect("create test dir");
    let path = dir.join("note.md");
    fs::write(&path, b"# Title\r\n\r\nBody").expect("write crlf fixture");

    let document = open_text_file_with_label(MAIN_WINDOW_LABEL, path.to_string_lossy().to_string())
        .expect("open crlf fixture");

    assert_eq!(document.line_ending, "crlf");

    save_text_file_with_label(
        MAIN_WINDOW_LABEL,
        path.to_string_lossy().to_string(),
        "# Changed\n\nBody".to_string(),
        document.fingerprint,
        document.line_ending,
        "utf-8".to_string(),
    )
    .expect("save crlf document without final newline");

    assert_eq!(
        fs::read(&path).expect("read saved file"),
        b"# Changed\r\n\r\nBody"
    );

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn save_text_file_as_creates_new_text_extension_with_requested_line_endings() {
    let dir = unique_test_dir("save_as_text_extension");
    fs::create_dir_all(&dir).expect("create test dir");
    let path = dir.join("note.log");

    let document = save_text_file_as_with_label(
        MAIN_WINDOW_LABEL,
        path.to_string_lossy().to_string(),
        "First\nSecond\n".to_string(),
        "crlf".to_string(),
        "utf-8".to_string(),
        None,
    )
    .expect("save as text file");

    assert_eq!(document.name, "note.log");
    assert_eq!(document.line_ending, "crlf");
    assert_eq!(
        fs::read(&path).expect("read saved-as file"),
        b"First\r\nSecond\r\n"
    );

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn save_text_file_as_rejects_existing_file() {
    let dir = unique_test_dir("save_as_existing");
    fs::create_dir_all(&dir).expect("create test dir");
    let path = dir.join("existing.txt");
    fs::write(&path, "Keep me\n").expect("write fixture");

    let err = save_text_file_as_with_label(
        MAIN_WINDOW_LABEL,
        path.to_string_lossy().to_string(),
        "Overwrite attempt\n".to_string(),
        "lf".to_string(),
        "utf-8".to_string(),
        None,
    )
    .expect_err("save as should not overwrite existing file");

    assert!(err.contains("already exists"));
    assert_eq!(
        fs::read_to_string(&path).expect("read protected file"),
        "Keep me\n"
    );

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn save_text_file_as_rejects_path_outside_workspace_root() {
    let root = unique_test_dir("save_as_outside_root");
    let outside = unique_test_dir("save_as_outside_target");
    fs::create_dir_all(&root).expect("create root");
    fs::create_dir_all(&outside).expect("create outside");
    let path = outside.join("escape-as.html");

    let err = save_text_file_as_with_label(
        MAIN_WINDOW_LABEL,
        path.to_string_lossy().to_string(),
        "<p>html</p>\n".to_string(),
        "lf".to_string(),
        "utf-8".to_string(),
        Some(root.to_string_lossy().to_string()),
    )
    .expect_err("save-as outside workspace root should be rejected");

    assert!(err.contains("outside the workspace root"), "{err}");
    assert!(!path.exists());

    let _ = fs::remove_dir_all(root);
    let _ = fs::remove_dir_all(outside);
}

#[test]
fn save_text_file_as_allows_path_inside_workspace_root() {
    let root = unique_test_dir("save_as_inside_root");
    fs::create_dir_all(&root).expect("create root");
    let path = root.join("export.html");

    let document = save_text_file_as_with_label(
        MAIN_WINDOW_LABEL,
        path.to_string_lossy().to_string(),
        "<p>html</p>\n".to_string(),
        "lf".to_string(),
        "utf-8".to_string(),
        Some(root.to_string_lossy().to_string()),
    )
    .expect("save-as inside workspace root should be allowed");

    assert_eq!(document.name, "export.html");
    assert!(path.exists());

    let _ = fs::remove_dir_all(root);
}

#[test]
fn metadata_rejects_oversized_files() {
    let dir = unique_test_dir("oversized");
    fs::create_dir_all(&dir).expect("create test dir");
    let path = dir.join("huge.md");
    let file = File::create(&path).expect("create large file");
    file.set_len(MAX_EDITABLE_BYTES + 1)
        .expect("resize large file");

    let err = readable_text_metadata(&path).expect_err("large file should fail");

    assert!(err.contains("10 MB"));

    let _ = fs::remove_dir_all(dir);
}
