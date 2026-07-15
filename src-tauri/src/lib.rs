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
    pub(crate) mod external_links;
    pub(crate) mod files;
    pub(crate) mod images;
    pub(crate) mod import_assist;
    pub(crate) mod okf;
    pub(crate) mod reference_compare;
    pub(crate) mod search;
    pub(crate) mod security_bookmarks;
    pub(crate) mod workspace;
    pub(crate) mod workspace_broadcast;
}
pub(crate) mod agent;
pub(crate) mod auto_backup;
pub(crate) mod distribution;
pub(crate) mod import_assist;
pub(crate) mod menu;
pub(crate) mod os_handoff;
pub(crate) mod types;
pub(crate) mod util;

#[cfg(test)]
pub(crate) mod tests;

use tauri::Emitter;
use tauri::Manager;

// v0.25 native-feeling shell: apply macOS vibrancy to the main window so
// the sidebar / top-chrome surfaces (made transparent in CSS) sit over a
// real `NSVisualEffectView` instead of a `backdrop-filter` CSS
// approximation. macOS-only and best-effort: a vibrancy failure must not
// prevent the editor from launching, so the result is ignored.
#[cfg(target_os = "macos")]
fn apply_macos_vibrancy<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial, NSVisualEffectState};

    // The main window is created by `tauri.conf.json` before `setup`
    // runs, so resolve it by its configured label.
    let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        return;
    };
    // `Active` state forces the vibrant appearance regardless of window
    // key state, so the material reads clearly instead of flattening to a
    // near-solid tint behind the dark overlay.
    let _ = apply_vibrancy(
        &window,
        NSVisualEffectMaterial::Sidebar,
        Some(NSVisualEffectState::Active),
        None,
    );
}

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
use crate::commands::external_links::*;
#[allow(unused_imports)]
use crate::commands::files::*;
#[allow(unused_imports)]
use crate::commands::images::*;
#[allow(unused_imports)]
use crate::commands::import_assist::*;
#[allow(unused_imports)]
use crate::commands::okf::*;
#[allow(unused_imports)]
use crate::commands::reference_compare::*;
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
use crate::os_handoff::*;
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
        .manage(std::sync::Arc::new(AppleAssistHelperStore::default()))
        .manage(std::sync::Arc::new(
            commands::okf::OkfDiscoveryCancelStore::default(),
        ))
        .manage(OpenedFileStore::default())
        .manage(commands::workspace_broadcast::MainWorkspaceCache::default())
        .manage(commands::apple_assist_target::MainAppleAssistTargetCache::default())
        .plugin(tauri_plugin_dialog::init());

    #[cfg(desktop)]
    let builder = builder
        .menu(build_app_menu)
        .on_menu_event(emit_app_menu_event);

    // v0.25 native-feeling shell: apply macOS vibrancy once the main
    // window exists. On non-macOS targets this is a no-op setup hook.
    #[cfg(target_os = "macos")]
    let builder = builder.setup(|app| {
        apply_macos_vibrancy(app.handle());
        Ok(())
    });

    // When the detached Hazakura Local Assist (`apple-assist`) window is
    // closed while a generation is in flight, stop the helper so the
    // `spawn_blocking` task unblocks and releases the supervisor `inner`
    // lock. Without this, reopening the window and starting a new
    // generation would block forever on that lock.
    //
    // Handled on the Rust side (not in the window's JS) so it does not
    // depend on the detached window's event loop and does not block the
    // close: `cancel_active` kills the shared child without acquiring
    // `inner`, which unblocks the in-flight read immediately. The close
    // itself is not prevented — `api.prevent_close()` is never called.
    // Best-effort: if no store is reachable or no generation is active,
    // `cancel_active` is a no-op. Other windows are unaffected.
    let builder = builder.on_window_event(|window, event| {
        if !matches!(event, tauri::WindowEvent::CloseRequested { .. }) {
            return;
        }
        if window.label() != APPLE_ASSIST_WINDOW_LABEL {
            return;
        }
        let Some(store) = window
            .app_handle()
            .try_state::<std::sync::Arc<AppleAssistHelperStore>>()
        else {
            return;
        };
        let _ = store.cancel_active();
    });

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
            scan_okf_bundle,
            cancel_okf_bundle_scan,
            create_okf_scaffold,
            start_agent_workbench_session,
            stop_agent_workbench_session,
            get_agent_workbench_session_state,
            write_agent_workbench_session_input,
            resize_agent_workbench_terminal,
            list_agent_provider_availability,
            probe_apple_assist_availability,
            generate_apple_assist_candidate,
            generate_apple_assist_candidate_streaming,
            stop_apple_assist_candidate,
            drain_opened_files,
            request_app_restart,
            exit_app,
            hide_main_window,
            save_text_file,
            save_text_file_as,
            save_binary_file_as,
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
            import_source_to_markdown,
            open_pdf_reference,
            render_pdf_reference_page,
            close_pdf_reference,
            get_reference_file_metadata,
            export_pdf,
            open_external_url,
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
            // (`AgentWorkbenchSessionStore`, Hazakura Local Assist helpers)
            // fire, child processes are killed/waited, and
            // cleanup runs before the process terminates.
            tauri::RunEvent::ExitRequested { api, .. } => {
                if EXIT_CONFIRMED_BY_FRONTEND.load(Ordering::SeqCst) {
                    // Confirmed quit: drop staged PDF reference copy before
                    // process teardown so hazakura-import-assist-stage does
                    // not retain a confidential PDF after close.
                    import_assist::pdf_reference::release_active_pdf_reference();
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
