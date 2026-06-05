use crate::security::window_guard::*;
use crate::types::*;

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::Emitter;
use tauri::Manager;

// v0.12+ Apple Local Assist Writing Companion (slice 3+).
// Process-singleton cache of the main window's current Apple
// Assist target. The detached Apple Assist window reads this
// on demand via `get_main_apple_assist_target` and subscribes
// to `MAIN_APPLE_ASSIST_TARGET_CHANGED_EVENT` for live updates;
// the main window writes here on selection / cursor change
// via `set_main_apple_assist_target`.
//
// The shape mirrors `MainWorkspaceCache` in
// `commands/workspace_broadcast.rs`: a small, owned by Rust,
// cross-window bridge. The TS side mirrors the data in
// `src/types.ts` (`AppleAssistTarget`) and the main window
// infers the target from the editor's CodeMirror state via
// `inferAppleAssistTarget` in
// `src/features/editor/aiEditTarget.ts`. Rust only stores
// and forwards the inferred snapshot — it does NOT do any
// text parsing itself.

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum AppleAssistTargetKind {
    Selection,
    Paragraph,
    Block,
    Section,
    Document,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AppleAssistTargetSnapshot {
    pub(crate) kind: AppleAssistTargetKind,
    pub(crate) start: u32,
    pub(crate) end: u32,
    pub(crate) text: String,
    pub(crate) label: String,
    pub(crate) active_document_path: Option<String>,
    pub(crate) active_document_name: Option<String>,
    pub(crate) captured_at_ms: u64,
}

#[derive(Default)]
pub(crate) struct MainAppleAssistTargetCache(pub(crate) Mutex<Option<AppleAssistTargetSnapshot>>);

#[cfg(desktop)]
#[tauri::command]
pub(crate) fn get_main_apple_assist_target<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    app: tauri::AppHandle<R>,
) -> Result<Option<AppleAssistTargetSnapshot>, String> {
    // The detached Apple Assist window is the primary caller;
    // the main window may also call it (for self-consistency).
    // The gate is intentionally permissive so the apple-assist
    // window can poll the cache without depending on the main
    // window being alive.
    let _ = ensure_label_is_main_or_apple_assist(window.label())?;
    let cache_state = app.state::<MainAppleAssistTargetCache>();
    let cache = cache_state
        .0
        .lock()
        .map_err(|_| "Cannot read main apple assist target cache.".to_string())?;
    Ok(cache.clone())
}

#[cfg(desktop)]
#[tauri::command]
pub(crate) fn set_main_apple_assist_target<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    app: tauri::AppHandle<R>,
    target: AppleAssistTargetSnapshot,
) -> Result<(), String> {
    ensure_main_window(&window)?;

    let cache_state = app.state::<MainAppleAssistTargetCache>();
    let mut cache = cache_state
        .0
        .lock()
        .map_err(|_| "Cannot lock main apple assist target cache.".to_string())?;

    // The cache stores the full snapshot; the event payload is
    // the snapshot itself so detached listeners can rebuild
    // their UI without an additional `get_*` round-trip.
    *cache = Some(target.clone());
    drop(cache);

    let _ = app.emit(MAIN_APPLE_ASSIST_TARGET_CHANGED_EVENT, target);
    Ok(())
}

#[cfg(desktop)]
#[cfg_attr(not(test), allow(dead_code))]
pub(crate) fn get_main_apple_assist_target_with_label(label: &str) -> Result<(), String> {
    ensure_label_is_main_or_apple_assist(label)
}

#[cfg(desktop)]
#[cfg_attr(not(test), allow(dead_code))]
pub(crate) fn set_main_apple_assist_target_with_label(label: &str) -> Result<(), String> {
    ensure_label_is_main(label)
}
