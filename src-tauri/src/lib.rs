pub(crate) mod security {
    pub(crate) mod window_guard;
}
pub(crate) mod commands {
    pub(crate) mod agent_workbench;
    pub(crate) mod app_window;
    pub(crate) mod export;
    pub(crate) mod files;
    pub(crate) mod images;
    pub(crate) mod search;
    pub(crate) mod workspace;
    pub(crate) mod workspace_broadcast;
}
pub(crate) mod agent;
pub(crate) mod auto_backup;
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
use crate::agent::*;
#[allow(unused_imports)]
use crate::commands::agent_workbench::*;
#[allow(unused_imports)]
use crate::commands::app_window::*;
#[allow(unused_imports)]
use crate::commands::export::*;
#[allow(unused_imports)]
use crate::commands::files::*;
#[allow(unused_imports)]
use crate::commands::images::*;
#[allow(unused_imports)]
use crate::commands::search::*;
#[allow(unused_imports)]
use crate::commands::workspace::*;
#[allow(unused_imports)]
use crate::commands::workspace_broadcast::*;
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
    let builder = tauri::Builder::default()
        .manage(AgentWorkbenchSessionStore::default())
        .manage(OpenedFileStore::default())
        .manage(commands::workspace_broadcast::MainWorkspaceCache::default())
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
            get_file_metadata,
            list_workspace_directory,
            list_workspace_tree,
            open_workspace_image,
            search_workspace_files,
            start_agent_workbench_session,
            stop_agent_workbench_session,
            get_agent_workbench_session_state,
            write_agent_workbench_session_input,
            resize_agent_workbench_terminal,
            list_agent_provider_availability,
            drain_opened_files,
            request_app_restart,
            save_text_file,
            save_text_file_as,
            update_app_menu_state,
            update_theme_menu_state,
            open_agent_window,
            set_agent_window_theme,
            open_main_agent_pane,
            get_main_active_workspace,
            set_main_active_workspace,
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
        .run(|app, event| {
            if let tauri::RunEvent::Opened { urls } = event {
                let paths = urls
                    .into_iter()
                    .filter_map(|url| url.to_file_path().ok())
                    .filter(|path| path.is_file())
                    .map(|path| path.to_string_lossy().to_string())
                    .collect::<Vec<_>>();

                if paths.is_empty() {
                    return;
                }

                if let Some(store) = app.try_state::<OpenedFileStore>() {
                    if let Ok(mut pending_paths) = store.0.lock() {
                        pending_paths.extend(paths.clone());
                    }
                }

                let _ = app.emit(OPENED_FILES_EVENT, paths);
            }
        });
}
