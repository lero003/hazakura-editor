//! `CoreAiModelStore::selection` impl block.
//!
//! Split out of `core_ai_models.rs`; the methods are still the
//! store's own inherent methods and can touch its private fields.

use super::*;

impl CoreAiModelStore {
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
        if entry.retired && !self.retired_model_is_present(entry) {
            return Err("The retired Core AI model is no longer installed.".into());
        }
        let asset_pack_id = entry.asset_pack_id.as_deref().ok_or_else(|| {
            "Apple-hosted model removal is not configured for this catalog entry.".to_string()
        })?;
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
        if let Err(remove_error) = self.transport.remove(asset_pack_id) {
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

    pub(super) fn apply_selection(
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

    pub(super) fn selection_for(&self, model_id: &str) -> Result<AssistBackendSelection, String> {
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
}
