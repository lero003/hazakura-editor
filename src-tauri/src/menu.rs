use crate::distribution::*;
use crate::types::*;
use tauri::menu::{
    AboutMetadata, CheckMenuItem, IsMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu,
    HELP_SUBMENU_ID, WINDOW_SUBMENU_ID,
};
use tauri::Emitter;

#[cfg(desktop)]
pub(crate) fn build_app_menu<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
) -> tauri::Result<Menu<R>> {
    build_app_menu_with_state(app, None)
}

#[cfg(desktop)]
pub(crate) fn build_app_menu_with_state<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    state: Option<&AppMenuState>,
) -> tauri::Result<Menu<R>> {
    let menu = Menu::default(app)?;
    let has_active_tab = state.map(|state| state.has_active_tab).unwrap_or(false);
    let active_dirty = state.map(|state| state.active_dirty).unwrap_or(false);
    let preview_visible = state.map(|state| state.preview_visible).unwrap_or(true);
    let wrap_lines = state.map(|state| state.wrap_lines).unwrap_or(true);
    let show_invisibles = state.map(|state| state.show_invisibles).unwrap_or(false);
    let spellcheck_enabled = state.map(|state| state.spellcheck_enabled).unwrap_or(true);
    let l_mode_enabled = state.map(|state| state.l_mode_enabled).unwrap_or(false);
    let agent_workbench_allowed = agent_workbench_allowed_by_distribution();
    let apple_assist_allowed = apple_assist_allowed_by_distribution();
    let assist_surface_settings_allowed = assist_surface_settings_allowed_by_distribution();
    let apple_assist_active = apple_assist_allowed
        && state
            .map(|state| state.assist_surface_active.as_str() == "apple-local")
            .unwrap_or(false);
    let agent_workbench_active = state
        .map(|state| state.agent_workbench_active)
        .unwrap_or(false);
    let agent_workbench_consent = state
        .map(|state| state.agent_workbench_consent)
        .unwrap_or(false);
    let agent_window_enabled =
        agent_workbench_allowed && agent_workbench_active && agent_workbench_consent;
    let theme_preference = state
        .map(|state| state.theme_preference.as_str())
        .unwrap_or("dark");
    let menu_language = state
        .map(|state| state.menu_language.as_str())
        .unwrap_or("en");
    let menu_is_kana = menu_language == "kana";
    let menu_is_japanese = state
        .map(|state| matches!(state.menu_language.as_str(), "ja" | "kana"))
        .unwrap_or(false);
    let label = |english: &'static str, japanese: &'static str| {
        if menu_is_kana {
            kana_menu_label(japanese).unwrap_or(japanese)
        } else if menu_is_japanese {
            japanese
        } else {
            english
        }
    };
    let file_menu = Submenu::with_items(
        app,
        label("File", "ファイル"),
        true,
        &[
            &MenuItem::with_id(
                app,
                MENU_NEW_FILE,
                label("New File", "新規ファイル"),
                true,
                Some("CmdOrCtrl+N"),
            )?,
            &MenuItem::with_id(
                app,
                MENU_OPEN_FILE,
                label("Open...", "開く..."),
                true,
                Some("CmdOrCtrl+O"),
            )?,
            &MenuItem::with_id(
                app,
                MENU_IMPORT_PDF_IMAGE,
                label(
                    "Import PDF / Image as Markdown Draft...",
                    "PDF / 画像を Markdown 下書きとして取り込む...",
                ),
                true,
                None::<&str>,
            )?,
            &MenuItem::with_id(
                app,
                MENU_OPEN_FOLDER,
                label("Open Folder...", "フォルダを開く..."),
                true,
                Some("CmdOrCtrl+Shift+O"),
            )?,
            &PredefinedMenuItem::separator(app)?,
            &recent_submenu(
                app,
                label("Recent Folders", "最近使ったフォルダ"),
                label("No Recent Items", "最近使った項目はありません"),
                MENU_RECENT_FOLDER_PREFIX,
                state
                    .map(|state| state.recent_folders.as_slice())
                    .unwrap_or(&[]),
            )?,
            #[cfg(not(target_os = "macos"))]
            &PredefinedMenuItem::separator(app)?,
            #[cfg(not(target_os = "macos"))]
            &MenuItem::with_id(
                app,
                MENU_PREFERENCES,
                label("Preferences...", "設定..."),
                true,
                Some("CmdOrCtrl+,"),
            )?,
            #[cfg(not(target_os = "macos"))]
            &MenuItem::with_id(
                app,
                MENU_AGENT_WORKBENCH,
                label("Assist Surface...", "アシスト設定..."),
                true,
                None::<&str>,
            )?,
            #[cfg(not(target_os = "macos"))]
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(
                app,
                MENU_SAVE,
                label("Save", "保存"),
                active_dirty,
                Some("CmdOrCtrl+S"),
            )?,
            &MenuItem::with_id(
                app,
                MENU_SAVE_AS,
                label("Save As...", "別名で保存..."),
                has_active_tab,
                Some("CmdOrCtrl+Shift+S"),
            )?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(
                app,
                MENU_EXPORT_HTML,
                label("Export as HTML…", "HTMLとして書き出す…"),
                true,
                Some("CmdOrCtrl+Alt+H"),
            )?,
            &MenuItem::with_id(
                app,
                MENU_EXPORT_EPUB_BETA,
                label("Export as EPUB (Beta)…", "EPUBとして書き出す（β）…"),
                true,
                None::<&str>,
            )?,
            &MenuItem::with_id(
                app,
                MENU_EXPORT_PDF,
                label("Export as PDF…", "PDFとして書き出す…"),
                true,
                Some("CmdOrCtrl+Alt+P"),
            )?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(
                app,
                MENU_CLOSE_WINDOW,
                label("Close Window", "ウィンドウを閉じる"),
                true,
                Some("CmdOrCtrl+Shift+W"),
            )?,
        ],
    )?;
    let view_preview = CheckMenuItem::with_id(
        app,
        MENU_TOGGLE_PREVIEW,
        label("Preview", "プレビュー"),
        true,
        preview_visible,
        Some("CmdOrCtrl+Option+P"),
    )?;
    let view_agent_window = MenuItem::with_id(
        app,
        MENU_OPEN_AGENT_WINDOW,
        label("Open Agent Window", "Agent ウィンドウを開く"),
        agent_window_enabled,
        None::<&str>,
    )?;
    let view_apple_assist_window = MenuItem::with_id(
        app,
        MENU_OPEN_APPLE_ASSIST_WINDOW,
        label(
            "Open Hazakura Local Assist Window",
            "Hazakura Local Assist ウィンドウを開く",
        ),
        apple_assist_active,
        None::<&str>,
    )?;
    let view_separator_after_companion = PredefinedMenuItem::separator(app)?;
    let view_l_mode = CheckMenuItem::with_id(
        app,
        MENU_TOGGLE_L_MODE,
        label("L Mode / Edit Mode", "えるモード / 編集モード"),
        true,
        l_mode_enabled,
        Some("CmdOrCtrl+Shift+L"),
    )?;
    let view_wrap = CheckMenuItem::with_id(
        app,
        MENU_TOGGLE_WRAP,
        label("Wrap Lines", "行を折り返す"),
        true,
        wrap_lines,
        Some("CmdOrCtrl+Option+W"),
    )?;
    let view_invisibles = CheckMenuItem::with_id(
        app,
        MENU_TOGGLE_INVISIBLES,
        label("Show Invisibles", "不可視文字を表示"),
        true,
        show_invisibles,
        Some("CmdOrCtrl+Option+I"),
    )?;
    let view_spellcheck = CheckMenuItem::with_id(
        app,
        MENU_TOGGLE_SPELLCHECK,
        label("Spell Check", "スペルチェック"),
        true,
        spellcheck_enabled,
        Some("CmdOrCtrl+Option+;"),
    )?;
    let view_separator_before_theme = PredefinedMenuItem::separator(app)?;
    let theme_light = MenuItem::with_id(
        app,
        MENU_THEME_LIGHT,
        selected_theme_label(label("Light", "ライト"), theme_preference == "light"),
        true,
        None::<&str>,
    )?;
    let theme_dark = MenuItem::with_id(
        app,
        MENU_THEME_DARK,
        selected_theme_label(label("Dark", "ダーク"), theme_preference == "dark"),
        true,
        None::<&str>,
    )?;
    let theme_yakou = MenuItem::with_id(
        app,
        MENU_THEME_YAKOU,
        selected_theme_label(label("Yakou", "夜光"), theme_preference == "yakou"),
        true,
        None::<&str>,
    )?;
    let theme_shokou = MenuItem::with_id(
        app,
        MENU_THEME_SHOKOU,
        selected_theme_label(label("Shokou", "曙光"), theme_preference == "shokou"),
        true,
        None::<&str>,
    )?;
    let theme_crt = MenuItem::with_id(
        app,
        MENU_THEME_CRT,
        selected_theme_label(
            label("CRT (joke)", "CRT（お遊び）"),
            theme_preference == "crt",
        ),
        true,
        None::<&str>,
    )?;
    let theme_shinkai = MenuItem::with_id(
        app,
        MENU_THEME_SHINKAI,
        selected_theme_label(
            label("Shinkai (joke)", "深海（お遊び）"),
            theme_preference == "shinkai",
        ),
        true,
        None::<&str>,
    )?;
    // 江戸彼岸は最上級・静謐テーマとして一覧の末尾に置く
    let theme_edohigan = MenuItem::with_id(
        app,
        MENU_THEME_EDOHIGAN,
        selected_theme_label(
            label("Edohigan (Quietude)", "江戸彼岸（静謐）"),
            theme_preference == "edohigan",
        ),
        true,
        None::<&str>,
    )?;
    let theme_menu = Submenu::with_items(
        app,
        label("Theme", "テーマ"),
        true,
        &[
            &theme_light,
            &theme_dark,
            &theme_yakou,
            &theme_shokou,
            &theme_crt,
            &theme_shinkai,
            &theme_edohigan,
        ],
    )?;
    let view_separator_before_fullscreen = PredefinedMenuItem::separator(app)?;
    let view_fullscreen = PredefinedMenuItem::fullscreen(
        app,
        Some(label("Enter Full Screen", "フルスクリーンにする")),
    )?;
    let mut view_items: Vec<&dyn IsMenuItem<R>> = vec![&view_preview];
    if agent_workbench_allowed {
        view_items.push(&view_agent_window);
    }
    if apple_assist_allowed {
        view_items.push(&view_apple_assist_window);
        view_items.push(&view_separator_after_companion);
    }
    view_items.extend([
        &view_l_mode as &dyn IsMenuItem<R>,
        &view_wrap,
        &view_invisibles,
        &view_spellcheck,
        &view_separator_before_theme,
        &theme_menu,
        &view_separator_before_fullscreen,
        &view_fullscreen,
    ]);
    let view_menu = Submenu::with_items(app, label("View", "表示"), true, &view_items)?;
    let edit_menu = Submenu::with_items(
        app,
        label("Edit", "編集"),
        true,
        &[
            &PredefinedMenuItem::undo(app, Some(label("Undo", "取り消す")))?,
            &PredefinedMenuItem::redo(app, Some(label("Redo", "やり直す")))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, Some(label("Cut", "カット")))?,
            &PredefinedMenuItem::copy(app, Some(label("Copy", "コピー")))?,
            &PredefinedMenuItem::paste(app, Some(label("Paste", "ペースト")))?,
            &PredefinedMenuItem::select_all(app, Some(label("Select All", "すべて選択")))?,
        ],
    )?;
    let window_menu = Submenu::with_id_and_items(
        app,
        WINDOW_SUBMENU_ID,
        label("Window", "ウィンドウ"),
        true,
        &[
            &PredefinedMenuItem::minimize(app, Some(label("Minimize", "しまう")))?,
            &PredefinedMenuItem::maximize(app, Some(label("Zoom", "拡大/縮小")))?,
            #[cfg(target_os = "macos")]
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::close_window(
                app,
                Some(label("Close Window", "ウィンドウを閉じる")),
            )?,
        ],
    )?;
    let help_menu = Submenu::with_id_and_items(
        app,
        HELP_SUBMENU_ID,
        label("Help", "ヘルプ"),
        true,
        &[
            &MenuItem::with_id(
                app,
                MENU_LOCAL_DATA_DISCLOSURE,
                label("Local Data Disclosure...", "ローカルデータの扱い..."),
                true,
                None::<&str>,
            )?,
            &MenuItem::with_id(
                app,
                MENU_OPEN_SUPPORT_DIAGNOSTICS,
                label("Support Diagnostics...", "サポート診断..."),
                true,
                None::<&str>,
            )?,
            &MenuItem::with_id(
                app,
                MENU_PRIVACY_POLICY,
                label("Privacy Policy...", "プライバシーポリシー..."),
                true,
                None::<&str>,
            )?,
            &MenuItem::with_id(
                app,
                MENU_OPEN_SOURCE_ACKNOWLEDGEMENTS,
                label("Open Source Acknowledgements...", "オープンソース謝辞..."),
                true,
                None::<&str>,
            )?,
            &MenuItem::with_id(
                app,
                MENU_ABOUT_HELP,
                label("About Hazakura Editor...", "Hazakura Editor について..."),
                true,
                None::<&str>,
            )?,
        ],
    )?;

    #[cfg(target_os = "macos")]
    {
        let package_info = app.package_info();
        let config = app.config();
        let about_metadata = AboutMetadata {
            name: Some("Hazakura Editor".to_string()),
            version: Some(package_info.version.to_string()),
            copyright: config.bundle.copyright.clone(),
            authors: config
                .bundle
                .publisher
                .clone()
                .map(|publisher| vec![publisher]),
            ..Default::default()
        };
        let about_item = PredefinedMenuItem::about(
            app,
            Some(label("About Hazakura Editor", "Hazakura Editor について")),
            Some(about_metadata),
        )?;
        let separator_after_about = PredefinedMenuItem::separator(app)?;
        let preferences_item = MenuItem::with_id(
            app,
            MENU_PREFERENCES,
            label("Preferences...", "設定..."),
            true,
            Some("CmdOrCtrl+,"),
        )?;
        let assist_surface_item = MenuItem::with_id(
            app,
            MENU_AGENT_WORKBENCH,
            label("Assist Surface...", "アシスト設定..."),
            true,
            None::<&str>,
        )?;
        let separator_after_preferences = PredefinedMenuItem::separator(app)?;
        let services_item = PredefinedMenuItem::services(app, Some(label("Services", "サービス")))?;
        let separator_after_services = PredefinedMenuItem::separator(app)?;
        let hide_item = PredefinedMenuItem::hide(
            app,
            Some(label("Hide Hazakura Editor", "Hazakura Editor を隠す")),
        )?;
        let hide_others_item =
            PredefinedMenuItem::hide_others(app, Some(label("Hide Others", "ほかを隠す")))?;
        let separator_before_quit = PredefinedMenuItem::separator(app)?;
        let quit_item = MenuItem::with_id(
            app,
            MENU_QUIT_APP,
            label("Quit Hazakura Editor", "Hazakura Editor を終了"),
            true,
            Some("CmdOrCtrl+Q"),
        )?;

        let mut app_menu_items: Vec<&dyn IsMenuItem<R>> =
            vec![&about_item, &separator_after_about, &preferences_item];
        if assist_surface_settings_allowed {
            app_menu_items.push(&assist_surface_item);
        }
        app_menu_items.extend([
            &separator_after_preferences as &dyn IsMenuItem<R>,
            &services_item,
            &separator_after_services,
            &hide_item,
            &hide_others_item,
            &separator_before_quit,
            &quit_item,
        ]);

        let app_menu = Submenu::with_items(app, package_info.name.clone(), true, &app_menu_items)?;

        menu.remove_at(0)?;
        menu.insert(&app_menu, 0)?;
        menu.remove_at(1)?;
        menu.insert(&file_menu, 1)?;
        menu.remove_at(2)?;
        menu.insert(&edit_menu, 2)?;
        menu.remove_at(3)?;
        menu.insert(&view_menu, 3)?;
        menu.remove_at(4)?;
        menu.insert(&window_menu, 4)?;
        menu.remove_at(5)?;
        menu.insert(&help_menu, 5)?;
    }

    #[cfg(not(any(
        target_os = "macos",
        target_os = "linux",
        target_os = "dragonfly",
        target_os = "freebsd",
        target_os = "netbsd",
        target_os = "openbsd"
    )))]
    {
        menu.remove_at(0)?;
        menu.insert(&file_menu, 0)?;
        menu.insert(&view_menu, 2)?;
    }

    #[cfg(any(
        target_os = "linux",
        target_os = "dragonfly",
        target_os = "freebsd",
        target_os = "netbsd",
        target_os = "openbsd"
    ))]
    {
        menu.insert(&file_menu, 0)?;
        menu.insert(&view_menu, 2)?;
    }

    Ok(menu)
}

