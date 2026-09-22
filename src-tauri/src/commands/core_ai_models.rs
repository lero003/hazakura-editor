use crate::commands::apple_assist_supervisor::{AppleAssistHelperStore, AssistBackendSelection};
use crate::commands::background_assets::{
    BackgroundAssetTransport, PlatformBackgroundAssetTransport,
};
use crate::commands::core_ai_local_models::scan_custom_models_directory;
use crate::distribution::{
    ensure_apple_assist_allowed_by_distribution, is_app_store_distribution_lane,
};
use crate::security::window_guard::{ensure_label_is_main, ensure_label_is_main_or_apple_assist};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::Emitter;

pub(crate) const SYSTEM_MODEL_ID: &str = "apple:foundation-models:system-default";
pub(crate) const CORE_AI_MODEL_STATE_CHANGED_EVENT: &str = "core-ai-model-state-changed";
const E4B_MODEL_ID: &str = "apple:core-ai:gemma-4-e4b-it-int4-v1";
// App Store Connect rejects periods in an asset pack identifier, so this uses
// hyphens only. Keep it identical to the lock and the packaged manifest.
const E4B_ASSET_PACK_ID: &str = "hazakura-coreai-gemma4-e4b-v1";
const E4B_CATALOG_VERSION: &str = "2026.09.20.1";
const E4B_STORAGE_DIRECTORY: &str = "gemma-4-e4b-it-int4-v1";
const E4B_RESOURCE_MANIFEST: &str =
    include_str!("../../resources/core-ai/gemma4-e4b-resource-manifest.json");
const E4B_RESOURCE_MANIFEST_SHA256: &str =
    "d46c81f18147a2faf0d066b4ef2d31f72416b75ee544397580815fa2e4fb4af3";
const TWELVE_B_MODEL_ID: &str = "apple:core-ai:gemma-4-12b-it-int8-v1";
const TWELVE_B_ASSET_PACK_ID: &str = "hazakura-coreai-gemma4-12b-v1";
const TWELVE_B_CATALOG_VERSION: &str = "2026.09.20.1";
const TWELVE_B_STORAGE_DIRECTORY: &str = "gemma-4-12b-it-int8-v1";
const TWELVE_B_RESOURCE_MANIFEST: &str =
    include_str!("../../resources/core-ai/gemma4-12b-resource-manifest.json");
const TWELVE_B_RESOURCE_MANIFEST_SHA256: &str =
    "cbb81f30fbff9171e5001acd3305a9b36d1dd06ba6fac607edb7618ac3bd6ac1";
const PACK_RESOURCE_MANIFEST_FILENAME: &str = "hazakura-resource-manifest.json";
const STATE_FILENAME: &str = "core-ai-selection.json";
const MODEL_DIRECTORY: &str = "CoreAIModels";
const VALIDATION_DIRECTORY: &str = "core-ai-validation";
/// Hazakura-managed directory the user drops local Core AI bundles into. It is
/// kept apart from the Background Assets materialization in `CoreAIModels/`.
const CUSTOM_MODELS_DIRECTORY: &str = "CoreAICustomModels";
/// Id namespace for detected local models. `local:` cannot collide with the
/// `apple:core-ai:` ids that Apple-hosted catalog entries use.
pub(crate) const LOCAL_MODEL_ID_PREFIX: &str = "local:app-managed:";

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
    /// A local bundle passed the local contract. It is detected and usable as a
    /// resource, but this build cannot generate from it yet (the helper local
    /// backend path lands in a later C-3 slice).
    Detected,
}

