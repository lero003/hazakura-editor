use crate::commands::apple_assist_supervisor::{store_without_helper, AssistBackendSelection};
use crate::commands::background_assets::{BackgroundAssetSnapshot, BackgroundAssetTransport};
use crate::commands::core_ai_models::{
    CoreAiCatalogEntry, CoreAiDistributionStatus, CoreAiModelKind, CoreAiModelStatus,
    CoreAiModelStore, SYSTEM_MODEL_ID,
};
use std::path::{Path, PathBuf};
use std::sync::Arc;

const TEST_PUBLISHED_MODEL_ID: &str = "apple:core-ai:test-pack";
const TEST_RESOURCE_MANIFEST: &str = r#"{
  "modelId": "apple:core-ai:test-pack",
  "catalogVersion": "test-v1",
  "storageDirectory": "test-pack",
  "maxEntries": 1,
  "files": [
    {
      "path": "model.bin",
      "size": 5,
      "sha256": "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
    }
  ]
}
"#;

struct PublishedFixtureTransport {
    root: PathBuf,
}

impl BackgroundAssetTransport for PublishedFixtureTransport {
    fn snapshot(
        &self,
        _asset_pack_id: &str,
        _relative_path: &str,
    ) -> Result<BackgroundAssetSnapshot, String> {
        Ok(BackgroundAssetSnapshot {
            supported: true,
            available: true,
            phase: "downloaded".into(),
            progress: Some(1.0),
            path: Some(self.root.clone()),
            error: None,
            asset_pack_version: Some(1),
        })
    }

    fn start(&self, _asset_pack_id: &str) -> Result<(), String> {
        Ok(())
    }

    fn cancel(&self, _asset_pack_id: &str) -> Result<bool, String> {
        Ok(true)
    }

    fn remove(&self, _asset_pack_id: &str) -> Result<(), String> {
        Ok(())
    }

    fn sha256_file(&self, path: &Path) -> Result<String, String> {
        if std::fs::read(path).map_err(|error| error.to_string())? == b"hello" {
            Ok("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824".into())
        } else {
            Ok("corrupt".into())
        }
    }
}

fn temp_data_dir() -> std::path::PathBuf {
    std::env::temp_dir().join(format!(
        "hazakura-core-ai-model-store-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("clock")
            .as_nanos()
    ))
}

fn create_ready_fixture(data_dir: &std::path::Path, storage_directory: &str) {
    let model_dir = data_dir.join("CoreAIModels").join(storage_directory);
    std::fs::create_dir_all(&model_dir).expect("model fixture directory");
    std::fs::write(model_dir.join("hazakura-model.json"), "{}").expect("model fixture marker");
}

#[test]
fn production_catalog_fails_closed_until_a_model_is_published() {
    let data_dir = temp_data_dir();
    let helper = store_without_helper();
    let store = CoreAiModelStore::default();
    store.configure(Ok(data_dir.clone()), &helper, None);
    assert!(store.list().management_error.is_none());

    let response = store.list();
    assert_eq!(
        response.distribution_status,
        CoreAiDistributionStatus::NotPublished
    );
    assert_eq!(response.selected_model_id, SYSTEM_MODEL_ID);
    assert_eq!(response.models.len(), 1);
    assert_eq!(response.models[0].kind, CoreAiModelKind::System);
    assert_eq!(response.models[0].status, CoreAiModelStatus::Ready);
    assert!(store
        .select("apple:core-ai:not-in-catalog", &helper)
        .is_err());

    std::fs::remove_dir_all(data_dir).expect("cleanup");
}

