//! `CoreAiModelStore::verification` impl block.
//!
//! Split out of `core_ai_models.rs`; the methods are still the
//! store's own inherent methods and can touch its private fields.

use super::*;

impl CoreAiModelStore {
    pub(super) fn verify_materialized_model(
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

    pub(super) fn sync_ready_selection(
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

    pub(super) fn ensure_management_available(&self) -> Result<(), String> {
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
    pub(super) fn ensure_apple_hosted_management_model(
        &self,
        model_id: &str,
    ) -> Result<(), String> {
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
}
