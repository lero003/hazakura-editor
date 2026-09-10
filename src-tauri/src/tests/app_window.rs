// Tests for the agent window background-color lookup. The
// function reads from the same JSON that the TS side's
// `windowBackgroundColorForTheme` uses; a sample of themes is
// pinned so a future palette edit cannot silently break the
// initial-paint color.
use super::*;

#[test]
fn agent_window_background_color_returns_palette_color_for_known_theme() {
    // The function reads from the same JSON that the TS side's
    // `windowBackgroundColorForTheme` uses. Pin a sample of themes
    // so a future palette edit can't silently break the
    // agent-window initial-paint color.
    let dark = agent_window_background_color("dark");
    assert_eq!(dark, tauri::window::Color(0x18, 0x24, 0x1e, 0xff));
    // 江戸彼岸 is a dark twilight surface (#2a2030), not the old light sakura.
    let edohigan = agent_window_background_color("edohigan");
    assert_eq!(edohigan, tauri::window::Color(0x2a, 0x20, 0x30, 0xff));
    let yakou = agent_window_background_color("yakou");
    assert_eq!(yakou, tauri::window::Color(0x12, 0x10, 0x2a, 0xff));
    let shokou = agent_window_background_color("shokou");
    assert_eq!(shokou, tauri::window::Color(0xee, 0xf5, 0xfb, 0xff));
    let crt = agent_window_background_color("crt");
    assert_eq!(crt, tauri::window::Color(0x04, 0x0a, 0x06, 0xff));
    let light = agent_window_background_color("light");
    assert_eq!(light, tauri::window::Color(0xf7, 0xf8, 0xf5, 0xff));
}

#[test]
fn agent_window_background_color_falls_back_to_dark_for_unknown_theme() {
    // Future / unknown theme strings must not crash the agent window
    // open path; they should fall back to the dark palette entry,
    // matching the previous hand-written match arm.
    let fallback = agent_window_background_color("definitely-not-a-theme");
    assert_eq!(fallback, tauri::window::Color(0x18, 0x24, 0x1e, 0xff));
}

#[test]
fn apple_assist_window_uses_compact_vertical_tool_window_size() {
    assert_eq!(APPLE_ASSIST_WINDOW_DEFAULT_WIDTH, 480.0);
    assert_eq!(APPLE_ASSIST_WINDOW_DEFAULT_HEIGHT, 720.0);
    assert_eq!(APPLE_ASSIST_WINDOW_MIN_WIDTH, 420.0);
    assert_eq!(APPLE_ASSIST_WINDOW_MIN_HEIGHT, 540.0);

    let source = include_str!("../commands/app_window.rs");
    assert!(
        source.contains(
            ".inner_size(\n        APPLE_ASSIST_WINDOW_DEFAULT_WIDTH,\n        APPLE_ASSIST_WINDOW_DEFAULT_HEIGHT,\n    )",
        ),
        "apple-assist builder must use the compact default-size constants",
    );
    assert!(
        source.contains(
            ".min_inner_size(\n        APPLE_ASSIST_WINDOW_MIN_WIDTH,\n        APPLE_ASSIST_WINDOW_MIN_HEIGHT,\n    )"
        ),
        "apple-assist builder must use the compact min-size constants",
    );
}

#[test]
fn dock_reopen_without_visible_windows_should_restore_main_window() {
    assert!(should_restore_main_window_on_reopen(None, false));
}

#[test]
fn dock_reopen_with_visible_main_window_should_not_force_restore_main_window() {
    assert!(!should_restore_main_window_on_reopen(Some(true), true));
}

#[test]
fn dock_reopen_with_only_companion_windows_visible_should_restore_main_window() {
    assert!(should_restore_main_window_on_reopen(Some(false), true));
}

#[test]
fn file_open_event_with_paths_should_raise_main_window() {
    assert!(should_raise_main_window_on_opened_files(1));
}

#[test]
fn file_open_event_without_paths_should_not_raise_main_window() {
    assert!(!should_raise_main_window_on_opened_files(0));
}

#[test]
fn local_assist_review_rejects_unbounded_or_incomplete_identity() {
    let valid = || LocalAssistReviewRequest {
        request_id: "request-1".into(),
        conversation_id: "conversation-1".into(),
        document_session_id: "session-1".into(),
        navigation_id: "navigation-1".into(),
    };
    assert!(validate_local_assist_review_identity(&valid()).is_ok());
    for invalid in [
        "".to_string(),
        " ".to_string(),
        "x".repeat(201),
        "x\ny".to_string(),
    ] {
        let mut payload = valid();
        payload.request_id = invalid.clone();
        assert!(validate_local_assist_review_identity(&payload).is_err());
        let mut payload = valid();
        payload.conversation_id = invalid.clone();
        assert!(validate_local_assist_review_identity(&payload).is_err());
        let mut payload = valid();
        payload.document_session_id = invalid.clone();
        assert!(validate_local_assist_review_identity(&payload).is_err());
        let mut payload = valid();
        payload.navigation_id = invalid;
        assert!(validate_local_assist_review_identity(&payload).is_err());
    }
    assert!(
        serde_json::from_value::<LocalAssistReviewRequest>(serde_json::json!({
            "requestId":"r", "conversationId":"c", "documentSessionId":"s", "navigationId":"n", "windowLabel":"agent"
        }))
        .is_err()
    );
}
