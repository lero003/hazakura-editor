use super::*;

#[test]
fn book_scope_resolves_markdown_in_requested_order_and_reports_unavailable() {
    let root = unique_test_dir("book_scope_order");
    fs::create_dir_all(root.join("chapters")).expect("create chapters");
    fs::write(root.join("chapters/one.md"), "# One\n").expect("write one");
    fs::write(root.join("chapters/two.markdown"), "# Two\n").expect("write two");
    fs::write(root.join("notes.txt"), "notes\n").expect("write txt");

    let result = resolve_book_scope_with_label(
        MAIN_WINDOW_LABEL,
        root.to_string_lossy().to_string(),
        vec![
            "chapters/two.markdown".into(),
            "missing.md".into(),
            "chapters/one.md".into(),
            "chapters/one.md".into(),
            "notes.txt".into(),
        ],
    )
    .expect("resolve scope");

    assert_eq!(
        result
            .chapters
            .iter()
            .map(|chapter| chapter.relative_path.as_str())
            .collect::<Vec<_>>(),
        vec!["chapters/two.markdown", "chapters/one.md"]
    );
    assert_eq!(result.unavailable.len(), 3);
    assert_eq!(result.unavailable[0].reason, "missing");
    assert_eq!(result.unavailable[1].reason, "duplicate");
    assert_eq!(result.unavailable[2].reason, "unsupported-extension");

    fs::remove_dir_all(root).expect("cleanup");
}

#[test]
fn book_scope_rejects_invalid_relative_paths_and_non_files() {
    let root = unique_test_dir("book_scope_invalid");
    fs::create_dir_all(root.join("folder.md")).expect("create directory");

    let result = resolve_book_scope_with_label(
        MAIN_WINDOW_LABEL,
        root.to_string_lossy().to_string(),
        vec![
            "/tmp/outside.md".into(),
            "../outside.md".into(),
            "folder.md".into(),
            "".into(),
        ],
    )
    .expect("resolve scope");

    assert!(result.chapters.is_empty());
    assert_eq!(
        result
            .unavailable
            .iter()
            .map(|entry| entry.reason.as_str())
            .collect::<Vec<_>>(),
        vec!["invalid-path", "invalid-path", "not-file", "invalid-path"]
    );

    fs::remove_dir_all(root).expect("cleanup");
}

#[cfg(unix)]
#[test]
fn book_scope_does_not_follow_symlinks() {
    use std::os::unix::fs::symlink;

    let root = unique_test_dir("book_scope_symlink");
    let outside = unique_test_dir("book_scope_symlink_outside");
    fs::create_dir_all(&root).expect("create root");
    fs::create_dir_all(&outside).expect("create outside");
    fs::write(outside.join("secret.md"), "secret\n").expect("write outside");
    symlink(outside.join("secret.md"), root.join("linked.md")).expect("create symlink");
    fs::create_dir_all(root.join("real")).expect("create real dir");
    fs::write(root.join("real/inside.md"), "inside\n").expect("write inside");
    symlink(root.join("real"), root.join("linked-dir")).expect("create directory symlink");

    let result = resolve_book_scope_with_label(
        MAIN_WINDOW_LABEL,
        root.to_string_lossy().to_string(),
        vec!["linked.md".into(), "linked-dir/inside.md".into()],
    )
    .expect("resolve scope");

    assert!(result.chapters.is_empty());
    assert_eq!(
        result
            .unavailable
            .iter()
            .map(|entry| entry.reason.as_str())
            .collect::<Vec<_>>(),
        vec!["symlink", "symlink"]
    );

    fs::remove_dir_all(root).expect("cleanup root");
    fs::remove_dir_all(outside).expect("cleanup outside");
}

#[test]
fn book_scope_enforces_main_window_and_input_limit() {
    let root = unique_test_dir("book_scope_limits");
    fs::create_dir_all(&root).expect("create root");

    let label_error =
        resolve_book_scope_with_label("agent", root.to_string_lossy().to_string(), Vec::new())
            .expect_err("agent window must be rejected");
    assert!(label_error.contains("not allowed"));

    let limit_error = resolve_book_scope_with_label(
        MAIN_WINDOW_LABEL,
        root.to_string_lossy().to_string(),
        (0..=MAX_BOOK_SCOPE_CHAPTERS)
            .map(|index| format!("{index}.md"))
            .collect(),
    )
    .expect_err("over-limit scope must be rejected");
    assert!(limit_error.contains("at most"));

    fs::remove_dir_all(root).expect("cleanup");
}
