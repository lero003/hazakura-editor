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
const TWELVE_B_RUNTIME_KIND: &str = "coreai-kit-language";
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

    fn twelve_b() -> Self {
        Self {
            id: TWELVE_B_MODEL_ID.into(),
            display_name: "Gemma 4 12B".into(),
            storage_directory: TWELVE_B_STORAGE_DIRECTORY.into(),
            published: true,
            download_size_bytes: Some(9_148_924_300),
            installed_size_bytes: Some(14_698_433_203),
            minimum_memory_gb: Some(16),
            recommended_memory_gb: Some(24),
            license: Some("Apache-2.0".into()),
            has_upstream_conversion_notice: true,
            asset_pack_id: Some(TWELVE_B_ASSET_PACK_ID.into()),
            runtime_kind: Some(TWELVE_B_RUNTIME_KIND),
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
    vec![CoreAiCatalogEntry::twelve_b()]
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

    pub(crate) fn list(&self) -> CoreAiModelCatalogResponse {
        let selected = self
            .selected_model_id
            .lock()
            .expect("selected model lock")
            .clone();
        let mut models = vec![CoreAiModelSummary {
            id: SYSTEM_MODEL_ID.into(),
            display_name: "Apple Intelligence".into(),
            kind: CoreAiModelKind::System,
            source: CoreAiModelSource::AppleHosted,
            status: CoreAiModelStatus::Ready,
            selected: selected == SYSTEM_MODEL_ID,
            download_size_bytes: None,
            installed_size_bytes: None,
            minimum_memory_gb: None,
            recommended_memory_gb: None,
            license: None,
            has_upstream_conversion_notice: false,
            progress: None,
            error: None,
            error_code: None,
            asset_pack_version: None,
            can_remove: false,
        }];
        models.extend(self.catalog.iter().map(|entry| {
            let runtime = self.runtime_state(entry);
            let preview_unavailable = runtime.error.as_deref() == Some(LOCAL_PREVIEW_ASSET_ERROR);
            CoreAiModelSummary {
                id: entry.id.clone(),
                display_name: entry.display_name.clone(),
                kind: CoreAiModelKind::CoreAi,
                source: CoreAiModelSource::AppleHosted,
                status: runtime.status,
                selected: selected == entry.id,
                download_size_bytes: entry.download_size_bytes,
                installed_size_bytes: entry.installed_size_bytes,
                minimum_memory_gb: entry.minimum_memory_gb,
                recommended_memory_gb: entry.recommended_memory_gb,
                license: entry.license.clone(),
                has_upstream_conversion_notice: entry.has_upstream_conversion_notice,
                progress: runtime.progress,
                error: runtime.error,
                error_code: if preview_unavailable {
                    Some("local-preview".into())
                } else {
                    runtime.failure_kind.map(str::to_string)
                },
                asset_pack_version: runtime.asset_pack_version,
                can_remove: runtime.materialized_path.is_some(),
            }
        }));
        models.extend(self.local_model_summaries(&selected));
        models.extend(self.external_model_summaries(&selected));
        CoreAiModelCatalogResponse {
            distribution_status: if self.catalog.iter().any(|entry| entry.published) {
                CoreAiDistributionStatus::Available
            } else {
                CoreAiDistributionStatus::NotPublished
            },
            selected_model_id: selected,
            models,
            management_error: self
                .management_error
                .lock()
                .expect("model management error lock")
                .clone(),
            selection_locked: *self.selection_locked.lock().expect("selection locked lock"),
            device_memory_gb: physical_memory_gb(),
        }
    }

    pub(crate) fn select(
        &self,
        model_id: &str,
        helper_store: &AppleAssistHelperStore,
    ) -> Result<CoreAiModelCatalogResponse, String> {
        self.ensure_management_available()?;
        let selection = self.selection_for(model_id)?;
        {
            let mut selected = self.selected_model_id.lock().expect("selected model lock");
            helper_store
                .set_selected_backend_after(selection, || self.persist_selection(model_id))?;
            *selected = model_id.into();
        }
        *self
            .pending_restore_model_id
            .lock()
            .expect("pending restore lock") = None;
        Ok(self.list())
    }

    pub(crate) fn start_download(
        &self,
        model_id: &str,
    ) -> Result<CoreAiModelCatalogResponse, String> {
        self.ensure_management_available()?;
        self.ensure_apple_hosted_management_model(model_id)?;
        let entry = self.catalog_entry(model_id)?;
        let asset_pack_id = self.asset_pack_id(entry)?;
        let previous_path = self.runtime_state(entry).materialized_path;
        self.next_monitor_generation(model_id);
        self.transport.start(asset_pack_id)?;
        self.set_runtime_state(
            model_id,
            RuntimeState {
                status: CoreAiModelStatus::Downloading,
                progress: Some(0.0),
                materialized_path: previous_path,
                ..RuntimeState::default()
            },
        );
        Ok(self.list())
    }

    pub(crate) fn cancel_download(&self, model_id: &str) -> Result<bool, String> {
        self.ensure_management_available()?;
        self.ensure_apple_hosted_management_model(model_id)?;
        let entry = self.catalog_entry(model_id)?;
        let cancelled = self.transport.cancel(self.asset_pack_id(entry)?)?;
        if cancelled {
            let mut state = self.runtime_state(entry);
            state.status = CoreAiModelStatus::Paused;
            state.progress = None;
            state.error = None;
            self.set_runtime_state(model_id, state);
        }
        Ok(cancelled)
    }

    pub(crate) fn delete(
        &self,
        model_id: &str,
        helper_store: &AppleAssistHelperStore,
    ) -> Result<CoreAiModelCatalogResponse, String> {
        self.ensure_management_available()?;
        self.ensure_apple_hosted_management_model(model_id)?;
        let entry = self.catalog_entry(model_id)?;
        self.next_monitor_generation(model_id);
        let was_selected = self
            .selected_model_id
            .lock()
            .expect("selected model lock")
            .as_str()
            == model_id;
        let previous_backend = was_selected.then(|| helper_store.selected_backend_for_restore());
        if was_selected {
            helper_store
                .set_selected_backend_after(AssistBackendSelection::SystemDefault, || {
                    self.persist_selection(SYSTEM_MODEL_ID)
                })?;
            *self.selected_model_id.lock().expect("selected model lock") = SYSTEM_MODEL_ID.into();
        }
        if let Err(remove_error) = self.transport.remove(self.asset_pack_id(entry)?) {
            if was_selected {
                if let Err(restore_error) = helper_store.set_selected_backend_after(
                    previous_backend.expect("selected model has a previous backend"),
                    || self.persist_selection(model_id),
                ) {
                    return Err(format!(
                        "{remove_error} The previous model could not be restored after removal failed: {restore_error}"
                    ));
                }
                *self.selected_model_id.lock().expect("selected model lock") = model_id.into();
            }
            return Err(remove_error);
        }
        let _ = fs::remove_file(self.validation_receipt_path(entry)?);
        self.set_runtime_state(model_id, RuntimeState::default());
        let pending = self
            .pending_restore_model_id
            .lock()
            .expect("pending restore lock")
            .as_deref()
            == Some(model_id);
        if pending {
            *self
                .pending_restore_model_id
                .lock()
                .expect("pending restore lock") = None;
            self.persist_selection(SYSTEM_MODEL_ID)?;
        }
        Ok(self.list())
    }

    pub(crate) fn spawn_monitor<R: tauri::Runtime>(
        self: &Arc<Self>,
        app: tauri::AppHandle<R>,
        model_id: String,
        helper_store: Option<Arc<AppleAssistHelperStore>>,
    ) {
        let generation = self.next_monitor_generation(&model_id);
        let store = self.clone();
        std::thread::spawn(move || loop {
            let Some((status, selection_synced)) =
                store.refresh_monitored(&model_id, generation, helper_store.as_deref(), || {
                    let _ = app.emit(CORE_AI_MODEL_STATE_CHANGED_EVENT, store.list());
                })
            else {
                break;
            };
            if monitor_is_terminal(status) && selection_synced {
                break;
            }
            std::thread::sleep(monitor_poll_interval(status));
        });
    }

    fn next_monitor_generation(&self, model_id: &str) -> u64 {
        let mut generations = self
            .monitor_generations
            .lock()
            .expect("monitor generations lock");
        let next = generations.get(model_id).copied().unwrap_or(0) + 1;
        generations.insert(model_id.into(), next);
        next
    }

    fn refresh_monitored(
        &self,
        model_id: &str,
        generation: u64,
        helper_store: Option<&AppleAssistHelperStore>,
        on_commit: impl FnOnce(),
    ) -> Option<(CoreAiModelStatus, bool)> {
        if self
            .monitor_generations
            .lock()
            .expect("monitor generations lock")
            .get(model_id)
            .copied()
            != Some(generation)
        {
            return None;
        }
        // Snapshot acquisition and hashing can take seconds. Neither operation
        // may mutate shared runtime state before the generation is rechecked.
        let previous = self
            .catalog_entry(model_id)
            .ok()
            .map(|entry| self.runtime_state(entry))
            .unwrap_or_default();
        let result = self.compute_runtime_state(model_id);
        let generations = self
            .monitor_generations
            .lock()
            .expect("monitor generations lock");
        if generations.get(model_id).copied() != Some(generation) {
            return None;
        }
        let state = match result {
            Ok(state) => state,
            Err(error) => RuntimeState {
                status: CoreAiModelStatus::Failed,
                error: Some(error),
                materialized_path: previous.materialized_path,
                asset_pack_version: previous.asset_pack_version,
                failure_kind: Some("download-failed"),
                ..RuntimeState::default()
            },
        };
        let status = state.status;
        self.set_runtime_state(model_id, state);
        let selection_synced = if status == CoreAiModelStatus::Ready {
            helper_store.map_or(true, |helper| {
                self.sync_ready_selection(model_id, helper).is_ok()
            })
        } else {
            true
        };
        on_commit();
        drop(generations);
        Some((status, selection_synced))
    }

    #[cfg(test)]
    pub(crate) fn next_monitor_generation_for_test(&self, model_id: &str) -> u64 {
        self.next_monitor_generation(model_id)
    }

    #[cfg(test)]
    pub(crate) fn refresh_monitored_for_test(
        &self,
        model_id: &str,
        generation: u64,
        helper_store: &AppleAssistHelperStore,
    ) -> Option<(CoreAiModelStatus, bool)> {
        self.refresh_monitored(model_id, generation, Some(helper_store), || {})
    }

    fn compute_runtime_state(&self, model_id: &str) -> Result<RuntimeState, String> {
        let entry = self.catalog_entry(model_id)?;
        if !entry.published {
            return Ok(RuntimeState {
                status: CoreAiModelStatus::NotPublished,
                ..RuntimeState::default()
            });
        }
        let snapshot = self
            .transport
            .snapshot(self.asset_pack_id(entry)?, &entry.relative_asset_path())?;
        if !snapshot.supported {
            return Ok(RuntimeState {
                status: CoreAiModelStatus::Unsupported,
                error: snapshot.error,
                asset_pack_version: snapshot.asset_pack_version,
                ..RuntimeState::default()
            });
        }
        // A previous pack version can remain available while Apple downloads
        // the requested update. Wait for ensureLocalAvailability to finish
        // before resolving and verifying its materialized path.
        if matches!(
            snapshot.phase.as_str(),
            "resolving" | "downloading" | "paused" | "failed"
        ) {
            let previous_path = self.runtime_state(entry).materialized_path;
            let status = match snapshot.phase.as_str() {
                "resolving" | "downloading" => CoreAiModelStatus::Downloading,
                "paused" => CoreAiModelStatus::Paused,
                _ => CoreAiModelStatus::Failed,
            };
            return Ok(RuntimeState {
                status,
                progress: snapshot.progress.map(|value| value.clamp(0.0, 1.0)),
                error: snapshot.error,
                materialized_path: previous_path,
                asset_pack_version: snapshot.asset_pack_version,
                failure_kind: (status == CoreAiModelStatus::Failed).then_some("download-failed"),
                ..RuntimeState::default()
            });
        }
        if snapshot.available {
            let path = snapshot.path.ok_or_else(|| {
                "Background Assets reported a Core AI model as downloaded without a materialized path."
                    .to_string()
            })?;
            if let Err(error) =
                self.verify_materialized_model(entry, &path, snapshot.asset_pack_version)
            {
                return Ok(RuntimeState {
                    status: CoreAiModelStatus::Failed,
                    error: Some(error),
                    materialized_path: Some(path),
                    asset_pack_version: snapshot.asset_pack_version,
                    failure_kind: Some("verification-failed"),
                    ..RuntimeState::default()
                });
            }
            return Ok(RuntimeState {
                status: CoreAiModelStatus::Ready,
                progress: Some(1.0),
                materialized_path: Some(path),
                asset_pack_version: snapshot.asset_pack_version,
                error: None,
                failure_kind: None,
            });
        }
        Ok(RuntimeState {
            status: CoreAiModelStatus::NotDownloaded,
            progress: snapshot.progress.map(|value| value.clamp(0.0, 1.0)),
            error: snapshot.error,
            materialized_path: None,
            asset_pack_version: snapshot.asset_pack_version,
            failure_kind: None,
        })
    }

    #[cfg(test)]
    pub(crate) fn refresh_model_for_test(
        &self,
        model_id: &str,
    ) -> Result<CoreAiModelStatus, String> {
        match self.compute_runtime_state(model_id) {
            Ok(state) => {
                let status = state.status;
                let error = state.error.clone();
                self.set_runtime_state(model_id, state);
                if status == CoreAiModelStatus::Failed {
                    Err(error.unwrap_or_else(|| "Core AI model verification failed.".into()))
                } else {
                    Ok(status)
                }
            }
            Err(error) => {
                self.set_failure(model_id, error.clone());
                Err(error)
            }
        }
    }

    fn verify_materialized_model(
        &self,
        entry: &CoreAiCatalogEntry,
        root: &Path,
        asset_pack_version: Option<u64>,
    ) -> Result<(), String> {
        let manifest_path = root.join(PACK_RESOURCE_MANIFEST_FILENAME);
        let manifest_metadata = fs::symlink_metadata(&manifest_path)
            .map_err(|error| format!("Core AI resource manifest is missing: {error}"))?;
        if !manifest_metadata.is_file()
            || manifest_metadata.file_type().is_symlink()
            || manifest_metadata.len() > MAX_PACK_RESOURCE_MANIFEST_BYTES
        {
            return Err("Core AI resource manifest is not a bounded regular file.".into());
        }
        let packaged_manifest = fs::read(&manifest_path)
            .map_err(|error| format!("Core AI resource manifest cannot be read: {error}"))?;
        let manifest: ResourceManifest = serde_json::from_slice(&packaged_manifest)
            .map_err(|error| format!("Core AI resource manifest is invalid: {error}"))?;
        if manifest.schema_version != 1
            || manifest.model_id != entry.id
            || manifest.storage_directory != entry.storage_directory
            || manifest.catalog_version.trim().is_empty()
            || manifest.catalog_version.len() > 80
            || manifest.files.is_empty()
            || manifest.files.len() != manifest.max_entries
            || manifest.files.len() > MAX_PACK_FILES
            || manifest.expanded_bytes > manifest.max_expanded_bytes
            || manifest.max_expanded_bytes > MAX_PACK_EXPANDED_BYTES
        {
            return Err("Core AI resource manifest is incompatible with this model.".into());
        }
        let mut listed_paths = HashSet::new();
        let mut listed_bytes = 0_u64;
        let mut file_stamps = Vec::with_capacity(manifest.files.len());
        for file in &manifest.files {
            validate_relative_path(&file.path)?;
            if !listed_paths.insert(file.path.as_str())
                || file.sha256.len() != 64
                || !file.sha256.bytes().all(|byte| byte.is_ascii_hexdigit())
            {
                return Err(
                    "Core AI resource manifest contains a duplicate or invalid file entry.".into(),
                );
            }
            listed_bytes = listed_bytes
                .checked_add(file.size)
                .ok_or_else(|| "Core AI resource manifest file sizes overflow.".to_string())?;
            let metadata = regular_pack_file_metadata(root, &file.path)?;
            if metadata.len() != file.size {
                return Err(format!(
                    "Core AI file size mismatch for {}: expected {}, got {}.",
                    file.path,
                    file.size,
                    metadata.len()
                ));
            }
            file_stamps.push(verified_file_stamp(file.path.clone(), &metadata));
        }
        if listed_bytes != manifest.expanded_bytes {
            return Err("Core AI resource manifest expanded size is inconsistent.".into());
        }
        ensure_pack_file_set(root, &listed_paths)?;
        let manifest_sha256 = self.transport.sha256_file(&manifest_path)?;
        let receipt_is_valid = self
            .read_validation_receipt(
                entry,
                asset_pack_version,
                &manifest_sha256,
                root,
                &file_stamps,
            )
            .unwrap_or(false);
        if !receipt_is_valid {
            for file in &manifest.files {
                if !self
                    .transport
                    .sha256_file(&root.join(&file.path))?
                    .eq_ignore_ascii_case(&file.sha256)
                {
                    return Err(format!("Core AI SHA-256 mismatch for {}.", file.path));
                }
            }
            // A model changed during hashing must not acquire a trusted receipt.
            for (file, stamp) in manifest.files.iter().zip(&file_stamps) {
                let metadata = regular_pack_file_metadata(root, &file.path)?;
                if verified_file_stamp(file.path.clone(), &metadata) != *stamp {
                    return Err(format!(
                        "Core AI file changed during verification: {}.",
                        file.path
                    ));
                }
            }
        }
        if let Some(expected_runtime_kind) = entry.runtime_kind {
            if !listed_paths.contains("hazakura-model.json") {
                return Err(
                    "Core AI model descriptor is not covered by the resource manifest.".into(),
                );
            }
            let descriptor: ProductionDescriptorIdentity = serde_json::from_slice(
                &fs::read(root.join("hazakura-model.json"))
                    .map_err(|error| format!("Core AI model descriptor cannot be read: {error}"))?,
            )
            .map_err(|error| format!("Core AI model descriptor is invalid: {error}"))?;
            if descriptor.schema_version != 1
                || descriptor.model_id != entry.id
                || descriptor.runtime_kind != expected_runtime_kind
            {
                return Err("Core AI model descriptor is incompatible with this app.".into());
            }
        }
        if !receipt_is_valid {
            self.write_validation_receipt(
                entry,
                asset_pack_version,
                &manifest_sha256,
                root,
                file_stamps,
            )?;
        }
        Ok(())
    }

    fn sync_ready_selection(
        &self,
        model_id: &str,
        helper_store: &AppleAssistHelperStore,
    ) -> Result<(), String> {
        let pending = self
            .pending_restore_model_id
            .lock()
            .expect("pending restore lock")
            .clone();
        if pending.as_deref() == Some(model_id) {
            self.apply_selection(model_id, helper_store)?;
            *self
                .pending_restore_model_id
                .lock()
                .expect("pending restore lock") = None;
            return Ok(());
        }
        let selected = self.selected_model_id.lock().expect("selected model lock");
        if selected.as_str() == model_id {
            let desired = self.selection_for(model_id)?;
            if helper_store.selected_backend_for_restore() != desired {
                helper_store.set_selected_backend(desired)?;
            }
        }
        Ok(())
    }

    #[cfg(test)]
    pub(crate) fn sync_ready_selection_for_test(
        &self,
        model_id: &str,
        helper_store: &AppleAssistHelperStore,
    ) -> Result<(), String> {
        self.sync_ready_selection(model_id, helper_store)
    }

    fn ensure_management_available(&self) -> Result<(), String> {
        if let Some(error) = self
            .management_error
            .lock()
            .expect("model management error lock")
            .as_ref()
        {
            return Err(error.clone());
        }
        if *self.selection_locked.lock().expect("selection locked lock") {
            return Err("Model management is locked by the Developer test backend override. Restart without the override to manage models.".into());
        }
        Ok(())
    }

    /// Local models are selectable, but remain outside Apple-hosted asset
    /// lifecycle operations. Refusing here keeps a crafted local id from
    /// reaching the download and deletion path.
    fn ensure_apple_hosted_management_model(&self, model_id: &str) -> Result<(), String> {
        if model_id.starts_with(LOCAL_MODEL_ID_PREFIX)
            || model_id.starts_with(EXTERNAL_MODEL_ID_PREFIX)
        {
            return Err(
                "Custom models are selectable, but cannot be downloaded, cancelled, or deleted by Hazakura."
                    .into(),
            );
        }
        Ok(())
    }

    /// Detected models under `app_data_dir()/CoreAICustomModels`. Read-only: the
    /// app never deletes or repairs what the user placed there, and a broken
    /// folder is reported rather than hidden.
    fn local_model_summaries(&self, selected: &str) -> Vec<CoreAiModelSummary> {
        let root = match self.custom_models_root() {
            Ok(root) => root,
            Err(_) => return Vec::new(),
        };
        scan_custom_models_directory(&root)
            .into_iter()
            .map(|candidate| {
                let (display_name, status, error_code) = match candidate.outcome {
                    Ok(model) => (
                        model
                            .display_name
                            .unwrap_or_else(|| candidate.directory_name.clone()),
                        CoreAiModelStatus::Detected,
                        None,
                    ),
                    Err(code) => (
                        candidate.directory_name.clone(),
                        CoreAiModelStatus::Failed,
                        Some(code.code().to_string()),
                    ),
                };
                let id = format!("{LOCAL_MODEL_ID_PREFIX}{}", candidate.directory_name);
                CoreAiModelSummary {
                    id: id.clone(),
                    display_name,
                    kind: CoreAiModelKind::CoreAi,
                    source: CoreAiModelSource::AppManagedLocal,
                    status,
                    selected: selected == id,
                    download_size_bytes: None,
                    installed_size_bytes: None,
                    minimum_memory_gb: None,
                    recommended_memory_gb: None,
                    license: None,
                    has_upstream_conversion_notice: false,
                    progress: None,
                    error: None,
                    error_code,
                    asset_pack_version: None,
                    can_remove: false,
                }
            })
            .collect()
    }

    fn external_model_summaries(&self, selected: &str) -> Vec<CoreAiModelSummary> {
        self.external_models
            .lock()
            .expect("external models lock")
            .iter()
            .map(|entry| {
                let result = resolve_model_bookmark(&entry.bookmark)
                    .map_err(|_| "bookmark-inaccessible".to_string())
                    .and_then(|scope| {
                        resolve_local_model_root(&scope.path)
                            .map_err(|error| error.code().to_string())
                    });
                let (display_name, status, error_code) = match result {
                    Ok(model) => (
                        model
                            .display_name
                            .unwrap_or_else(|| entry.display_name.clone()),
                        CoreAiModelStatus::Detected,
                        None,
                    ),
                    Err(code) => (
                        entry.display_name.clone(),
                        CoreAiModelStatus::Failed,
                        Some(code),
                    ),
                };
                CoreAiModelSummary {
                    id: entry.id.clone(),
                    display_name,
                    kind: CoreAiModelKind::CoreAi,
                    source: CoreAiModelSource::ExternalLocal,
                    status,
                    selected: selected == entry.id,
                    download_size_bytes: None,
                    installed_size_bytes: None,
                    minimum_memory_gb: None,
                    recommended_memory_gb: None,
                    license: None,
                    has_upstream_conversion_notice: false,
                    progress: None,
                    error: None,
                    error_code,
                    asset_pack_version: None,
                    can_remove: false,
                }
            })
            .collect()
    }

    pub(crate) fn register_external_model(
        &self,
        path: &Path,
    ) -> Result<CoreAiModelCatalogResponse, String> {
        self.ensure_management_available()?;
        let model = resolve_local_model_root(path)
            .map_err(|error| format!("local-model:{}", error.code()))?;
        // Picking only `*.aimodel` does not grant access to its parent bundle
        // and sibling tokenizer. Require the resource root itself in the picker.
        if fs::canonicalize(path).ok().as_deref() != Some(model.resource_root.as_path()) {
            return Err("model-bookmark:select-resource-root".into());
        }
        let identity = model.identity_key();
        if scan_custom_models_directory(&self.custom_models_root()?)
            .into_iter()
            .any(|candidate| {
                candidate
                    .outcome
                    .is_ok_and(|existing| existing.identity_key() == identity)
            })
        {
            return Ok(self.list());
        }
        let bookmark = create_read_only_model_bookmark(&model.resource_root).map_err(|error| {
            if path != model.resource_root {
                "model-bookmark:select-resource-root".to_string()
            } else {
                format!("model-bookmark:access-denied: {error}")
            }
        })?;
        if bookmark.is_empty() || bookmark.len() > 64 * 1024 {
            return Err("model-bookmark:access-denied: bookmark data is invalid".into());
        }
        let mut entries = self.external_models.lock().expect("external models lock");
        for entry in entries.iter() {
            let Ok(scope) = resolve_model_bookmark(&entry.bookmark) else {
                continue;
            };
            if resolve_local_model_root(&scope.path)
                .is_ok_and(|existing| existing.identity_key() == identity)
            {
                drop(entries);
                return Ok(self.list());
            }
        }
        let created_ns = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|_| "The system clock cannot create a model registration id.".to_string())?
            .as_nanos();
        let mut suffix = 0_u64;
        let id = loop {
            let candidate = format!(
                "{EXTERNAL_MODEL_ID_PREFIX}{created_ns:x}-{:x}-{suffix:x}",
                std::process::id()
            );
            if entries.iter().all(|entry| entry.id != candidate) {
                break candidate;
            }
            suffix = suffix
                .checked_add(1)
                .ok_or_else(|| "Too many registered Core AI models.".to_string())?;
        };
        entries.push(RegisteredExternalModel {
            id,
            display_name: model.display_name.unwrap_or_else(|| {
                model
                    .resource_root
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .into_owned()
            }),
            bookmark,
        });
        if let Err(error) = self.persist_external_models(&entries) {
            entries.pop();
            return Err(error);
        }
        drop(entries);
        Ok(self.list())
    }

    pub(crate) fn unregister_external_model(
        &self,
        model_id: &str,
        helper_store: &AppleAssistHelperStore,
    ) -> Result<CoreAiModelCatalogResponse, String> {
        self.ensure_management_available()?;
        if !model_id.starts_with(EXTERNAL_MODEL_ID_PREFIX) {
            return Err("Only registered external model folders can be unregistered.".into());
        }
        let was_selected = self
            .selected_model_id
            .lock()
            .expect("selected model lock")
            .as_str()
            == model_id;
        let previous_backend = was_selected.then(|| helper_store.selected_backend_for_restore());
        if was_selected {
            self.select(SYSTEM_MODEL_ID, helper_store)?;
        }
        let mut entries = self.external_models.lock().expect("external models lock");
        let Some(index) = entries.iter().position(|entry| entry.id == model_id) else {
            return Err("The registered model folder was not found.".into());
        };
        let removed = entries.remove(index);
        if let Err(error) = self.persist_external_models(&entries) {
            entries.insert(index, removed);
            drop(entries);
            if let Some(previous) = previous_backend {
                helper_store
                    .set_selected_backend_after(previous, || self.persist_selection(model_id))?;
                *self.selected_model_id.lock().expect("selected model lock") = model_id.into();
            }
            return Err(error);
        }
        drop(entries);
        Ok(self.list())
    }

    fn external_models_path(&self) -> Result<PathBuf, String> {
        Ok(self.data_dir()?.join(EXTERNAL_MODELS_FILENAME))
    }

    fn read_external_models(&self) -> Result<Vec<RegisteredExternalModel>, String> {
        let data = match fs::read(self.external_models_path()?) {
            Ok(data) => data,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
            Err(error) => return Err(format!("Cannot read registered model folders: {error}")),
        };
        let entries: Vec<RegisteredExternalModel> = serde_json::from_slice(&data)
            .map_err(|error| format!("Cannot read registered model folders: {error}"))?;
        let mut ids = HashSet::new();
        if entries.iter().any(|entry| {
            !entry.id.starts_with(EXTERNAL_MODEL_ID_PREFIX)
                || entry.id.len() <= EXTERNAL_MODEL_ID_PREFIX.len()
                || entry.id.len() > 160
                || !entry.id[EXTERNAL_MODEL_ID_PREFIX.len()..]
                    .bytes()
                    .all(|byte| byte.is_ascii_hexdigit() || byte == b'-')
                || !ids.insert(&entry.id)
                || entry.bookmark.is_empty()
                || entry.bookmark.len() > 64 * 1024
        }) {
            return Err("Registered model folder data is invalid.".into());
        }
        Ok(entries)
    }

    fn persist_external_models(&self, entries: &[RegisteredExternalModel]) -> Result<(), String> {
        let path = self.external_models_path()?;
        let temporary = path.with_extension("json.tmp");
        let data = serde_json::to_vec(entries)
            .map_err(|error| format!("Cannot encode registered model folders: {error}"))?;
        fs::write(&temporary, data)
            .map_err(|error| format!("Cannot save registered model folders: {error}"))?;
        fs::rename(&temporary, path)
            .map_err(|error| format!("Cannot save registered model folders: {error}"))
    }

    fn custom_models_root(&self) -> Result<PathBuf, String> {
        Ok(self.data_dir()?.join(CUSTOM_MODELS_DIRECTORY))
    }

    fn apply_selection(
        &self,
        model_id: &str,
        helper_store: &AppleAssistHelperStore,
    ) -> Result<(), String> {
        let selection = self.selection_for(model_id)?;
        let mut selected = self.selected_model_id.lock().expect("selected model lock");
        helper_store.set_selected_backend(selection)?;
        *selected = model_id.into();
        Ok(())
    }

    fn selection_for(&self, model_id: &str) -> Result<AssistBackendSelection, String> {
        if model_id == SYSTEM_MODEL_ID {
            return Ok(AssistBackendSelection::SystemDefault);
        }
        if model_id.starts_with(LOCAL_MODEL_ID_PREFIX) {
            let root = self.custom_models_root()?;
            let candidate = scan_custom_models_directory(&root)
                .into_iter()
                .find(|candidate| {
                    format!("{LOCAL_MODEL_ID_PREFIX}{}", candidate.directory_name) == model_id
                })
                .ok_or_else(|| {
                    "The selected local Core AI model is not in Hazakura's Custom Models directory."
                        .to_string()
                })?;
            let model = candidate.outcome.map_err(|error| {
                format!(
                    "The selected local Core AI model is invalid ({}): {}",
                    error.code(),
                    error.message()
                )
            })?;
            return Ok(AssistBackendSelection::CoreAiLocal {
                model_id: model_id.to_string(),
                model_path: model.resource_root,
                model_bookmark: None,
            });
        }
        if model_id.starts_with(EXTERNAL_MODEL_ID_PREFIX) {
            let bookmark = self
                .external_models
                .lock()
                .expect("external models lock")
                .iter()
                .find(|entry| entry.id == model_id)
                .ok_or_else(|| "The registered model folder was not found.".to_string())?
                .bookmark
                .clone();
            let scope = resolve_model_bookmark(&bookmark)?;
            let model = resolve_local_model_root(&scope.path).map_err(|error| {
                format!(
                    "The registered Core AI model is unavailable ({}): {}",
                    error.code(),
                    error.message()
                )
            })?;
            return Ok(AssistBackendSelection::CoreAiLocal {
                model_id: model_id.to_string(),
                model_path: model.resource_root,
                model_bookmark: Some(bookmark),
            });
        }
        let entry = self.catalog_entry(model_id)?;
        if self.runtime_state(entry).status != CoreAiModelStatus::Ready {
            return Err(
                "The selected Core AI model is not downloaded, verified, and ready.".into(),
            );
        }
        Ok(AssistBackendSelection::CoreAi {
            model_id: entry.id.clone(),
            model_path: self.model_path(entry)?,
        })
    }

    fn catalog_entry(&self, model_id: &str) -> Result<&CoreAiCatalogEntry, String> {
        self.catalog
            .iter()
            .find(|entry| entry.id == model_id)
            .ok_or_else(|| "The requested Core AI model is not in the signed app catalog.".into())
    }

    fn asset_pack_id<'a>(&self, entry: &'a CoreAiCatalogEntry) -> Result<&'a str, String> {
        if !entry.published {
            return Err(
                "This Core AI model has not been published through Apple-hosted assets.".into(),
            );
        }
        entry.asset_pack_id.as_deref().ok_or_else(|| {
            "Apple-hosted model downloading is not configured for this catalog entry.".into()
        })
    }

    fn runtime_state(&self, entry: &CoreAiCatalogEntry) -> RuntimeState {
        if !entry.published {
            return RuntimeState {
                status: CoreAiModelStatus::NotPublished,
                ..RuntimeState::default()
            };
        }
        if entry.asset_pack_id.is_none() {
            let path = self.fixture_model_path(entry);
            let ready = path
                .as_ref()
                .map(|path| path.join("hazakura-model.json").is_file())
                .unwrap_or(false);
            return RuntimeState {
                status: if ready {
                    CoreAiModelStatus::Ready
                } else {
                    CoreAiModelStatus::NotDownloaded
                },
                materialized_path: if ready { path.ok() } else { None },
                ..RuntimeState::default()
            };
        }
        self.runtime_states
            .lock()
            .expect("runtime states lock")
            .get(&entry.id)
            .cloned()
            .unwrap_or_default()
    }

    fn set_runtime_state(&self, model_id: &str, state: RuntimeState) {
        self.runtime_states
            .lock()
            .expect("runtime states lock")
            .insert(model_id.into(), state);
    }
    #[cfg(test)]
    fn set_failure(&self, model_id: &str, error: String) {
        let previous_state = self
            .catalog_entry(model_id)
            .ok()
            .map(|entry| self.runtime_state(entry))
            .unwrap_or_default();
        self.set_runtime_state(
            model_id,
            RuntimeState {
                status: CoreAiModelStatus::Failed,
                error: Some(error),
                materialized_path: previous_state.materialized_path,
                asset_pack_version: previous_state.asset_pack_version,
                failure_kind: Some("download-failed"),
                ..RuntimeState::default()
            },
        );
    }

    fn model_path(&self, entry: &CoreAiCatalogEntry) -> Result<PathBuf, String> {
        entry.validate()?;
        if entry.asset_pack_id.is_none() {
            return self.fixture_model_path(entry);
        }
        self.runtime_state(entry)
            .materialized_path
            .ok_or_else(|| "The verified Core AI model path is unavailable.".into())
    }

    fn fixture_model_path(&self, entry: &CoreAiCatalogEntry) -> Result<PathBuf, String> {
        Ok(self
            .data_dir()?
            .join(MODEL_DIRECTORY)
            .join(&entry.storage_directory))
    }
    fn data_dir(&self) -> Result<PathBuf, String> {
        self.data_dir
            .lock()
            .expect("Core AI data dir lock")
            .clone()
            .ok_or_else(|| "Core AI model storage is not initialized.".into())
    }
    fn state_path(&self) -> Result<PathBuf, String> {
        Ok(self.data_dir()?.join(STATE_FILENAME))
    }
    fn validation_receipt_path(&self, entry: &CoreAiCatalogEntry) -> Result<PathBuf, String> {
        Ok(self
            .data_dir()?
            .join(VALIDATION_DIRECTORY)
            .join(format!("{}.json", entry.storage_directory)))
    }

    fn read_validation_receipt(
        &self,
        entry: &CoreAiCatalogEntry,
        asset_pack_version: Option<u64>,
        manifest_sha256: &str,
        root: &Path,
        file_stamps: &[VerifiedFileStamp],
    ) -> Result<bool, String> {
        let data = match fs::read(self.validation_receipt_path(entry)?) {
            Ok(data) => data,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(false),
            Err(error) => {
                return Err(format!(
                    "Failed to read Core AI validation receipt: {error}"
                ))
            }
        };
        let receipt: ValidationReceipt = serde_json::from_slice(&data)
            .map_err(|error| format!("Failed to decode Core AI validation receipt: {error}"))?;
        Ok(asset_pack_version.is_some()
            && receipt.model_id == entry.id
            && receipt.asset_pack_version == asset_pack_version
            && receipt.resource_manifest_sha256 == manifest_sha256
            && receipt.materialized_root == root.to_string_lossy().as_ref()
            && file_stamps.iter().all(|stamp| {
                stamp.modified_ns.is_some()
                    && stamp.changed_ns.is_some()
                    && stamp.device.is_some()
                    && stamp.inode.is_some()
            })
            && receipt.file_stamps == file_stamps)
    }

    fn write_validation_receipt(
        &self,
        entry: &CoreAiCatalogEntry,
        asset_pack_version: Option<u64>,
        manifest_sha256: &str,
        root: &Path,
        file_stamps: Vec<VerifiedFileStamp>,
    ) -> Result<(), String> {
        let path = self.validation_receipt_path(entry)?;
        fs::create_dir_all(
            path.parent()
                .ok_or_else(|| "Core AI validation receipt has no parent directory.".to_string())?,
        )
        .map_err(|error| format!("Failed to prepare Core AI validation receipt: {error}"))?;
        let data = serde_json::to_vec_pretty(&ValidationReceipt {
            model_id: entry.id.clone(),
            asset_pack_version,
            resource_manifest_sha256: manifest_sha256.into(),
            materialized_root: root.to_string_lossy().into_owned(),
            file_stamps,
        })
        .map_err(|error| format!("Failed to encode Core AI validation receipt: {error}"))?;
        fs::write(path, data)
            .map_err(|error| format!("Failed to save Core AI validation receipt: {error}"))
    }

    fn read_persisted_selection(&self) -> Result<Option<String>, String> {
        let data = match fs::read(self.state_path()?) {
            Ok(data) => data,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
            Err(error) => return Err(format!("Failed to read Core AI selection: {error}")),
        };
        serde_json::from_slice::<CoreAiSelectionState>(&data)
            .map(|state| Some(state.selected_model_id))
            .map_err(|error| format!("Failed to decode Core AI selection: {error}"))
    }

    fn persist_selection(&self, model_id: &str) -> Result<(), String> {
        let path = self.state_path()?;
        let temporary = path.with_extension("json.tmp");
        let data = serde_json::to_vec_pretty(&CoreAiSelectionState {
            selected_model_id: model_id.into(),
        })
        .map_err(|error| format!("Failed to encode Core AI selection: {error}"))?;
        fs::write(&temporary, data)
            .map_err(|error| format!("Failed to save Core AI selection: {error}"))?;
        fs::rename(&temporary, &path)
            .map_err(|error| format!("Failed to commit Core AI selection: {error}"))?;
        Ok(())
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