#[cfg(desktop)]
fn selected_theme_label(label: &str, selected: bool) -> String {
    if selected {
        format!("● {label}")
    } else {
        format!("  {label}")
    }
}

#[cfg(desktop)]
fn kana_menu_label(japanese: &'static str) -> Option<&'static str> {
    Some(match japanese {
        "ファイル" => "ふみ",
        "新規ファイル" => "あらたなるふみ",
        "開く..." => "ひらく...",
        "フォルダを開く..." => "ところをひらく...",
        "最近使った項目はありません" => "このごろのものなし",
        "最近使ったフォルダ" => "このごろのところ",
        "設定..." => "おこのみ...",
        "アシスト設定..." => "あしすとのせってい...",
        "保存" => "たくはふ",
        "別名で保存..." => "なをかへてたくはふ...",
        "HTMLとして書き出す…" => "HTML としてしるしだす…",
        "PDFとして書き出す…" => "PDF としてしるしだす…",
        "ウィンドウを閉じる" => "まどをとぢる",
        "表示" => "ながめ",
        "プレビュー" => "したみ",
        "レビューデスク" => "れびゅーのつくゑ",
        "えるモード / 編集モード" => "えるもーど / へんしゅうもーど",
        "Agent ウィンドウを開く" => "えーじぇんとまどをひらく",
        "行を折り返す" => "くだりををる",
        "不可視文字を表示" => "みえぬもじをあらはす",
        "スペルチェック" => "つづりみ",
        "テーマ" => "いろあひ",
        "ライト" => "ひかり",
        "ダーク" => "やみ",
        "江戸彼岸（お遊び）" => "えどひがん（おあそび）",
        "夜光" => "よるひかり",
        "曙光" => "あけぼのひかり",
        "フルスクリーンにする" => "まどをみちみちにす",
        "編集" => "てならひ",
        "取り消す" => "かへす",
        "やり直す" => "またなす",
        "カット" => "きる",
        "コピー" => "うつす",
        "ペースト" => "はる",
        "すべて選択" => "みなえらぶ",
        "ウィンドウ" => "まど",
        "しまう" => "しまふ",
        "拡大/縮小" => "おほきく/ちひさく",
        "ヘルプ" => "たすけ",
        "ローカルデータの扱い..." => "ろーかるでーたのあつかひ...",
        "Hazakura Editor について" => "Hazakura Editor のこと",
        "サービス" => "つかへ",
        "Hazakura Editor を隠す" => "Hazakura Editor をかくす",
        "ほかを隠す" => "ほかをかくす",
        "Hazakura Editor を終了" => "Hazakura Editor ををはる",
        _ => return None,
    })
}

#[cfg(desktop)]
fn strip_theme_marker(label: &str) -> &str {
    label
        .strip_prefix("● ")
        .or_else(|| label.strip_prefix("  "))
        .unwrap_or(label)
}

#[cfg(desktop)]
pub(crate) fn recent_submenu<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    title: &str,
    empty_label: &str,
    id_prefix: &str,
    items: &[AppMenuRecentItem],
) -> tauri::Result<Submenu<R>> {
    let submenu = Submenu::new(app, title, true)?;

    if items.is_empty() {
        submenu.append(&MenuItem::new(app, empty_label, false, None::<&str>)?)?;
        return Ok(submenu);
    }

    for (index, item) in items.iter().take(8).enumerate() {
        submenu.append(&MenuItem::with_id(
            app,
            format!("{id_prefix}{index}"),
            menu_label(&item.label),
            true,
            None::<&str>,
        )?)?;
    }

    Ok(submenu)
}

