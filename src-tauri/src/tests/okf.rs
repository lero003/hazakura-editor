// Tests for v1.11 OKF bounded discovery (`scan_okf_bundle_with_label`).
use super::*;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc;
use std::sync::Arc;
use std::thread;
use std::time::Duration;

#[test]
fn okf_scan_reads_markdown_only_in_stable_order() {
    let dir = unique_test_dir("okf_basic");
    fs::create_dir_all(dir.join("chapters")).expect("create chapters");
    fs::write(
        dir.join("index.md"),
        "---\nokf_version: \"0.1\"\n---\n\n# Root\n",
    )
    .expect("write index");
    fs::write(dir.join("chapters/a.md"), "---\ntype: Note\n---\n\nA\n").expect("write a");
    fs::write(dir.join("chapters/b.md"), "---\ntype: Note\n---\n\nB\n").expect("write b");
    fs::write(dir.join("notes.txt"), "ignored\n").expect("write txt");
    fs::write(dir.join("image.png"), [0u8; 8]).expect("write png");

    let result = scan_okf_bundle_with_label(
        MAIN_WINDOW_LABEL,
        None,
        dir.to_string_lossy().to_string(),
        dir.to_string_lossy().to_string(),
    )
    .expect("scan okf");

    assert_eq!(result.source, "disk");
    assert!(!result.cancelled);
    assert!(!result.truncated);
    assert_eq!(result.scanned_markdown_files, 3);
    assert_eq!(
        result
            .files
            .iter()
            .map(|file| file.relative_path.as_str())
            .collect::<Vec<_>>(),
        vec!["chapters/a.md", "chapters/b.md", "index.md"]
    );
    assert!(result.files.iter().all(|file| file.content.is_some()));

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn okf_scan_rejects_non_main_window() {
    let dir = unique_test_dir("okf_window");
    fs::create_dir_all(&dir).expect("create dir");
    let err = scan_okf_bundle_with_label(
        AGENT_WINDOW_LABEL,
        None,
        dir.to_string_lossy().to_string(),
        dir.to_string_lossy().to_string(),
    )
    .expect_err("agent window must be rejected");
    assert!(err.contains("not allowed"));
    let _ = fs::remove_dir_all(dir);
}

#[test]
fn okf_scan_rejects_path_outside_workspace() {
    let workspace = unique_test_dir("okf_ws");
    let outside = unique_test_dir("okf_outside");
    fs::create_dir_all(&workspace).expect("workspace");
    fs::create_dir_all(&outside).expect("outside");

    let err = scan_okf_bundle_with_label(
        MAIN_WINDOW_LABEL,
        None,
        workspace.to_string_lossy().to_string(),
        outside.to_string_lossy().to_string(),
    )
    .expect_err("outside path must fail");
    assert!(
        err.contains("outside") || err.contains("workspace"),
        "unexpected error: {err}"
    );

    let _ = fs::remove_dir_all(workspace);
    let _ = fs::remove_dir_all(outside);
}

#[test]
fn okf_scan_skips_symlinks() {
    let dir = unique_test_dir("okf_symlink");
    let outside = unique_test_dir("okf_symlink_target");
    fs::create_dir_all(&dir).expect("dir");
    fs::create_dir_all(&outside).expect("outside");
    fs::write(
        outside.join("secret.md"),
        "---\ntype: Note\n---\n\nsecret\n",
    )
    .expect("secret");
    fs::write(dir.join("local.md"), "---\ntype: Note\n---\n\nlocal\n").expect("local");

    #[cfg(unix)]
    {
        use std::os::unix::fs::symlink;
        symlink(outside.join("secret.md"), dir.join("linked.md")).expect("symlink file");
        symlink(&outside, dir.join("linked-dir")).expect("symlink dir");
    }

    let result = scan_okf_bundle_with_label(
        MAIN_WINDOW_LABEL,
        None,
        dir.to_string_lossy().to_string(),
        dir.to_string_lossy().to_string(),
    )
    .expect("scan");

    assert_eq!(result.scanned_markdown_files, 1);
    assert_eq!(result.files[0].relative_path, "local.md");

    let _ = fs::remove_dir_all(dir);
    let _ = fs::remove_dir_all(outside);
}

#[test]
fn okf_scan_rejects_symlink_bundle_root() {
    let workspace = unique_test_dir("okf_symlink_root_ws");
    let real = workspace.join("real-bundle");
    fs::create_dir_all(&real).expect("real");
    fs::write(real.join("a.md"), "---\ntype: Note\n---\n\nA\n").expect("a");
    let link = workspace.join("linked-root");

    #[cfg(unix)]
    {
        use std::os::unix::fs::symlink;
        symlink(&real, &link).expect("symlink root");

        let err = scan_okf_bundle_with_label(
            MAIN_WINDOW_LABEL,
            None,
            workspace.to_string_lossy().to_string(),
            link.to_string_lossy().to_string(),
        )
        .expect_err("symlink root must be rejected");
        assert!(err.contains("symlink"), "unexpected error: {err}");
    }

    let _ = fs::remove_dir_all(workspace);
}

#[cfg(unix)]
#[test]
fn okf_bounded_read_rejects_file_replaced_by_symlink_after_metadata() {
    use std::os::unix::fs::symlink;

    let dir = unique_test_dir("okf_symlink_swap");
    let outside = unique_test_dir("okf_symlink_swap_outside");
    fs::create_dir_all(&dir).expect("dir");
    fs::create_dir_all(&outside).expect("outside");
    let candidate = dir.join("candidate.md");
    let original = dir.join("candidate-original.md");
    let secret = outside.join("secret.md");
    fs::write(&candidate, "---\ntype: Note\n---\n\ninside\n").expect("candidate");
    fs::write(&secret, "outside secret\n").expect("secret");
    let expected = fs::symlink_metadata(&candidate).expect("metadata before swap");

    fs::rename(&candidate, &original).expect("preserve original");
    symlink(&secret, &candidate).expect("replace with symlink");

    let err = read_file_bounded(&candidate, 1024, &expected)
        .expect_err("open-time identity check must reject the replacement");
    assert!(err.contains("changed during OKF scan"), "unexpected: {err}");

    let _ = fs::remove_dir_all(dir);
    let _ = fs::remove_dir_all(outside);
}

#[test]
fn okf_scan_marks_non_utf8_unreadable() {
    let dir = unique_test_dir("okf_utf8");
    fs::create_dir_all(&dir).expect("dir");
    fs::write(dir.join("ok.md"), "---\ntype: Note\n---\n\nutf8\n").expect("ok");
    fs::write(dir.join("bad.md"), [0x80u8, 0x81, 0x82, b'\n']).expect("bad");

    let result = scan_okf_bundle_with_label(
        MAIN_WINDOW_LABEL,
        None,
        dir.to_string_lossy().to_string(),
        dir.to_string_lossy().to_string(),
    )
    .expect("scan");

    let bad = result
        .files
        .iter()
        .find(|file| file.relative_path == "bad.md")
        .expect("bad file");
    assert!(bad.content.is_none());
    assert_eq!(bad.unreadable_reason.as_deref(), Some("non-utf8"));
    // Non-UTF-8 bytes still count toward the total read budget.
    assert!(result.total_bytes_read >= bad.byte_length);

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn okf_scan_counts_non_utf8_toward_total_budget() {
    let dir = unique_test_dir("okf_total_nonutf8");
    fs::create_dir_all(&dir).expect("dir");

    // Two non-UTF-8 files whose combined size exceeds a tiny simulated budget
    // path: use real MAX budget by creating enough large non-utf8 payloads.
    // Keep this practical: write files just under MAX_OKF_FILE_BYTES but
    // ensure total_bytes_read accumulates even when decode fails.
    let chunk = vec![0xFFu8; 1024 * 64]; // 64 KiB invalid UTF-8
    for index in 0..8 {
        fs::write(dir.join(format!("bad{index:02}.md")), &chunk).expect("write bad");
    }
    fs::write(dir.join("ok.md"), "---\ntype: Note\n---\n\nok\n").expect("ok");

    let result = scan_okf_bundle_with_label(
        MAIN_WINDOW_LABEL,
        None,
        dir.to_string_lossy().to_string(),
        dir.to_string_lossy().to_string(),
    )
    .expect("scan");

    let non_utf8_total: u64 = result
        .files
        .iter()
        .filter(|file| file.unreadable_reason.as_deref() == Some("non-utf8"))
        .map(|file| file.byte_length)
        .sum();
    assert!(non_utf8_total > 0);
    assert!(
        result.total_bytes_read >= non_utf8_total,
        "total_bytes_read={} non_utf8_total={}",
        result.total_bytes_read,
        non_utf8_total
    );

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn okf_scan_respects_markdown_file_budget() {
    let dir = unique_test_dir("okf_budget_files");
    fs::create_dir_all(&dir).expect("dir");
    for index in 0..(MAX_OKF_MARKDOWN_FILES + 5) {
        fs::write(
            dir.join(format!("f{index:04}.md")),
            format!("---\ntype: Note\n---\n\n{index}\n"),
        )
        .expect("write");
    }

    let result = scan_okf_bundle_with_label(
        MAIN_WINDOW_LABEL,
        None,
        dir.to_string_lossy().to_string(),
        dir.to_string_lossy().to_string(),
    )
    .expect("scan");

    assert!(result.truncated);
    assert_eq!(result.truncation_reason.as_deref(), Some("markdown-files"));
    assert!(result.scanned_markdown_files <= MAX_OKF_MARKDOWN_FILES);
    assert!(result.files.len() <= MAX_OKF_MARKDOWN_FILES);

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn okf_scan_respects_walk_entry_budget() {
    let dir = unique_test_dir("okf_walk_budget");
    // Create more directory entries than MAX_OKF_WALK_ENTRIES.
    // Use nested folders of non-md files to inflate walk count cheaply.
    let bulk = dir.join("bulk");
    fs::create_dir_all(&bulk).expect("bulk");
    for index in 0..(MAX_OKF_WALK_ENTRIES + 50) {
        fs::write(bulk.join(format!("n{index:05}.txt")), b"x").expect("txt");
    }
    fs::write(dir.join("only.md"), "---\ntype: Note\n---\n\nA\n").expect("md");

    let result = scan_okf_bundle_with_label(
        MAIN_WINDOW_LABEL,
        None,
        dir.to_string_lossy().to_string(),
        dir.to_string_lossy().to_string(),
    )
    .expect("scan");

    assert!(result.truncated);
    assert_eq!(result.truncation_reason.as_deref(), Some("walk-entries"));
    assert!(result.scanned_entries >= MAX_OKF_WALK_ENTRIES);

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn okf_scan_respects_depth_budget() {
    let dir = unique_test_dir("okf_depth");
    let mut current = dir.clone();
    for level in 0..=(MAX_OKF_DEPTH + 2) {
        current = current.join(format!("d{level}"));
        fs::create_dir_all(&current).expect("mkdir");
    }
    fs::write(current.join("deep.md"), "---\ntype: Note\n---\n\ndeep\n").expect("deep");
    fs::write(dir.join("root.md"), "---\ntype: Note\n---\n\nroot\n").expect("root");

    let result = scan_okf_bundle_with_label(
        MAIN_WINDOW_LABEL,
        None,
        dir.to_string_lossy().to_string(),
        dir.to_string_lossy().to_string(),
    )
    .expect("scan");

    assert!(result.truncated);
    assert_eq!(result.truncation_reason.as_deref(), Some("depth"));
    assert!(result
        .files
        .iter()
        .any(|file| file.relative_path == "root.md"));
    assert!(
        !result
            .files
            .iter()
            .any(|file| file.relative_path.ends_with("deep.md")),
        "deep file beyond MAX_OKF_DEPTH must not be read"
    );

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn okf_scan_respects_file_byte_budget() {
    let dir = unique_test_dir("okf_file_bytes");
    fs::create_dir_all(&dir).expect("dir");
    let oversized = vec![b'a'; (MAX_OKF_FILE_BYTES as usize) + 8];
    fs::write(dir.join("big.md"), &oversized).expect("big");
    fs::write(dir.join("small.md"), "---\ntype: Note\n---\n\nS\n").expect("small");

    let result = scan_okf_bundle_with_label(
        MAIN_WINDOW_LABEL,
        None,
        dir.to_string_lossy().to_string(),
        dir.to_string_lossy().to_string(),
    )
    .expect("scan");

    assert!(result.truncated);
    assert_eq!(result.truncation_reason.as_deref(), Some("file-bytes"));
    let big = result
        .files
        .iter()
        .find(|file| file.relative_path == "big.md")
        .expect("big");
    assert_eq!(big.unreadable_reason.as_deref(), Some("over-budget"));
    assert!(big.content.is_none());

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn okf_scan_respects_total_byte_budget_with_reads() {
    let dir = unique_test_dir("okf_total_bytes");
    fs::create_dir_all(&dir).expect("dir");
    // Each file is 8 MiB of valid UTF-8 so five files exceed 32 MiB total.
    let payload = vec![b'x'; 8 * 1024 * 1024];
    for index in 0..5 {
        let mut body = b"---\ntype: Note\n---\n\n".to_vec();
        body.extend_from_slice(&payload);
        fs::write(dir.join(format!("p{index}.md")), body).expect("write");
    }

    let result = scan_okf_bundle_with_label(
        MAIN_WINDOW_LABEL,
        None,
        dir.to_string_lossy().to_string(),
        dir.to_string_lossy().to_string(),
    )
    .expect("scan");

    assert!(result.truncated);
    assert_eq!(result.truncation_reason.as_deref(), Some("total-bytes"));
    assert!(result.total_bytes_read <= MAX_OKF_TOTAL_BYTES + (8 * 1024 * 1024));
    // At least one file should be present; not all five fully accepted.
    assert!(result.files.len() < 5 || result.files.iter().any(|f| f.content.is_none()));

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn okf_scan_can_cancel_midway_with_handshake() {
    let dir = unique_test_dir("okf_cancel");
    fs::create_dir_all(&dir).expect("dir");
    // Stay under MAX_OKF_MARKDOWN_FILES so cancel cannot be confused with
    // the markdown-files budget.
    for index in 0..40 {
        fs::write(
            dir.join(format!("c{index:02}.md")),
            format!("---\ntype: Note\n---\n\n{index}\n"),
        )
        .expect("write");
    }

    let flag = Arc::new(AtomicBool::new(false));
    let (progress_tx, progress_rx) = mpsc::sync_channel(1);
    let (cancel_tx, cancel_rx) = mpsc::sync_channel(1);
    let armed_progress = AtomicBool::new(false);
    let cancel_thread = {
        let flag = Arc::clone(&flag);
        thread::spawn(move || {
            // Wait until the walk has read at least one Markdown file.
            progress_rx
                .recv_timeout(Duration::from_secs(5))
                .expect("scan must report first Markdown progress");
            flag.store(true, Ordering::SeqCst);
            // Release the walk so it observes cancel on the next check.
            cancel_tx.send(()).expect("acknowledge cancel");
        })
    };

    let canonical_dir = fs::canonicalize(&dir).expect("canonical test dir");

    let result = scan_okf_bundle_inner(
        &canonical_dir,
        Some(flag.as_ref()),
        Some(&|progress: OkfScanProgress| {
            if progress.scanned_entries >= 1
                && progress.scanned_markdown_files >= 1
                && !armed_progress.swap(true, Ordering::SeqCst)
            {
                progress_tx.send(()).expect("report first progress");
                cancel_rx
                    .recv_timeout(Duration::from_secs(5))
                    .expect("cancel thread must acknowledge");
            }
        }),
    )
    .expect("scan");
    cancel_thread.join().expect("join cancel thread");

    assert!(
        result.cancelled,
        "expected cancelled=true after barrier cancel, got files={} truncated={:?}",
        result.files.len(),
        result.truncation_reason
    );
    assert!(result.files.len() < 40);

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn okf_scan_rejects_concurrent_scan() {
    let store = OkfDiscoveryCancelStore::default();
    let first = store.try_arm().expect("first arm");
    let second = store.try_arm();
    assert!(second.is_err(), "second concurrent arm must fail");
    assert!(second.err().unwrap_or_default().contains("already running"));
    first.store(true, Ordering::SeqCst);
    store.disarm();
    let _ = store.try_arm().expect("arm after disarm");
    store.disarm();
}

#[test]
fn okf_scan_rejects_subfolder_escape_via_parent() {
    let workspace = unique_test_dir("okf_parent_ws");
    fs::create_dir_all(workspace.join("bundle")).expect("bundle");
    fs::write(workspace.join("bundle/a.md"), "---\ntype: Note\n---\n\nA\n").expect("a");

    let err = scan_okf_bundle_with_label(
        MAIN_WINDOW_LABEL,
        None,
        workspace.join("bundle").to_string_lossy().to_string(),
        workspace.to_string_lossy().to_string(),
    )
    .expect_err("parent of workspace must fail");
    assert!(
        err.contains("outside") || err.contains("workspace"),
        "unexpected error: {err}"
    );

    let _ = fs::remove_dir_all(workspace);
}

#[test]
fn okf_budget_constants_match_contract() {
    assert_eq!(MAX_OKF_WALK_ENTRIES, 2_000);
    assert_eq!(MAX_OKF_MARKDOWN_FILES, 200);
    assert_eq!(MAX_OKF_FILE_BYTES, 10 * 1024 * 1024);
    assert_eq!(MAX_OKF_TOTAL_BYTES, 32 * 1024 * 1024);
    assert_eq!(MAX_OKF_DEPTH, 16);
}

#[test]
fn okf_scaffold_creates_files_inside_workspace() {
    let workspace = unique_test_dir("okf_scaffold_ws");
    let parent = workspace.join("drafts");
    fs::create_dir_all(&parent).expect("parent");

    let result = create_okf_scaffold_with_label(
        MAIN_WINDOW_LABEL,
        &workspace.to_string_lossy(),
        &parent.to_string_lossy(),
        "知識フォルダ",
        vec![
            OkfScaffoldFileInput {
                relative_path: "index.md".into(),
                contents: "---\nokf_version: \"0.1\"\n---\n\n# Root\n".into(),
            },
            OkfScaffoldFileInput {
                relative_path: "notes/first-note.md".into(),
                contents: "---\ntype: Note\n---\n\nBody\n".into(),
            },
        ],
        Some("index.md"),
    )
    .expect("create scaffold");

    let root = PathBuf::from(&result.root_path);
    assert!(root.ends_with("知識フォルダ"));
    assert!(root.join("index.md").is_file());
    assert!(root.join("notes/first-note.md").is_file());
    assert_eq!(result.created_files.len(), 2);
    assert_eq!(
        result.open_path.as_deref(),
        Some(root.join("index.md").to_string_lossy().as_ref())
    );
}

#[test]
fn okf_scaffold_rejects_existing_folder() {
    let workspace = unique_test_dir("okf_scaffold_exists");
    let existing = workspace.join("知識フォルダ");
    fs::create_dir_all(&existing).expect("existing");

    let err = create_okf_scaffold_with_label(
        MAIN_WINDOW_LABEL,
        &workspace.to_string_lossy(),
        &workspace.to_string_lossy(),
        "知識フォルダ",
        vec![OkfScaffoldFileInput {
            relative_path: "index.md".into(),
            contents: "# x\n".into(),
        }],
        None,
    )
    .expect_err("must refuse existing");
    assert!(err.to_lowercase().contains("already exists") || err.contains("already"));
}

#[test]
fn okf_scaffold_rejects_path_escape_and_agent_window() {
    let workspace = unique_test_dir("okf_scaffold_escape");
    fs::create_dir_all(&workspace).expect("workspace");
    let err = create_okf_scaffold_with_label(
        MAIN_WINDOW_LABEL,
        &workspace.to_string_lossy(),
        &workspace.to_string_lossy(),
        "safe",
        vec![OkfScaffoldFileInput {
            relative_path: "../escape.md".into(),
            contents: "nope\n".into(),
        }],
        None,
    )
    .expect_err("escape");
    assert!(err.contains("..") || err.to_lowercase().contains("invalid"));

    let agent_err = create_okf_scaffold_with_label(
        AGENT_WINDOW_LABEL,
        &workspace.to_string_lossy(),
        &workspace.to_string_lossy(),
        "safe",
        vec![OkfScaffoldFileInput {
            relative_path: "index.md".into(),
            contents: "# x\n".into(),
        }],
        None,
    )
    .expect_err("agent window");
    assert!(!agent_err.is_empty());
}

#[test]
fn okf_scaffold_rejects_non_markdown() {
    let workspace = unique_test_dir("okf_scaffold_md");
    fs::create_dir_all(&workspace).expect("workspace");
    let err = create_okf_scaffold_with_label(
        MAIN_WINDOW_LABEL,
        &workspace.to_string_lossy(),
        &workspace.to_string_lossy(),
        "safe",
        vec![OkfScaffoldFileInput {
            relative_path: "notes/readme.txt".into(),
            contents: "x\n".into(),
        }],
        None,
    )
    .expect_err("non md");
    assert!(err.contains("Markdown") || err.contains(".md"));
}

#[test]
fn okf_scaffold_rejects_unclean_paths_names_and_contents() {
    let workspace = unique_test_dir("okf_scaffold_strict");
    fs::create_dir_all(&workspace).expect("workspace");

    for relative_path in ["/absolute.md", "notes//draft.md", "notes/./draft.md"] {
        let err = create_okf_scaffold_with_label(
            MAIN_WINDOW_LABEL,
            &workspace.to_string_lossy(),
            &workspace.to_string_lossy(),
            "safe",
            vec![OkfScaffoldFileInput {
                relative_path: relative_path.into(),
                contents: "# safe\n".into(),
            }],
            None,
        )
        .expect_err("unclean path");
        assert!(err.contains("relative") || err.contains("segment"));
    }

    let name_err = create_okf_scaffold_with_label(
        MAIN_WINDOW_LABEL,
        &workspace.to_string_lossy(),
        &workspace.to_string_lossy(),
        " safe ",
        vec![OkfScaffoldFileInput {
            relative_path: "index.md".into(),
            contents: "# safe\n".into(),
        }],
        None,
    )
    .expect_err("surrounding whitespace");
    assert!(name_err.contains("whitespace"));

    let content_err = create_okf_scaffold_with_label(
        MAIN_WINDOW_LABEL,
        &workspace.to_string_lossy(),
        &workspace.to_string_lossy(),
        "safe",
        vec![OkfScaffoldFileInput {
            relative_path: "index.md".into(),
            contents: "# safe\0hidden\n".into(),
        }],
        None,
    )
    .expect_err("NUL content");
    assert!(content_err.contains("NUL"));
}

#[test]
fn okf_scaffold_cleanup_preserves_unexpected_raced_content() {
    let workspace = unique_test_dir("okf_scaffold_cleanup");
    let root = workspace.join("safe");
    let notes = root.join("notes");
    fs::create_dir_all(&notes).expect("notes");
    let created = notes.join("created.md");
    let unexpected = root.join("unexpected.md");
    fs::write(&created, "created\n").expect("created file");
    fs::write(&unexpected, "external\n").expect("unexpected file");
    let planned = vec![(
        created.clone(),
        "notes/created.md".to_string(),
        "created\n".to_string(),
    )];

    let complete = cleanup_scaffold_creation(&root, &planned, &[created.clone()]);

    assert!(
        !complete,
        "unexpected content should make cleanup incomplete"
    );
    assert!(!created.exists());
    assert!(
        unexpected.exists(),
        "cleanup must preserve unexpected content"
    );
}
