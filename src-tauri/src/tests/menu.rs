use super::*;

#[test]
fn file_menu_exposes_epub_beta_export_action() {
    let source = include_str!("../menu.rs");

    assert_eq!(MENU_EXPORT_EPUB_BETA, "export-epub-beta");
    assert!(source.contains("MENU_EXPORT_EPUB_BETA"));
    assert!(source.contains("Export as EPUB (Beta)…"));
    assert!(source.contains("EPUBとして書き出す（β）…"));
}

#[test]
fn app_menu_event_allows_epub_beta_export_action() {
    let source = include_str!("../menu.rs");
    let emit_match = source
        .split("matches!(")
        .find(|section| section.contains("MENU_EXPORT_HTML"))
        .expect("find menu action allowlist");

    assert!(emit_match.contains("MENU_EXPORT_EPUB_BETA"));
}

#[test]
fn app_menu_event_emits_all_theme_actions() {
    let source = include_str!("../menu.rs");
    let emit_match = source
        .split("matches!(")
        .find(|section| section.contains("MENU_THEME_LIGHT"))
        .expect("find menu action allowlist");

    for theme in [
        "MENU_THEME_LIGHT",
        "MENU_THEME_DARK",
        "MENU_THEME_SAKURA",
        "MENU_THEME_YAKOU",
        "MENU_THEME_SHOKOU",
        "MENU_THEME_CRT",
        "MENU_THEME_SHINKAI",
    ] {
        assert!(
            emit_match.contains(theme),
            "{theme} must be in the menu action allowlist so its click emits an IPC event",
        );
    }
}
