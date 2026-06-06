// --- Window-label gate (security boundary) ---------------------------------
//
// The detached Agent window is a separate Tauri webview with its own
// capability file. Custom `#[tauri::command]` functions are
// auto-allowlisted for any window listed in *any* capability file, so
// the agent window could in principle invoke every project command
// unless we gate by `window.label()` on the server side. These tests
// pin the gate so the boundary cannot drift silently.
use super::*;

const UNKNOWN_WINDOW_LABEL: &str = "unknown-window";

#[test]
fn label_gate_helpers_reject_unknown_label() {
    let err = ensure_label_is_main(UNKNOWN_WINDOW_LABEL).expect_err("unknown label must fail");
    assert!(err.contains(UNKNOWN_WINDOW_LABEL));

    let err =
        ensure_label_is_main_or_agent(UNKNOWN_WINDOW_LABEL).expect_err("unknown label must fail");
    assert!(err.contains(UNKNOWN_WINDOW_LABEL));

    let err = ensure_label_is_main_or_apple_assist(UNKNOWN_WINDOW_LABEL)
        .expect_err("unknown label must fail");
    assert!(err.contains(UNKNOWN_WINDOW_LABEL));
}

#[test]
fn label_gate_helpers_accept_known_labels() {
    ensure_label_is_main(MAIN_WINDOW_LABEL).expect("main must be allowed");
    ensure_label_is_main_or_agent(MAIN_WINDOW_LABEL).expect("main must be allowed");
    ensure_label_is_main_or_agent(AGENT_WINDOW_LABEL).expect("agent must be allowed");
    ensure_label_is_main_or_apple_assist(MAIN_WINDOW_LABEL)
        .expect("main must be allowed for apple-assist gate");
    ensure_label_is_main_or_apple_assist(APPLE_ASSIST_WINDOW_LABEL)
        .expect("apple-assist must be allowed for apple-assist gate");
    ensure_label_is_apple_assist(APPLE_ASSIST_WINDOW_LABEL)
        .expect("apple-assist must be allowed for apple-assist-only gate");
}

#[test]
fn agent_workbench_distribution_gate_rejects_app_store_lane() {
    let err = ensure_agent_workbench_allowed_for_lane(Some("app-store"))
        .expect_err("App Store distribution lane must reject Agent Workbench");

    assert!(err.contains("Agent Workbench"), "{err}");
    assert!(err.contains("App Store"), "{err}");
}

#[test]
fn app_store_distribution_lane_detection_is_case_insensitive() {
    assert!(is_app_store_distribution_lane_for_lane(Some("app-store")));
    assert!(is_app_store_distribution_lane_for_lane(Some("App-Store")));
    assert!(!is_app_store_distribution_lane_for_lane(Some("developer")));
    assert!(!is_app_store_distribution_lane_for_lane(None));
}

#[test]
fn agent_workbench_distribution_gate_allows_developer_lane() {
    ensure_agent_workbench_allowed_for_lane(None).expect("default lane must allow Agent Workbench");
    ensure_agent_workbench_allowed_for_lane(Some("developer"))
        .expect("developer lane must allow Agent Workbench");
}

#[test]
fn app_store_distribution_lane_rejects_agent_window_reverse_link() {
    open_main_agent_pane_with_label_for_lane(MAIN_WINDOW_LABEL, Some("developer"))
        .expect("developer lane may route the Agent reverse-link");

    let err = open_main_agent_pane_with_label_for_lane(MAIN_WINDOW_LABEL, Some("app-store"))
        .expect_err("App Store lane must reject Agent reverse-link IPC");
    assert!(err.contains("Agent Workbench"), "{err}");
    assert!(err.contains("App Store"), "{err}");
}

#[test]
fn app_store_distribution_lane_rejects_agent_window_theme_ipc() {
    set_agent_window_theme_with_label_for_lane(MAIN_WINDOW_LABEL, Some("developer"))
        .expect("developer lane may update the Agent window theme");

    let err = set_agent_window_theme_with_label_for_lane(MAIN_WINDOW_LABEL, Some("app-store"))
        .expect_err("App Store lane must reject Agent window theme IPC");
    assert!(err.contains("Agent Workbench"), "{err}");
    assert!(err.contains("App Store"), "{err}");
}

