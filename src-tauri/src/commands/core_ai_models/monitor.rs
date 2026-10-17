//! `CoreAiModelStore::monitor` impl block.
//!
//! Split out of `core_ai_models.rs`; the methods are still the
//! store's own inherent methods and can touch its private fields.

use super::*;

impl CoreAiModelStore {
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

    pub(super) fn next_monitor_generation(&self, model_id: &str) -> u64 {
        let mut generations = self
            .monitor_generations
            .lock()
            .expect("monitor generations lock");
        let next = generations.get(model_id).copied().unwrap_or(0) + 1;
        generations.insert(model_id.into(), next);
        next
    }

    pub(super) fn refresh_monitored(
        &self,
        model_id: &str,
        generation: u64,
        helper_store: Option<&AppleAssistHelperStore>,
        on_commit: impl Fn(),
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
        // Snapshot acquisition and hashing can take seconds. Publish the
        // intermediate phase only for this operation generation, then recheck
        // it again before committing the completed verification.
        let previous = self
            .catalog_entry(model_id)
            .ok()
            .map(|entry| self.runtime_state(entry))
            .unwrap_or_default();
        let result = self.compute_runtime_state_with_verifying(model_id, |path, version| {
            let generations = self
                .monitor_generations
                .lock()
                .expect("monitor generations lock");
            if generations.get(model_id).copied() != Some(generation) {
                return;
            }
            self.set_runtime_state(
                model_id,
                RuntimeState {
                    status: CoreAiModelStatus::Verifying,
                    materialized_path: Some(path.to_path_buf()),
                    asset_pack_version: version,
                    ..RuntimeState::default()
                },
            );
            on_commit();
        });
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

    #[cfg(test)]
    pub(crate) fn refresh_monitored_with_notify_for_test(
        &self,
        model_id: &str,
        generation: u64,
        helper_store: &AppleAssistHelperStore,
        on_commit: impl Fn(),
    ) -> Option<(CoreAiModelStatus, bool)> {
        self.refresh_monitored(model_id, generation, Some(helper_store), on_commit)
    }

    #[cfg(test)]
    pub(super) fn compute_runtime_state(&self, model_id: &str) -> Result<RuntimeState, String> {
        self.compute_runtime_state_with_verifying(model_id, |_, _| {})
    }

    pub(super) fn compute_runtime_state_with_verifying(
        &self,
        model_id: &str,
        on_verifying: impl FnOnce(&Path, Option<u64>),
    ) -> Result<RuntimeState, String> {
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
            on_verifying(&path, snapshot.asset_pack_version);
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

    pub(super) fn retired_model_is_present(&self, entry: &CoreAiCatalogEntry) -> bool {
        entry.retired
            && self
                .validation_receipt_path(entry)
                .is_ok_and(|path| path.is_file())
    }

    pub(super) fn set_runtime_state(&self, model_id: &str, state: RuntimeState) {
        self.runtime_states
            .lock()
            .expect("runtime states lock")
            .insert(model_id.into(), state);
    }

    #[cfg(test)]
    pub(super) fn set_failure(&self, model_id: &str, error: String) {
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

    pub(super) fn model_path(&self, entry: &CoreAiCatalogEntry) -> Result<PathBuf, String> {
        entry.validate()?;
        if entry.asset_pack_id.is_none() {
            return self.fixture_model_path(entry);
        }
        self.runtime_state(entry)
            .materialized_path
            .ok_or_else(|| "The verified Core AI model path is unavailable.".into())
    }

    pub(super) fn fixture_model_path(&self, entry: &CoreAiCatalogEntry) -> Result<PathBuf, String> {
        Ok(self
            .data_dir()?
            .join(MODEL_DIRECTORY)
            .join(&entry.storage_directory))
    }
}