#[cfg(desktop)]
pub(crate) fn menu_label(label: &str) -> String {
    let trimmed = label.trim();

    if trimmed.is_empty() {
        return "Untitled".to_string();
    }

    trimmed.replace('&', "&&")
}

#[cfg(desktop)]
pub(crate) fn emit_app_menu_event<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    event: tauri::menu::MenuEvent,
) {
    let action = event.id().as_ref();

    if let Some(theme_preference) = theme_preference_for_menu_action(action) {
        let _ = sync_theme_menu_state(app, theme_preference);
    }

    if action.starts_with(MENU_RECENT_FILE_PREFIX)
        || action.starts_with(MENU_RECENT_FOLDER_PREFIX)
        || matches!(
            action,
            MENU_NEW_FILE
                | MENU_OPEN_FILE
                | MENU_IMPORT_PDF_IMAGE
                | MENU_OPEN_FOLDER
                | MENU_SAVE
                | MENU_SAVE_AS
                | MENU_EXPORT_HTML
                | MENU_EXPORT_EPUB_BETA
                | MENU_EXPORT_PDF
                | MENU_CLOSE_WINDOW
                | MENU_QUIT_APP
                | MENU_TOGGLE_PREVIEW
                | MENU_TOGGLE_L_MODE
                | MENU_TOGGLE_WRAP
                | MENU_TOGGLE_INVISIBLES
                | MENU_TOGGLE_SPELLCHECK
                | MENU_THEME_LIGHT
                | MENU_THEME_DARK
                | MENU_THEME_EDOHIGAN
                | MENU_THEME_YAKOU
                | MENU_THEME_SHOKOU
                | MENU_THEME_CRT
                | MENU_THEME_SHINKAI
                | MENU_PREFERENCES
                | MENU_AGENT_WORKBENCH
                | MENU_LOCAL_DATA_DISCLOSURE
                | MENU_OPEN_SUPPORT_DIAGNOSTICS
                | MENU_PRIVACY_POLICY
                | MENU_OPEN_SOURCE_ACKNOWLEDGEMENTS
                | MENU_ABOUT_HELP
                | MENU_OPEN_AGENT_WINDOW
                | MENU_OPEN_APPLE_ASSIST_WINDOW
        )
    {
        let _ = app.emit(MENU_ACTION_EVENT, action);
    }
}

