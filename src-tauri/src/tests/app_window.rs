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
    assert_eq!(dark, tauri::window::Color(0x0e, 0x13, 0x11, 0xff));
    let sakura = agent_window_background_color("sakura");
    assert_eq!(sakura, tauri::window::Color(0xfd, 0xf3, 0xf4, 0xff));
    let yakou = agent_window_background_color("yakou");
    assert_eq!(yakou, tauri::window::Color(0x0c, 0x0c, 0x14, 0xff));
    let shokou = agent_window_background_color("shokou");
    assert_eq!(shokou, tauri::window::Color(0xed, 0xf4, 0xfc, 0xff));
    let light = agent_window_background_color("light");
    assert_eq!(light, tauri::window::Color(0xf3, 0xf6, 0xf4, 0xff));
}

#[test]
fn agent_window_background_color_falls_back_to_dark_for_unknown_theme() {
    // Future / unknown theme strings must not crash the agent window
    // open path; they should fall back to the dark palette entry,
    // matching the previous hand-written match arm.
    let fallback = agent_window_background_color("definitely-not-a-theme");
    assert_eq!(fallback, tauri::window::Color(0x0e, 0x13, 0x11, 0xff));
}