#[test]
fn label_gate_apple_assist_rejects_agent_label() {
    // The Apple Assist window and the Agent window are mutually
    // exclusive companion slots, but their label gates are
    // independent: a Tauri command guarded by
    // `ensure_label_is_main_or_apple_assist` must NOT accept
    // the `agent` label, and vice versa. The companion-slot
    // mutual exclusion is enforced server-side by the window
    // open commands (closing the other window before opening
    // the new one), not by relaxing the per-command gates.
    let err = ensure_label_is_main_or_apple_assist(AGENT_WINDOW_LABEL)
        .expect_err("agent label must be rejected by the apple-assist gate");
    assert!(err.contains(AGENT_WINDOW_LABEL), "{err}");

    let err = ensure_label_is_main_or_agent(APPLE_ASSIST_WINDOW_LABEL)
        .expect_err("apple-assist label must be rejected by the agent gate");
    assert!(err.contains(APPLE_ASSIST_WINDOW_LABEL), "{err}");

    let err = ensure_label_is_apple_assist(MAIN_WINDOW_LABEL)
        .expect_err("main label must be rejected by the apple-assist-only gate");
    assert!(err.contains(MAIN_WINDOW_LABEL), "{err}");

    let err = ensure_label_is_apple_assist(AGENT_WINDOW_LABEL)
        .expect_err("agent label must be rejected by the apple-assist-only gate");
    assert!(err.contains(AGENT_WINDOW_LABEL), "{err}");
}

#[test]
fn request_apply_ai_edit_transaction_accepts_apple_assist_only() {
    request_apply_ai_edit_transaction_with_label(APPLE_ASSIST_WINDOW_LABEL)
        .expect("apple-assist must be allowed to request AI edit apply");

    let err = request_apply_ai_edit_transaction_with_label(MAIN_WINDOW_LABEL)
        .expect_err("main must not request Apple Assist apply through this command");
    assert!(err.contains(MAIN_WINDOW_LABEL), "{err}");

    let err = request_apply_ai_edit_transaction_with_label(AGENT_WINDOW_LABEL)
        .expect_err("agent must not request Apple Assist apply");
    assert!(err.contains(AGENT_WINDOW_LABEL), "{err}");

    let err = request_apply_ai_edit_transaction_with_label(UNKNOWN_WINDOW_LABEL)
        .expect_err("unknown window must not request Apple Assist apply");
    assert!(err.contains(UNKNOWN_WINDOW_LABEL), "{err}");
}

#[test]
fn get_main_apple_assist_target_allows_main_and_apple_assist_labels() {
    // The detached Apple Assist window is the primary caller
    // of `get_main_apple_assist_target`; the main window may
    // also call it for self-consistency. Both must clear the
    // gate. The label-only shim pins the gate without needing
    // a real `WebviewWindow` instance.
    get_main_apple_assist_target_with_label(MAIN_WINDOW_LABEL)
        .expect("main must be allowed to read the apple-assist target");
    get_main_apple_assist_target_with_label(APPLE_ASSIST_WINDOW_LABEL)
        .expect("apple-assist must be allowed to read the target");
}

#[test]
fn get_main_apple_assist_target_rejects_agent_and_unknown_labels() {
    let err = get_main_apple_assist_target_with_label(AGENT_WINDOW_LABEL)
        .expect_err("agent must be rejected by the apple-assist-target gate");
    assert!(err.contains(AGENT_WINDOW_LABEL), "{err}");

    let err = get_main_apple_assist_target_with_label(UNKNOWN_WINDOW_LABEL)
        .expect_err("unknown must be rejected by the apple-assist-target gate");
    assert!(err.contains(UNKNOWN_WINDOW_LABEL), "{err}");
}

