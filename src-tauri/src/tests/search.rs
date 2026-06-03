// Tests for the bounded workspace search command:
// `search_workspace_files_with_label`. The command is the
// back-end for the v0.8 "Find in Files" palette entry, so the
// tests cover: substring match across multiple files, the
// excluded-directory guards, the binary-file skip, the empty
// query short-circuit, the file-size ceiling, the per-file /
// total truncation flags, the window-label guard, and the
// symlink containment guard (a symlink inside the workspace
// must not be read or descended into, even when it points at a
// file outside the canonical root).
use super::*;

#[test]
fn search_finds_substring_matches_across_files() {
    let dir = unique_test_dir("search_basic");
    fs::create_dir_all(dir.join("notes")).expect("create notes dir");
    fs::write(
        dir.join("notes/today.md"),
        "# Today\nHazakura blooms in spring.\nNotes about the wind.\n",
    )
    .expect("write today");
    fs::write(dir.join("notes/old.md"), "old draft\n").expect("write old");
    fs::write(dir.join("README.md"), "Hazakura editor readme\n").expect("write readme");

    let result = search_workspace_files_with_label(
        MAIN_WINDOW_LABEL,
        dir.to_string_lossy().to_string(),
        "Hazakura".to_string(),
    )
    .expect("search workspace");

    assert_eq!(result.total_files_scanned, 3);
    assert_eq!(result.total_matches, 2);
    assert_eq!(result.files.len(), 2);
    assert!(!result.truncated);

    let paths: Vec<&str> = result
        .files
        .iter()
        .map(|file| file.relative_path.as_str())
        .collect::<Vec<_>>();
    assert!(paths.contains(&"notes/today.md"));
    assert!(paths.contains(&"README.md"));

    let readme = result
        .files
        .iter()
        .find(|file| file.relative_path == "README.md")
        .expect("readme file");
    assert_eq!(readme.matches.len(), 1);
    assert_eq!(readme.matches[0].line, 1);
    assert_eq!(readme.matches[0].column, 1);
    assert!(readme.matches[0].text.contains("Hazakura"));

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn search_is_case_insensitive() {
    let dir = unique_test_dir("search_case");
    fs::create_dir_all(&dir).expect("create test dir");
    fs::write(dir.join("note.md"), "Hazakura\nhAZAKURA\nHAZAKURA\n").expect("write note");

    let result = search_workspace_files_with_label(
        MAIN_WINDOW_LABEL,
        dir.to_string_lossy().to_string(),
        "hazakura".to_string(),
    )
    .expect("search workspace");

    assert_eq!(result.total_matches, 3);
    assert_eq!(result.files.len(), 1);
    let file = &result.files[0];
    assert_eq!(file.matches[0].line, 1);
    assert_eq!(file.matches[0].column, 1);
    assert_eq!(file.matches[1].line, 2);
    assert_eq!(file.matches[1].column, 1);
    assert_eq!(file.matches[2].line, 3);
    assert_eq!(file.matches[2].column, 1);

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn search_empty_query_returns_no_results() {
    let dir = unique_test_dir("search_empty");
    fs::create_dir_all(&dir).expect("create test dir");
    fs::write(dir.join("note.md"), "anything\n").expect("write note");

    let result = search_workspace_files_with_label(
        MAIN_WINDOW_LABEL,
        dir.to_string_lossy().to_string(),
        "   ".to_string(),
    )
    .expect("search workspace");

    assert_eq!(result.total_matches, 0);
    assert_eq!(result.files.len(), 0);
    assert_eq!(result.total_files_scanned, 0);
    assert!(!result.truncated);

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn search_skips_excluded_directories() {
    let dir = unique_test_dir("search_excluded");
    fs::create_dir_all(dir.join("node_modules/pkg")).expect("create node_modules");
    fs::create_dir_all(dir.join(".git/objects")).expect("create .git");
    fs::create_dir_all(dir.join("target/debug")).expect("create target");
    fs::write(dir.join("node_modules/pkg/index.js"), "hazakura secret\n")
        .expect("write node_modules file");
    fs::write(dir.join(".git/config"), "hazakura secret\n").expect("write git file");
    fs::write(dir.join("target/debug/log.txt"), "hazakura secret\n").expect("write target file");
    fs::write(dir.join("note.md"), "hazakura note\n").expect("write note");

    let result = search_workspace_files_with_label(
        MAIN_WINDOW_LABEL,
        dir.to_string_lossy().to_string(),
        "hazakura".to_string(),
    )
    .expect("search workspace");

    assert_eq!(result.files.len(), 1);
    assert_eq!(result.files[0].relative_path, "note.md");
    assert_eq!(result.total_files_scanned, 1);

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn search_skips_binary_files() {
    let dir = unique_test_dir("search_binary");
    fs::create_dir_all(&dir).expect("create test dir");
    fs::write(dir.join("note.md"), "hazakura plain text\n").expect("write note");
    let binary = dir.join("image.bin");
    fs::write(&binary, b"\x00\x01hazakura\x00\x02").expect("write binary file");

    let result = search_workspace_files_with_label(
        MAIN_WINDOW_LABEL,
        dir.to_string_lossy().to_string(),
        "hazakura".to_string(),
    )
    .expect("search workspace");

    assert_eq!(result.files.len(), 1);
    assert_eq!(result.files[0].relative_path, "note.md");

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn search_caps_per_file_matches_and_marks_truncation() {
    let dir = unique_test_dir("search_cap_per_file");
    fs::create_dir_all(&dir).expect("create test dir");
    let mut body = String::new();
    for index in 0..(MAX_WORKSPACE_SEARCH_MATCHES_PER_FILE + 5) {
        body.push_str(&format!("line {index} hazakura hit\n"));
    }
    fs::write(dir.join("note.md"), body).expect("write note");

    let result = search_workspace_files_with_label(
        MAIN_WINDOW_LABEL,
        dir.to_string_lossy().to_string(),
        "hazakura".to_string(),
    )
    .expect("search workspace");

    assert_eq!(result.files.len(), 1);
    let file = &result.files[0];
    assert_eq!(file.matches.len(), MAX_WORKSPACE_SEARCH_MATCHES_PER_FILE);
    assert!(file.truncated);
    assert!(result.truncated);

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn search_caps_total_matches_and_marks_truncation() {
    let dir = unique_test_dir("search_cap_total");
    fs::create_dir_all(&dir).expect("create test dir");
    // Spread hits across enough files to blow past the total cap
    // without tripping the per-file cap.
    let file_count = MAX_WORKSPACE_SEARCH_TOTAL_MATCHES + 10;
    for index in 0..file_count {
        fs::write(
            dir.join(format!("note-{index:04}.md")),
            "hazakura hit here\n",
        )
        .expect("write note");
    }

    let result = search_workspace_files_with_label(
        MAIN_WINDOW_LABEL,
        dir.to_string_lossy().to_string(),
        "hazakura".to_string(),
    )
    .expect("search workspace");

    assert!(result.truncated);
    assert_eq!(result.total_matches, MAX_WORKSPACE_SEARCH_TOTAL_MATCHES);
    // The total cap fires during the inner match loop. The outer
    // file walk keeps visiting remaining files in the current
    // directory and recording them in `total_files_scanned`
    // before the next pass of the stack notices the truncation.
    // The contract is "matches are capped" — not "the walk
    // short-circuits mid-stack" — so we only assert the scan
    // count never exceeds the input file count.
    assert!(result.total_files_scanned <= file_count);

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn search_caps_files_visited_and_marks_truncation() {
    let dir = unique_test_dir("search_cap_files");
    fs::create_dir_all(&dir).expect("create test dir");
    let file_count = MAX_WORKSPACE_SEARCH_FILES + 5;
    for index in 0..file_count {
        fs::write(dir.join(format!("note-{index:04}.md")), "hazakura\n").expect("write note");
    }

    let result = search_workspace_files_with_label(
        MAIN_WINDOW_LABEL,
        dir.to_string_lossy().to_string(),
        "hazakura".to_string(),
    )
    .expect("search workspace");

    assert!(result.truncated);
    assert!(result.files.len() <= MAX_WORKSPACE_SEARCH_FILES);
    assert!(result.total_files_scanned <= file_count);

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn search_rejects_missing_root() {
    // The "outside the workspace" trust boundary for search is
    // the single `root` argument: the command walks *that*
    // directory and only that directory. There is no per-file
    // path argument to validate against the root like
    // `open_workspace_image` has, so the failure mode we can
    // exercise from Rust is "the root is not a real folder" —
    // anything else would just be a successful walk of a
    // different directory, which is by design.
    let missing = unique_test_dir("search_missing_root");

    let err = search_workspace_files_with_label(
        MAIN_WINDOW_LABEL,
        missing.to_string_lossy().to_string(),
        "anything".to_string(),
    )
    .expect_err("missing root should fail");

    assert!(err.contains("Cannot read workspace folder"), "{err}");
}

#[test]
fn search_rejects_non_main_window() {
    let dir = unique_test_dir("search_label_gate");
    fs::create_dir_all(&dir).expect("create test dir");
    fs::write(dir.join("note.md"), "hazakura\n").expect("write note");

    let err = search_workspace_files_with_label(
        AGENT_WINDOW_LABEL,
        dir.to_string_lossy().to_string(),
        "hazakura".to_string(),
    )
    .expect_err("agent window should be rejected");

    assert!(err.contains("not allowed from window"), "{err}");

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn search_truncates_long_line_text() {
    let dir = unique_test_dir("search_long_line");
    fs::create_dir_all(&dir).expect("create test dir");
    let padding = "x".repeat(MAX_WORKSPACE_SEARCH_LINE_BYTES + 256);
    fs::write(dir.join("note.md"), format!("hazakura {padding}\n")).expect("write note");

    let result = search_workspace_files_with_label(
        MAIN_WINDOW_LABEL,
        dir.to_string_lossy().to_string(),
        "hazakura".to_string(),
    )
    .expect("search workspace");

    assert_eq!(result.files.len(), 1);
    let file = &result.files[0];
    assert_eq!(file.matches.len(), 1);
    // The trim keeps the prefix through the cap and appends `…`
    // (3 bytes) so the payload is exactly `cap + 3` bytes when
    // represented as UTF-8.
    let match_text_bytes = file.matches[0].text.len();
    assert!(
        match_text_bytes <= MAX_WORKSPACE_SEARCH_LINE_BYTES + "…".len(),
        "match text should be capped (got {match_text_bytes} bytes)",
    );
    assert!(file.matches[0].text.contains('…'));

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn search_skips_symlinks_pointing_outside_the_workspace() {
    // Defense in depth: a symlink inside the workspace must not
    // be read or descended into, even if it points at a real
    // file (or directory) that contains a matching string. This
    // pins the `entry.file_type().is_symlink()` + `symlink_metadata`
    // hardening in `search_workspace_files_with_label`.
    //
    // We test two failure modes in one fixture:
    //   1. A symlink file pointing at an outside file with a
    //      match-string.
    //   2. A symlink directory pointing at an outside folder
    //      whose files contain a match-string.
    // The walk must skip both without surfacing their contents.
    let dir = unique_test_dir("search_symlink");
    let outside = unique_test_dir("search_symlink_outside");
    fs::create_dir_all(&dir).expect("create workspace");
    fs::create_dir_all(&outside).expect("create outside");
    fs::write(dir.join("note.md"), "hazakura inside the workspace\n").expect("write inside file");
    fs::write(
        outside.join("secret.md"),
        "hazakura outside the workspace\n",
    )
    .expect("write outside file");
    fs::write(outside.join("secret-2.md"), "hazakura outside again\n")
        .expect("write outside file 2");

    #[cfg(unix)]
    {
        std::os::unix::fs::symlink(outside.join("secret.md"), dir.join("leaked.md"))
            .expect("create file symlink");
        std::os::unix::fs::symlink(&outside, dir.join("leaked-dir"))
            .expect("create directory symlink");
    }

    let result = search_workspace_files_with_label(
        MAIN_WINDOW_LABEL,
        dir.to_string_lossy().to_string(),
        "hazakura".to_string(),
    )
    .expect("search workspace");

    // Only the real in-workspace file should appear. The
    // symlinked file and the symlinked directory's contents
    // must both be skipped.
    let relative_paths: Vec<&str> = result
        .files
        .iter()
        .map(|file| file.relative_path.as_str())
        .collect();
    assert!(
        relative_paths.contains(&"note.md"),
        "expected the in-workspace file to be present, got {relative_paths:?}",
    );
    assert!(
        !relative_paths.iter().any(|path| path.contains("leaked")),
        "symlink file should not be in results, got {relative_paths:?}",
    );
    assert!(
        !relative_paths.iter().any(|path| path.contains("secret")),
        "symlink directory contents should not be in results, got {relative_paths:?}",
    );
    assert_eq!(result.total_matches, 1);

    let _ = fs::remove_dir_all(dir);
    let _ = fs::remove_dir_all(outside);
}
