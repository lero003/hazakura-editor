// Default-path and button option compatibility is adapted from
// tauri-plugin-dialog 2.7.3 (Apache-2.0 OR MIT):
// Copyright 2019-2023 Tauri Programme within The Commons Conservancy.

use crate::security::window_guard::{ensure_label_is_main, ensure_main_window};
use serde::{Deserialize, Serialize};
use std::future::Future;
use std::path::PathBuf;
use std::pin::Pin;
use tauri::async_runtime::{channel, Receiver, Sender};
use tauri::{Manager, Runtime, WebviewWindow};

type DialogReply<T> = Result<T, String>;
type DialogFuture<T> = Pin<Box<dyn Future<Output = DialogReply<T>> + Send>>;

#[derive(Clone, Debug, Deserialize, PartialEq, Eq)]
pub(crate) struct DialogFilter {
    name: String,
    extensions: Vec<String>,
}

#[derive(Default, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub(crate) struct OpenDialogOptions {
    title: Option<String>,
    filters: Vec<DialogFilter>,
    default_path: Option<PathBuf>,
    multiple: bool,
    directory: bool,
    // This only affected the optional fs plugin's scope. That plugin is not
    // registered by Hazakura; keep accepting the frontend option unchanged.
    #[serde(rename = "recursive")]
    _recursive: bool,
    can_create_directories: Option<bool>,
}

#[derive(Default, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub(crate) struct SaveDialogOptions {
    title: Option<String>,
    filters: Vec<DialogFilter>,
    default_path: Option<PathBuf>,
    can_create_directories: Option<bool>,
}

#[derive(Debug, PartialEq, Eq)]
struct FileDialogPlan {
    title: Option<String>,
    filters: Vec<DialogFilter>,
    directory: Option<PathBuf>,
    file_name: Option<String>,
    can_create_directories: bool,
}

impl FileDialogPlan {
    fn new(
        title: Option<String>,
        filters: Vec<DialogFilter>,
        default_path: Option<PathBuf>,
        can_create_directories: Option<bool>,
    ) -> Self {
        let (directory, file_name) = match default_path {
            Some(path) if path.is_file() || !path.exists() => {
                match (path.parent(), path.file_name()) {
                    (Some(parent), Some(name)) => (
                        (parent.components().count() > 0).then(|| parent.to_path_buf()),
                        Some(name.to_string_lossy().into_owned()),
                    ),
                    _ => (Some(path), None),
                }
            }
            Some(path) => (Some(path), None),
            None => (None, None),
        };
        Self {
            title,
            filters,
            directory,
            file_name,
            can_create_directories: can_create_directories.unwrap_or(true),
        }
    }

    fn builder<R: Runtime>(self, parent: &WebviewWindow<R>) -> rfd::AsyncFileDialog {
        let mut builder = rfd::AsyncFileDialog::new()
            .set_parent(parent)
            .set_can_create_directories(self.can_create_directories);
        if let Some(title) = self.title {
            builder = builder.set_title(title);
        }
        if let Some(directory) = self.directory {
            builder = builder.set_directory(directory);
        }
        if let Some(file_name) = self.file_name {
            builder = builder.set_file_name(file_name);
        }
        for filter in self.filters {
            builder = builder.add_filter(filter.name, &filter.extensions);
        }
        builder
    }
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(untagged)]
pub(crate) enum OpenDialogSelection {
    Single(PathBuf),
    Multiple(Vec<PathBuf>),
}

impl OpenDialogSelection {
    fn paths(&self) -> &[PathBuf] {
        match self {
            Self::Single(path) => std::slice::from_ref(path),
            Self::Multiple(paths) => paths,
        }
    }
}

#[derive(Default, Deserialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum ConfirmDialogKind {
    #[default]
    Info,
    Warning,
    Error,
}

impl From<ConfirmDialogKind> for rfd::MessageLevel {
    fn from(kind: ConfirmDialogKind) -> Self {
        match kind {
            ConfirmDialogKind::Info => Self::Info,
            ConfirmDialogKind::Warning => Self::Warning,
            ConfirmDialogKind::Error => Self::Error,
        }
    }
}

