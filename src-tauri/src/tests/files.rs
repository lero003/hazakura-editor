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

// v0.17 app-store-quality: save-restore-regression slice 1.2
// — Shift-JIS / EUC-JP file I/O round-trip. Slice 1.1
// pinned the UTF-8 BOM path. These tests cover the
// other two encodings offered in the StatusBar
// selector. The codec-level round-trip is already
// pinned in `tests::encoding::encode_text_round_trips_*`;
// the tests here exercise the full file I/O path
// (`open_text_file` → in-memory decode → `save_text_file` →
// on-disk re-encode → re-decode from disk) so a future
// refactor cannot silently regress either of the
// non-UTF-8 encodings at the storage layer. The
// unmappable-char test pins the existing save-time
// error contract so an emoji or other
// out-of-repertoire character cannot reach
// `atomic_write` and corrupt the file.

#[test]
fn shift_jis_open_detects_label_and_decodes_contents() {
    // App Store / App Sandbox: a user opens a plain
    // Markdown note that was authored or exported in
    // Shift-JIS. The editor must auto-detect the
    // encoding, surface it in `document.encoding`, and
    // decode the body losslessly into a Unicode string.
    let dir = unique_test_dir("shift_jis_open");
    fs::create_dir_all(&dir).expect("create test dir");
    let path = dir.join("note.md");
    let original = "こんにちは、世界。\n";
    let (bytes, _, had_unmappable) = encoding_rs::SHIFT_JIS.encode(original);
    assert!(
        !had_unmappable,
        "fixture string must encode cleanly to Shift-JIS",
    );
    fs::write(&path, &bytes).expect("write Shift-JIS fixture");

    let document = open_text_file_with_label(MAIN_WINDOW_LABEL, path.to_string_lossy().to_string())
        .expect("open shift-jis file");

    assert_eq!(document.encoding, "shift-jis");
    assert_eq!(document.contents, original);
    assert_eq!(document.line_ending, "lf");

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn shift_jis_save_round_trip_preserves_bytes() {
    // Open a Shift-JIS file, re-save the exact same
    // string with the same encoding label, then read
    // the on-disk bytes back and assert they match
    // the original Shift-JIS bytes byte-for-byte.
    // The save path runs `encode_text(..., "shift-jis")`
    // on the contents and writes the result through
    // `atomic_write`, both of which are deterministic,
    // so the on-disk bytes must be identical to the
    // pre-save bytes. Catching a byte-level
    // discrepancy catches more regressions than a
    // decoded-string equality alone (e.g. an encoder
    // that started producing IBM vs Microsoft
    // extension variants for the same scalar).
    let dir = unique_test_dir("shift_jis_resave");
    fs::create_dir_all(&dir).expect("create test dir");
    let path = dir.join("note.md");
    let original = "こんにちは、世界。\n";
    let (initial_bytes, _, had_unmappable) = encoding_rs::SHIFT_JIS.encode(original);
    assert!(
        !had_unmappable,
        "fixture string must encode cleanly to Shift-JIS",
    );
    let initial_bytes: Vec<u8> = initial_bytes.into_owned();
    fs::write(&path, &initial_bytes).expect("write Shift-JIS fixture");

    let document = open_text_file_with_label(MAIN_WINDOW_LABEL, path.to_string_lossy().to_string())
        .expect("open shift-jis file");
    assert_eq!(document.encoding, "shift-jis");

    save_text_file_with_label(
        MAIN_WINDOW_LABEL,
        path.to_string_lossy().to_string(),
        original.to_string(),
        document.fingerprint,
        document.line_ending,
        document.encoding,
    )
    .expect("save shift-jis document");

    let saved = fs::read(&path).expect("read saved file");
    assert_eq!(
        saved, initial_bytes,
        "on-disk bytes must match the original Shift-JIS bytes byte-for-byte",
    );

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn euc_jp_open_detects_label_and_decodes_contents() {
    // The fixture includes the fullwidth cent sign "￠"
    // (U+FFE0), which has no Shift-JIS representation.
    // This is what forces the detector to settle on
    // "euc-jp" instead of falling into the Shift-JIS
    // happy path — JIS X 0208 lead bytes in the range
    // 0xA4–0xA5 are valid single-byte halfwidth katakana
    // in Shift-JIS, so an EUC-JP kanji-only fixture
    // would be misidentified.
    let dir = unique_test_dir("euc_jp_open");
    fs::create_dir_all(&dir).expect("create test dir");
    let path = dir.join("note.md");
    let original = "本日￠50です。\n";
    let (bytes, _, had_unmappable) = encoding_rs::EUC_JP.encode(original);
    assert!(
        !had_unmappable,
        "fixture string must encode cleanly to EUC-JP",
    );
    fs::write(&path, &bytes).expect("write EUC-JP fixture");

    let document = open_text_file_with_label(MAIN_WINDOW_LABEL, path.to_string_lossy().to_string())
        .expect("open euc-jp file");

    assert_eq!(document.encoding, "euc-jp");
    assert_eq!(document.contents, original);
    assert_eq!(document.line_ending, "lf");

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn euc_jp_save_round_trip_preserves_bytes() {
    // Mirror of `shift_jis_save_round_trip_preserves_bytes`:
    // assert the on-disk bytes match the original
    // EUC-JP bytes byte-for-byte after a no-op
    // re-save. See that test for why byte-level
    // equality is the stronger regression net.
    let dir = unique_test_dir("euc_jp_resave");
    fs::create_dir_all(&dir).expect("create test dir");
    let path = dir.join("note.md");
    let original = "本日￠50です。\n";
    let (initial_bytes, _, had_unmappable) = encoding_rs::EUC_JP.encode(original);
    assert!(
        !had_unmappable,
        "fixture string must encode cleanly to EUC-JP",
    );
    let initial_bytes: Vec<u8> = initial_bytes.into_owned();
    fs::write(&path, &initial_bytes).expect("write EUC-JP fixture");

    let document = open_text_file_with_label(MAIN_WINDOW_LABEL, path.to_string_lossy().to_string())
        .expect("open euc-jp file");
    assert_eq!(document.encoding, "euc-jp");

    save_text_file_with_label(
        MAIN_WINDOW_LABEL,
        path.to_string_lossy().to_string(),
        original.to_string(),
        document.fingerprint,
        document.line_ending,
        document.encoding,
    )
    .expect("save euc-jp document");

    let saved = fs::read(&path).expect("read saved file");
    assert_eq!(
        saved, initial_bytes,
        "on-disk bytes must match the original EUC-JP bytes byte-for-byte",
    );

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn save_with_unmappable_shift_jis_chars_returns_clean_error_and_preserves_file() {
    // The `encode_text` helper rejects any Unicode scalar
    // that cannot be losslessly encoded as Shift-JIS.
    // The save path must surface that as a clean error
    // and never reach `atomic_write` — otherwise the
    // encoder would substitute a replacement character
    // and the on-disk file would silently change. This
    // pins the existing error contract: emoji / rare
    // CJK extensions stay in the editor as UTF-8 or get
    // rejected at save time, never silently re-encoded.
    let dir = unique_test_dir("shift_jis_unmappable");
    fs::create_dir_all(&dir).expect("create test dir");
    let path = dir.join("note.md");
    let original = "こんにちは\n";
    let (initial_bytes, _, had_unmappable) = encoding_rs::SHIFT_JIS.encode(original);
    assert!(!had_unmappable);
    let initial_bytes: Vec<u8> = initial_bytes.into_owned();
    fs::write(&path, &initial_bytes).expect("write Shift-JIS fixture");

    let document = open_text_file_with_label(MAIN_WINDOW_LABEL, path.to_string_lossy().to_string())
        .expect("open shift-jis file");

    // "🚀" (U+1F680) is outside the Shift-JIS repertoire.
    let unmappable_contents = "こんにちは🚀\n".to_string();
    let err = save_text_file_with_label(
        MAIN_WINDOW_LABEL,
        path.to_string_lossy().to_string(),
        unmappable_contents,
        document.fingerprint,
        document.line_ending,
        "shift-jis".to_string(),
    )
    .expect_err("save with unmappable char must fail cleanly");

    assert!(
        err.contains("Shift-JIS"),
        "error must name the encoding that rejected the char, got: {err}",
    );

    // The on-disk file must remain the original Shift-JIS
    // bytes — atomic_write must not have run.
    let saved = fs::read(&path).expect("read preserved file");
    assert_eq!(
        saved, initial_bytes,
        "file must not be touched when encode_text rejects the contents",
    );

    let _ = fs::remove_dir_all(dir);
}

// v0.17 app-store-quality: save-restore-regression slice 1.1
// — UTF-8 BOM round-trip across `open_text_file` →
// `save_text_file` → re-open. The codec-level round-trip is
// already covered in `tests::encoding::encode_text_*`, but
// the full file I/O path (atomic write + read + BOM
// re-prepend) is the App Store / sandbox evidence we want.
// A BOM mishandled at this layer would either silently strip
// the marker (visible to downstream tools that key off the
// BOM) or duplicate it on re-save (visible to anything that
// counts BOMs). The tests below pin both directions.

#[test]
fn utf8_bom_open_detects_label_and_strips_marker_from_contents() {
    let dir = unique_test_dir("utf8_bom_open");
    fs::create_dir_all(&dir).expect("create test dir");
    let path = dir.join("bom.md");
    let mut bytes = vec![0xEF, 0xBB, 0xBF];
    bytes.extend_from_slice("# Hello\n".as_bytes());
    fs::write(&path, &bytes).expect("write BOM fixture");

    let document = open_text_file_with_label(MAIN_WINDOW_LABEL, path.to_string_lossy().to_string())
        .expect("open utf-8-bom file");

    assert_eq!(document.encoding, "utf-8-bom");
    // The in-memory string must NOT carry a leading U+FEFF;
    // see `decode_text_bytes` for the strip-on-read contract.
    assert!(!document.contents.starts_with('\u{FEFF}'));
    assert_eq!(document.contents, "# Hello\n");

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn utf8_bom_save_preserves_bom_on_resave() {
    // Open a utf-8-bom file, edit, re-save with the same
    // encoding label, and assert the on-disk bytes still
    // start with the 3-byte BOM. This is the App Store
    // contract: re-saving never strips the BOM marker.
    let dir = unique_test_dir("utf8_bom_resave");
    fs::create_dir_all(&dir).expect("create test dir");
    let path = dir.join("bom.md");
    let mut bytes = vec![0xEF, 0xBB, 0xBF];
    bytes.extend_from_slice("# Hello\n".as_bytes());
    fs::write(&path, &bytes).expect("write BOM fixture");

    let document = open_text_file_with_label(MAIN_WINDOW_LABEL, path.to_string_lossy().to_string())
        .expect("open utf-8-bom file");
    assert_eq!(document.encoding, "utf-8-bom");

    save_text_file_with_label(
        MAIN_WINDOW_LABEL,
        path.to_string_lossy().to_string(),
        "# Hello (edited)\n".to_string(),
        document.fingerprint,
        document.line_ending,
        document.encoding,
    )
    .expect("save utf-8-bom document");

    let saved = fs::read(&path).expect("read saved file");
    assert_eq!(
        &saved[..3],
        &[0xEF, 0xBB, 0xBF],
        "BOM must be re-prepended on save, not stripped or duplicated",
    );
    assert_eq!(&saved[3..], b"# Hello (edited)\n");

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn utf8_bom_save_does_not_double_write_marker() {
    // A second-pass safety net: if a future refactor
    // accidentally re-prepends the BOM to a buffer that
    // already carries one, the on-disk bytes will have
    // 6 leading BOM bytes. The test reads the file back
    // after a no-op save and asserts the BOM is exactly
    // 3 bytes long.
    let dir = unique_test_dir("utf8_bom_nodouble");
    fs::create_dir_all(&dir).expect("create test dir");
    let path = dir.join("bom.md");
    let mut bytes = vec![0xEF, 0xBB, 0xBF];
    bytes.extend_from_slice("# Hello\n".as_bytes());
    fs::write(&path, &bytes).expect("write BOM fixture");

    let document = open_text_file_with_label(MAIN_WINDOW_LABEL, path.to_string_lossy().to_string())
        .expect("open utf-8-bom file");

    // Re-save with the exact same contents and fingerprint
    // (no edit). The on-disk BOM must remain 3 bytes.
    save_text_file_with_label(
        MAIN_WINDOW_LABEL,
        path.to_string_lossy().to_string(),
        document.contents.clone(),
        document.fingerprint,
        document.line_ending,
        document.encoding,
    )
    .expect("no-op save utf-8-bom document");

    let saved = fs::read(&path).expect("read saved file");
    // The on-disk bytes must start with exactly one BOM (3 bytes).
    // A double BOM bug would produce 6 leading bytes:
    // EF BB BF EF BB BF. We check both that the first 3
    // bytes are a BOM and that bytes 3-5 are NOT a BOM.
    assert_eq!(
        &saved[..3],
        &[0xEF, 0xBB, 0xBF],
        "BOM must appear exactly once (3 bytes)",
    );
    assert!(
        !saved[3..].starts_with(&[0xEF, 0xBB, 0xBF]),
        "double BOM must not be written (bytes 3-5 must not be a BOM)"
    );

    let _ = fs::remove_dir_all(dir);
}
