use crate::commands::apple_assist_supervisor::{AppleAssistHelperStore, AssistBackendSelection};
use crate::distribution::ensure_apple_assist_allowed_by_distribution;
use crate::security::window_guard::{ensure_label_is_main, ensure_label_is_main_or_apple_assist};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::{Arc, Mutex};

pub(crate) const SYSTEM_MODEL_ID: &str = "apple:foundation-models:system-default";
const STATE_FILENAME: &str = "core-ai-selection.json";
const MODEL_DIRECTORY: &str = "CoreAIModels";

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

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum CoreAiModelStatus {
    Ready,
    NotDownloaded,
    NotPublished,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CoreAiModelSummary {
    pub(crate) id: String,
    pub(crate) display_name: String,
    pub(crate) kind: CoreAiModelKind,
    pub(crate) status: CoreAiModelStatus,
    pub(crate) selected: bool,
    pub(crate) download_size_bytes: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CoreAiModelCatalogResponse {
    pub(crate) distribution_status: CoreAiDistributionStatus,
    pub(crate) selected_model_id: String,
    pub(crate) models: Vec<CoreAiModelSummary>,
}

#[derive(Debug, Clone)]
pub(crate) struct CoreAiCatalogEntry {
    id: String,
    display_name: String,
    storage_directory: String,
    published: bool,
    download_size_bytes: Option<u64>,
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
        Ok(())
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CoreAiSelectionState {
    selected_model_id: String,
}

pub(crate) struct CoreAiModelStore {
    data_dir: Mutex<Option<PathBuf>>,
    selected_model_id: Mutex<String>,
    catalog: Vec<CoreAiCatalogEntry>,
}

impl Default for CoreAiModelStore {
    fn default() -> Self {
        // Deliberately empty until the product model, license, manifest,
        // Apple-hosted asset-pack id, and hashes are release-approved.
        Self::with_catalog(Vec::new())
    }
}

impl CoreAiModelStore {
    fn with_catalog(catalog: Vec<CoreAiCatalogEntry>) -> Self {
        Self {
            data_dir: Mutex::new(None),
            selected_model_id: Mutex::new(SYSTEM_MODEL_ID.into()),
            catalog,
        }
    }

    #[cfg(test)]
    pub(crate) fn with_fixture_catalog(catalog: Vec<CoreAiCatalogEntry>) -> Self {
        Self::with_catalog(catalog)
    }

    pub(crate) fn configure(
        &self,
        data_dir: PathBuf,
        helper_store: &AppleAssistHelperStore,
    ) -> Result<(), String> {
        for entry in &self.catalog {
            entry.validate()?;
        }
        fs::create_dir_all(&data_dir)
            .map_err(|error| format!("Failed to prepare Core AI app data: {error}"))?;
        *self.data_dir.lock().expect("Core AI data dir lock") = Some(data_dir);

        let selected = self
            .read_persisted_selection()
            .unwrap_or_else(|| SYSTEM_MODEL_ID.into());
        if self.selection_for(&selected).is_err() {
            self.persist_selection(SYSTEM_MODEL_ID)?;
            helper_store.set_selected_backend(AssistBackendSelection::SystemDefault)?;
        } else {
            self.apply_selection(&selected, helper_store)?;
        }
        Ok(())
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
            status: CoreAiModelStatus::Ready,
            selected: selected == SYSTEM_MODEL_ID,
            download_size_bytes: None,
        }];
        models.extend(self.catalog.iter().map(|entry| CoreAiModelSummary {
            id: entry.id.clone(),
            display_name: entry.display_name.clone(),
            kind: CoreAiModelKind::CoreAi,
            status: self.status_for(entry),
            selected: selected == entry.id,
            download_size_bytes: entry.download_size_bytes,
        }));
        CoreAiModelCatalogResponse {
            distribution_status: if self.catalog.iter().any(|entry| entry.published) {
                CoreAiDistributionStatus::Available
            } else {
                CoreAiDistributionStatus::NotPublished
            },
            selected_model_id: selected,
            models,
        }
    }

    pub(crate) fn select(
        &self,
        model_id: &str,
        helper_store: &AppleAssistHelperStore,
    ) -> Result<CoreAiModelCatalogResponse, String> {
        self.apply_selection(model_id, helper_store)?;
        self.persist_selection(model_id)?;
        Ok(self.list())
    }

    pub(crate) fn start_download(&self, model_id: &str) -> Result<(), String> {
        let entry = self.catalog_entry(model_id)?;
        if !entry.published {
            return Err(
                "This Core AI model has not been published through Apple-hosted assets.".into(),
            );
        }
        if self.status_for(entry) == CoreAiModelStatus::Ready {
            return Ok(());
        }
        Err(
            "Apple-hosted model downloading is not active until the asset pack and downloader extension are configured."
                .into(),
        )
    }

    pub(crate) fn cancel_download(&self, model_id: &str) -> Result<bool, String> {
        let entry = self.catalog_entry(model_id)?;
        if !entry.published {
            return Err(
                "This Core AI model has not been published through Apple-hosted assets.".into(),
            );
        }
        Ok(false)
    }

    pub(crate) fn delete(
        &self,
        model_id: &str,
        _helper_store: &AppleAssistHelperStore,
    ) -> Result<CoreAiModelCatalogResponse, String> {
        let entry = self.catalog_entry(model_id)?;
        if !entry.published {
            return Err(
                "This Core AI model has not been published through Apple-hosted assets.".into(),
            );
        }
        Err(
            "Apple-hosted model removal is not active until the asset pack and downloader extension are configured."
                .into(),
        )
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
        if self.status_for(entry) != CoreAiModelStatus::Ready {
            return Err("The selected Core AI model is not downloaded and ready.".into());
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

    fn status_for(&self, entry: &CoreAiCatalogEntry) -> CoreAiModelStatus {
        if !entry.published {
            return CoreAiModelStatus::NotPublished;
        }
        match self.model_path(entry) {
            Ok(path) if path.is_dir() => CoreAiModelStatus::Ready,
            _ => CoreAiModelStatus::NotDownloaded,
        }
    }

    fn model_path(&self, entry: &CoreAiCatalogEntry) -> Result<PathBuf, String> {
        entry.validate()?;
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

    fn read_persisted_selection(&self) -> Option<String> {
        let data = fs::read(self.state_path().ok()?).ok()?;
        serde_json::from_slice::<CoreAiSelectionState>(&data)
            .ok()
            .map(|state| state.selected_model_id)
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
    store: tauri::State<'_, Arc<CoreAiModelStore>>,
    helper_store: tauri::State<'_, Arc<AppleAssistHelperStore>>,
    model_id: String,
) -> Result<CoreAiModelCatalogResponse, String> {
    ensure_label_is_main_or_apple_assist(window.label())?;
    ensure_apple_assist_allowed_by_distribution()?;
    store.select(&model_id, helper_store.inner().as_ref())
}

#[tauri::command]
pub(crate) fn start_core_ai_model_download<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    store: tauri::State<'_, Arc<CoreAiModelStore>>,
    model_id: String,
) -> Result<(), String> {
    ensure_label_is_main(window.label())?;
    ensure_apple_assist_allowed_by_distribution()?;
    store.start_download(&model_id)
}

#[tauri::command]
pub(crate) fn cancel_core_ai_model_download<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    store: tauri::State<'_, Arc<CoreAiModelStore>>,
    model_id: String,
) -> Result<bool, String> {
    ensure_label_is_main(window.label())?;
    ensure_apple_assist_allowed_by_distribution()?;
    store.cancel_download(&model_id)
}

#[tauri::command]
pub(crate) fn delete_core_ai_model<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    store: tauri::State<'_, Arc<CoreAiModelStore>>,
    helper_store: tauri::State<'_, Arc<AppleAssistHelperStore>>,
    model_id: String,
) -> Result<CoreAiModelCatalogResponse, String> {
    ensure_label_is_main(window.label())?;
    ensure_apple_assist_allowed_by_distribution()?;
    store.delete(&model_id, helper_store.inner().as_ref())
}