pub(crate) fn monitor_is_terminal(status: CoreAiModelStatus) -> bool {
    matches!(
        status,
        CoreAiModelStatus::Ready
            | CoreAiModelStatus::NotDownloaded
            | CoreAiModelStatus::Failed
            | CoreAiModelStatus::Unsupported
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
    pub(crate) recommended_memory_gb: Option<u64>,
    pub(crate) license: Option<String>,
    pub(crate) has_upstream_conversion_notice: bool,
    pub(crate) progress: Option<f64>,
    pub(crate) error: Option<String>,
    /// Stable code for a localized message owned by the frontend. Local entries
    /// use it instead of `error`, whose English text is for logs only.
    pub(crate) error_code: Option<String>,
    pub(crate) asset_pack_version: Option<u64>,
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
    recommended_memory_gb: Option<u64>,
    license: Option<String>,
    has_upstream_conversion_notice: bool,
    asset_pack_id: Option<String>,
    catalog_version: Option<String>,
    resource_manifest: Option<&'static str>,
    resource_manifest_sha256: Option<&'static str>,
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
            recommended_memory_gb: Some(1),
            license: Some("Apache-2.0".into()),
            has_upstream_conversion_notice: false,
            asset_pack_id: None,
            catalog_version: None,
            resource_manifest: None,
            resource_manifest_sha256: None,
        }
    }

    #[cfg(test)]
    pub(crate) fn published_fixture(
        id: &str,
        storage_directory: &str,
        resource_manifest: &'static str,
    ) -> Self {
        Self {
            id: id.into(),
            display_name: "Published fixture".into(),
            storage_directory: storage_directory.into(),
            published: true,
            download_size_bytes: Some(5),
            installed_size_bytes: Some(5),
            recommended_memory_gb: Some(1),
            license: Some("Apache-2.0".into()),
            has_upstream_conversion_notice: false,
            asset_pack_id: Some("dev.hazakura.editor.coreai.test.v1".into()),
            catalog_version: Some("test-v1".into()),
            resource_manifest: Some(resource_manifest),
            resource_manifest_sha256: Some("test-resource-manifest-sha256"),
        }
    }

    fn e4b() -> Self {
        Self {
            id: E4B_MODEL_ID.into(),
            display_name: "Gemma 4 E4B".into(),
            storage_directory: E4B_STORAGE_DIRECTORY.into(),
            published: true,
            download_size_bytes: Some(5_431_767_276),
            installed_size_bytes: Some(6_807_926_119),
            recommended_memory_gb: Some(16),
            license: Some("Apache-2.0".into()),
            has_upstream_conversion_notice: false,
            asset_pack_id: Some(E4B_ASSET_PACK_ID.into()),
            catalog_version: Some(E4B_CATALOG_VERSION.into()),
            resource_manifest: Some(E4B_RESOURCE_MANIFEST),
            resource_manifest_sha256: Some(E4B_RESOURCE_MANIFEST_SHA256),
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
            recommended_memory_gb: Some(32),
            license: Some("Apache-2.0".into()),
            has_upstream_conversion_notice: true,
            asset_pack_id: Some(TWELVE_B_ASSET_PACK_ID.into()),
            catalog_version: Some(TWELVE_B_CATALOG_VERSION.into()),
            resource_manifest: Some(TWELVE_B_RESOURCE_MANIFEST),
            resource_manifest_sha256: Some(TWELVE_B_RESOURCE_MANIFEST_SHA256),
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
        if self.asset_pack_id.is_some()
            != (self.catalog_version.is_some()
                && self.resource_manifest.is_some()
                && self.resource_manifest_sha256.is_some())
        {
            return Err("Core AI catalog contains an incomplete Background Assets entry.".into());
        }
        Ok(())
    }

    fn relative_asset_path(&self) -> String {
        format!("{MODEL_DIRECTORY}/{}", self.storage_directory)
    }
}

fn production_catalog() -> Vec<CoreAiCatalogEntry> {
    vec![CoreAiCatalogEntry::e4b(), CoreAiCatalogEntry::twelve_b()]
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
}

