pub(crate) mod security {
    pub(crate) mod window_guard;
}
pub(crate) mod commands {
    pub(crate) mod agent_workbench;
    pub(crate) mod app_window;
    pub(crate) mod apple_assist;
    pub(crate) mod apple_assist_supervisor;
    pub(crate) mod apple_assist_target;
    pub(crate) mod export;
    pub(crate) mod files;
    pub(crate) mod images;
    pub(crate) mod search;
    pub(crate) mod security_bookmarks;
    pub(crate) mod workspace;
    pub(crate) mod workspace_broadcast;
}
pub(crate) mod agent;
pub(crate) mod auto_backup;
pub(crate) mod distribution;
pub(crate) mod menu;
pub(crate) mod types;
pub(crate) mod util;

#[cfg(test)]
pub(crate) mod tests;

use tauri::Emitter;
use tauri::Manager;

// `use super::*;` in `src/tests.rs` pulls in everything from the crate
// root. The following `use` lines don't have call sites in `run()`
// itself, but they re-export the symbols into the crate root so
// `tests.rs` can keep its pre-split `use super::*;` import. The
// `#[allow(unused_imports)]` keeps the lib build warning-free.
#[allow(unused_imports)]
use std::env;
#[allow(unused_imports)]
use std::ffi::OsStr;
#[allow(unused_imports)]
use std::fs;
#[allow(unused_imports)]
use std::path::PathBuf;
#[allow(unused_imports)]
use std::process::Command;
#[allow(unused_imports)]
use std::sync::atomic::Ordering;