// Only the two-button confirmation used by Hazakura is exposed over IPC.
#[derive(Default, Deserialize)]
pub(crate) enum ConfirmDialogButtons {
    #[default]
    OkCancel,
    OkCancelCustom(String, String),
}

impl From<ConfirmDialogButtons> for rfd::MessageButtons {
    fn from(buttons: ConfirmDialogButtons) -> Self {
        match buttons {
            ConfirmDialogButtons::OkCancel => Self::OkCancel,
            ConfirmDialogButtons::OkCancelCustom(ok, cancel) => Self::OkCancelCustom(ok, cancel),
        }
    }
}

fn confirm_reply(result: rfd::MessageDialogResult, buttons: &rfd::MessageButtons) -> String {
    match (result, buttons) {
        // rfd uses Custom(label) on macOS, but returns Ok/Cancel on Linux.
        // Preserve the upstream plugin's label mapping for both backends.
        (rfd::MessageDialogResult::Ok, rfd::MessageButtons::OkCancelCustom(ok, _)) => ok.clone(),
        (rfd::MessageDialogResult::Cancel, rfd::MessageButtons::OkCancelCustom(_, cancel)) => {
            cancel.clone()
        }
        (rfd::MessageDialogResult::Ok, _) => "Ok".into(),
        (rfd::MessageDialogResult::Custom(label), _) => label,
        // Unexpected results must never turn into acceptance.
        _ => "Cancel".into(),
    }
}

fn schedule_dialog_with_label<T>(
    label: &str,
    start: impl FnOnce(Sender<DialogReply<T>>) -> Result<(), String>,
) -> Result<Receiver<DialogReply<T>>, String> {
    ensure_label_is_main(label)?;
    let (sender, receiver) = channel(1);
    start(sender)?;
    Ok(receiver)
}

async fn run_native_dialog<R, T, F, Fut>(window: &WebviewWindow<R>, build: F) -> DialogReply<T>
where
    R: Runtime,
    T: Send + 'static,
    F: FnOnce(&WebviewWindow<R>) -> Fut + Send + 'static,
    Fut: Future<Output = DialogReply<T>> + Send + 'static,
{
    let parent = window.clone();
    let receiver = schedule_dialog_with_label(window.label(), |sender| {
        window
            .run_on_main_thread(move || {
                // rfd constructs its macOS sheet while creating the future.
                // Construct it here, then await its reply off the UI thread.
                let future = build(&parent);
                tauri::async_runtime::spawn(async move {
                    let _ = sender.send(future.await).await;
                });
            })
            .map_err(|error| format!("Cannot open native dialog: {error}"))
    })?;
    receive_dialog_reply(receiver).await
}

fn start_open_dialog(
    builder: rfd::AsyncFileDialog,
    directory: bool,
    multiple: bool,
) -> DialogFuture<Option<OpenDialogSelection>> {
    match (directory, multiple) {
        (false, false) => {
            let future = builder.pick_file();
            Box::pin(async move {
                Ok(future
                    .await
                    .map(|file| OpenDialogSelection::Single(file.path().to_path_buf())))
            })
        }
        (true, false) => {
            let future = builder.pick_folder();
            Box::pin(async move {
                Ok(future
                    .await
                    .map(|file| OpenDialogSelection::Single(file.path().to_path_buf())))
            })
        }
        (false, true) => {
            let future = builder.pick_files();
            Box::pin(async move {
                Ok(future.await.map(|files| {
                    OpenDialogSelection::Multiple(
                        files
                            .into_iter()
                            .map(|file| file.path().to_path_buf())
                            .collect(),
                    )
                }))
            })
        }
        (true, true) => {
            let future = builder.pick_folders();
            Box::pin(async move {
                Ok(future.await.map(|files| {
                    OpenDialogSelection::Multiple(
                        files
                            .into_iter()
                            .map(|file| file.path().to_path_buf())
                            .collect(),
                    )
                }))
            })
        }
    }
}