#[test]
fn app_store_catalog_publishes_the_pinned_e4b_and_12b_asset_packs() {
    let developer = CoreAiModelStore::production_catalog_for_lane(false).list();
    assert_eq!(
        developer.distribution_status,
        CoreAiDistributionStatus::NotPublished
    );
    assert_eq!(developer.models.len(), 1);

    let app_store = CoreAiModelStore::production_catalog_for_lane(true).list();
    assert_eq!(
        app_store.distribution_status,
        CoreAiDistributionStatus::Available
    );
    assert_eq!(app_store.models.len(), 3);
    assert_eq!(
        app_store.models[1].id,
        "apple:core-ai:gemma-4-e4b-it-int4-v1"
    );
    assert_eq!(app_store.models[1].display_name, "Gemma 4 E4B");
    assert_eq!(app_store.models[1].status, CoreAiModelStatus::NotDownloaded);
    assert_eq!(app_store.models[1].recommended_memory_gb, Some(16));
    assert_eq!(
        app_store.models[1].installed_size_bytes,
        Some(6_807_926_119)
    );
    assert_eq!(app_store.models[1].license, Some("Apache-2.0".into()));
    assert!(!app_store.models[1].has_upstream_conversion_notice);

    assert_eq!(
        app_store.models[2].id,
        "apple:core-ai:gemma-4-12b-it-int8-v1"
    );
    assert_eq!(app_store.models[2].display_name, "Gemma 4 12B");
    assert_eq!(app_store.models[2].status, CoreAiModelStatus::NotDownloaded);
    assert_eq!(app_store.models[2].recommended_memory_gb, Some(32));
    assert_eq!(app_store.models[2].download_size_bytes, Some(9_148_924_300));
    assert_eq!(
        app_store.models[2].installed_size_bytes,
        Some(14_698_433_203)
    );
    assert_eq!(app_store.models[2].license, Some("Apache-2.0".into()));
    assert!(app_store.models[2].has_upstream_conversion_notice);
}

#[test]
fn an_empty_model_directory_is_never_ready() {
    let data_dir = temp_data_dir();
    std::fs::create_dir_all(data_dir.join("CoreAIModels/empty")).unwrap();
    let helper = store_without_helper();
    let store = CoreAiModelStore::with_fixture_catalog(vec![CoreAiCatalogEntry::fixture(
        "apple:core-ai:empty",
        "Empty",
        "empty",
    )]);
    store.configure(Ok(data_dir.clone()), &helper, None);

    assert_eq!(
        store.list().models[1].status,
        CoreAiModelStatus::NotDownloaded
    );
    assert!(store.select("apple:core-ai:empty", &helper).is_err());
    std::fs::remove_dir_all(data_dir).unwrap();
}

#[test]
fn downloaded_pack_requires_exact_manifest_files_sizes_and_sha_before_ready() {
    for (payload, expected) in [
        (Some(b"hello".as_slice()), None),
        (Some(b"short".as_slice()), Some("SHA-256 mismatch")),
        (None, Some("missing model.bin")),
    ] {
        let data_dir = temp_data_dir();
        let root = data_dir.join("materialized-test-pack");
        std::fs::create_dir_all(&root).unwrap();
        std::fs::write(
            root.join("hazakura-resource-manifest.json"),
            TEST_RESOURCE_MANIFEST,
        )
        .unwrap();
        if let Some(payload) = payload {
            std::fs::write(root.join("model.bin"), payload).unwrap();
        }
        let helper = store_without_helper();
        let store = CoreAiModelStore::with_test_transport(
            vec![CoreAiCatalogEntry::published_fixture(
                TEST_PUBLISHED_MODEL_ID,
                "test-pack",
                TEST_RESOURCE_MANIFEST,
            )],
            Arc::new(PublishedFixtureTransport { root }),
        );
        store.configure(Ok(data_dir.clone()), &helper, None);

        let result = store.refresh_model_for_test(TEST_PUBLISHED_MODEL_ID);
        match expected {
            None => {
                assert_eq!(result.unwrap(), CoreAiModelStatus::Ready);
                assert_eq!(store.list().models[1].status, CoreAiModelStatus::Ready);
                assert!(store.select(TEST_PUBLISHED_MODEL_ID, &helper).is_ok());
            }
            Some(message) => {
                assert!(result.unwrap_err().contains(message));
                assert_eq!(store.list().models[1].status, CoreAiModelStatus::Failed);
                assert!(store.select(TEST_PUBLISHED_MODEL_ID, &helper).is_err());
            }
        }
        std::fs::remove_dir_all(data_dir).unwrap();
    }
}

