use crate::menu::*;
use crate::security::window_guard::*;
use crate::types::*;

use std::sync::atomic::Ordering;
use std::sync::OnceLock;
use tauri::window::Color;
use tauri::Emitter;
use tauri::Manager;
use tauri::Theme;
use tauri::TitleBarStyle;
use tauri::WebviewUrl;
use tauri::WebviewWindowBuilder;

// Single source of truth for the per-theme OS window background color.
// Mirrors `windowBackgroundColorForTheme` in
// `src/hooks/app/useAppPreferences.ts` (both import the same JSON).
// The hex values are the initial-paint colors used for the agent
// window's Tauri `background_color` and the main window's
// `setCurrentWindowBackgroundColor` IPC. For themes whose CSS
// `--bg` is a gradient (yakou / shokou), this is the gradient's
// start color, picked to keep the title-bar / chrome visually
// close to the actual surface during the pre-CSS paint.
const THEME_BACKGROUND_COLORS_JSON: &str = include_str!("../../../src/lib/theme-palette.json");

#[derive(serde::Deserialize)]
struct ThemeBackgroundColors {
    dark: String,
    light: String,
    sakura: String,
    shokou: String,
    yakou: String,
}

fn theme_background_colors() -> &'static ThemeBackgroundColors {
    static CACHE: OnceLock<ThemeBackgroundColors> = OnceLock::new();
    CACHE.get_or_init(|| {
        serde_json::from_str(THEME_BACKGROUND_COLORS_JSON)
            .expect("src/lib/theme-palette.json must be a valid theme background color map")
    })
}

fn parse_hex_color(hex: &str) -> Color {
    let trimmed = hex.trim_start_matches('#');
    let r = u8::from_str_radix(&trimmed[0..2], 16)
        .expect("theme background color must be a 6-digit hex string");
    let g = u8::from_str_radix(&trimmed[2..4], 16)
        .expect("theme background color must be a 6-digit hex string");
    let b = u8::from_str_radix(&trimmed[4..6], 16)
        .expect("theme background color must be a 6-digit hex string");
    Color(r, g, b, 0xff)
}

pub(crate) fn agent_window_background_color(theme: &str) -> Color {
    let palette = theme_background_colors();
    let hex = match theme {
        "dark" => &palette.dark,
        "sakura" => &palette.sakura,
        "yakou" => &palette.yakou,
        "shokou" => &palette.shokou,
        "light" => &palette.light,
        _ => &palette.dark,
    };
    parse_hex_color(hex)
}

// Map the in-app theme preference to the agent window's OS chrome
// `Theme` (controls whether the title-bar / traffic-lights paint
// light or dark). Matches the `BaseTheme` derivation in
// `useAppPreferences.ts`: `dark` / `yakou` → Dark, everything else → Light.
pub(crate) fn agent_window_os_theme(theme: &str) -> Theme {
    match theme {
        "dark" | "yakou" => Theme::Dark,
        _ => Theme::Light,
    }
}

#[tauri::command]
pub(crate) fn update_app_menu_state<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    app: tauri::AppHandle<R>,
    state: AppMenuState,
    session_store: tauri::State<'_, AgentWorkbenchSessionStore>,
) -> Result<(), String> {
    ensure_main_window(&window)?;
    // Mirror the Agent Workbench active + consent flags into the
    // process-singleton session store. The Rust `open_agent_window`
    // command reads these flags to gate the detached Agent Window
    // server-side (defense in depth — the menu item is also gated
    // client-side, but a direct IPC call must not be able to spawn
    // the agent window when Agent Workbench is disabled or consent
    // is missing).
    session_store
        .agent_workbench_active
        .store(state.agent_workbench_active, Ordering::SeqCst);
    session_store
        .agent_workbench_consent
        .store(state.agent_workbench_consent, Ordering::SeqCst);

    let menu = build_app_menu_with_state(&app, Some(&state))
        .map_err(|err| format!("Cannot build app menu: {err}"))?;
    app.set_menu(menu)
        .map_err(|err| format!("Cannot update app menu: {err}"))?;

    Ok(())
}

