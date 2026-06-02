use crate::menu::*;
use crate::security::window_guard::*;
use crate::types::*;

use std::sync::atomic::Ordering;
use tauri::window::Color;
use tauri::Emitter;
use tauri::Manager;
use tauri::Theme;
use tauri::TitleBarStyle;
use tauri::WebviewUrl;
use tauri::WebviewWindowBuilder;
// Map the in-app theme preference (the same string the main window
// stores under THEME_STORAGE_KEY) to the agent window's initial
// `background_color`. The agent window uses a `Transparent` title bar
// (set in `open_agent_window`'s builder) so the OS chrome shows this
// color through; matching the main window's per-theme `backgroundColor`
// keeps the two surfaces visually consistent. Hex values mirror
// `windowBackgroundColorForTheme` in `src/hooks/useAppPreferences.ts`
// and the new `set_agent_window_theme` command.
pub(crate) fn agent_window_background_color(theme: &str) -> Color {
    match theme {
        "dark" => Color(0x0e, 0x13, 0x11, 0xff),
        "sakura" => Color(0xfd, 0xf3, 0xf4, 0xff),
        "yakou" => Color(0x0c, 0x0c, 0x14, 0xff),
        "shokou" => Color(0xed, 0xf4, 0xfc, 0xff),
        "light" => Color(0xf3, 0xf6, 0xf4, 0xff),
        _ => Color(0x0e, 0x13, 0x11, 0xff),
    }
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
        // not a browser-popup size. The 380 × 520 floor is just enough
        // to keep the four-row chrome (header / info / terminal /
        // footer) readable; the xterm fit-addon will reflow to the new
        // columns on the first ResizeObserver tick after open.
        .inner_size(440.0, 760.0)
        .min_inner_size(380.0, 520.0)
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