#[tauri::command]
pub(crate) async fn open_native_dialog<R: Runtime>(
    window: WebviewWindow<R>,
    options: OpenDialogOptions,
) -> DialogReply<Option<OpenDialogSelection>> {
    // Guard before even checking the suggested path's metadata.
    ensure_main_window(&window)?;
    let directory = options.directory;
    let multiple = options.multiple;
    let plan = FileDialogPlan::new(
        options.title,
        options.filters,
        options.default_path,
        options.can_create_directories,
    );
    let selection = run_native_dialog(&window, move |parent| {
        start_open_dialog(plan.builder(parent), directory, multiple)
    })
    .await?;
    if let Some(selection) = &selection {
        let scopes = window.state::<tauri::scope::Scopes>();
        for path in selection.paths() {
            if directory {
                // Preserve the prior dialog plugin's core-scope behavior.
                scopes
                    .allow_directory(path, true)
                    .map_err(|error| error.to_string())?;
            } else {
                scopes.allow_file(path).map_err(|error| error.to_string())?;
            }
        }
    }
    Ok(selection)
}

#[tauri::command]
pub(crate) async fn save_native_dialog<R: Runtime>(
    window: WebviewWindow<R>,
    options: SaveDialogOptions,
) -> DialogReply<Option<PathBuf>> {
    ensure_main_window(&window)?;
    let plan = FileDialogPlan::new(
        options.title,
        options.filters,
        options.default_path,
        options.can_create_directories,
    );
    let selected = run_native_dialog(&window, move |parent| {
        let future = plan.builder(parent).save_file();
        async move { Ok(future.await.map(|file| file.path().to_path_buf())) }
    })
    .await?;
    if let Some(path) = &selected {
        window
            .state::<tauri::scope::Scopes>()
            .allow_file(path)
            .map_err(|error| error.to_string())?;
    }
    Ok(selected)
}

#[tauri::command]
pub(crate) async fn confirm_native_dialog<R: Runtime>(
    window: WebviewWindow<R>,
    message: String,
    title: Option<String>,
    kind: Option<ConfirmDialogKind>,
    buttons: Option<ConfirmDialogButtons>,
) -> DialogReply<String> {
    ensure_main_window(&window)?;
    let title = title.unwrap_or_else(|| window.app_handle().package_info().name.clone());
    run_native_dialog(&window, move |parent| {
        let buttons = rfd::MessageButtons::from(buttons.unwrap_or_default());
        let future = rfd::AsyncMessageDialog::new()
            .set_parent(parent)
            .set_title(title)
            .set_description(message)
            .set_level(kind.unwrap_or_default().into())
            .set_buttons(buttons.clone())
            .show();
        async move { Ok(confirm_reply(future.await, &buttons)) }
    })
    .await
}

