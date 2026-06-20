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
