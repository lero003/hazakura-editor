//! `CoreAiModelStore::catalog` impl block.
//!
//! Split out of `core_ai_models.rs`; the methods are still the
//! store's own inherent methods and can touch its private fields.

use super::*;

impl CoreAiModelStore {
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
        models.extend(
            self.catalog
                .iter()
                .filter(|entry| {
                    entry.published || (entry.retired && self.retired_model_is_present(entry))
                })
                .map(|entry| {
                    let runtime = self.runtime_state(entry);
                    let preview_unavailable =
                        runtime.error.as_deref() == Some(LOCAL_PREVIEW_ASSET_ERROR);
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
                        error_code: if entry.retired {
                            Some("retired-model".into())
                        } else if preview_unavailable {
                            Some("local-preview".into())
                        } else {
                            runtime.failure_kind.map(str::to_string)
                        },
                        asset_pack_version: runtime.asset_pack_version,
                        can_remove: runtime.materialized_path.is_some()
                            || (entry.retired && self.retired_model_is_present(entry)),
                    }
                }),
        );
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

    /// Detected models under `app_data_dir()/CoreAICustomModels`. Read-only: the
    /// app never deletes or repairs what the user placed there, and a broken
    /// folder is reported rather than hidden.
    pub(super) fn local_model_summaries(&self, selected: &str) -> Vec<CoreAiModelSummary> {
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

    pub(super) fn external_model_summaries(&self, selected: &str) -> Vec<CoreAiModelSummary> {
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

    pub(super) fn catalog_entry(&self, model_id: &str) -> Result<&CoreAiCatalogEntry, String> {
        self.catalog
            .iter()
            .find(|entry| entry.id == model_id)
            .ok_or_else(|| "The requested Core AI model is not in the signed app catalog.".into())
    }

    pub(super) fn asset_pack_id<'a>(
        &self,
        entry: &'a CoreAiCatalogEntry,
    ) -> Result<&'a str, String> {
        if !entry.published {
            return Err(
                "This Core AI model has not been published through Apple-hosted assets.".into(),
            );
        }
        entry.asset_pack_id.as_deref().ok_or_else(|| {
            "Apple-hosted model downloading is not configured for this catalog entry.".into()
        })
    }

    pub(super) fn runtime_state(&self, entry: &CoreAiCatalogEntry) -> RuntimeState {
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
}