async fn receive_dialog_reply<T>(mut receiver: Receiver<DialogReply<T>>) -> DialogReply<T> {
    receiver
        .recv()
        .await
        .ok_or_else(|| "Native dialog closed without a response.".to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::future::Future;
    use std::task::{Context, Poll, Waker};

    #[test]
    fn non_main_windows_cannot_start_or_prepare_a_dialog() {
        for label in ["agent", "apple-assist", "unknown", ""] {
            let mut started = false;
            let result = schedule_dialog_with_label::<()>(label, |_| {
                started = true;
                Ok(())
            });
            assert!(result.is_err(), "must reject {label:?}");
            assert!(!started, "must guard before UI preparation for {label:?}");
        }
    }

    #[test]
    fn main_window_preserves_dispatch_errors() {
        let result = schedule_dialog_with_label::<()>("main", |_| Err("dispatch failed".into()));
        assert!(matches!(result, Err(error) if error == "dispatch failed"));
    }

    #[test]
    fn pending_dialog_does_not_resolve_until_the_native_reply_and_cancel_stays_none() {
        let mut sender = None;
        let receiver = schedule_dialog_with_label::<Option<String>>("main", |reply| {
            sender = Some(reply);
            Ok(())
        })
        .unwrap();
        let mut future = Box::pin(receive_dialog_reply(receiver));
        let mut context = Context::from_waker(Waker::noop());
        assert!(matches!(future.as_mut().poll(&mut context), Poll::Pending));
        sender.unwrap().try_send(Ok(None)).unwrap();
        assert!(matches!(
            future.as_mut().poll(&mut context),
            Poll::Ready(Ok(None))
        ));
    }

    #[test]
    fn dialog_errors_and_dropped_reply_channels_are_not_accepted() {
        let (sender, receiver) = channel::<DialogReply<bool>>(1);
        sender.try_send(Err("native failed".into())).unwrap();
        assert_eq!(
            tauri::async_runtime::block_on(receive_dialog_reply(receiver)),
            Err("native failed".into())
        );

        let (sender, receiver) = channel::<DialogReply<bool>>(1);
        drop(sender);
        assert!(tauri::async_runtime::block_on(receive_dialog_reply(receiver)).is_err());
    }

    #[test]
    fn empty_file_options_keep_the_original_defaults() {
        let open: OpenDialogOptions = serde_json::from_str("{}").unwrap();
        assert!(!open.multiple);
        assert!(!open.directory);
        let plan = FileDialogPlan::new(
            open.title,
            open.filters,
            open.default_path,
            open.can_create_directories,
        );
        assert!(plan.can_create_directories);
        assert_eq!(plan.directory, None);
        assert_eq!(plan.file_name, None);
        assert!(plan.filters.is_empty());

        let save: SaveDialogOptions = serde_json::from_str("{}").unwrap();
        assert!(
            FileDialogPlan::new(
                save.title,
                save.filters,
                save.default_path,
                save.can_create_directories
            )
            .can_create_directories
        );
    }

    #[test]
    fn explicit_picker_options_and_japanese_filters_are_preserved() {
        let options: OpenDialogOptions = serde_json::from_value(serde_json::json!({
            "title": "原稿を選択",
            "filters": [{"name": "Markdown原稿", "extensions": ["md", "markdown"]}],
            "multiple": true,
            "directory": true,
            "recursive": false,
            "canCreateDirectories": false,
            "defaultPath": "未保存原稿.md"
        }))
        .unwrap();
        assert!(options.multiple && options.directory);
        let plan = FileDialogPlan::new(
            options.title,
            options.filters,
            options.default_path,
            options.can_create_directories,
        );
        assert_eq!(plan.title.as_deref(), Some("原稿を選択"));
        assert_eq!(plan.file_name.as_deref(), Some("未保存原稿.md"));
        assert_eq!(plan.directory, None);
        assert!(!plan.can_create_directories);
        assert_eq!(
            plan.filters,
            vec![DialogFilter {
                name: "Markdown原稿".into(),
                extensions: vec!["md".into(), "markdown".into()]
            }]
        );
    }

    #[test]
    fn suggested_files_and_existing_directories_keep_distinct_path_semantics() {
        let root = crate::tests::unique_test_dir("native-dialog-paths");
        std::fs::create_dir_all(&root).unwrap();
        let existing = root.join("原稿.md");
        std::fs::write(&existing, "原文を変更しない").unwrap();
        for path in [&existing, &root.join("新規原稿.md")] {
            let plan = FileDialogPlan::new(None, vec![], Some(path.clone()), None);
            assert_eq!(plan.directory.as_ref(), Some(&root));
            assert_eq!(
                plan.file_name.as_deref(),
                path.file_name().unwrap().to_str()
            );
        }
        let plan = FileDialogPlan::new(None, vec![], Some(root.clone()), None);
        assert_eq!(plan.directory.as_ref(), Some(&root));
        assert_eq!(plan.file_name, None);
        assert_eq!(
            std::fs::read_to_string(&existing).unwrap(),
            "原文を変更しない"
        );
        std::fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn suggested_symlink_paths_are_not_canonicalized_or_rewritten() {
        let root = crate::tests::unique_test_dir("native-dialog-symlinks");
        std::fs::create_dir_all(root.join("実体")).unwrap();
        let linked_folder = root.join("参照");
        std::os::unix::fs::symlink(root.join("実体"), &linked_folder).unwrap();
        let plan = FileDialogPlan::new(None, vec![], Some(linked_folder.clone()), None);
        assert_eq!(plan.directory, Some(linked_folder));
        assert_eq!(plan.file_name, None);
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn selection_serialization_preserves_single_multiple_and_cancel_shapes() {
        let single = OpenDialogSelection::Single(PathBuf::from("/選択/原稿.md"));
        assert_eq!(serde_json::to_value(&single).unwrap(), "/選択/原稿.md");
        assert_eq!(single.paths(), &[PathBuf::from("/選択/原稿.md")]);
        let paths = vec![PathBuf::from("/選択/一.md"), PathBuf::from("/選択/二.md")];
        let multiple = OpenDialogSelection::Multiple(paths.clone());
        assert_eq!(multiple.paths(), paths);
        assert_eq!(
            serde_json::to_value(multiple).unwrap(),
            serde_json::json!(paths)
        );
        assert_eq!(
            serde_json::to_value(None::<OpenDialogSelection>).unwrap(),
            serde_json::Value::Null
        );
    }

    #[test]
    fn custom_confirmation_labels_including_empty_labels_remain_exact() {
        let buttons: ConfirmDialogButtons = serde_json::from_value(serde_json::json!({
            "OkCancelCustom": ["", "戻る"]
        }))
        .unwrap();
        assert!(
            matches!(rfd::MessageButtons::from(buttons), rfd::MessageButtons::OkCancelCustom(ok, cancel) if ok.is_empty() && cancel == "戻る")
        );
        assert_eq!(
            confirm_reply(
                rfd::MessageDialogResult::Custom("".into()),
                &rfd::MessageButtons::OkCancel
            ),
            ""
        );
        assert_eq!(
            confirm_reply(
                rfd::MessageDialogResult::Custom("採用".into()),
                &rfd::MessageButtons::OkCancel
            ),
            "採用"
        );
        assert_eq!(
            confirm_reply(rfd::MessageDialogResult::Ok, &rfd::MessageButtons::OkCancel),
            "Ok"
        );
        for result in [
            rfd::MessageDialogResult::Cancel,
            rfd::MessageDialogResult::Yes,
            rfd::MessageDialogResult::No,
        ] {
            assert_eq!(
                confirm_reply(result, &rfd::MessageButtons::OkCancel),
                "Cancel"
            );
        }
        assert!(serde_json::from_str::<ConfirmDialogButtons>("\"YesNo\"").is_err());
    }

    #[test]
    fn linux_backend_ok_cancel_results_keep_custom_label_mapping() {
        let buttons = rfd::MessageButtons::OkCancelCustom("採用".into(), "戻る".into());
        assert_eq!(
            confirm_reply(rfd::MessageDialogResult::Ok, &buttons),
            "採用"
        );
        assert_eq!(
            confirm_reply(rfd::MessageDialogResult::Cancel, &buttons),
            "戻る"
        );
        assert_eq!(
            confirm_reply(rfd::MessageDialogResult::Custom("採用".into()), &buttons),
            "採用"
        );
    }

    #[test]
    fn confirmation_severity_is_validated_before_ui_dispatch() {
        assert!(matches!(
            rfd::MessageLevel::from(
                serde_json::from_str::<ConfirmDialogKind>("\"warning\"").unwrap()
            ),
            rfd::MessageLevel::Warning
        ));
        assert!(matches!(
            rfd::MessageLevel::from(
                serde_json::from_str::<ConfirmDialogKind>("\"error\"").unwrap()
            ),
            rfd::MessageLevel::Error
        ));
        assert!(matches!(
            rfd::MessageLevel::from(ConfirmDialogKind::default()),
            rfd::MessageLevel::Info
        ));
        assert!(serde_json::from_str::<ConfirmDialogKind>("\"critical\"").is_err());
    }
}