#[allow(unused_imports)]
use crate::agent::*;
#[allow(unused_imports)]
use crate::commands::agent_workbench::*;
#[allow(unused_imports)]
use crate::commands::app_window::*;
#[allow(unused_imports)]
use crate::commands::apple_assist::*;
#[allow(unused_imports)]
use crate::commands::apple_assist_supervisor::*;
#[allow(unused_imports)]
use crate::commands::apple_assist_target::*;
#[allow(unused_imports)]
use crate::commands::export::*;
#[allow(unused_imports)]
use crate::commands::files::*;
#[allow(unused_imports)]
use crate::commands::images::*;
#[allow(unused_imports)]
use crate::commands::search::*;
#[allow(unused_imports)]
use crate::commands::security_bookmarks::*;
#[allow(unused_imports)]
use crate::commands::workspace::*;
#[allow(unused_imports)]
use crate::commands::workspace_broadcast::*;
#[allow(unused_imports)]
use crate::distribution::*;
#[allow(unused_imports)]
use crate::menu::*;
#[allow(unused_imports)]
use crate::security::window_guard::*;
#[allow(unused_imports)]
use crate::types::*;
#[allow(unused_imports)]
use crate::util::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    run_sandbox_parent_smoke_if_requested();

    let builder = tauri::Builder::default()
        .manage(AgentWorkbenchSessionStore::default())
        .manage(AppleAssistHelperStore::default())
        .manage(OpenedFileStore::default())
        .manage(commands::workspace_broadcast::MainWorkspaceCache::default())
        .manage(commands::apple_assist_target::MainAppleAssistTargetCache::default())
        .plugin(tauri_plugin_dialog::init());

    #[cfg(desktop)]
    let builder = builder
        .menu(build_app_menu)
        .on_menu_event(emit_app_menu_event);

    builder
        .invoke_handler(tauri::generate_handler![
            open_text_file,
            reveal_path_in_file_manager,
            create_text_file,
            create_text_folder,
            get_file_metadata,
            list_workspace_directory,
            list_workspace_tree,
            create_security_scoped_bookmark,
            resolve_security_scoped_bookmark,
            rename_workspace_entry,
            move_workspace_entry,
            move_workspace_entry_to_trash,
            open_image_file,
            open_workspace_image,
            search_workspace_files,
            start_agent_workbench_session,
            stop_agent_workbench_session,
            get_agent_workbench_session_state,
            write_agent_workbench_session_input,
            resize_agent_workbench_terminal,
            list_agent_provider_availability,
            probe_apple_assist_availability,
            generate_apple_assist_candidate,
            drain_opened_files,
            request_app_restart,
            exit_app,
            hide_main_window,
            save_text_file,
            save_text_file_as,
            update_app_menu_state,
            update_theme_menu_state,
            open_agent_window,
            set_agent_window_theme,
            open_apple_assist_window,
            toggle_apple_assist_window,
            set_apple_assist_window_theme,
            request_apply_ai_edit_transaction,
            open_main_agent_pane,
            get_main_active_workspace,
            set_main_active_workspace,
            get_main_apple_assist_target,
            set_main_apple_assist_target,
            save_pasted_image,
            import_image_from_path,
            open_temp_print_html,
            save_auto_backup,
            list_auto_backups,
            read_auto_backup,
            prune_auto_backups,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| match event {
            tauri::RunEvent::Opened { urls } => {
                let paths = urls
                    .into_iter()
                    .filter_map(|url| url.to_file_path().ok())
                    .filter(|path| path.is_file())
                    .map(|path| path.to_string_lossy().to_string())
                    .collect::<Vec<_>>();

                if paths.is_empty() {
                    return;
                }

                #[cfg(target_os = "macos")]
                raise_main_window_on_opened_files(app, paths.len());

                if let Some(store) = app.try_state::<OpenedFileStore>() {
                    if let Ok(mut pending_paths) = store.0.lock() {
                        pending_paths.extend(paths.clone());
                    }
                }

                let _ = app.emit(OPENED_FILES_EVENT, paths);
            }
            #[cfg(target_os = "macos")]
            tauri::RunEvent::Reopen {
                has_visible_windows,
                ..
            } => {
                restore_main_window_on_reopen(app, has_visible_windows);
            }
            // v0.17 app-store-quality: save-restore-regression slice 1.4
            // — intercept app-level exit requests so the frontend
            // gets a chance to consult dirty state. The normal macOS
            // Quit menu item is custom-routed through `MENU_QUIT_APP`
            // first; this run-loop arm remains the fallback for
            // OS-driven quit signals that still route through
            // `RunEvent::ExitRequested` in Tauri 2.
            //
            // `EXIT_CONFIRMED_BY_FRONTEND` is flipped by the
            // `exit_app` command when the frontend has confirmed
            // the exit (user picked Save/Discard, or the dirty-
            // count was zero). Once that flag is set, we skip
            // `prevent_exit()` and let Tauri run its normal
            // shutdown — Drop handlers for managed state
            // (`AgentWorkbenchSessionStore`, Apple Assist helpers)
            // fire, child processes are killed/waited, and
            // cleanup runs before the process terminates.
            tauri::RunEvent::ExitRequested { api, .. } => {
                if EXIT_CONFIRMED_BY_FRONTEND.load(Ordering::SeqCst) {
                    return;
                }
                api.prevent_exit();
                if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
                    let _ = window.emit(APP_EXIT_REQUESTED_EVENT, ());
                }
            }
            _ => {}
        });
}

fn run_sandbox_parent_smoke_if_requested() {
    if std::env::var("HAZAKURA_SANDBOX_PARENT_SMOKE").as_deref() != Ok("apple-assist-probe") {
        return;
    }

    let store = AppleAssistHelperStore::default();
    match probe_availability_via_helper(&store) {
        Ok(envelope) => {
            match serde_json::to_string(&envelope) {
                Ok(serialized) => println!("apple_assist_parent_smoke: {serialized}"),
                Err(err) => {
                    eprintln!("apple_assist_parent_smoke_error: failed to encode result: {err}");
                    std::process::exit(1);
                }
            }
            std::process::exit(0);
        }
        Err(err) => {
            eprintln!("apple_assist_parent_smoke_error: {err}");
            std::process::exit(1);
        }
    }
}