impl Default for RuntimeState {
    fn default() -> Self {
        Self {
            status: CoreAiModelStatus::NotDownloaded,
            progress: None,
            error: None,
            materialized_path: None,
            asset_pack_version: None,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CoreAiSelectionState {
    selected_model_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ValidationReceipt {
    model_id: String,
    catalog_version: String,
    resource_manifest_sha256: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ResourceManifest {
    model_id: String,
    catalog_version: String,
    storage_directory: String,
    max_entries: usize,
    files: Vec<ResourceManifestFile>,
}

#[derive(Debug, Deserialize)]
struct ResourceManifestFile {
    path: String,
    size: u64,
    sha256: String,
}

pub(crate) struct CoreAiModelStore {
    data_dir: Mutex<Option<PathBuf>>,
    selected_model_id: Mutex<String>,
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
        Self::with_catalog_and_transport(
            if is_app_store_distribution_lane() {
                production_catalog()
            } else {
                Vec::new()
            },
            Arc::new(PlatformBackgroundAssetTransport),
        )
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
        if overridden {
            return Ok(());
        }

        let selected = self
            .read_persisted_selection()?
            .unwrap_or_else(|| SYSTEM_MODEL_ID.into());
        if selected == SYSTEM_MODEL_ID {
            return Ok(());
        }
        if self.catalog_entry(&selected).is_err() {
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
            .filter(|entry| entry.asset_pack_id.is_some())
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
            recommended_memory_gb: None,
            license: None,
            has_upstream_conversion_notice: false,
            progress: None,
            error: None,
            error_code: None,
            asset_pack_version: None,
        }];
        models.extend(self.catalog.iter().map(|entry| {
            let runtime = self.runtime_state(entry);
            CoreAiModelSummary {
                id: entry.id.clone(),
                display_name: entry.display_name.clone(),
                kind: CoreAiModelKind::CoreAi,
                source: CoreAiModelSource::AppleHosted,
                status: runtime.status,
                selected: selected == entry.id,
                download_size_bytes: entry.download_size_bytes,
                installed_size_bytes: entry.installed_size_bytes,
                recommended_memory_gb: entry.recommended_memory_gb,
                license: entry.license.clone(),
                has_upstream_conversion_notice: entry.has_upstream_conversion_notice,
                progress: runtime.progress,
                error: runtime.error,
                error_code: None,
                asset_pack_version: runtime.asset_pack_version,
            }
        }));
        models.extend(self.local_model_summaries(&selected));
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
        self.ensure_not_a_local_model(model_id)?;
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
        self.ensure_not_a_local_model(model_id)?;
        let entry = self.catalog_entry(model_id)?;
        let asset_pack_id = self.asset_pack_id(entry)?;
        if self.runtime_state(entry).status == CoreAiModelStatus::Ready {
            return Ok(self.list());
        }
        self.transport.start(asset_pack_id)?;
        self.set_runtime_state(
            model_id,
            RuntimeState {
                status: CoreAiModelStatus::Downloading,
                progress: Some(0.0),
                ..RuntimeState::default()
            },
        );
        Ok(self.list())
    }

    pub(crate) fn cancel_download(&self, model_id: &str) -> Result<bool, String> {
        self.ensure_management_available()?;
        self.ensure_not_a_local_model(model_id)?;
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
        self.ensure_not_a_local_model(model_id)?;
        let entry = self.catalog_entry(model_id)?;
        let was_selected = self
            .selected_model_id
            .lock()
            .expect("selected model lock")
            .as_str()
            == model_id;
        if was_selected {
            helper_store
                .set_selected_backend_after(AssistBackendSelection::SystemDefault, || {
                    self.persist_selection(SYSTEM_MODEL_ID)
                })?;
            *self.selected_model_id.lock().expect("selected model lock") = SYSTEM_MODEL_ID.into();
        }
        if let Err(remove_error) = self.transport.remove(self.asset_pack_id(entry)?) {
            if was_selected {
                if let Err(restore_error) = self.select(model_id, helper_store) {
                    return Err(format!(
                        "{remove_error} The previous model could not be restored after removal failed: {restore_error}"
                    ));
                }
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
        let generation = {
            let mut generations = self
                .monitor_generations
                .lock()
                .expect("monitor generations lock");
            let next = generations.get(&model_id).copied().unwrap_or(0) + 1;
            generations.insert(model_id.clone(), next);
            next
        };
        let store = self.clone();
        std::thread::spawn(move || loop {
            if store
                .monitor_generations
                .lock()
                .expect("monitor generations lock")
                .get(&model_id)
                .copied()
                != Some(generation)
            {
                break;
            }
            let status = match store.refresh_model(&model_id) {
                Ok(status) => status,
                Err(error) => {
                    store.set_failure(&model_id, error);
                    CoreAiModelStatus::Failed
                }
            };
            if store.runtime_status(&model_id) == Some(CoreAiModelStatus::Ready) {
                if let Some(helper) = helper_store.as_deref() {
                    let _ = store.restore_pending_selection(&model_id, helper);
                }
            }
            let _ = app.emit(CORE_AI_MODEL_STATE_CHANGED_EVENT, store.list());
            if monitor_is_terminal(status) {
                break;
            }
            std::thread::sleep(monitor_poll_interval(status));
        });
    }

    fn refresh_model(&self, model_id: &str) -> Result<CoreAiModelStatus, String> {
        let entry = self.catalog_entry(model_id)?;
        let snapshot = self
            .transport
            .snapshot(self.asset_pack_id(entry)?, &entry.relative_asset_path())?;
        if !snapshot.supported {
            self.set_runtime_state(
                model_id,
                RuntimeState {
                    status: CoreAiModelStatus::Unsupported,
                    error: snapshot.error,
                    asset_pack_version: snapshot.asset_pack_version,
                    ..RuntimeState::default()
                },
            );
            return Ok(CoreAiModelStatus::Unsupported);
        }
        if snapshot.available {
            let path = snapshot.path.ok_or_else(|| {
                "Background Assets reported E4B as downloaded without a materialized path."
                    .to_string()
            })?;
            self.set_runtime_state(
                model_id,
                RuntimeState {
                    status: CoreAiModelStatus::Verifying,
                    progress: Some(1.0),
                    asset_pack_version: snapshot.asset_pack_version,
                    ..RuntimeState::default()
                },
            );
            self.verify_materialized_model(entry, &path)?;
            self.set_runtime_state(
                model_id,
                RuntimeState {
                    status: CoreAiModelStatus::Ready,
                    progress: Some(1.0),
                    materialized_path: Some(path),
                    asset_pack_version: snapshot.asset_pack_version,
                    error: None,
                },
            );
            return Ok(CoreAiModelStatus::Ready);
        }
        let status = match snapshot.phase.as_str() {
            "resolving" | "downloading" => CoreAiModelStatus::Downloading,
            "paused" => CoreAiModelStatus::Paused,
            "failed" => CoreAiModelStatus::Failed,
            _ => CoreAiModelStatus::NotDownloaded,
        };
        self.set_runtime_state(
            model_id,
            RuntimeState {
                status,
                progress: snapshot.progress.map(|value| value.clamp(0.0, 1.0)),
                error: snapshot.error,
                materialized_path: None,
                asset_pack_version: snapshot.asset_pack_version,
            },
        );
        Ok(status)
    }

    #[cfg(test)]
    pub(crate) fn refresh_model_for_test(
        &self,
        model_id: &str,
    ) -> Result<CoreAiModelStatus, String> {
        match self.refresh_model(model_id) {
            Ok(status) => Ok(status),
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
    ) -> Result<(), String> {
        let expected_manifest = entry
            .resource_manifest
            .ok_or_else(|| "Core AI entry has no resource manifest.".to_string())?;
        let packaged_manifest = fs::read(root.join(PACK_RESOURCE_MANIFEST_FILENAME))
            .map_err(|error| format!("The E4B resource manifest is missing: {error}"))?;
        if packaged_manifest != expected_manifest.as_bytes() {
            return Err(
                "The downloaded E4B resource manifest does not match the signed catalog.".into(),
            );
        }
        let manifest: ResourceManifest = serde_json::from_str(expected_manifest)
            .map_err(|error| format!("The signed E4B resource manifest is invalid: {error}"))?;
        if manifest.model_id != entry.id
            || manifest.storage_directory != entry.storage_directory
            || Some(manifest.catalog_version.as_str()) != entry.catalog_version.as_deref()
            || manifest.files.len() != manifest.max_entries
        {
            return Err("The signed E4B resource manifest identity is inconsistent.".into());
        }
        let receipt_is_valid = self.read_validation_receipt(entry).unwrap_or(false);
        for file in &manifest.files {
            validate_relative_path(&file.path)?;
            let path = root.join(&file.path);
            let metadata = fs::symlink_metadata(&path)
                .map_err(|error| format!("E4B is missing {}: {error}", file.path))?;
            if metadata.file_type().is_symlink() || !metadata.is_file() {
                return Err(format!(
                    "E4B contains an unsafe non-file entry: {}",
                    file.path
                ));
            }
            if metadata.len() != file.size {
                return Err(format!(
                    "E4B file size mismatch for {}: expected {}, got {}.",
                    file.path,
                    file.size,
                    metadata.len()
                ));
            }
            if !receipt_is_valid && self.transport.sha256_file(&path)? != file.sha256 {
                return Err(format!("E4B SHA-256 mismatch for {}.", file.path));
            }
        }
        if !receipt_is_valid {
            self.write_validation_receipt(entry)?;
        }
        Ok(())
    }

    fn restore_pending_selection(
        &self,
        model_id: &str,
        helper_store: &AppleAssistHelperStore,
    ) -> Result<(), String> {
        let pending = self
            .pending_restore_model_id
            .lock()
            .expect("pending restore lock")
            .clone();
        if pending.as_deref() != Some(model_id) {
            return Ok(());
        }
        self.apply_selection(model_id, helper_store)?;
        *self
            .pending_restore_model_id
            .lock()
            .expect("pending restore lock") = None;
        Ok(())
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

    /// Local models are detected and validated, but this build cannot select,
    /// download, or delete them yet. Refusing here keeps a crafted model id from
    /// reaching the Apple-hosted management path.
    fn ensure_not_a_local_model(&self, model_id: &str) -> Result<(), String> {
        if model_id.starts_with(LOCAL_MODEL_ID_PREFIX) {
            return Err(
                "Custom models are detected only. This build cannot select, download, or delete them."
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
                    recommended_memory_gb: None,
                    license: None,
                    has_upstream_conversion_notice: false,
                    progress: None,
                    error: None,
                    error_code,
                    asset_pack_version: None,
                }
            })
            .collect()
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
        helper_store.set_selected_backend(selection)?;
        *self.selected_model_id.lock().expect("selected model lock") = model_id.into();
        Ok(())
    }

    fn selection_for(&self, model_id: &str) -> Result<AssistBackendSelection, String> {
        if model_id == SYSTEM_MODEL_ID {
            return Ok(AssistBackendSelection::SystemDefault);
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

    fn runtime_status(&self, model_id: &str) -> Option<CoreAiModelStatus> {
        self.catalog_entry(model_id)
            .ok()
            .map(|entry| self.runtime_state(entry).status)
    }
    fn set_runtime_state(&self, model_id: &str, state: RuntimeState) {
        self.runtime_states
            .lock()
            .expect("runtime states lock")
            .insert(model_id.into(), state);
    }
    fn set_failure(&self, model_id: &str, error: String) {
        let version = self
            .catalog_entry(model_id)
            .ok()
            .and_then(|entry| self.runtime_state(entry).asset_pack_version);
        self.set_runtime_state(
            model_id,
            RuntimeState {
                status: CoreAiModelStatus::Failed,
                error: Some(error),
                asset_pack_version: version,
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

    fn read_validation_receipt(&self, entry: &CoreAiCatalogEntry) -> Result<bool, String> {
        let data = match fs::read(self.validation_receipt_path(entry)?) {
            Ok(data) => data,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(false),
            Err(error) => return Err(format!("Failed to read E4B validation receipt: {error}")),
        };
        let receipt: ValidationReceipt = serde_json::from_slice(&data)
            .map_err(|error| format!("Failed to decode E4B validation receipt: {error}"))?;
        Ok(receipt.model_id == entry.id
            && Some(receipt.catalog_version.as_str()) == entry.catalog_version.as_deref()
            && Some(receipt.resource_manifest_sha256.as_str()) == entry.resource_manifest_sha256)
    }

    fn write_validation_receipt(&self, entry: &CoreAiCatalogEntry) -> Result<(), String> {
        let path = self.validation_receipt_path(entry)?;
        fs::create_dir_all(
            path.parent()
                .ok_or_else(|| "E4B validation receipt has no parent directory.".to_string())?,
        )
        .map_err(|error| format!("Failed to prepare E4B validation receipt: {error}"))?;
        let data = serde_json::to_vec_pretty(&ValidationReceipt {
            model_id: entry.id.clone(),
            catalog_version: entry.catalog_version.clone().unwrap_or_default(),
            resource_manifest_sha256: entry.resource_manifest_sha256.unwrap_or_default().into(),
        })
        .map_err(|error| format!("Failed to encode E4B validation receipt: {error}"))?;
        fs::write(path, data)
            .map_err(|error| format!("Failed to save E4B validation receipt: {error}"))
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
    let mut count = 0;
    for component in Path::new(path).components() {
        match component {
            Component::Normal(_) => count += 1,
            _ => return Err(format!("Resource manifest contains an unsafe path: {path}")),
        }
    }
    if count == 0 {
        return Err("Resource manifest contains an empty path.".into());
    }
    Ok(())
}

fn emit_catalog<R: tauri::Runtime>(app: &tauri::AppHandle<R>, store: &CoreAiModelStore) {
    let _ = app.emit(CORE_AI_MODEL_STATE_CHANGED_EVENT, store.list());
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
