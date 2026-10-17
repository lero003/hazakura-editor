//! `CoreAiModelStore::persistence` impl block.
//!
//! Split out of `core_ai_models.rs`; the methods are still the
//! store's own inherent methods and can touch its private fields.

use super::*;

impl CoreAiModelStore {
    pub(super) fn external_models_path(&self) -> Result<PathBuf, String> {
        Ok(self.data_dir()?.join(EXTERNAL_MODELS_FILENAME))
    }

    pub(super) fn read_external_models(&self) -> Result<Vec<RegisteredExternalModel>, String> {
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

    pub(super) fn persist_external_models(
        &self,
        entries: &[RegisteredExternalModel],
    ) -> Result<(), String> {
        let path = self.external_models_path()?;
        let temporary = path.with_extension("json.tmp");
        let data = serde_json::to_vec(entries)
            .map_err(|error| format!("Cannot encode registered model folders: {error}"))?;
        fs::write(&temporary, data)
            .map_err(|error| format!("Cannot save registered model folders: {error}"))?;
        fs::rename(&temporary, path)
            .map_err(|error| format!("Cannot save registered model folders: {error}"))
    }

    pub(super) fn custom_models_root(&self) -> Result<PathBuf, String> {
        Ok(self.data_dir()?.join(CUSTOM_MODELS_DIRECTORY))
    }

    pub(super) fn data_dir(&self) -> Result<PathBuf, String> {
        self.data_dir
            .lock()
            .expect("Core AI data dir lock")
            .clone()
            .ok_or_else(|| "Core AI model storage is not initialized.".into())
    }

    pub(super) fn state_path(&self) -> Result<PathBuf, String> {
        Ok(self.data_dir()?.join(STATE_FILENAME))
    }

    pub(super) fn validation_receipt_path(
        &self,
        entry: &CoreAiCatalogEntry,
    ) -> Result<PathBuf, String> {
        Ok(self
            .data_dir()?
            .join(VALIDATION_DIRECTORY)
            .join(format!("{}.json", entry.storage_directory)))
    }

    pub(super) fn read_validation_receipt(
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

    pub(super) fn write_validation_receipt(
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

    pub(super) fn read_persisted_selection(&self) -> Result<Option<String>, String> {
        let data = match fs::read(self.state_path()?) {
            Ok(data) => data,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
            Err(error) => return Err(format!("Failed to read Core AI selection: {error}")),
        };
        serde_json::from_slice::<CoreAiSelectionState>(&data)
            .map(|state| Some(state.selected_model_id))
            .map_err(|error| format!("Failed to decode Core AI selection: {error}"))
    }

    pub(super) fn persist_selection(&self, model_id: &str) -> Result<(), String> {
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
