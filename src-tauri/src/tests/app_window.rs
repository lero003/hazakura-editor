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
    assert_eq!(dark, tauri::window::Color(0x10, 0x16, 0x13, 0xff));
    let sakura = agent_window_background_color("sakura");
    assert_eq!(sakura, tauri::window::Color(0xfa, 0xee, 0xf2, 0xff));
    let yakou = agent_window_background_color("yakou");
    assert_eq!(yakou, tauri::window::Color(0x10, 0x10, 0x1a, 0xff));
    let shokou = agent_window_background_color("shokou");
    assert_eq!(shokou, tauri::window::Color(0xee, 0xf5, 0xfb, 0xff));
    let light = agent_window_background_color("light");
    assert_eq!(light, tauri::window::Color(0xed, 0xf3, 0xef, 0xff));
}

#[test]
fn agent_window_background_color_falls_back_to_dark_for_unknown_theme() {
    // Future / unknown theme strings must not crash the agent window
    // open path; they should fall back to the dark palette entry,
    // matching the previous hand-written match arm.
    let fallback = agent_window_background_color("definitely-not-a-theme");
    assert_eq!(fallback, tauri::window::Color(0x10, 0x16, 0x13, 0xff));
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
