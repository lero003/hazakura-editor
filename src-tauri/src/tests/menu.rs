use super::*;
use crate::menu::menu_state_needs_rebuild;
use crate::types::{AppMenuRecentItem, AppMenuState};

fn base_menu_state() -> AppMenuState {
    AppMenuState {
        active_dirty: false,
        agent_workbench_active: false,
        agent_workbench_consent: false,
        assist_surface_active: "none".to_string(),
        has_active_tab: true,
        l_mode_enabled: false,
        menu_language: "ja".to_string(),
        preview_visible: true,
        recent_files: vec![],
        recent_folders: vec![],
        show_invisibles: false,
        spellcheck_enabled: true,
        theme_preference: "light".to_string(),
        wrap_lines: true,
    }
}

// `app.set_menu` replaces the whole macOS menu bar, and the user sees that
// as the menu bar flashing while they type. Only a change to the labels or
// the item set may rebuild it; every other field must update in place.

#[test]
fn first_menu_state_builds_and_a_repeated_state_is_skipped() {
    let state = base_menu_state();

    // Startup has no previous state, so the menu is built once.
    assert!(menu_state_needs_rebuild(None, &state));
    // The frontend sends the full state on every change, so an identical
    // state must not touch the native menu bar at all.
    assert!(!menu_state_needs_rebuild(Some(&state), &state));
}

#[test]
fn typing_and_tab_presence_changes_only_flip_item_flags() {
    let saved = base_menu_state();

    // Typing the first character after a save flips `active_dirty`
    // (the Save item), which is what the user reported as flashing.
    let mut edited = saved.clone();
    edited.active_dirty = true;
    assert!(
        !menu_state_needs_rebuild(Some(&saved), &edited),
        "an edit must update the Save item in place instead of rebuilding",
    );

    // Opening or closing the last tab flips `has_active_tab` (Save As).
    let mut closed = saved.clone();
    closed.has_active_tab = false;
    assert!(
        !menu_state_needs_rebuild(Some(&saved), &closed),
        "tab presence must update the Save As item in place",
    );
}

#[test]
fn view_assist_and_theme_changes_only_flip_item_flags() {
    let base = base_menu_state();
    let variant = |name: &'static str, mutate: fn(&mut AppMenuState)| {
        let mut next = base.clone();
        mutate(&mut next);
        (name, next)
    };
    let variants = [
        variant("preview", |state| {
            state.preview_visible = !state.preview_visible
        }),
        variant("wrap", |state| state.wrap_lines = !state.wrap_lines),
        variant("invisibles", |state| {
            state.show_invisibles = !state.show_invisibles
        }),
        variant("spellcheck", |state| {
            state.spellcheck_enabled = !state.spellcheck_enabled
        }),
        variant("l mode", |state| {
            state.l_mode_enabled = !state.l_mode_enabled
        }),
        variant("theme", |state| {
            state.theme_preference = "yakou".to_string()
        }),
        variant("agent workbench", |state| {
            state.agent_workbench_active = true
        }),
        variant("agent consent", |state| {
            state.agent_workbench_consent = true
        }),
        variant("assist surface", |state| {
            state.assist_surface_active = "apple-local".to_string()
        }),
    ];

    for (name, next) in variants {
        assert!(
            !menu_state_needs_rebuild(Some(&base), &next),
            "{name} must update existing menu items instead of rebuilding",
        );
    }
}

#[test]
fn label_and_recent_list_changes_rebuild_the_menu() {
    let base = base_menu_state();

    let mut translated = base.clone();
    translated.menu_language = "en".to_string();
    assert!(
        menu_state_needs_rebuild(Some(&base), &translated),
        "menu labels only change by rebuilding the menu",
    );

    let mut recent_files = base.clone();
    recent_files.recent_files = vec![AppMenuRecentItem {
        label: "note.md".to_string(),
    }];
    assert!(
        menu_state_needs_rebuild(Some(&base), &recent_files),
        "the recent-files submenu items only change by rebuilding",
    );

    let mut recent_folders = base.clone();
    recent_folders.recent_folders = vec![AppMenuRecentItem {
        label: "book".to_string(),
    }];
    assert!(
        menu_state_needs_rebuild(Some(&base), &recent_folders),
        "the recent-folders submenu items only change by rebuilding",
    );
}

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