#[tauri::command]
pub(crate) fn open_agent_window<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    app: tauri::AppHandle<R>,
    session_store: tauri::State<'_, AgentWorkbenchSessionStore>,
    theme: Option<String>,
) -> Result<(), String> {
    ensure_main_window(&window)?;
    if !session_store.agent_workbench_active.load(Ordering::SeqCst) {
        return Err(
            "Agent Workbench is not active. Enable it in Preferences and restart before opening the Agent window."
                .to_string(),
        );
    }

    if !session_store.agent_workbench_consent.load(Ordering::SeqCst) {
        return Err(
            "Agent Workbench consent is required before opening the Agent window.".to_string(),
        );
    }

    let theme = theme.unwrap_or_else(|| "dark".to_string());

    if let Some(existing) = app.get_webview_window("agent") {
        // Window already open — refocus, then push the current theme so
        // the existing agent window catches up if the user changed
        // themes between launches.
        let _ = existing.set_focus();
        let bg = agent_window_background_color(&theme);
        let _ = existing.set_background_color(Some(bg));
        let _ = existing.set_theme(Some(agent_window_os_theme(&theme)));
        return Ok(());
    }

    // Companion-slot mutual exclusion: the Apple Assist window
    // occupies the same outside-companion slot as the Agent window
    // (see `docs/apple-local-assist-writing-companion-plan.md`).
    // Closing the Apple Assist window here keeps the two surfaces
    // from coexisting as competing main companions; the main window
    // is the only ever-present surface.
    if let Some(apple_assist) = app.get_webview_window(APPLE_ASSIST_WINDOW_LABEL) {
        let _ = apple_assist.close();
    }

    // Transparent title bar + a per-theme `background_color` so the OS
    // chrome (title bar / traffic lights) shows the same dark or light
    // surface as the main window's chrome, matching the main window's
    // tauri.conf.json pattern. The per-theme color is taken from the
    // `theme` argument (the main window passes its current
    // `THEME_STORAGE_KEY` value), so the initial paint is already
    // correct — no flash of the wrong-color title bar.
    WebviewWindowBuilder::new(&app, "agent", WebviewUrl::App("agent.html".into()))
        .title("hazakura agent")
        .title_bar_style(TitleBarStyle::Transparent)
        .background_color(agent_window_background_color(&theme))
        .theme(Some(agent_window_os_theme(&theme)))
        // Narrow tool-window size (Photoshop / IDE panel proportions),
        // not a browser-popup size. The 420 × 560 floor is just enough
        // to keep the four-row chrome (header / 2×2 info grid /
        // terminal / footer) readable; the xterm fit-addon will reflow
        // to the new columns on the first ResizeObserver tick after
        // open. The 480 × 800 default is wider than the prior 440 ×
        // 760 so the info row fits a 2×2 grid without truncating
        // "INPUT disabled" / the state pill / the footer status.
        .inner_size(480.0, 800.0)
        .min_inner_size(420.0, 560.0)
        .center()
        .build()
        .map_err(|err| format!("Cannot open Agent window: {err}"))?;

    Ok(())
}

#[tauri::command]
pub(crate) fn set_agent_window_theme<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    app: tauri::AppHandle<R>,
    theme: String,
) -> Result<(), String> {
    ensure_label_is_main_or_agent(window.label())?;
    let bg = agent_window_background_color(&theme);
    let os_theme = agent_window_os_theme(&theme);

    if let Some(agent_window) = app.get_webview_window(AGENT_WINDOW_LABEL) {
        agent_window
            .set_background_color(Some(bg))
            .map_err(|err| format!("Cannot update agent window background color: {err}"))?;
        agent_window
            .set_theme(Some(os_theme))
            .map_err(|err| format!("Cannot update agent window OS theme: {err}"))?;
    }

    Ok(())
}

#[tauri::command]
pub(crate) fn open_main_agent_pane<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    app: tauri::AppHandle<R>,
) -> Result<(), String> {
    ensure_label_is_main_or_agent(window.label())?;
    if let Some(main_window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        let _ = main_window.set_focus();
    }
    let _ = app.emit_to(MAIN_WINDOW_LABEL, OPEN_MAIN_AGENT_PANE_EVENT, ());
    Ok(())
}

// Label-only check used by the `open_main_agent_pane` test suite.
// The `app.emit_to` and `app.get_webview_window` calls in the body
// need a real `AppHandle`; the gate is the only piece worth pinning
// in unit tests, mirroring the `*_with_label` shim pattern used by
// the other boundary tests.
#[cfg(desktop)]
#[cfg_attr(not(test), allow(dead_code))]
pub(crate) fn open_main_agent_pane_with_label(label: &str) -> Result<(), String> {
    ensure_label_is_main_or_agent(label)
}

#[tauri::command]
pub(crate) fn update_theme_menu_state<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    app: tauri::AppHandle<R>,
    theme_preference: String,
) -> Result<(), String> {
    ensure_main_window(&window)?;
    crate::menu::sync_theme_menu_state(&app, &theme_preference)
}

#[tauri::command]
pub(crate) fn open_apple_assist_window<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    app: tauri::AppHandle<R>,
    theme: Option<String>,
) -> Result<(), String> {
    // v0.12+ Apple Local Assist Writing Companion mock (slice 2).
    // The Apple Assist window is a separate outside-companion slot
    // that replaces the Agent window in the same UX surface
    // (see `docs/apple-local-assist-writing-companion-plan.md`).
    // Unlike the Agent window it is NOT gated on
    // `agent_workbench_active` / `agent_workbench_consent`: Apple
    // Local Assist is a different trust boundary (Writing
    // Companion, not Code Agent). Only the main window may spawn
    // it, matching the Agent window's gate.
    ensure_main_window(&window)?;

    let theme = theme.unwrap_or_else(|| "dark".to_string());

    show_or_create_apple_assist_window(&app, &theme)
}

