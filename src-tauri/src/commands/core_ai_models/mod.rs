//! Core AI model store: catalog projection, download/selection
//! management, on-disk persistence, background-asset verification and
//! the monitor loop.
//!
//! The store is a single type (`CoreAiModelStore`) whose inherent impl
//! is split across the child modules below so each responsibility owns
//! one file. All of them are still the same crate-local impl, so the
//! children reach the store's private fields directly:
//!
//!   * `catalog` — list / summary projection and catalog lookups.
//!   * `selection` — select, download, cancel, delete, external models.
//!   * `monitor` — runtime state machine and the monitor thread.
//!   * `verification` — materialized-pack verification and receipts.
//!   * `persistence` — state / receipt / external-model file access.
//!
//! This module keeps the shared types and constants, the store's
//! construction + configuration, the manifest helpers and the Tauri IPC
//! command surface. The public paths (`crate::commands::core_ai_models::*`)
//! are unchanged: every item the rest of the crate imports still lives
//! here.

use crate::commands::apple_assist_supervisor::{AppleAssistHelperStore, AssistBackendSelection};
use crate::commands::background_assets::{
    BackgroundAssetTransport, LocalPreviewBackgroundAssetTransport,
    PlatformBackgroundAssetTransport, LOCAL_PREVIEW_ASSET_ERROR,
};
use crate::commands::core_ai_local_models::{
    resolve_local_model_root, scan_custom_models_directory,
};
use crate::commands::security_bookmarks::{
    create_read_only_model_bookmark, resolve_model_bookmark,
};
use crate::distribution::{
    ensure_apple_assist_allowed_by_distribution, is_app_store_distribution_lane,
};
use crate::security::window_guard::{ensure_label_is_main, ensure_label_is_main_or_apple_assist};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
#[cfg(unix)]
use std::os::unix::fs::MetadataExt;
use std::path::{Component, Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::Emitter;
use tauri::Manager;

pub(crate) const SYSTEM_MODEL_ID: &str = "apple:foundation-models:system-default";
pub(crate) const CORE_AI_MODEL_STATE_CHANGED_EVENT: &str = "core-ai-model-state-changed";
const TWELVE_B_MODEL_ID: &str = "apple:core-ai:gemma-4-12b-it-int8-v1";
const TWELVE_B_ASSET_PACK_ID: &str = "hazakura-coreai-gemma4-12b-v1";
const TWELVE_B_STORAGE_DIRECTORY: &str = "gemma-4-12b-it-int8-v1";
const E4B_MODEL_ID: &str = "apple:core-ai:gemma-4-e4b-it-int4-provider-v2";
const E4B_ASSET_PACK_ID: &str = "hazakura-coreai-gemma4-e4b-v2";
const E4B_STORAGE_DIRECTORY: &str = "gemma-4-e4b-it-int4-provider-v2";
const E4B_RUNTIME_KIND: &str = "coreai-kit-gemma4-ple-provider";
const PACK_RESOURCE_MANIFEST_FILENAME: &str = "hazakura-resource-manifest.json";
const MAX_PACK_RESOURCE_MANIFEST_BYTES: u64 = 512 * 1024;
const MAX_PACK_FILES: usize = 256;
const MAX_PACK_EXPANDED_BYTES: u64 = 64 * 1024 * 1024 * 1024;
const STATE_FILENAME: &str = "core-ai-selection.json";
const MODEL_DIRECTORY: &str = "CoreAIModels";
const VALIDATION_DIRECTORY: &str = "core-ai-validation";
/// Hazakura-managed directory the user drops local Core AI bundles into. It is
/// kept apart from the Background Assets materialization in `CoreAIModels/`.
const CUSTOM_MODELS_DIRECTORY: &str = "CoreAICustomModels";
const EXTERNAL_MODELS_FILENAME: &str = "core-ai-external-models.json";
/// Id namespace for detected local models. `local:` cannot collide with the
/// `apple:core-ai:` ids that Apple-hosted catalog entries use.
pub(crate) const LOCAL_MODEL_ID_PREFIX: &str = "local:app-managed:";
pub(crate) const EXTERNAL_MODEL_ID_PREFIX: &str = "local:external:";

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum CoreAiDistributionStatus {
    NotPublished,
    Available,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum CoreAiModelKind {
    System,
    CoreAi,
}

/// Where a model came from. The local contract (`core_ai_local_models.rs`) owns
/// validation for non Apple-hosted sources; this enum only labels the origin so
/// the model list can tell them apart.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum CoreAiModelSource {
    AppleHosted,
    AppManagedLocal,
    ExternalLocal,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum CoreAiModelStatus {
    Ready,
    NotDownloaded,
    Downloading,
    Paused,
    Verifying,
    Failed,
    Unsupported,
    NotPublished,
    /// A local bundle passed the local contract and can be selected. It remains
    /// distinct from `Ready`, which is an Apple-hosted download state.
    Detected,
}

pub(crate) fn monitor_is_terminal(status: CoreAiModelStatus) -> bool {
    matches!(
        status,
        CoreAiModelStatus::Ready
            | CoreAiModelStatus::NotDownloaded
            | CoreAiModelStatus::Failed
            | CoreAiModelStatus::Unsupported
            | CoreAiModelStatus::NotPublished
    )
}

pub(crate) fn monitor_poll_interval(status: CoreAiModelStatus) -> Duration {
    if status == CoreAiModelStatus::Paused {
        Duration::from_secs(5)
    } else {
        Duration::from_secs(1)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CoreAiModelSummary {
    pub(crate) id: String,
    pub(crate) display_name: String,
    pub(crate) kind: CoreAiModelKind,
    pub(crate) source: CoreAiModelSource,
    pub(crate) status: CoreAiModelStatus,
    pub(crate) selected: bool,
    pub(crate) download_size_bytes: Option<u64>,
    pub(crate) installed_size_bytes: Option<u64>,
    pub(crate) minimum_memory_gb: Option<u64>,
    pub(crate) recommended_memory_gb: Option<u64>,
    pub(crate) license: Option<String>,
    pub(crate) has_upstream_conversion_notice: bool,
    pub(crate) progress: Option<f64>,
    pub(crate) error: Option<String>,
    /// Stable code for a localized message owned by the frontend. Local entries
    /// use it instead of `error`, whose English text is for logs only.
    pub(crate) error_code: Option<String>,
    pub(crate) asset_pack_version: Option<u64>,
    pub(crate) can_remove: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CoreAiModelCatalogResponse {
    pub(crate) distribution_status: CoreAiDistributionStatus,
    pub(crate) selected_model_id: String,
    pub(crate) models: Vec<CoreAiModelSummary>,
    pub(crate) management_error: Option<String>,
    pub(crate) selection_locked: bool,
    pub(crate) device_memory_gb: Option<u64>,
}

#[derive(Debug, Clone)]
pub(crate) struct CoreAiCatalogEntry {
    id: String,
    display_name: String,
    storage_directory: String,
    published: bool,
    retired: bool,
    download_size_bytes: Option<u64>,
    installed_size_bytes: Option<u64>,
    minimum_memory_gb: Option<u64>,
    recommended_memory_gb: Option<u64>,
    license: Option<String>,
    has_upstream_conversion_notice: bool,
    asset_pack_id: Option<String>,
    runtime_kind: Option<&'static str>,
}

impl CoreAiCatalogEntry {
    #[cfg(test)]
    pub(crate) fn fixture(id: &str, display_name: &str, storage_directory: &str) -> Self {
        Self {
            id: id.into(),
            display_name: display_name.into(),
            storage_directory: storage_directory.into(),
            published: true,
            retired: false,
            download_size_bytes: Some(1024),
            installed_size_bytes: Some(1024),
            minimum_memory_gb: None,
            recommended_memory_gb: Some(1),
            license: Some("Apache-2.0".into()),
            has_upstream_conversion_notice: false,
            asset_pack_id: None,
            runtime_kind: None,
        }
    }

    #[cfg(test)]
    pub(crate) fn published_fixture(id: &str, storage_directory: &str) -> Self {
        Self {
            id: id.into(),
            display_name: "Published fixture".into(),
            storage_directory: storage_directory.into(),
            published: true,
            retired: false,
            download_size_bytes: Some(5),
            installed_size_bytes: Some(5),
            minimum_memory_gb: None,
            recommended_memory_gb: Some(1),
            license: Some("Apache-2.0".into()),
            has_upstream_conversion_notice: false,
            asset_pack_id: Some("dev.hazakura.editor.coreai.test.v1".into()),
            runtime_kind: None,
        }
    }

    fn e4b() -> Self {
        Self {
            id: E4B_MODEL_ID.into(),
            display_name: "Gemma 4 E4B".into(),
            storage_directory: E4B_STORAGE_DIRECTORY.into(),
            published: true,
            retired: false,
            download_size_bytes: Some(5_519_729_626),
            installed_size_bytes: Some(6_808_842_583),
            minimum_memory_gb: Some(16),
            recommended_memory_gb: None,
            license: Some("Apache-2.0".into()),
            has_upstream_conversion_notice: false,
            asset_pack_id: Some(E4B_ASSET_PACK_ID.into()),
            runtime_kind: Some(E4B_RUNTIME_KIND),
        }
    }

    fn retired_twelve_b() -> Self {
        Self {
            id: TWELVE_B_MODEL_ID.into(),
            display_name: "Gemma 4 12B".into(),
            storage_directory: TWELVE_B_STORAGE_DIRECTORY.into(),
            published: false,
            retired: true,
            download_size_bytes: None,
            installed_size_bytes: Some(14_698_433_203),
            minimum_memory_gb: None,
            recommended_memory_gb: None,
            license: Some("Apache-2.0".into()),
            has_upstream_conversion_notice: true,
            asset_pack_id: Some(TWELVE_B_ASSET_PACK_ID.into()),
            runtime_kind: None,
        }
    }

    fn validate(&self) -> Result<(), String> {
        if !self.id.starts_with("apple:core-ai:") || self.id.len() > 160 {
            return Err("Core AI catalog contains an invalid model id.".into());
        }
        let mut components = Path::new(&self.storage_directory).components();
        if !matches!(components.next(), Some(Component::Normal(_))) || components.next().is_some() {
            return Err("Core AI catalog contains an invalid storage directory.".into());
        }
        if self.asset_pack_id.as_deref() == Some("") {
            return Err("Core AI catalog contains an empty asset pack id.".into());
        }
        Ok(())
    }

    fn relative_asset_path(&self) -> String {
        format!("{MODEL_DIRECTORY}/{}", self.storage_directory)
    }
}

fn production_catalog() -> Vec<CoreAiCatalogEntry> {
    vec![
        CoreAiCatalogEntry::e4b(),
        CoreAiCatalogEntry::retired_twelve_b(),
    ]
}

#[cfg(test)]
mod production_catalog_tests {
    use super::*;

    #[test]
    fn e4b_delivery_identity_matches_the_pinned_model_lock() {
        let lock: serde_json::Value = serde_json::from_str(include_str!(
            "../../../../scripts/core-ai-production-models.json"
        ))
        .unwrap();
        let e4b_lock = lock["models"]
            .as_array()
            .unwrap()
            .iter()
            .find(|model| model["key"] == "gemma4-e4b")
            .unwrap();
        let e4b = CoreAiCatalogEntry::e4b();
        assert_eq!(e4b.id, e4b_lock["modelId"].as_str().unwrap());
        assert_eq!(
            e4b.storage_directory,
            e4b_lock["storageDirectory"].as_str().unwrap()
        );
        assert_eq!(
            e4b.asset_pack_id.as_deref(),
            e4b_lock["assetPackId"].as_str()
        );
        assert_eq!(e4b.runtime_kind, e4b_lock["runtimeKind"].as_str());
        assert_eq!(e4b.installed_size_bytes, Some(6_808_842_583));
    }
}

#[cfg(target_os = "macos")]
fn physical_memory_gb() -> Option<u64> {
    extern "C" {
        fn sysctlbyname(
            name: *const std::ffi::c_char,
            old_value: *mut std::ffi::c_void,
            old_length: *mut usize,
            new_value: *mut std::ffi::c_void,
            new_length: usize,
        ) -> std::ffi::c_int;
    }

    let mut bytes = 0_u64;
    let mut length = std::mem::size_of::<u64>();
    let result = unsafe {
        sysctlbyname(
            c"hw.memsize".as_ptr(),
            (&mut bytes as *mut u64).cast(),
            &mut length,
            std::ptr::null_mut(),
            0,
        )
    };
    if result == 0 && length == std::mem::size_of::<u64>() {
        Some(bytes / (1024 * 1024 * 1024))
    } else {
        None
    }
}

#[cfg(not(target_os = "macos"))]
fn physical_memory_gb() -> Option<u64> {
    None
}

#[derive(Debug, Clone)]
struct RuntimeState {
    status: CoreAiModelStatus,
    progress: Option<f64>,
    error: Option<String>,
    materialized_path: Option<PathBuf>,
    asset_pack_version: Option<u64>,
    failure_kind: Option<&'static str>,
}

impl Default for RuntimeState {
    fn default() -> Self {
        Self {
            status: CoreAiModelStatus::NotDownloaded,
            progress: None,
            error: None,
            materialized_path: None,
            asset_pack_version: None,
            failure_kind: None,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CoreAiSelectionState {
    selected_model_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RegisteredExternalModel {
    id: String,
    display_name: String,
    bookmark: Vec<u8>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ValidationReceipt {
    model_id: String,
    asset_pack_version: Option<u64>,
    resource_manifest_sha256: String,
    materialized_root: String,
    file_stamps: Vec<VerifiedFileStamp>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
struct VerifiedFileStamp {
    path: String,
    size: u64,
    modified_ns: Option<u128>,
    changed_ns: Option<i128>,
    device: Option<u64>,
    inode: Option<u64>,
}

fn verified_file_stamp(path: String, metadata: &fs::Metadata) -> VerifiedFileStamp {
    let modified_ns = metadata
        .modified()
        .ok()
        .and_then(|value| value.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|value| value.as_nanos());
    #[cfg(unix)]
    let (changed_ns, device, inode) = (
        Some(i128::from(metadata.ctime()) * 1_000_000_000 + i128::from(metadata.ctime_nsec())),
        Some(metadata.dev()),
        Some(metadata.ino()),
    );
    #[cfg(not(unix))]
    let (changed_ns, device, inode) = (None, None, None);
    VerifiedFileStamp {
        path,
        size: metadata.len(),
        modified_ns,
        changed_ns,
        device,
        inode,
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ResourceManifest {
    schema_version: u64,
    model_id: String,
    catalog_version: String,
    storage_directory: String,
    expanded_bytes: u64,
    max_expanded_bytes: u64,
    max_entries: usize,
    files: Vec<ResourceManifestFile>,
}

#[derive(Debug, Deserialize)]
struct ResourceManifestFile {
    path: String,
    size: u64,
    sha256: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProductionDescriptorIdentity {
    schema_version: u64,
    model_id: String,
    runtime_kind: String,
}

pub(crate) struct CoreAiModelStore {
    data_dir: Mutex<Option<PathBuf>>,
    selected_model_id: Mutex<String>,
    external_models: Mutex<Vec<RegisteredExternalModel>>,
    pending_restore_model_id: Mutex<Option<String>>,
    catalog: Vec<CoreAiCatalogEntry>,
    runtime_states: Mutex<HashMap<String, RuntimeState>>,
    monitor_generations: Mutex<HashMap<String, u64>>,
    management_error: Mutex<Option<String>>,
    selection_locked: Mutex<bool>,
    transport: Arc<dyn BackgroundAssetTransport>,
}

impl Default for CoreAiModelStore {
    fn default() -> Self {
        let transport: Arc<dyn BackgroundAssetTransport> =
            if cfg!(hazakura_background_assets_local_preview) {
                Arc::new(LocalPreviewBackgroundAssetTransport)
            } else {
                Arc::new(PlatformBackgroundAssetTransport)
            };
        let store = Self::with_catalog_and_transport(
            if is_app_store_distribution_lane() {
                production_catalog()
            } else {
                Vec::new()
            },
            transport,
        );
        if cfg!(hazakura_background_assets_local_preview) {
            for entry in &store.catalog {
                if entry.published && entry.asset_pack_id.is_some() {
                    store.set_runtime_state(
                        &entry.id,
                        RuntimeState {
                            status: CoreAiModelStatus::Unsupported,
                            error: Some(LOCAL_PREVIEW_ASSET_ERROR.into()),
                            ..RuntimeState::default()
                        },
                    );
                }
            }
        }
        store
    }
}

mod catalog;
mod monitor;
mod persistence;
mod selection;
mod verification;

impl CoreAiModelStore {
    fn with_catalog_and_transport(
        catalog: Vec<CoreAiCatalogEntry>,
        transport: Arc<dyn BackgroundAssetTransport>,
    ) -> Self {
        let runtime_states = catalog
            .iter()
            .map(|entry| (entry.id.clone(), RuntimeState::default()))
            .collect();
        Self {
            data_dir: Mutex::new(None),
            selected_model_id: Mutex::new(SYSTEM_MODEL_ID.into()),
            external_models: Mutex::new(Vec::new()),
            pending_restore_model_id: Mutex::new(None),
            catalog,
            runtime_states: Mutex::new(runtime_states),
            monitor_generations: Mutex::new(HashMap::new()),
            management_error: Mutex::new(None),
            selection_locked: Mutex::new(false),
            transport,
        }
    }

    #[cfg(test)]
    pub(crate) fn with_fixture_catalog(catalog: Vec<CoreAiCatalogEntry>) -> Self {
        Self::with_catalog_and_transport(catalog, Arc::new(PlatformBackgroundAssetTransport))
    }

    #[cfg(test)]
    pub(crate) fn with_test_transport(
        catalog: Vec<CoreAiCatalogEntry>,
        transport: Arc<dyn BackgroundAssetTransport>,
    ) -> Self {
        Self::with_catalog_and_transport(catalog, transport)
    }

    #[cfg(test)]
    pub(crate) fn production_catalog_for_lane(app_store: bool) -> Self {
        Self::with_catalog_and_transport(
            if app_store {
                production_catalog()
            } else {
                Vec::new()
            },
            Arc::new(PlatformBackgroundAssetTransport),
        )
    }

    #[cfg(test)]
    pub(crate) fn production_catalog_with_test_transport(
        transport: Arc<dyn BackgroundAssetTransport>,
    ) -> Self {
        Self::with_catalog_and_transport(production_catalog(), transport)
    }

    pub(crate) fn configure(
        &self,
        data_dir: Result<PathBuf, String>,
        helper_store: &AppleAssistHelperStore,
        startup_override: Option<AssistBackendSelection>,
    ) {
        let result = self.configure_inner(data_dir, helper_store, startup_override);
        *self
            .management_error
            .lock()
            .expect("model management error lock") = result.err();
    }

    fn configure_inner(
        &self,
        data_dir: Result<PathBuf, String>,
        helper_store: &AppleAssistHelperStore,
        startup_override: Option<AssistBackendSelection>,
    ) -> Result<(), String> {
        let overridden = startup_override.is_some();
        *self.selection_locked.lock().expect("selection locked lock") = overridden;
        helper_store.set_selected_backend(
            startup_override.unwrap_or(AssistBackendSelection::SystemDefault),
        )?;
        *self.selected_model_id.lock().expect("selected model lock") =
            helper_store.selected_model_id()?;
        let data_dir = data_dir?;
        for entry in &self.catalog {
            entry.validate()?;
        }
        fs::create_dir_all(&data_dir)
            .map_err(|error| format!("Failed to prepare Core AI app data: {error}"))?;
        *self.data_dir.lock().expect("Core AI data dir lock") = Some(data_dir);
        *self.external_models.lock().expect("external models lock") =
            self.read_external_models()?;
        if overridden {
            return Ok(());
        }

        let selected = self
            .read_persisted_selection()?
            .unwrap_or_else(|| SYSTEM_MODEL_ID.into());
        if selected == SYSTEM_MODEL_ID {
            return Ok(());
        }
        if selected.starts_with(LOCAL_MODEL_ID_PREFIX)
            || selected.starts_with(EXTERNAL_MODEL_ID_PREFIX)
        {
            if self.selection_for(&selected).is_ok() {
                self.apply_selection(&selected, helper_store)?;
            } else {
                self.persist_selection(SYSTEM_MODEL_ID)?;
            }
        } else if self
            .catalog_entry(&selected)
            .map_or(true, |entry| !entry.published)
        {
            self.persist_selection(SYSTEM_MODEL_ID)?;
        } else if self.selection_for(&selected).is_ok() {
            self.apply_selection(&selected, helper_store)?;
        } else {
            *self
                .pending_restore_model_id
                .lock()
                .expect("pending restore lock") = Some(selected);
        }
        Ok(())
    }

    pub(crate) fn start_startup_refresh<R: tauri::Runtime>(
        self: &Arc<Self>,
        app: tauri::AppHandle<R>,
        helper_store: Arc<AppleAssistHelperStore>,
    ) {
        for model_id in self
            .catalog
            .iter()
            .filter(|entry| entry.published && entry.asset_pack_id.is_some())
            .map(|entry| entry.id.clone())
        {
            self.spawn_monitor(app.clone(), model_id, Some(helper_store.clone()));
        }
    }
}

fn validate_relative_path(path: &str) -> Result<(), String> {
    if path.is_empty() {
        return Err("Resource manifest contains an empty path.".into());
    }
    if path.starts_with('/')
        || path.contains('\\')
        || path.contains('\0')
        || path
            .split('/')
            .any(|part| part.is_empty() || part == "." || part == "..")
    {
        return Err(format!("Resource manifest contains an unsafe path: {path}"));
    }
    Ok(())
}

fn regular_pack_file_metadata(root: &Path, relative_path: &str) -> Result<fs::Metadata, String> {
    let mut current = root.to_path_buf();
    let parts: Vec<_> = relative_path.split('/').collect();
    for (index, part) in parts.iter().enumerate() {
        current.push(part);
        let metadata = fs::symlink_metadata(&current)
            .map_err(|error| format!("Core AI is missing {relative_path}: {error}"))?;
        if metadata.file_type().is_symlink()
            || (index + 1 == parts.len() && !metadata.is_file())
            || (index + 1 < parts.len() && !metadata.is_dir())
        {
            return Err(format!("Core AI contains an unsafe entry: {relative_path}"));
        }
        if index + 1 == parts.len() {
            return Ok(metadata);
        }
    }
    Err("Core AI resource path is empty.".into())
}

fn ensure_pack_file_set(root: &Path, listed_paths: &HashSet<&str>) -> Result<(), String> {
    let mut directories = vec![root.to_path_buf()];
    let mut observed_files = HashSet::new();
    let mut observed_entries = 0_usize;
    while let Some(directory) = directories.pop() {
        for entry in fs::read_dir(&directory)
            .map_err(|error| format!("Core AI directory cannot be read: {error}"))?
        {
            let entry =
                entry.map_err(|error| format!("Core AI directory entry is invalid: {error}"))?;
            observed_entries += 1;
            if observed_entries > MAX_PACK_FILES * 4 {
                return Err("Core AI resource contains too many entries.".into());
            }
            let path = entry.path();
            let metadata = fs::symlink_metadata(&path)
                .map_err(|error| format!("Core AI entry cannot be inspected: {error}"))?;
            if metadata.file_type().is_symlink() {
                return Err("Core AI resource contains a symbolic link.".into());
            }
            if metadata.is_dir() {
                directories.push(path);
            } else if metadata.is_file() {
                let relative = path
                    .strip_prefix(root)
                    .map_err(|_| "Core AI resource escaped its root.".to_string())?
                    .to_str()
                    .ok_or_else(|| "Core AI resource path is not UTF-8.".to_string())?
                    .to_string();
                if relative == PACK_RESOURCE_MANIFEST_FILENAME {
                    continue;
                }
                if !listed_paths.contains(relative.as_str()) {
                    return Err(format!("Core AI resource has an unlisted file: {relative}"));
                }
                observed_files.insert(relative);
            } else {
                return Err("Core AI resource contains an unsupported file type.".into());
            }
        }
    }
    if observed_files.len() != listed_paths.len() {
        return Err("Core AI resource manifest does not cover all files.".into());
    }
    Ok(())
}

fn emit_catalog<R: tauri::Runtime>(app: &tauri::AppHandle<R>, store: &CoreAiModelStore) {
    let _ = app.emit(CORE_AI_MODEL_STATE_CHANGED_EVENT, store.list());
}

#[tauri::command]
pub(crate) fn open_local_assist_model_settings<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
) -> Result<(), String> {
    crate::security::window_guard::ensure_label_is_apple_assist(window.label())?;
    ensure_apple_assist_allowed_by_distribution()?;
    let main = window
        .app_handle()
        .get_webview_window(crate::security::window_guard::MAIN_WINDOW_LABEL)
        .ok_or_else(|| "The main editor window is unavailable.".to_string())?;
    main.show().map_err(|error| error.to_string())?;
    main.unminimize().map_err(|error| error.to_string())?;
    main.set_focus().map_err(|error| error.to_string())?;
    window
        .app_handle()
        .emit_to(
            crate::security::window_guard::MAIN_WINDOW_LABEL,
            crate::types::MENU_ACTION_EVENT,
            crate::types::MENU_ON_DEVICE_MODELS,
        )
        .map_err(|error| format!("Cannot open model settings: {error}"))
}

#[tauri::command]
pub(crate) fn list_core_ai_models<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    store: tauri::State<'_, Arc<CoreAiModelStore>>,
) -> Result<CoreAiModelCatalogResponse, String> {
    ensure_label_is_main_or_apple_assist(window.label())?;
    ensure_apple_assist_allowed_by_distribution()?;
    Ok(store.list())
}

#[tauri::command]
pub(crate) fn select_local_assist_model<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    app: tauri::AppHandle<R>,
    store: tauri::State<'_, Arc<CoreAiModelStore>>,
    helper_store: tauri::State<'_, Arc<AppleAssistHelperStore>>,
    model_id: String,
) -> Result<CoreAiModelCatalogResponse, String> {
    ensure_label_is_main_or_apple_assist(window.label())?;
    ensure_apple_assist_allowed_by_distribution()?;
    let catalog = store.select(&model_id, helper_store.inner().as_ref())?;
    emit_catalog(&app, store.inner().as_ref());
    Ok(catalog)
}

#[tauri::command]
pub(crate) async fn register_external_core_ai_model<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    app: tauri::AppHandle<R>,
    store: tauri::State<'_, Arc<CoreAiModelStore>>,
    path: String,
) -> Result<CoreAiModelCatalogResponse, String> {
    ensure_label_is_main(window.label())?;
    ensure_apple_assist_allowed_by_distribution()?;
    let owned_store = store.inner().clone();
    let catalog = tauri::async_runtime::spawn_blocking(move || {
        owned_store.register_external_model(Path::new(&path))
    })
    .await
    .map_err(|error| format!("Core AI model registration failed: {error}"))??;
    emit_catalog(&app, store.inner().as_ref());
    Ok(catalog)
}

#[tauri::command]
pub(crate) async fn unregister_external_core_ai_model<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    app: tauri::AppHandle<R>,
    store: tauri::State<'_, Arc<CoreAiModelStore>>,
    helper_store: tauri::State<'_, Arc<AppleAssistHelperStore>>,
    model_id: String,
) -> Result<CoreAiModelCatalogResponse, String> {
    ensure_label_is_main(window.label())?;
    ensure_apple_assist_allowed_by_distribution()?;
    let owned_store = store.inner().clone();
    let owned_helper = helper_store.inner().clone();
    let catalog = tauri::async_runtime::spawn_blocking(move || {
        owned_store.unregister_external_model(&model_id, owned_helper.as_ref())
    })
    .await
    .map_err(|error| format!("Core AI model registration removal failed: {error}"))??;
    emit_catalog(&app, store.inner().as_ref());
    Ok(catalog)
}

#[tauri::command]
pub(crate) async fn start_core_ai_model_download<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    app: tauri::AppHandle<R>,
    store: tauri::State<'_, Arc<CoreAiModelStore>>,
    helper_store: tauri::State<'_, Arc<AppleAssistHelperStore>>,
    model_id: String,
) -> Result<CoreAiModelCatalogResponse, String> {
    ensure_label_is_main(window.label())?;
    ensure_apple_assist_allowed_by_distribution()?;
    let owned_store = store.inner().clone();
    let owned_model_id = model_id.clone();
    let catalog =
        tauri::async_runtime::spawn_blocking(move || owned_store.start_download(&owned_model_id))
            .await
            .map_err(|error| format!("Core AI download task failed: {error}"))??;
    emit_catalog(&app, store.inner().as_ref());
    store.spawn_monitor(app, model_id, Some(helper_store.inner().clone()));
    Ok(catalog)
}

#[tauri::command]
pub(crate) async fn cancel_core_ai_model_download<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    app: tauri::AppHandle<R>,
    store: tauri::State<'_, Arc<CoreAiModelStore>>,
    model_id: String,
) -> Result<bool, String> {
    ensure_label_is_main(window.label())?;
    ensure_apple_assist_allowed_by_distribution()?;
    let owned_store = store.inner().clone();
    let cancelled =
        tauri::async_runtime::spawn_blocking(move || owned_store.cancel_download(&model_id))
            .await
            .map_err(|error| format!("Core AI cancel task failed: {error}"))??;
    emit_catalog(&app, store.inner().as_ref());
    Ok(cancelled)
}

#[tauri::command]
pub(crate) async fn delete_core_ai_model<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    app: tauri::AppHandle<R>,
    store: tauri::State<'_, Arc<CoreAiModelStore>>,
    helper_store: tauri::State<'_, Arc<AppleAssistHelperStore>>,
    model_id: String,
) -> Result<CoreAiModelCatalogResponse, String> {
    ensure_label_is_main(window.label())?;
    ensure_apple_assist_allowed_by_distribution()?;
    let owned_store = store.inner().clone();
    let owned_helper = helper_store.inner().clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        owned_store.delete(&model_id, owned_helper.as_ref())
    })
    .await
    .map_err(|error| format!("Core AI removal task failed: {error}"))?;
    emit_catalog(&app, store.inner().as_ref());
    result
}