#[test]
fn ready_catalog_model_can_be_selected_and_restored_without_frontend_path_input() {
    let data_dir = temp_data_dir();
    let model_id = "apple:core-ai:fixture-ready";
    let entry = CoreAiCatalogEntry::fixture(model_id, "Fixture Ready", "fixture-ready");
    create_ready_fixture(&data_dir, "fixture-ready");
    let helper = store_without_helper();
    let store = CoreAiModelStore::with_fixture_catalog(vec![entry.clone()]);
    store.configure(Ok(data_dir.clone()), &helper, None);

    let selected = store.select(model_id, &helper).expect("select ready model");
    assert_eq!(selected.selected_model_id, model_id);
    assert_eq!(helper.selected_model_id().expect("helper model"), model_id);

    let restored_helper = store_without_helper();
    let restored = CoreAiModelStore::with_fixture_catalog(vec![entry]);
    restored.configure(Ok(data_dir.clone()), &restored_helper, None);
    assert!(restored.list().management_error.is_none());
    assert_eq!(restored.list().selected_model_id, model_id);
    assert_eq!(
        restored_helper
            .selected_model_id()
            .expect("restored helper"),
        model_id
    );

    std::fs::remove_dir_all(data_dir).expect("cleanup");
}

#[test]
fn published_but_missing_model_cannot_be_selected_or_fake_downloaded() {
    let data_dir = temp_data_dir();
    let model_id = "apple:core-ai:fixture-missing";
    let entry = CoreAiCatalogEntry::fixture(model_id, "Fixture Missing", "fixture-missing");
    let helper = store_without_helper();
    let store = CoreAiModelStore::with_fixture_catalog(vec![entry]);
    store.configure(Ok(data_dir.clone()), &helper, None);

    assert!(store.select(model_id, &helper).is_err());
    let download_error = store
        .start_download(model_id)
        .expect_err("transport is gated");
    assert!(
        download_error.contains("not configured"),
        "{download_error}"
    );

    std::fs::remove_dir_all(data_dir).expect("cleanup");
}

#[test]
fn startup_preserves_explicit_developer_test_backend() {
    let data_dir = temp_data_dir();
    let helper = store_without_helper();
    let override_selection = AssistBackendSelection::developer_override_for_lane(
        Some("developer"),
        Ok("core_ai_test".into()),
    );
    let store = CoreAiModelStore::default();
    store.configure(Ok(data_dir.clone()), &helper, override_selection);
    assert_eq!(
        helper.selected_model_id().unwrap(),
        "apple:core-ai:qwen3-0.6b-test"
    );
    assert_eq!(
        store.list().selected_model_id,
        "apple:core-ai:qwen3-0.6b-test"
    );
    assert!(store.list().selection_locked);
    assert!(store.list().management_error.is_none());
    assert!(store.select(SYSTEM_MODEL_ID, &helper).is_err());
    assert!(!data_dir.join("core-ai-selection.json").exists());
    std::fs::remove_dir_all(data_dir).unwrap();
}

#[test]
fn storage_creation_failure_does_not_abort_startup() {
    let data_dir = temp_data_dir();
    std::fs::write(&data_dir, "not a directory").unwrap();
    let helper = store_without_helper();
    let store = CoreAiModelStore::default();
    // Unit return is the setup contract: the error cannot escape into startup.
    let (): () = store.configure(Ok(data_dir.clone()), &helper, None);
    std::fs::remove_file(data_dir).unwrap();
    assert!(store
        .list()
        .management_error
        .unwrap()
        .contains("Failed to prepare"));
    assert!(store.select(SYSTEM_MODEL_ID, &helper).is_err());
    assert_eq!(helper.selected_model_id().unwrap(), SYSTEM_MODEL_ID);
}

#[test]
fn invalid_selection_repair_failure_does_not_abort_startup() {
    let data_dir = temp_data_dir();
    std::fs::create_dir_all(data_dir.join("core-ai-selection.json.tmp")).unwrap();
    std::fs::write(
        data_dir.join("core-ai-selection.json"),
        r#"{"selectedModelId":"apple:core-ai:removed"}"#,
    )
    .unwrap();
    let helper = store_without_helper();
    let store = CoreAiModelStore::default();
    let (): () = store.configure(Ok(data_dir.clone()), &helper, None);
    std::fs::remove_dir_all(data_dir).unwrap();
    assert!(store
        .list()
        .management_error
        .unwrap()
        .contains("Failed to save"));
    assert_eq!(store.list().selected_model_id, SYSTEM_MODEL_ID);
    assert_eq!(helper.selected_model_id().unwrap(), SYSTEM_MODEL_ID);
}