#[cfg(desktop)]
fn theme_preference_for_menu_action(action: &str) -> Option<&'static str> {
    match action {
        MENU_THEME_LIGHT => Some("light"),
        MENU_THEME_DARK => Some("dark"),
        MENU_THEME_EDOHIGAN => Some("edohigan"),
        MENU_THEME_YAKOU => Some("yakou"),
        MENU_THEME_SHOKOU => Some("shokou"),
        MENU_THEME_CRT => Some("crt"),
        MENU_THEME_SHINKAI => Some("shinkai"),
        _ => None,
    }
}

#[cfg(desktop)]
pub(crate) fn sync_theme_menu_state<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    theme_preference: &str,
) -> Result<(), String> {
    // The theme submenu uses normal menu items with a radio-style marker
    // because native check menu items read as independent ON/OFF toggles.
    let menu = app
        .menu()
        .ok_or_else(|| "App menu not available".to_string())?;

    for top_item in menu.items().map_err(|e| e.to_string())? {
        if let Some(top_submenu) = top_item.as_submenu() {
            for child_item in top_submenu.items().map_err(|e| e.to_string())? {
                if let Some(theme_submenu) = child_item.as_submenu() {
                    if sync_theme_submenu_items(theme_submenu, theme_preference)? {
                        return Ok(());
                    }
                }
            }
        }
    }

    Err("Theme submenu not found".to_string())
}

#[cfg(desktop)]
fn sync_theme_submenu_items<R: tauri::Runtime>(
    submenu: &Submenu<R>,
    theme_preference: &str,
) -> Result<bool, String> {
    let mut found_theme_item = false;

    for theme_item in submenu.items().map_err(|e| e.to_string())? {
        if let Some(menu_item) = theme_item.as_menuitem() {
            let id = menu_item.id().as_ref();
            if let Some(preference) = theme_preference_for_menu_action(id) {
                found_theme_item = true;
                let current_label = menu_item.text().map_err(|e| e.to_string())?;
                let selected = preference == theme_preference;
                menu_item
                    .set_text(selected_theme_label(
                        strip_theme_marker(&current_label),
                        selected,
                    ))
                    .map_err(|e| e.to_string())?;
            }
        }
    }

    Ok(found_theme_item)
}
