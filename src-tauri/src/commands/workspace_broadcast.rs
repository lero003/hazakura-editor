use crate::security::window_guard::*;
use crate::types::*;

use std::sync::Mutex;
use tauri::Emitter;
use tauri::Manager;

// Process-singleton cache of the main window's active workspace
// root. The detached Agent window reads this on mount and
// subscribes to `MAIN_WORKSPACE_CHANGED_EVENT` for live updates;
// the main window writes here on open / close via
// `set_main_active_workspace`. This is the bridge that lets the
// detached Agent window start its own sessions without the main
// window being alive — the value is the *latest known* workspace
// path or `None` when no workspace is open. See
// docs/assist-surface-strategy.md and
// docs/agent-workbench-boundary.md.

#[derive(Default)]
pub(crate) struct MainWorkspaceCache(pub(crate) Mutex<Option<String>>);

#[cfg(desktop)]
#[tauri::command]
pub(crate) fn get_main_active_workspace<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    app: tauri::AppHandle<R>,
) -> Result<Option<String>, String> {
    // The detached Agent window is the primary caller; the main
    // window may also call it (for self-consistency). The gate is
    // intentionally permissive so the agent window does not depend
    // on the main window being alive.
    let _ = ensure_label_is_main_or_agent(window.label())?;
    let cache_state = app.state::<MainWorkspaceCache>();
    let cache = cache_state
        .0
        .lock()
        .map_err(|_| "Cannot read main workspace cache.".to_string())?;
    Ok(cache.clone())
}

#[cfg(desktop)]
#[tauri::command]
pub(crate) fn set_main_active_workspace<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    app: tauri::AppHandle<R>,
    workspace: Option<String>,
) -> Result<(), String> {
    ensure_main_window(&window)?;

    let cache_state = app.state::<MainWorkspaceCache>();
    let mut cache = cache_state
        .0
        .lock()
        .map_err(|_| "Cannot lock main workspace cache.".to_string())?;

    // Only fire the change event on actual change so detached
    // listeners don't churn on every open. The comparison is on
    // `Option<String>` equality.
    if *cache == workspace {
        return Ok(());
    }

    *cache = workspace.clone();
    drop(cache);

    let _ = app.emit(MAIN_WORKSPACE_CHANGED_EVENT, workspace);
    Ok(())
}

#[cfg(desktop)]
#[cfg_attr(not(test), allow(dead_code))]
pub(crate) fn get_main_active_workspace_with_label(label: &str) -> Result<(), String> {
    ensure_label_is_main_or_agent(label)
}

#[cfg(desktop)]
#[cfg_attr(not(test), allow(dead_code))]
pub(crate) fn set_main_active_workspace_with_label(label: &str) -> Result<(), String> {
    ensure_label_is_main(label)
}
