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
fn file_menu_exposes_okf_scaffold_starters() {
    let source = include_str!("../menu.rs");

    assert_eq!(MENU_OKF_SCAFFOLD_MINIMAL, "okf-scaffold-minimal");
    assert_eq!(MENU_OKF_SCAFFOLD_BOOK_LIKE, "okf-scaffold-book-like");
    assert!(source.contains("MENU_OKF_SCAFFOLD_MINIMAL"));
    assert!(source.contains("MENU_OKF_SCAFFOLD_BOOK_LIKE"));
    assert!(source.contains("Knowledge Folder Starters"));
    assert!(source.contains("知識フォルダのひな形"));

    let emit_match = source
        .split("matches!(")
        .find(|section| section.contains("MENU_NEW_FILE"))
        .expect("find menu action allowlist");
    assert!(emit_match.contains("MENU_OKF_SCAFFOLD_MINIMAL"));
    assert!(emit_match.contains("MENU_OKF_SCAFFOLD_BOOK_LIKE"));
}

#[test]
fn help_menu_exposes_books_and_knowledge_folders() {
    let source = include_str!("../menu.rs");

    assert_eq!(
        MENU_BOOKS_AND_KNOWLEDGE_FOLDERS,
        "books-and-knowledge-folders"
    );
    assert!(source.contains("MENU_BOOKS_AND_KNOWLEDGE_FOLDERS"));
    assert!(source.contains("Books and Knowledge Folders…"));
    assert!(source.contains("本と知識フォルダ…"));

    let emit_match = source
        .split("matches!(")
        .find(|section| section.contains("MENU_LOCAL_DATA_DISCLOSURE"))
        .expect("find menu action allowlist");
    assert!(emit_match.contains("MENU_BOOKS_AND_KNOWLEDGE_FOLDERS"));
}

#[test]
fn file_menu_exposes_reference_beside_editor_action() {
    let source = include_str!("../menu.rs");

    assert_eq!(MENU_OPEN_REFERENCE, "open-reference");
    assert!(source.contains("MENU_OPEN_REFERENCE"));
    assert!(source.contains("Open Reference Beside Editor…"));
    assert!(source.contains("参照ファイルを横に開く…"));

    let emit_match = source
        .split("matches!(")
        .find(|section| section.contains("MENU_OPEN_FILE"))
        .expect("find menu action allowlist");
    assert!(emit_match.contains("MENU_OPEN_REFERENCE"));
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
        "MENU_THEME_EDOHIGAN",
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