#[test]
fn failed_selection_write_keeps_the_previous_runtime_model() {
    let data_dir = temp_data_dir();
    create_ready_fixture(&data_dir, "ready");
    let helper = store_without_helper();
    let model_id = "apple:core-ai:ready";
    let store = CoreAiModelStore::with_fixture_catalog(vec![CoreAiCatalogEntry::fixture(
        model_id, "Ready", "ready",
    )]);
    store.configure(Ok(data_dir.clone()), &helper, None);
    std::fs::create_dir(data_dir.join("core-ai-selection.json.tmp")).unwrap();
    assert!(store.select(model_id, &helper).is_err());
    assert_eq!(helper.selected_model_id().unwrap(), SYSTEM_MODEL_ID);
    assert_eq!(store.list().selected_model_id, SYSTEM_MODEL_ID);
    std::fs::remove_dir_all(data_dir).unwrap();
}

#[test]
fn app_store_ignores_all_developer_overrides_and_restores_production_selection() {
    let data_dir = temp_data_dir();
    create_ready_fixture(&data_dir, "ready");
    let model_id = "apple:core-ai:ready";
    std::fs::write(
        data_dir.join("core-ai-selection.json"),
        format!(r#"{{"selectedModelId":"{model_id}"}}"#),
    )
    .unwrap();
    for value in ["core_ai_test", "system_default", "unknown"] {
        let selection = AssistBackendSelection::developer_override_for_lane(
            Some("app-store"),
            Ok(value.into()),
        );
        assert!(selection.is_none());
        let helper = store_without_helper();
        let store = CoreAiModelStore::with_fixture_catalog(vec![CoreAiCatalogEntry::fixture(
            model_id, "Ready", "ready",
        )]);
        store.configure(Ok(data_dir.clone()), &helper, selection);
        assert_eq!(helper.selected_model_id().unwrap(), model_id);
        assert_eq!(store.list().selected_model_id, model_id);
        assert!(!store.list().selection_locked);
        assert!(store.list().management_error.is_none());
    }
    std::fs::remove_dir_all(data_dir).unwrap();
}

#[test]
fn explicit_developer_override_wins_without_rewriting_production_preference() {
    let data_dir = temp_data_dir();
    create_ready_fixture(&data_dir, "ready");
    let saved = r#"{"selectedModelId":"apple:core-ai:ready"}"#;
    std::fs::write(data_dir.join("core-ai-selection.json"), saved).unwrap();
    for (value, expected) in [
        ("core_ai_test", "apple:core-ai:qwen3-0.6b-test"),
        ("system_default", SYSTEM_MODEL_ID),
    ] {
        let helper = store_without_helper();
        let store = CoreAiModelStore::with_fixture_catalog(vec![CoreAiCatalogEntry::fixture(
            "apple:core-ai:ready",
            "Ready",
            "ready",
        )]);
        let selection = AssistBackendSelection::developer_override_for_lane(
            Some("developer"),
            Ok(value.into()),
        );
        store.configure(Ok(data_dir.clone()), &helper, selection);
        assert_eq!(helper.selected_model_id().unwrap(), expected);
        assert_eq!(store.list().selected_model_id, expected);
        assert_eq!(
            std::fs::read_to_string(data_dir.join("core-ai-selection.json")).unwrap(),
            saved
        );
    }
    std::fs::remove_dir_all(data_dir).unwrap();
}

#[test]
fn unresolved_app_data_retains_error_without_overriding_developer_selection() {
    for selection in [
        None,
        AssistBackendSelection::developer_override_for_lane(
            Some("developer"),
            Ok("core_ai_test".into()),
        ),
    ] {
        let helper = store_without_helper();
        let store = CoreAiModelStore::default();
        let expected = if selection.is_some() {
            "apple:core-ai:qwen3-0.6b-test"
        } else {
            SYSTEM_MODEL_ID
        };
        let (): () = store.configure(
            Err("Failed to resolve app data directory".into()),
            &helper,
            selection,
        );
        assert_eq!(helper.selected_model_id().unwrap(), expected);
        assert_eq!(store.list().selected_model_id, expected);
        assert_eq!(
            store.list().management_error.as_deref(),
            Some("Failed to resolve app data directory")
        );
    }
}

#[test]
fn invalid_saved_id_is_repaired_after_system_becomes_active() {
    let data_dir = temp_data_dir();
    std::fs::create_dir_all(&data_dir).unwrap();
    std::fs::write(
        data_dir.join("core-ai-selection.json"),
        r#"{"selectedModelId":"apple:core-ai:removed"}"#,
    )
    .unwrap();
    let helper = store_without_helper();
    let store = CoreAiModelStore::default();
    store.configure(Ok(data_dir.clone()), &helper, None);
    assert_eq!(helper.selected_model_id().unwrap(), SYSTEM_MODEL_ID);
    assert!(store.list().management_error.is_none());
    assert!(
        std::fs::read_to_string(data_dir.join("core-ai-selection.json"))
            .unwrap()
            .contains(SYSTEM_MODEL_ID)
    );
    std::fs::remove_dir_all(data_dir).unwrap();
}

#[test]
fn unreadable_or_malformed_selection_is_reported_without_aborting_startup() {
    for unreadable in [true, false] {
        let data_dir = temp_data_dir();
        std::fs::create_dir_all(&data_dir).unwrap();
        let path = data_dir.join("core-ai-selection.json");
        if unreadable {
            std::fs::create_dir(path).unwrap();
        } else {
            std::fs::write(path, "invalid json").unwrap();
        }
        let helper = store_without_helper();
        let store = CoreAiModelStore::default();
        let (): () = store.configure(Ok(data_dir.clone()), &helper, None);
        assert!(store
            .list()
            .management_error
            .unwrap()
            .contains(if unreadable {
                "Failed to read"
            } else {
                "Failed to decode"
            }));
        assert_eq!(helper.selected_model_id().unwrap(), SYSTEM_MODEL_ID);
        std::fs::remove_dir_all(data_dir).unwrap();
    }
}

#[test]
fn pending_generation_rejects_selection_without_writing_preferences() {
    let data_dir = temp_data_dir();
    create_ready_fixture(&data_dir, "ready");
    let helper = store_without_helper();
    let store = CoreAiModelStore::with_fixture_catalog(vec![CoreAiCatalogEntry::fixture(
        "apple:core-ai:ready",
        "Ready",
        "ready",
    )]);
    store.configure(Ok(data_dir.clone()), &helper, None);
    store.select(SYSTEM_MODEL_ID, &helper).unwrap();
    let saved = std::fs::read(data_dir.join("core-ai-selection.json")).unwrap();
    helper.prepare_stream_request("pending").unwrap();
    assert!(store.select("apple:core-ai:ready", &helper).is_err());
    assert_eq!(helper.selected_model_id().unwrap(), SYSTEM_MODEL_ID);
    assert_eq!(store.list().selected_model_id, SYSTEM_MODEL_ID);
    assert_eq!(
        std::fs::read(data_dir.join("core-ai-selection.json")).unwrap(),
        saved
    );
    helper.finish_stream_request("pending");
    std::fs::remove_dir_all(data_dir).unwrap();
}

#[test]
fn absent_override_restores_normally_but_invalid_developer_override_fails_closed() {
    assert!(AssistBackendSelection::developer_override_for_lane(
        Some("developer"),
        Err(std::env::VarError::NotPresent),
    )
    .is_none());
    let data_dir = temp_data_dir();
    let helper = store_without_helper();
    let store = CoreAiModelStore::default();
    let invalid =
        AssistBackendSelection::developer_override_for_lane(Some("developer"), Ok("typo".into()));
    let (): () = store.configure(Ok(data_dir.clone()), &helper, invalid);
    assert!(helper.selected_model_id().is_err());
    assert!(store
        .list()
        .management_error
        .unwrap()
        .contains("Unsupported Local Assist test backend"));
    assert!(store.list().selection_locked);
    assert!(!data_dir.exists());
}