#[test]
fn set_main_apple_assist_target_rejects_non_main_labels() {
    // Only the main window may push the target snapshot.
    // The Apple Assist window reads the cache via
    // `get_main_apple_assist_target` and listens for the
    // change event; it must NOT be able to push a target
    // back into the cache.
    set_main_apple_assist_target_with_label(MAIN_WINDOW_LABEL)
        .expect("main must be allowed to push the apple-assist target");

    let err = set_main_apple_assist_target_with_label(APPLE_ASSIST_WINDOW_LABEL)
        .expect_err("apple-assist must be rejected by the set-target gate");
    assert!(err.contains(APPLE_ASSIST_WINDOW_LABEL), "{err}");

    let err = set_main_apple_assist_target_with_label(AGENT_WINDOW_LABEL)
        .expect_err("agent must be rejected by the set-target gate");
    assert!(err.contains(AGENT_WINDOW_LABEL), "{err}");

    let err = set_main_apple_assist_target_with_label(UNKNOWN_WINDOW_LABEL)
        .expect_err("unknown must be rejected by the set-target gate");
    assert!(err.contains(UNKNOWN_WINDOW_LABEL), "{err}");
}

#[test]
fn open_text_file_rejects_agent_window_label() {
    let dir = unique_label_path("open_text_file_agent");
    fs::create_dir_all(&dir).expect("create test dir");
    let path = dir.join("note.md");
    fs::write(&path, "# Hi\n").expect("write fixture");

    let err = open_text_file_with_label(AGENT_WINDOW_LABEL, path.to_string_lossy().to_string())
        .expect_err("open_text_file must reject the agent window");
    assert!(err.contains(AGENT_WINDOW_LABEL), "{err}");

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn open_text_file_rejects_unknown_window_label() {
    let dir = unique_label_path("open_text_file_unknown");
    fs::create_dir_all(&dir).expect("create test dir");
    let path = dir.join("note.md");
    fs::write(&path, "# Hi\n").expect("write fixture");

    let err = open_text_file_with_label(UNKNOWN_WINDOW_LABEL, path.to_string_lossy().to_string())
        .expect_err("open_text_file must reject unknown labels");
    assert!(err.contains(UNKNOWN_WINDOW_LABEL), "{err}");

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn create_text_file_rejects_agent_window_label() {
    let dir = unique_label_path("create_text_file_agent");
    fs::create_dir_all(&dir).expect("create test dir");
    let path = dir.join("fresh.md");

    let err =
        create_text_file_with_label(AGENT_WINDOW_LABEL, path.to_string_lossy().to_string(), None)
            .expect_err("create_text_file must reject the agent window");
    assert!(err.contains(AGENT_WINDOW_LABEL), "{err}");
    assert!(
        !path.exists(),
        "no file should be created on a rejected gate"
    );

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn create_text_folder_rejects_agent_window_label() {
    let dir = unique_label_path("create_text_folder_agent");
    fs::create_dir_all(&dir).expect("create test dir");
    let path = dir.join("new-folder");

    let err = create_text_folder_with_label(
        AGENT_WINDOW_LABEL,
        &path.to_string_lossy(),
        &dir.to_string_lossy(),
    )
    .expect_err("create_text_folder must reject the agent window");
    assert!(err.contains(AGENT_WINDOW_LABEL), "{err}");
    assert!(
        !path.exists(),
        "no folder should be created on a rejected gate"
    );

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn save_text_file_rejects_agent_window_label() {
    let dir = unique_label_path("save_text_file_agent");
    fs::create_dir_all(&dir).expect("create test dir");
    let path = dir.join("note.md");
    fs::write(&path, "# Original\n").expect("write fixture");
    let opened_metadata = fs::metadata(&path).expect("read opened metadata");
    let opened_fingerprint = metadata_fingerprint(&opened_metadata);

    let err = save_text_file_with_label(
        AGENT_WINDOW_LABEL,
        path.to_string_lossy().to_string(),
        "# Tampered\n".to_string(),
        opened_fingerprint,
        "lf".to_string(),
        "utf-8".to_string(),
    )
    .expect_err("save_text_file must reject the agent window");
    assert!(err.contains(AGENT_WINDOW_LABEL), "{err}");
    assert_eq!(
        fs::read_to_string(&path).expect("read protected file"),
        "# Original\n"
    );

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn save_text_file_as_rejects_agent_window_label() {
    let dir = unique_label_path("save_text_file_as_agent");
    fs::create_dir_all(&dir).expect("create test dir");
    let path = dir.join("note.log");

    let err = save_text_file_as_with_label(
        AGENT_WINDOW_LABEL,
        path.to_string_lossy().to_string(),
        "Body\n".to_string(),
        "lf".to_string(),
        "utf-8".to_string(),
        None,
    )
    .expect_err("save_text_file_as must reject the agent window");
    assert!(err.contains(AGENT_WINDOW_LABEL), "{err}");
    assert!(
        !path.exists(),
        "no file should be created on a rejected gate"
    );

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn get_file_metadata_rejects_agent_window_label() {
    let dir = unique_label_path("get_file_metadata_agent");
    fs::create_dir_all(&dir).expect("create test dir");
    let path = dir.join("note.md");
    fs::write(&path, "# Hi\n").expect("write fixture");

    let err = get_file_metadata_with_label(AGENT_WINDOW_LABEL, path.to_string_lossy().to_string())
        .expect_err("get_file_metadata must reject the agent window");
    assert!(err.contains(AGENT_WINDOW_LABEL), "{err}");

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn list_workspace_tree_rejects_agent_window_label() {
    let dir = unique_label_path("list_workspace_tree_agent");
    fs::create_dir_all(&dir).expect("create test dir");

    let err = list_workspace_tree_with_label(AGENT_WINDOW_LABEL, dir.to_string_lossy().to_string())
        .expect_err("list_workspace_tree must reject the agent window");
    assert!(err.contains(AGENT_WINDOW_LABEL), "{err}");

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn list_workspace_directory_rejects_agent_window_label() {
    let dir = unique_label_path("list_workspace_directory_agent");
    fs::create_dir_all(&dir).expect("create test dir");

    let err = list_workspace_directory_with_label(
        AGENT_WINDOW_LABEL,
        dir.to_string_lossy().to_string(),
        dir.to_string_lossy().to_string(),
    )
    .expect_err("list_workspace_directory must reject the agent window");
    assert!(err.contains(AGENT_WINDOW_LABEL), "{err}");

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn open_workspace_image_rejects_agent_window_label() {
    let dir = unique_label_path("open_workspace_image_agent");
    fs::create_dir_all(&dir).expect("create test dir");
    let path = dir.join("tiny.png");
    fs::write(&path, b"\x89PNG\r\n\x1a\n").expect("write png fixture");

    let err = open_workspace_image_with_label(
        AGENT_WINDOW_LABEL,
        dir.to_string_lossy().to_string(),
        path.to_string_lossy().to_string(),
    )
    .expect_err("open_workspace_image must reject the agent window");
    assert!(err.contains(AGENT_WINDOW_LABEL), "{err}");

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn save_pasted_image_rejects_agent_window_label() {
    let dir = unique_label_path("save_pasted_image_agent");
    fs::create_dir_all(&dir).expect("create test dir");

    let err = save_pasted_image_with_label(
        AGENT_WINDOW_LABEL,
        dir.to_string_lossy().to_string(),
        "iVBORw0KGgo=".to_string(),
        "pasted.png".to_string(),
    )
    .expect_err("save_pasted_image must reject the agent window");
    assert!(err.contains(AGENT_WINDOW_LABEL), "{err}");
    assert!(
        !dir.join("assets").exists(),
        "no assets folder should be created on a rejected gate"
    );

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn import_image_from_path_rejects_agent_window_label() {
    let root = unique_label_path("import_image_agent");
    let source_dir = unique_label_path("import_image_source_agent");
    fs::create_dir_all(&root).expect("create root");
    fs::create_dir_all(&source_dir).expect("create source dir");
    let source = source_dir.join("dropped.png");
    fs::write(
        &source,
        decode_base64("iVBORw0KGgo=").expect("decode png header"),
    )
    .expect("write source image");

    let err = import_image_from_path_with_label(
        AGENT_WINDOW_LABEL,
        root.to_string_lossy().to_string(),
        source.to_string_lossy().to_string(),
    )
    .expect_err("import_image_from_path must reject the agent window");
    assert!(err.contains(AGENT_WINDOW_LABEL), "{err}");
    assert!(
        !root.join("assets").exists(),
        "no assets folder should be created on a rejected gate"
    );

    let _ = fs::remove_dir_all(root);
    let _ = fs::remove_dir_all(source_dir);
}

#[test]
fn reveal_path_in_file_manager_rejects_agent_window_label() {
    let dir = unique_label_path("reveal_agent");
    fs::create_dir_all(&dir).expect("create test dir");

    let err = reveal_path_in_file_manager_with_label(
        AGENT_WINDOW_LABEL,
        dir.to_string_lossy().to_string(),
    )
    .expect_err("reveal_path_in_file_manager must reject the agent window");
    assert!(err.contains(AGENT_WINDOW_LABEL), "{err}");

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn open_temp_print_html_rejects_agent_window_label() {
    let err = open_temp_print_html_with_label(
        AGENT_WINDOW_LABEL,
        "<html></html>".to_string(),
        "label-gate-agent.html".to_string(),
    )
    .expect_err("open_temp_print_html must reject the agent window");
    assert!(err.contains(AGENT_WINDOW_LABEL), "{err}");
}

#[test]
fn agent_session_state_allows_main_and_agent_labels() {
    let store = AgentWorkbenchSessionStore::default();

    let from_main = get_agent_workbench_session_state_with_label(MAIN_WINDOW_LABEL, &store, None)
        .expect("main must be allowed to read session state");
    assert!(from_main.session.is_none());

    let from_agent = get_agent_workbench_session_state_with_label(AGENT_WINDOW_LABEL, &store, None)
        .expect("agent must be allowed to read session state");
    assert!(from_agent.session.is_none());
}

#[test]
fn agent_session_state_rejects_unknown_label() {
    let store = AgentWorkbenchSessionStore::default();

    let err = get_agent_workbench_session_state_with_label(UNKNOWN_WINDOW_LABEL, &store, None)
        .expect_err("get_agent_workbench_session_state must reject unknown labels");
    assert!(err.contains(UNKNOWN_WINDOW_LABEL), "{err}");
}

#[test]
fn agent_stop_allows_main_and_agent_labels() {
    let store = AgentWorkbenchSessionStore::default();

    // Neither call starts a session, but both must clear the gate.
    stop_agent_workbench_session_with_label(MAIN_WINDOW_LABEL, &store)
        .expect("main must be allowed to stop the session");
    stop_agent_workbench_session_with_label(AGENT_WINDOW_LABEL, &store)
        .expect("agent must be allowed to stop the session");
}

#[test]
fn agent_stop_rejects_unknown_label() {
    let store = AgentWorkbenchSessionStore::default();

    let err = stop_agent_workbench_session_with_label(UNKNOWN_WINDOW_LABEL, &store)
        .expect_err("stop_agent_workbench_session must reject unknown labels");
    assert!(err.contains(UNKNOWN_WINDOW_LABEL), "{err}");
}

#[test]
fn agent_input_allows_main_and_agent_labels() {
    let store = AgentWorkbenchSessionStore::default();

    // No active session, so the body returns the "not active" error —
    // but the label gate must pass for both labels first.
    for label in [MAIN_WINDOW_LABEL, AGENT_WINDOW_LABEL] {
        let err =
            write_agent_workbench_session_input_with_label(label, &store, "hello\n".to_string())
                .expect_err(
                    "input with no active session should be rejected by the body, not the gate",
                );
        assert!(
            err.contains("not active"),
            "expected the body to run for {label}, got gate error: {err}"
        );
    }
}

#[test]
fn agent_input_rejects_unknown_label() {
    let store = AgentWorkbenchSessionStore::default();

    let err = write_agent_workbench_session_input_with_label(
        UNKNOWN_WINDOW_LABEL,
        &store,
        "hello\n".to_string(),
    )
    .expect_err("write_agent_workbench_session_input must reject unknown labels");
    assert!(err.contains(UNKNOWN_WINDOW_LABEL), "{err}");
}

#[test]
fn agent_resize_allows_main_and_agent_labels() {
    let store = AgentWorkbenchSessionStore::default();

    // Neither call has an active session, but both must clear the
    // gate so the xterm fit addon in the detached Agent window can
    // call resize_agent_workbench_terminal freely.
    let from_main = resize_agent_workbench_terminal_with_label(MAIN_WINDOW_LABEL, &store, 80, 24)
        .expect("main must be allowed to resize the terminal");
    assert!(from_main.session.is_none());

    let from_agent =
        resize_agent_workbench_terminal_with_label(AGENT_WINDOW_LABEL, &store, 100, 30)
            .expect("agent must be allowed to resize the terminal");
    assert!(from_agent.session.is_none());
}

#[test]
fn agent_resize_rejects_unknown_label() {
    let store = AgentWorkbenchSessionStore::default();

    let err = resize_agent_workbench_terminal_with_label(UNKNOWN_WINDOW_LABEL, &store, 80, 24)
        .expect_err("resize_agent_workbench_terminal must reject unknown labels");
    assert!(err.contains(UNKNOWN_WINDOW_LABEL), "{err}");
}

#[test]
fn agent_resize_rejects_zero_dimensions_from_any_label() {
    // The body must still validate dimensions after the label gate
    // passes — pin the order: gate first, then dimension check.
    let store = AgentWorkbenchSessionStore::default();

    for label in [MAIN_WINDOW_LABEL, AGENT_WINDOW_LABEL] {
        let err = resize_agent_workbench_terminal_with_label(label, &store, 0, 24)
            .expect_err("zero columns must be rejected by the body, not the gate");
        assert!(
            err.contains("terminal size"),
            "expected the body to run for {label}, got gate error: {err}"
        );
    }
}

#[test]
fn agent_start_allows_agent_window_label() {
    // As of the v0.8+ slice the detached agent window is the only
    // Agent surface; the right pane is gone. The agent window
    // owns the Start flow via useAgentLaunchGate, so the gate
    // widens from main-only to main|agent. The session itself is
    // process-singleton — the Rust session store serializes
    // concurrent starts — so the widened gate does not introduce
    // a race. A non-allowlisted provider is what the body rejects
    // here, proving the label gate cleared first.
    let store = AgentWorkbenchSessionStore::default();
    let dir = unique_test_dir("start_agent_label");
    fs::create_dir_all(&dir).expect("create test dir");

    let err = start_agent_workbench_session_with_label(
        AGENT_WINDOW_LABEL,
        &store,
        true,
        true,
        "zsh".to_string(),
        dir.to_string_lossy().to_string(),
        None,
        None,
    )
    .expect_err("non-allowlisted provider must be rejected by the body");
    assert!(
        err.contains("allowlisted"),
        "expected the body to run for the agent window, got gate error: {err}"
    );
    assert!(store.session.lock().unwrap().is_none());

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn agent_start_rejects_unknown_label() {
    let store = AgentWorkbenchSessionStore::default();
    let dir = unique_test_dir("start_unknown_label");
    fs::create_dir_all(&dir).expect("create test dir");

    let err = start_agent_workbench_session_with_label(
        UNKNOWN_WINDOW_LABEL,
        &store,
        true,
        true,
        AGENT_PROVIDER_CODEX.to_string(),
        dir.to_string_lossy().to_string(),
        None,
        None,
    )
    .expect_err("start_agent_workbench_session must reject unknown labels");
    assert!(err.contains(UNKNOWN_WINDOW_LABEL), "{err}");
    assert!(store.session.lock().unwrap().is_none());

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn agent_start_allows_main_label() {
    // Pin the positive case: the main window still drives the
    // launch flow, and a non-allowlisted provider is what the body
    // rejects (proving the label gate cleared first).
    let store = AgentWorkbenchSessionStore::default();
    let dir = unique_test_dir("start_main_label");
    fs::create_dir_all(&dir).expect("create test dir");

    let err = start_agent_workbench_session_with_label(
        MAIN_WINDOW_LABEL,
        &store,
        true,
        true,
        "zsh".to_string(),
        dir.to_string_lossy().to_string(),
        None,
        None,
    )
    .expect_err("non-allowlisted provider must be rejected by the body");
    assert!(
        err.contains("allowlisted"),
        "expected the body to run for main, got gate error: {err}"
    );
    assert!(store.session.lock().unwrap().is_none());

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn open_main_agent_pane_allows_main_and_agent_labels() {
    // The "Show in main pane" reverse link in the detached agent
    // window's footer must be able to call this command directly
    // (without going through the menu). The main window also needs
    // to be able to call it (where it's effectively a no-op for the
    // focus + emit). Both must clear the gate.
    open_main_agent_pane_with_label(MAIN_WINDOW_LABEL)
        .expect("main must be allowed to ask the main window to open its agent pane");
    open_main_agent_pane_with_label(AGENT_WINDOW_LABEL)
        .expect("agent must be allowed to ask the main window to open its agent pane");
}

#[test]
fn open_main_agent_pane_rejects_unknown_label() {
    // Pin the negative case: anything that is not `main` or `agent`
    // gets the standard "not allowed from window" error. This is
    // the second layer of defense on top of the empty
    // `agent-window.json` permissions array — a future script in
    // some other webview must not be able to flip the main window's
    // right pane to Agent mode out from under the user.
    let err = open_main_agent_pane_with_label(UNKNOWN_WINDOW_LABEL)
        .expect_err("open_main_agent_pane must reject unknown labels");
    assert!(err.contains(UNKNOWN_WINDOW_LABEL), "{err}");
}

#[test]
fn toggle_apple_assist_window_accepts_main_window_only() {
    toggle_apple_assist_window_with_label(MAIN_WINDOW_LABEL)
        .expect("main must be allowed to toggle the Apple Assist window");

    let agent_err = toggle_apple_assist_window_with_label(AGENT_WINDOW_LABEL)
        .expect_err("agent must not be allowed to toggle the Apple Assist window");
    assert!(agent_err.contains(AGENT_WINDOW_LABEL), "{agent_err}");

    let unknown_err = toggle_apple_assist_window_with_label(UNKNOWN_WINDOW_LABEL)
        .expect_err("unknown labels must not be allowed to toggle the Apple Assist window");
    assert!(unknown_err.contains(UNKNOWN_WINDOW_LABEL), "{unknown_err}");
}

#[test]
fn rename_workspace_entry_rejects_agent_window_label() {
    let root = unique_label_path("rename_workspace_entry_agent");
    fs::create_dir_all(&root).expect("create root");
    let src = root.join("old.md");
    fs::write(&src, "# old\n").expect("write src");
    let dst = root.join("new.md");

    let err = rename_workspace_entry_with_label(
        AGENT_WINDOW_LABEL,
        &src.to_string_lossy(),
        &dst.to_string_lossy(),
        &root.to_string_lossy(),
    )
    .expect_err("rename_workspace_entry must reject the agent window");
    assert!(err.contains(AGENT_WINDOW_LABEL), "{err}");
    assert!(src.exists());
    assert!(!dst.exists());

    let _ = fs::remove_dir_all(root);
}

#[test]
fn move_workspace_entry_rejects_agent_window_label() {
    let root = unique_label_path("move_workspace_entry_agent");
    let source_dir = root.join("source");
    let dest_dir = root.join("dest");
    fs::create_dir_all(&root).expect("create root");
    fs::create_dir_all(&source_dir).expect("create source");
    fs::create_dir_all(&dest_dir).expect("create dest");
    let src = source_dir.join("note.md");
    fs::write(&src, "# note\n").expect("write src");

    let err = move_workspace_entry_with_label(
        AGENT_WINDOW_LABEL,
        &src.to_string_lossy(),
        &(dest_dir.join("note.md").to_string_lossy()),
        &root.to_string_lossy(),
    )
    .expect_err("move_workspace_entry must reject the agent window");
    assert!(err.contains(AGENT_WINDOW_LABEL), "{err}");
    assert!(src.exists());
    assert!(!dest_dir.join("note.md").exists());

    let _ = fs::remove_dir_all(root);
}