#[tauri::command]
pub(crate) fn toggle_apple_assist_window<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    app: tauri::AppHandle<R>,
    theme: Option<String>,
) -> Result<(), String> {
    // Main-window chrome uses Apple Assist as a visible companion
    // slot toggle. Menu / command-palette "open" actions still
    // call `open_apple_assist_window` so they keep the predictable
    // "open or focus" behavior.
    ensure_main_window(&window)?;

    if let Some(existing) = app.get_webview_window(APPLE_ASSIST_WINDOW_LABEL) {
        if existing.is_visible().unwrap_or(false) {
            existing
                .hide()
                .map_err(|err| format!("Cannot hide Apple Assist window: {err}"))?;
            return Ok(());
        }
    }

    let theme = theme.unwrap_or_else(|| "dark".to_string());
    show_or_create_apple_assist_window(&app, &theme)
}

// Label-only check used by the Apple Assist toggle boundary tests.
// The actual hide/show path needs a real Tauri window, but the
// trust boundary is worth pinning with the same shim pattern used
// by the other window commands.
#[cfg(desktop)]
#[cfg_attr(not(test), allow(dead_code))]
pub(crate) fn toggle_apple_assist_window_with_label(label: &str) -> Result<(), String> {
    ensure_label_is_main(label)
}

fn show_or_create_apple_assist_window<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    theme: &str,
) -> Result<(), String> {
    if let Some(existing) = app.get_webview_window(APPLE_ASSIST_WINDOW_LABEL) {
        // Window already open — refocus, then push the current
        // theme so the existing window catches up if the user
        // changed themes between launches. Mirrors the Agent
        // window's "refocus + resync" path.
        let _ = existing.show();
        let _ = existing.set_focus();
        let bg = agent_window_background_color(theme);
        let _ = existing.set_background_color(Some(bg));
        let _ = existing.set_theme(Some(agent_window_os_theme(theme)));
        return Ok(());
    }

    // Companion-slot mutual exclusion: the Apple Assist window
    // and the Agent window share the same outside-companion slot
    // and should not coexist as competing main companions.
    // Closing the Agent window here keeps the two surfaces
    // mutually exclusive.
    if let Some(agent) = app.get_webview_window(AGENT_WINDOW_LABEL) {
        let _ = agent.close();
    }

    WebviewWindowBuilder::new(
        app,
        APPLE_ASSIST_WINDOW_LABEL,
        WebviewUrl::App("apple-assist.html".into()),
    )
    .title("hazakura apple assist")
    .title_bar_style(TitleBarStyle::Transparent)
    .background_color(agent_window_background_color(theme))
    .theme(Some(agent_window_os_theme(theme)))
    // Same panel proportions as the Agent window so the two
    // surfaces feel like interchangeable companion slots. The
    // mock is intentionally a small form for rough requests; the
    // actual body editing happens in the main window.
    .inner_size(480.0, 800.0)
    .min_inner_size(420.0, 560.0)
    .center()
    .build()
    .map_err(|err| format!("Cannot open Apple Assist window: {err}"))?;

    Ok(())
}

#[tauri::command]
pub(crate) fn set_apple_assist_window_theme<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    app: tauri::AppHandle<R>,
    theme: String,
) -> Result<(), String> {
    // The Apple Assist window may legitimately update its own
    // background color / OS theme (e.g. when the user toggles
    // themes from the main window). Both labels are allowed so
    // the main window can also push a theme update, mirroring
    // the `set_agent_window_theme` pattern.
    ensure_label_is_main_or_apple_assist(window.label())?;
    let bg = agent_window_background_color(&theme);
    let os_theme = agent_window_os_theme(&theme);

    if let Some(apple_assist) = app.get_webview_window(APPLE_ASSIST_WINDOW_LABEL) {
        apple_assist
            .set_background_color(Some(bg))
            .map_err(|err| format!("Cannot update Apple Assist window background color: {err}"))?;
        apple_assist
            .set_theme(Some(os_theme))
            .map_err(|err| format!("Cannot update Apple Assist window OS theme: {err}"))?;
    }

    Ok(())
}

#[tauri::command]
pub(crate) fn request_apply_ai_edit_transaction<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    app: tauri::AppHandle<R>,
    payload: serde_json::Value,
) -> Result<(), String> {
    ensure_apple_assist_window(&window)?;
    app.emit_to(MAIN_WINDOW_LABEL, APPLY_AI_EDIT_TRANSACTION_EVENT, payload)
        .map_err(|err| format!("Cannot request Apple Assist edit: {err}"))?;
    Ok(())
}

#[cfg(desktop)]
#[cfg_attr(not(test), allow(dead_code))]
pub(crate) fn request_apply_ai_edit_transaction_with_label(label: &str) -> Result<(), String> {
    ensure_label_is_apple_assist(label)
}

#[tauri::command]
pub(crate) fn drain_opened_files<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    store: tauri::State<'_, OpenedFileStore>,
) -> Result<Vec<String>, String> {
    ensure_main_window(&window)?;
    let mut paths = store
        .0
        .lock()
        .map_err(|_| "Cannot read pending opened files.".to_string())?;
    Ok(paths.drain(..).collect())
}

#[tauri::command]
pub(crate) fn request_app_restart<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    app: tauri::AppHandle<R>,
) -> Result<(), String> {
    ensure_main_window(&window)?;
    app.request_restart();
    Ok(())
}
