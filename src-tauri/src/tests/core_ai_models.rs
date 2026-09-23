use crate::commands::apple_assist_supervisor::{store_without_helper, AssistBackendSelection};
use crate::commands::background_assets::{
    BackgroundAssetSnapshot, BackgroundAssetTransport, LocalPreviewBackgroundAssetTransport,
    LOCAL_PREVIEW_ASSET_ERROR,
};
use crate::commands::core_ai_models::{
    CoreAiCatalogEntry, CoreAiDistributionStatus, CoreAiModelKind, CoreAiModelSource,
    CoreAiModelStatus, CoreAiModelStore, SYSTEM_MODEL_ID,
};
use std::collections::VecDeque;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Arc, Mutex};

static NEXT_TEMP_ID: AtomicU64 = AtomicU64::new(0);

#[test]
fn local_preview_does_not_enter_apple_hosted_asset_transport() {
    let transport = LocalPreviewBackgroundAssetTransport;
    let snapshot = transport
        .snapshot("com.example.model", "CoreAIModels/model")
        .expect("preview snapshot");
    assert!(!snapshot.supported);
    assert!(!snapshot.available);
    assert_eq!(snapshot.phase, "unsupported");
    assert_eq!(snapshot.error.as_deref(), Some(LOCAL_PREVIEW_ASSET_ERROR));
    assert_eq!(
        transport.start("com.example.model"),
        Err(LOCAL_PREVIEW_ASSET_ERROR.into())
    );
    assert_eq!(
        transport.cancel("com.example.model"),
        Err(LOCAL_PREVIEW_ASSET_ERROR.into())
    );
    assert_eq!(
        transport.remove("com.example.model"),
        Err(LOCAL_PREVIEW_ASSET_ERROR.into())
    );
}

fn fixture_manifest_digest(data: &[u8]) -> String {
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    data.hash(&mut hasher);
    format!("{:064x}", hasher.finish())
}

const TEST_PUBLISHED_MODEL_ID: &str = "apple:core-ai:test-pack";
const TEST_RESOURCE_MANIFEST: &str = r#"{
  "schemaVersion": 1,
  "modelId": "apple:core-ai:test-pack",
  "catalogVersion": "test-v1",
  "storageDirectory": "test-pack",
  "expandedBytes": 5,
  "maxExpandedBytes": 1024,
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
    remove_error: Option<String>,
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
        self.remove_error.clone().map_or(Ok(()), Err)
    }

    fn sha256_file(&self, path: &Path) -> Result<String, String> {
        let data = std::fs::read(path).map_err(|error| error.to_string())?;
        if path
            .file_name()
            .is_some_and(|name| name == "hazakura-resource-manifest.json")
        {
            return Ok(fixture_manifest_digest(&data));
        }
        if data == b"hello" {
            Ok("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824".into())
        } else {
            Ok("corrupt".into())
        }
    }
}

struct SequencedFixtureTransport {
    snapshots: Mutex<VecDeque<BackgroundAssetSnapshot>>,
}

struct BlockingOldSnapshotTransport {
    root: PathBuf,
    calls: AtomicU64,
    old_entered: Sender<()>,
    release_old: Mutex<Receiver<()>>,
}

impl BackgroundAssetTransport for BlockingOldSnapshotTransport {
    fn snapshot(
        &self,
        _asset_pack_id: &str,
        _relative_path: &str,
    ) -> Result<BackgroundAssetSnapshot, String> {
        if self.calls.fetch_add(1, Ordering::SeqCst) == 0 {
            self.old_entered.send(()).unwrap();
            self.release_old.lock().unwrap().recv().unwrap();
            return Ok(BackgroundAssetSnapshot {
                supported: true,
                available: false,
                phase: "failed".into(),
                progress: None,
                path: None,
                error: Some("old snapshot".into()),
                asset_pack_version: Some(1),
            });
        }
        Ok(BackgroundAssetSnapshot {
            supported: true,
            available: true,
            phase: "downloaded".into(),
            progress: Some(1.0),
            path: Some(self.root.clone()),
            error: None,
            asset_pack_version: Some(2),
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
        PublishedFixtureTransport {
            root: self.root.clone(),
            remove_error: None,
        }
        .sha256_file(path)
    }
}

struct RecoveryFixtureTransport {
    bad_root: PathBuf,
    good_root: PathBuf,
    lifecycle: Mutex<(u8, Vec<&'static str>)>,
}

struct VersionedFixtureTransport {
    root: PathBuf,
    version: AtomicU64,
    payload_hashes: AtomicU64,
}

impl BackgroundAssetTransport for VersionedFixtureTransport {
    fn snapshot(
        &self,
        _asset_pack_id: &str,
        _relative_path: &str,
    ) -> Result<BackgroundAssetSnapshot, String> {
        Ok(BackgroundAssetSnapshot {
            supported: true,
            available: true,
            phase: "downloaded".into(),
            progress: None,
            path: Some(self.root.clone()),
            error: None,
            asset_pack_version: Some(self.version.load(Ordering::SeqCst)),
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
        if path.file_name().is_some_and(|name| name == "model.bin") {
            self.payload_hashes.fetch_add(1, Ordering::SeqCst);
        }
        PublishedFixtureTransport {
            root: self.root.clone(),
            remove_error: None,
        }
        .sha256_file(path)
    }
}

impl BackgroundAssetTransport for RecoveryFixtureTransport {
    fn snapshot(
        &self,
        _asset_pack_id: &str,
        _relative_path: &str,
    ) -> Result<BackgroundAssetSnapshot, String> {
        let stage = self.lifecycle.lock().unwrap().0;
        Ok(BackgroundAssetSnapshot {
            supported: true,
            available: stage != 1,
            phase: if stage == 1 {
                "not_downloaded"
            } else {
                "downloaded"
            }
            .into(),
            progress: None,
            path: match stage {
                0 => Some(self.bad_root.clone()),
                2 => Some(self.good_root.clone()),
                _ => None,
            },
            error: None,
            asset_pack_version: Some(2),
        })
    }
    fn start(&self, _asset_pack_id: &str) -> Result<(), String> {
        let mut lifecycle = self.lifecycle.lock().unwrap();
        assert_eq!(
            lifecycle.0, 1,
            "asset must be removed before recovery download"
        );
        lifecycle.1.push("start");
        lifecycle.0 = 2;
        Ok(())
    }
    fn cancel(&self, _asset_pack_id: &str) -> Result<bool, String> {
        Ok(true)
    }
    fn remove(&self, _asset_pack_id: &str) -> Result<(), String> {
        let mut lifecycle = self.lifecycle.lock().unwrap();
        lifecycle.1.push("remove");
        lifecycle.0 = 1;
        Ok(())
    }
    fn sha256_file(&self, path: &Path) -> Result<String, String> {
        PublishedFixtureTransport {
            root: self.good_root.clone(),
            remove_error: None,
        }
        .sha256_file(path)
    }
}

impl BackgroundAssetTransport for SequencedFixtureTransport {
    fn snapshot(
        &self,
        _asset_pack_id: &str,
        _relative_path: &str,
    ) -> Result<BackgroundAssetSnapshot, String> {
        self.snapshots
            .lock()
            .expect("snapshot sequence lock")
            .pop_front()
            .ok_or_else(|| "snapshot sequence exhausted".into())
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
        let data = std::fs::read(path).map_err(|error| error.to_string())?;
        if path
            .file_name()
            .is_some_and(|name| name == "hazakura-resource-manifest.json")
        {
            return Ok(fixture_manifest_digest(&data));
        }
        if data == b"hello" {
            Ok("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824".into())
        } else {
            Ok("corrupt".into())
        }
    }
}

fn temp_data_dir() -> std::path::PathBuf {
    std::env::temp_dir().join(format!(
        "hazakura-core-ai-model-store-{}-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("clock")
            .as_nanos(),
        NEXT_TEMP_ID.fetch_add(1, Ordering::Relaxed),
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
fn app_store_catalog_offers_only_twelve_b_for_explicit_download() {
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
    assert_eq!(app_store.models.len(), 2);
    assert_eq!(
        app_store.models[1].id,
        "apple:core-ai:gemma-4-12b-it-int8-v1"
    );
    assert_eq!(app_store.models[1].display_name, "Gemma 4 12B");
    assert_eq!(app_store.models[1].status, CoreAiModelStatus::NotDownloaded);
    assert_eq!(app_store.models[1].minimum_memory_gb, Some(16));
    assert_eq!(app_store.models[1].recommended_memory_gb, Some(24));
    assert_eq!(app_store.models[1].download_size_bytes, Some(9_148_924_300));
    assert_eq!(
        app_store.models[1].installed_size_bytes,
        Some(14_698_433_203)
    );
    assert_eq!(app_store.models[1].license, Some("Apache-2.0".into()));
    assert!(app_store.models[1].has_upstream_conversion_notice);
}

#[test]
fn twelve_b_uses_system_until_pack_is_verified_and_retains_restore_intent() {
    let data_dir = temp_data_dir();
    std::fs::create_dir_all(&data_dir).unwrap();
    let model_id = "apple:core-ai:gemma-4-12b-it-int8-v1";
    std::fs::write(
        data_dir.join("core-ai-selection.json"),
        format!(r#"{{"selectedModelId":"{model_id}"}}"#),
    )
    .unwrap();

    let helper = store_without_helper();
    let store = CoreAiModelStore::production_catalog_for_lane(true);
    store.configure(Ok(data_dir.clone()), &helper, None);

    assert_eq!(store.list().selected_model_id, SYSTEM_MODEL_ID);
    assert_eq!(helper.selected_model_id().unwrap(), SYSTEM_MODEL_ID);
    let persisted: serde_json::Value =
        serde_json::from_slice(&std::fs::read(data_dir.join("core-ai-selection.json")).unwrap())
            .unwrap();
    assert_eq!(persisted["selectedModelId"], model_id);
    std::fs::remove_dir_all(data_dir).unwrap();
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
            )],
            Arc::new(PublishedFixtureTransport {
                root,
                remove_error: None,
            }),
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
fn compatible_pack_update_can_change_manifest_without_rebuilding_the_app() {
    let data_dir = temp_data_dir();
    let root = data_dir.join("materialized-test-pack");
    std::fs::create_dir_all(&root).unwrap();
    let updated_manifest = TEST_RESOURCE_MANIFEST.replace("test-v1", "test-v2");
    std::fs::write(
        root.join("hazakura-resource-manifest.json"),
        updated_manifest,
    )
    .unwrap();
    std::fs::write(root.join("model.bin"), b"hello").unwrap();
    let helper = store_without_helper();
    let store = CoreAiModelStore::with_test_transport(
        vec![CoreAiCatalogEntry::published_fixture(
            TEST_PUBLISHED_MODEL_ID,
            "test-pack",
        )],
        Arc::new(PublishedFixtureTransport {
            root,
            remove_error: None,
        }),
    );
    store.configure(Ok(data_dir.clone()), &helper, None);

    assert_eq!(
        store
            .refresh_model_for_test(TEST_PUBLISHED_MODEL_ID)
            .unwrap(),
        CoreAiModelStatus::Ready
    );
    std::fs::remove_dir_all(data_dir).unwrap();
}

#[test]
fn updated_pack_manifest_still_rejects_incompatible_identity_and_wrong_file_digest() {
    let cases = [
        (
            TEST_RESOURCE_MANIFEST.replace(TEST_PUBLISHED_MODEL_ID, "apple:core-ai:other-pack"),
            "incompatible",
        ),
        (
            TEST_RESOURCE_MANIFEST.replace("model.bin", "../model.bin"),
            "unsafe path",
        ),
        (
            TEST_RESOURCE_MANIFEST.replace(
                "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
                "486ea46224d1bb4fb680f34f7c9ad96a8f24ec88be73c78a3716d63063fe2889",
            ),
            "SHA-256 mismatch",
        ),
    ];
    for (manifest, expected_error) in cases {
        let data_dir = temp_data_dir();
        let root = data_dir.join("materialized-test-pack");
        std::fs::create_dir_all(&root).unwrap();
        std::fs::write(root.join("hazakura-resource-manifest.json"), manifest).unwrap();
        std::fs::write(root.join("model.bin"), b"hello").unwrap();
        let helper = store_without_helper();
        let store = CoreAiModelStore::with_test_transport(
            vec![CoreAiCatalogEntry::published_fixture(
                TEST_PUBLISHED_MODEL_ID,
                "test-pack",
            )],
            Arc::new(PublishedFixtureTransport {
                root,
                remove_error: None,
            }),
        );
        store.configure(Ok(data_dir.clone()), &helper, None);
        let error = store
            .refresh_model_for_test(TEST_PUBLISHED_MODEL_ID)
            .unwrap_err();
        assert!(error.contains(expected_error), "{error}");
        assert_eq!(store.list().models[1].status, CoreAiModelStatus::Failed);
        std::fs::remove_dir_all(data_dir).unwrap();
    }
}

#[test]
fn a_new_pack_manifest_invalidates_the_old_validation_receipt() {
    let data_dir = temp_data_dir();
    let root = data_dir.join("materialized-test-pack");
    std::fs::create_dir_all(&root).unwrap();
    std::fs::write(
        root.join("hazakura-resource-manifest.json"),
        TEST_RESOURCE_MANIFEST,
    )
    .unwrap();
    std::fs::write(root.join("model.bin"), b"hello").unwrap();
    let helper = store_without_helper();
    let store = CoreAiModelStore::with_test_transport(
        vec![CoreAiCatalogEntry::published_fixture(
            TEST_PUBLISHED_MODEL_ID,
            "test-pack",
        )],
        Arc::new(PublishedFixtureTransport {
            root: root.clone(),
            remove_error: None,
        }),
    );
    store.configure(Ok(data_dir.clone()), &helper, None);
    store
        .refresh_model_for_test(TEST_PUBLISHED_MODEL_ID)
        .unwrap();

    let updated_manifest = TEST_RESOURCE_MANIFEST
        .replace("test-v1", "test-v2")
        .replace(
            "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
            "486ea46224d1bb4fb680f34f7c9ad96a8f24ec88be73c78a3716d63063fe2889",
        );
    std::fs::write(
        root.join("hazakura-resource-manifest.json"),
        updated_manifest,
    )
    .unwrap();
    let error = store
        .refresh_model_for_test(TEST_PUBLISHED_MODEL_ID)
        .unwrap_err();
    assert!(error.contains("SHA-256 mismatch"), "{error}");
    std::fs::remove_dir_all(data_dir).unwrap();
}

#[test]
fn same_size_payload_replacement_with_restored_mtime_invalidates_receipt() {
    let data_dir = temp_data_dir();
    let root = data_dir.join("materialized-test-pack");
    std::fs::create_dir_all(&root).unwrap();
    std::fs::write(
        root.join("hazakura-resource-manifest.json"),
        TEST_RESOURCE_MANIFEST,
    )
    .unwrap();
    let payload = root.join("model.bin");
    std::fs::write(&payload, b"hello").unwrap();
    let helper = store_without_helper();
    let store = CoreAiModelStore::with_test_transport(
        vec![CoreAiCatalogEntry::published_fixture(
            TEST_PUBLISHED_MODEL_ID,
            "test-pack",
        )],
        Arc::new(PublishedFixtureTransport {
            root: root.clone(),
            remove_error: None,
        }),
    );
    store.configure(Ok(data_dir.clone()), &helper, None);
    assert_eq!(
        store
            .refresh_model_for_test(TEST_PUBLISHED_MODEL_ID)
            .unwrap(),
        CoreAiModelStatus::Ready
    );

    let original_mtime = std::fs::metadata(&payload).unwrap().modified().unwrap();
    std::fs::write(&payload, b"other").unwrap();
    std::fs::File::options()
        .write(true)
        .open(&payload)
        .unwrap()
        .set_times(std::fs::FileTimes::new().set_modified(original_mtime))
        .unwrap();
    let error = store
        .refresh_model_for_test(TEST_PUBLISHED_MODEL_ID)
        .unwrap_err();
    assert!(error.contains("SHA-256 mismatch"), "{error}");
    assert_eq!(store.list().models[1].status, CoreAiModelStatus::Failed);
    std::fs::remove_dir_all(data_dir).unwrap();
}

#[test]
fn changed_asset_pack_version_rehashes_even_when_manifest_and_files_are_unchanged() {
    let data_dir = temp_data_dir();
    let root = data_dir.join("materialized-test-pack");
    std::fs::create_dir_all(&root).unwrap();
    std::fs::write(
        root.join("hazakura-resource-manifest.json"),
        TEST_RESOURCE_MANIFEST,
    )
    .unwrap();
    std::fs::write(root.join("model.bin"), b"hello").unwrap();
    let transport = Arc::new(VersionedFixtureTransport {
        root,
        version: AtomicU64::new(1),
        payload_hashes: AtomicU64::new(0),
    });
    let helper = store_without_helper();
    let store = CoreAiModelStore::with_test_transport(
        vec![CoreAiCatalogEntry::published_fixture(
            TEST_PUBLISHED_MODEL_ID,
            "test-pack",
        )],
        transport.clone(),
    );
    store.configure(Ok(data_dir.clone()), &helper, None);
    for _ in 0..2 {
        assert_eq!(
            store
                .refresh_model_for_test(TEST_PUBLISHED_MODEL_ID)
                .unwrap(),
            CoreAiModelStatus::Ready
        );
    }
    assert_eq!(transport.payload_hashes.load(Ordering::SeqCst), 1);
    transport.version.store(2, Ordering::SeqCst);
    assert_eq!(
        store
            .refresh_model_for_test(TEST_PUBLISHED_MODEL_ID)
            .unwrap(),
        CoreAiModelStatus::Ready
    );
    assert_eq!(transport.payload_hashes.load(Ordering::SeqCst), 2);
    std::fs::remove_dir_all(data_dir).unwrap();
}

#[test]
fn pack_rejects_payload_files_not_covered_by_its_manifest() {
    let data_dir = temp_data_dir();
    let root = data_dir.join("materialized-test-pack");
    std::fs::create_dir_all(&root).unwrap();
    std::fs::write(
        root.join("hazakura-resource-manifest.json"),
        TEST_RESOURCE_MANIFEST,
    )
    .unwrap();
    std::fs::write(root.join("model.bin"), b"hello").unwrap();
    std::fs::write(root.join("extra.bin"), b"extra").unwrap();
    let helper = store_without_helper();
    let store = CoreAiModelStore::with_test_transport(
        vec![CoreAiCatalogEntry::published_fixture(
            TEST_PUBLISHED_MODEL_ID,
            "test-pack",
        )],
        Arc::new(PublishedFixtureTransport {
            root,
            remove_error: None,
        }),
    );
    store.configure(Ok(data_dir.clone()), &helper, None);
    let error = store
        .refresh_model_for_test(TEST_PUBLISHED_MODEL_ID)
        .unwrap_err();
    assert!(error.contains("unlisted file"), "{error}");
    std::fs::remove_dir_all(data_dir).unwrap();
}

#[test]
fn update_waits_for_latest_pack_even_while_an_older_version_is_available() {
    let data_dir = temp_data_dir();
    let old_root = data_dir.join("old-pack");
    let new_root = data_dir.join("new-pack");
    std::fs::create_dir_all(&old_root).unwrap();
    std::fs::create_dir_all(&new_root).unwrap();
    std::fs::write(old_root.join("hazakura-resource-manifest.json"), "{}").unwrap();
    std::fs::write(
        new_root.join("hazakura-resource-manifest.json"),
        TEST_RESOURCE_MANIFEST,
    )
    .unwrap();
    std::fs::write(new_root.join("model.bin"), b"hello").unwrap();
    let snapshots = VecDeque::from([
        BackgroundAssetSnapshot {
            supported: true,
            available: true,
            phase: "downloading".into(),
            progress: Some(0.3),
            path: Some(old_root),
            error: None,
            asset_pack_version: Some(2),
        },
        BackgroundAssetSnapshot {
            supported: true,
            available: true,
            phase: "downloaded".into(),
            progress: Some(1.0),
            path: Some(new_root),
            error: None,
            asset_pack_version: Some(2),
        },
    ]);
    let helper = store_without_helper();
    let store = CoreAiModelStore::with_test_transport(
        vec![CoreAiCatalogEntry::published_fixture(
            TEST_PUBLISHED_MODEL_ID,
            "test-pack",
        )],
        Arc::new(SequencedFixtureTransport {
            snapshots: Mutex::new(snapshots),
        }),
    );
    store.configure(Ok(data_dir.clone()), &helper, None);

    assert_eq!(
        store
            .refresh_model_for_test(TEST_PUBLISHED_MODEL_ID)
            .unwrap(),
        CoreAiModelStatus::Downloading
    );
    assert_eq!(store.list().models[1].asset_pack_version, Some(2));
    assert_eq!(
        store
            .refresh_model_for_test(TEST_PUBLISHED_MODEL_ID)
            .unwrap(),
        CoreAiModelStatus::Ready
    );
    std::fs::remove_dir_all(data_dir).unwrap();
}

#[test]
fn selected_model_switches_its_helper_backend_after_a_new_pack_is_verified() {
    let data_dir = temp_data_dir();
    let old_root = data_dir.join("old-pack");
    let new_root = data_dir.join("new-pack");
    for root in [&old_root, &new_root] {
        std::fs::create_dir_all(root).unwrap();
        std::fs::write(
            root.join("hazakura-resource-manifest.json"),
            TEST_RESOURCE_MANIFEST,
        )
        .unwrap();
        std::fs::write(root.join("model.bin"), b"hello").unwrap();
    }
    let snapshots = [(&old_root, 1), (&new_root, 2)]
        .into_iter()
        .map(|(root, version)| BackgroundAssetSnapshot {
            supported: true,
            available: true,
            phase: "downloaded".into(),
            progress: Some(1.0),
            path: Some(root.clone()),
            error: None,
            asset_pack_version: Some(version),
        })
        .collect();
    let helper = store_without_helper();
    let store = CoreAiModelStore::with_test_transport(
        vec![CoreAiCatalogEntry::published_fixture(
            TEST_PUBLISHED_MODEL_ID,
            "test-pack",
        )],
        Arc::new(SequencedFixtureTransport {
            snapshots: Mutex::new(snapshots),
        }),
    );
    store.configure(Ok(data_dir.clone()), &helper, None);
    store
        .refresh_model_for_test(TEST_PUBLISHED_MODEL_ID)
        .unwrap();
    store.select(TEST_PUBLISHED_MODEL_ID, &helper).unwrap();
    assert_eq!(
        helper.selected_backend_for_restore(),
        AssistBackendSelection::CoreAi {
            model_id: TEST_PUBLISHED_MODEL_ID.into(),
            model_path: old_root.clone(),
        }
    );

    store
        .refresh_model_for_test(TEST_PUBLISHED_MODEL_ID)
        .unwrap();
    helper.prepare_stream_request("updating-model").unwrap();
    assert!(store
        .sync_ready_selection_for_test(TEST_PUBLISHED_MODEL_ID, &helper)
        .is_err());
    assert_eq!(
        helper.selected_backend_for_restore(),
        AssistBackendSelection::CoreAi {
            model_id: TEST_PUBLISHED_MODEL_ID.into(),
            model_path: old_root.clone(),
        }
    );
    helper.finish_stream_request("updating-model");
    store
        .sync_ready_selection_for_test(TEST_PUBLISHED_MODEL_ID, &helper)
        .unwrap();
    assert_eq!(
        helper.selected_backend_for_restore(),
        AssistBackendSelection::CoreAi {
            model_id: TEST_PUBLISHED_MODEL_ID.into(),
            model_path: new_root,
        }
    );
    std::fs::remove_dir_all(data_dir).unwrap();
}

#[test]
fn ready_pack_can_check_for_a_new_asset_version_on_explicit_request() {
    let data_dir = temp_data_dir();
    let root = data_dir.join("materialized-test-pack");
    std::fs::create_dir_all(&root).unwrap();
    std::fs::write(
        root.join("hazakura-resource-manifest.json"),
        TEST_RESOURCE_MANIFEST,
    )
    .unwrap();
    std::fs::write(root.join("model.bin"), b"hello").unwrap();
    let helper = store_without_helper();
    let store = CoreAiModelStore::with_test_transport(
        vec![CoreAiCatalogEntry::published_fixture(
            TEST_PUBLISHED_MODEL_ID,
            "test-pack",
        )],
        Arc::new(PublishedFixtureTransport {
            root,
            remove_error: None,
        }),
    );
    store.configure(Ok(data_dir.clone()), &helper, None);
    store
        .refresh_model_for_test(TEST_PUBLISHED_MODEL_ID)
        .unwrap();
    assert_eq!(store.list().models[1].status, CoreAiModelStatus::Ready);

    let response = store.start_download(TEST_PUBLISHED_MODEL_ID).unwrap();
    assert_eq!(response.models[1].status, CoreAiModelStatus::Downloading);
    std::fs::remove_dir_all(data_dir).unwrap();
}

#[test]
fn failed_removal_restores_selected_model_in_helper_store_and_preferences() {
    let data_dir = temp_data_dir();
    let root = data_dir.join("materialized-test-pack");
    std::fs::create_dir_all(&root).unwrap();
    std::fs::write(
        root.join("hazakura-resource-manifest.json"),
        TEST_RESOURCE_MANIFEST,
    )
    .unwrap();
    std::fs::write(root.join("model.bin"), b"hello").unwrap();
    let helper = store_without_helper();
    let store = CoreAiModelStore::with_test_transport(
        vec![CoreAiCatalogEntry::published_fixture(
            TEST_PUBLISHED_MODEL_ID,
            "test-pack",
        )],
        Arc::new(PublishedFixtureTransport {
            root,
            remove_error: Some("fixture removal failed".into()),
        }),
    );
    store.configure(Ok(data_dir.clone()), &helper, None);
    store
        .refresh_model_for_test(TEST_PUBLISHED_MODEL_ID)
        .expect("ready fixture");
    store
        .select(TEST_PUBLISHED_MODEL_ID, &helper)
        .expect("select fixture");

    let error = store
        .delete(TEST_PUBLISHED_MODEL_ID, &helper)
        .expect_err("remove must fail");
    assert!(error.contains("fixture removal failed"));
    assert_eq!(store.list().selected_model_id, TEST_PUBLISHED_MODEL_ID);
    assert_eq!(helper.selected_model_id().unwrap(), TEST_PUBLISHED_MODEL_ID);
    assert!(
        std::fs::read_to_string(data_dir.join("core-ai-selection.json"))
            .unwrap()
            .contains(TEST_PUBLISHED_MODEL_ID)
    );
    std::fs::remove_dir_all(data_dir).unwrap();
}

#[test]
fn failed_removal_restores_selected_backend_after_pack_verification_fails() {
    let data_dir = temp_data_dir();
    let root = data_dir.join("materialized-test-pack");
    std::fs::create_dir_all(&root).unwrap();
    std::fs::write(
        root.join("hazakura-resource-manifest.json"),
        TEST_RESOURCE_MANIFEST,
    )
    .unwrap();
    std::fs::write(root.join("model.bin"), b"hello").unwrap();
    let helper = store_without_helper();
    let store = CoreAiModelStore::with_test_transport(
        vec![CoreAiCatalogEntry::published_fixture(
            TEST_PUBLISHED_MODEL_ID,
            "test-pack",
        )],
        Arc::new(PublishedFixtureTransport {
            root: root.clone(),
            remove_error: Some("fixture removal failed".into()),
        }),
    );
    store.configure(Ok(data_dir.clone()), &helper, None);
    store
        .refresh_model_for_test(TEST_PUBLISHED_MODEL_ID)
        .unwrap();
    store.select(TEST_PUBLISHED_MODEL_ID, &helper).unwrap();

    std::fs::write(root.join("model.bin"), b"other").unwrap();
    assert!(store
        .refresh_model_for_test(TEST_PUBLISHED_MODEL_ID)
        .is_err());
    assert_eq!(store.list().models[1].status, CoreAiModelStatus::Failed);
    assert!(store.delete(TEST_PUBLISHED_MODEL_ID, &helper).is_err());
    assert_eq!(store.list().selected_model_id, TEST_PUBLISHED_MODEL_ID);
    assert_eq!(helper.selected_model_id().unwrap(), TEST_PUBLISHED_MODEL_ID);
    std::fs::remove_dir_all(data_dir).unwrap();
}

#[test]
fn verification_failure_can_remove_then_start_and_reverify_apple_asset() {
    let data_dir = temp_data_dir();
    let bad_root = data_dir.join("bad-pack");
    let good_root = data_dir.join("good-pack");
    for (root, contents) in [
        (&bad_root, b"other".as_slice()),
        (&good_root, b"hello".as_slice()),
    ] {
        std::fs::create_dir_all(root).unwrap();
        std::fs::write(
            root.join("hazakura-resource-manifest.json"),
            TEST_RESOURCE_MANIFEST,
        )
        .unwrap();
        std::fs::write(root.join("model.bin"), contents).unwrap();
    }
    let transport = Arc::new(RecoveryFixtureTransport {
        bad_root,
        good_root,
        lifecycle: Mutex::new((0, Vec::new())),
    });
    let helper = store_without_helper();
    let store = CoreAiModelStore::with_test_transport(
        vec![CoreAiCatalogEntry::published_fixture(
            TEST_PUBLISHED_MODEL_ID,
            "test-pack",
        )],
        transport.clone(),
    );
    store.configure(Ok(data_dir.clone()), &helper, None);

    assert!(store
        .refresh_model_for_test(TEST_PUBLISHED_MODEL_ID)
        .unwrap_err()
        .contains("SHA-256 mismatch"));
    let failed = &store.list().models[1];
    assert!(failed.can_remove);
    assert_eq!(failed.error_code.as_deref(), Some("verification-failed"));
    let removed = store.delete(TEST_PUBLISHED_MODEL_ID, &helper).unwrap();
    assert_eq!(removed.models[1].status, CoreAiModelStatus::NotDownloaded);
    assert!(!removed.models[1].can_remove);
    assert!(!data_dir.join("core-ai-validation/test-pack.json").exists());
    assert_eq!(
        store
            .start_download(TEST_PUBLISHED_MODEL_ID)
            .unwrap()
            .models[1]
            .status,
        CoreAiModelStatus::Downloading
    );
    assert_eq!(
        store
            .refresh_model_for_test(TEST_PUBLISHED_MODEL_ID)
            .unwrap(),
        CoreAiModelStatus::Ready
    );
    assert_eq!(store.list().models[1].error_code, None);
    assert_eq!(transport.lifecycle.lock().unwrap().1, ["remove", "start"]);
    std::fs::remove_dir_all(data_dir).unwrap();
}

#[test]
fn paused_monitor_remains_live_at_a_lower_polling_rate() {
    use crate::commands::core_ai_models::{monitor_is_terminal, monitor_poll_interval};
    assert!(!monitor_is_terminal(CoreAiModelStatus::Downloading));
    assert!(!monitor_is_terminal(CoreAiModelStatus::Paused));
    assert!(monitor_is_terminal(CoreAiModelStatus::Ready));
    assert!(
        monitor_poll_interval(CoreAiModelStatus::Paused)
            > monitor_poll_interval(CoreAiModelStatus::Downloading)
    );
}

#[test]
fn stale_monitor_cannot_roll_back_new_ready_state_or_selection_restore() {
    let data_dir = temp_data_dir();
    let root = data_dir.join("materialized-test-pack");
    std::fs::create_dir_all(&root).unwrap();
    std::fs::write(
        root.join("hazakura-resource-manifest.json"),
        TEST_RESOURCE_MANIFEST,
    )
    .unwrap();
    std::fs::write(root.join("model.bin"), b"hello").unwrap();
    std::fs::write(
        data_dir.join("core-ai-selection.json"),
        format!(r#"{{"selectedModelId":"{TEST_PUBLISHED_MODEL_ID}"}}"#),
    )
    .unwrap();
    let (entered_tx, entered_rx) = mpsc::channel();
    let (release_tx, release_rx) = mpsc::channel();
    let transport = Arc::new(BlockingOldSnapshotTransport {
        root,
        calls: AtomicU64::new(0),
        old_entered: entered_tx,
        release_old: Mutex::new(release_rx),
    });
    let helper = Arc::new(store_without_helper());
    let store = Arc::new(CoreAiModelStore::with_test_transport(
        vec![CoreAiCatalogEntry::published_fixture(
            TEST_PUBLISHED_MODEL_ID,
            "test-pack",
        )],
        transport,
    ));
    store.configure(Ok(data_dir.clone()), &helper, None);
    let old_generation = store.next_monitor_generation_for_test(TEST_PUBLISHED_MODEL_ID);
    let old_store = store.clone();
    let old_helper = helper.clone();
    let old = std::thread::spawn(move || {
        old_store.refresh_monitored_for_test(TEST_PUBLISHED_MODEL_ID, old_generation, &old_helper)
    });
    entered_rx
        .recv_timeout(std::time::Duration::from_secs(5))
        .unwrap();

    let new_generation = store.next_monitor_generation_for_test(TEST_PUBLISHED_MODEL_ID);
    assert_eq!(
        store.refresh_monitored_for_test(TEST_PUBLISHED_MODEL_ID, new_generation, &helper),
        Some((CoreAiModelStatus::Ready, true))
    );
    release_tx.send(()).unwrap();
    assert_eq!(old.join().unwrap(), None);
    assert_eq!(store.list().models[1].status, CoreAiModelStatus::Ready);
    assert_eq!(store.list().selected_model_id, TEST_PUBLISHED_MODEL_ID);
    assert_eq!(helper.selected_model_id().unwrap(), TEST_PUBLISHED_MODEL_ID);
    std::fs::remove_dir_all(data_dir).unwrap();
}

#[test]
fn paused_asset_can_resume_and_become_ready_without_a_ui_resume_action() {
    use crate::commands::core_ai_models::monitor_is_terminal;
    let data_dir = temp_data_dir();
    let root = data_dir.join("materialized-test-pack");
    std::fs::create_dir_all(&root).unwrap();
    std::fs::write(
        root.join("hazakura-resource-manifest.json"),
        TEST_RESOURCE_MANIFEST,
    )
    .unwrap();
    std::fs::write(root.join("model.bin"), b"hello").unwrap();
    let snapshot = |phase: &str, available: bool, path: Option<PathBuf>| BackgroundAssetSnapshot {
        supported: true,
        available,
        phase: phase.into(),
        progress: None,
        path,
        error: None,
        asset_pack_version: Some(1),
    };
    let transport = SequencedFixtureTransport {
        snapshots: Mutex::new(VecDeque::from([
            snapshot("downloading", false, None),
            snapshot("paused", false, None),
            snapshot("downloading", false, None),
            snapshot("downloaded", true, Some(root)),
        ])),
    };
    let helper = store_without_helper();
    let store = CoreAiModelStore::with_test_transport(
        vec![CoreAiCatalogEntry::published_fixture(
            TEST_PUBLISHED_MODEL_ID,
            "test-pack",
        )],
        Arc::new(transport),
    );
    store.configure(Ok(data_dir.clone()), &helper, None);

    for expected in [
        CoreAiModelStatus::Downloading,
        CoreAiModelStatus::Paused,
        CoreAiModelStatus::Downloading,
        CoreAiModelStatus::Ready,
    ] {
        let actual = store
            .refresh_model_for_test(TEST_PUBLISHED_MODEL_ID)
            .expect("refresh sequence");
        assert_eq!(actual, expected);
        assert_eq!(
            monitor_is_terminal(actual),
            actual == CoreAiModelStatus::Ready
        );
    }
    std::fs::remove_dir_all(data_dir).unwrap();
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

/// A Hazakura-described local bundle: `hazakura-model.json` plus a nested
/// language bundle. Used to check that local detection reports the declared
/// display name and keeps the Apple-hosted catalog untouched.
fn create_described_local_bundle(
    data_dir: &std::path::Path,
    directory_name: &str,
    display_name: &str,
) {
    let root = data_dir.join("CoreAICustomModels").join(directory_name);
    let bundle = root.join("bundle");
    std::fs::create_dir_all(bundle.join("local.aimodel")).unwrap();
    std::fs::create_dir_all(bundle.join("tokenizer")).unwrap();
    std::fs::write(
        root.join("hazakura-model.json"),
        format!(
            r#"{{"schemaVersion":1,"modelId":"local:custom:{directory_name}","displayName":"{display_name}","runtimeKind":"coreai-kit-language","layout":{{"bundle":"bundle"}}}}"#
        ),
    )
    .unwrap();
    std::fs::write(
        bundle.join("metadata.json"),
        r#"{"metadata_version":"0.2","kind":"llm","name":"Local fixture","assets":{"main":"local.aimodel"},"language":{"tokenizer":"local","vocab_size":1,"max_context_length":128,"embedded_tokenizer":true}}"#,
    )
    .unwrap();
    std::fs::write(bundle.join("tokenizer/tokenizer.json"), "{}").unwrap();
    for file in ["metadata.json", "main.hash", "main.mlirb"] {
        std::fs::write(bundle.join("local.aimodel").join(file), "x").unwrap();
    }
}

/// A folder that looks like a custom model but fails the local contract.
fn create_broken_local_bundle(data_dir: &std::path::Path, directory_name: &str) {
    let root = data_dir.join("CoreAICustomModels").join(directory_name);
    std::fs::create_dir_all(root.join("local.aimodel")).unwrap();
    std::fs::write(
        root.join("metadata.json"),
        r#"{"metadata_version":"0.2","kind":"llm","name":"Broken fixture","assets":{"main":"local.aimodel"},"language":{"tokenizer":"local","vocab_size":1,"max_context_length":128,"embedded_tokenizer":true}}"#,
    )
    .unwrap();
    for file in ["metadata.json", "main.hash", "main.mlirb"] {
        std::fs::write(root.join("local.aimodel").join(file), "x").unwrap();
    }
}

#[test]
fn local_custom_models_can_be_selected_and_restored_but_not_managed_as_downloads() {
    let data_dir = temp_data_dir();
    let helper = store_without_helper();
    let store = CoreAiModelStore::with_fixture_catalog(vec![CoreAiCatalogEntry::fixture(
        "apple:core-ai:fixture",
        "Fixture",
        "fixture",
    )]);
    store.configure(Ok(data_dir.clone()), &helper, None);
    create_ready_fixture(&data_dir, "fixture");
    create_described_local_bundle(&data_dir, "MyQwen", "My Qwen 3");

    let catalog = store.list();

    // System, the Apple-hosted fixture, then the detected local bundle.
    assert_eq!(catalog.models.len(), 3);
    assert_eq!(catalog.models[1].source, CoreAiModelSource::AppleHosted);
    let local = &catalog.models[2];
    // The id is namespaced by the folder, so it cannot collide with `apple:` ids.
    assert_eq!(local.id, "local:app-managed:MyQwen");
    assert_eq!(local.display_name, "My Qwen 3");
    assert_eq!(local.kind, CoreAiModelKind::CoreAi);
    assert_eq!(local.source, CoreAiModelSource::AppManagedLocal);
    assert_eq!(local.status, CoreAiModelStatus::Detected);
    assert!(!local.selected);
    assert_eq!(local.error_code, None);
    assert_eq!(local.error, None);

    // The Apple-hosted entry still behaves normally, then the local selection
    // persists only its stable id (never its absolute path).
    assert!(store.select("apple:core-ai:fixture", &helper).is_ok());
    assert!(store.select(&local.id, &helper).is_ok());
    assert_eq!(helper.selected_model_id().unwrap(), local.id);
    assert!(store.list().models[2].selected);

    let restored_helper = store_without_helper();
    let restored = CoreAiModelStore::default();
    restored.configure(Ok(data_dir.clone()), &restored_helper, None);
    assert_eq!(restored_helper.selected_model_id().unwrap(), local.id);
    assert_eq!(restored.list().selected_model_id, local.id);

    // Local models never enter the Apple-hosted asset-management path.
    assert!(store.start_download(&local.id).is_err());
    assert!(store.cancel_download(&local.id).is_err());
    assert!(store.delete(&local.id, &helper).is_err());

    // A saved local selection is revalidated on restart. If the user changes
    // the bundle into an invalid shape while the app is closed, startup falls
    // back to the System model and repairs the persisted preference.
    std::fs::remove_file(
        data_dir.join("CoreAICustomModels/MyQwen/bundle/tokenizer/tokenizer.json"),
    )
    .unwrap();
    let repaired_helper = store_without_helper();
    let repaired = CoreAiModelStore::default();
    repaired.configure(Ok(data_dir.clone()), &repaired_helper, None);
    assert_eq!(
        repaired_helper.selected_model_id().unwrap(),
        SYSTEM_MODEL_ID
    );
    assert_eq!(repaired.list().selected_model_id, SYSTEM_MODEL_ID);

    std::fs::write(
        data_dir.join("CoreAICustomModels/MyQwen/bundle/tokenizer/tokenizer.json"),
        "{}",
    )
    .unwrap();
    let confirmed_helper = store_without_helper();
    let confirmed = CoreAiModelStore::default();
    confirmed.configure(Ok(data_dir.clone()), &confirmed_helper, None);
    assert_eq!(
        confirmed_helper.selected_model_id().unwrap(),
        SYSTEM_MODEL_ID
    );

    std::fs::remove_dir_all(data_dir).unwrap();
}

#[test]
fn inaccessible_external_model_remains_visible_and_unregistration_keeps_user_files() {
    let data_dir = temp_data_dir();
    let user_folder = data_dir.join("user-owned-model");
    std::fs::create_dir_all(&user_folder).unwrap();
    std::fs::write(user_folder.join("keep.txt"), "original").unwrap();
    std::fs::write(
        data_dir.join("core-ai-external-models.json"),
        r#"[{"id":"local:external:1","displayName":"My Model","bookmark":[1,2,3]}]"#,
    )
    .unwrap();
    let helper = store_without_helper();
    let store = CoreAiModelStore::default();
    store.configure(Ok(data_dir.clone()), &helper, None);
    let external = store
        .list()
        .models
        .into_iter()
        .find(|model| model.id == "local:external:1")
        .unwrap();
    assert_eq!(external.source, CoreAiModelSource::ExternalLocal);
    assert_eq!(external.status, CoreAiModelStatus::Failed);
    assert_eq!(
        external.error_code.as_deref(),
        Some("bookmark-inaccessible")
    );
    assert!(store.select(&external.id, &helper).is_err());
    assert!(store.start_download(&external.id).is_err());
    assert!(store.delete(&external.id, &helper).is_err());
    store
        .unregister_external_model(&external.id, &helper)
        .unwrap();
    assert!(store
        .list()
        .models
        .iter()
        .all(|model| model.id != external.id));
    assert_eq!(
        std::fs::read_to_string(user_folder.join("keep.txt")).unwrap(),
        "original"
    );
}

#[test]
fn selecting_only_aimodel_does_not_claim_access_to_parent_resource_bundle() {
    let data_dir = temp_data_dir();
    let external_parent = temp_data_dir();
    create_described_local_bundle(&external_parent, "MyQwen", "My Qwen 3");
    let selected = external_parent.join("CoreAICustomModels/MyQwen/bundle/local.aimodel");
    let helper = store_without_helper();
    let store = CoreAiModelStore::default();
    store.configure(Ok(data_dir.clone()), &helper, None);
    assert_eq!(
        store.register_external_model(&selected).unwrap_err(),
        "model-bookmark:select-resource-root"
    );
    assert!(store
        .list()
        .models
        .iter()
        .all(|model| model.source != CoreAiModelSource::ExternalLocal));
    std::fs::remove_dir_all(data_dir).unwrap();
    std::fs::remove_dir_all(external_parent).unwrap();
}

#[cfg(target_os = "macos")]
#[test]
#[ignore = "requires a macOS session permitting app-scoped bookmark creation"]
fn external_model_folder_registration_deduplicates_and_restores_selection() {
    let data_dir = temp_data_dir();
    let external_parent = temp_data_dir();
    create_described_local_bundle(&external_parent, "MyQwen", "My Qwen 3");
    let root = external_parent.join("CoreAICustomModels/MyQwen");
    let helper = store_without_helper();
    let store = CoreAiModelStore::default();
    store.configure(Ok(data_dir.clone()), &helper, None);
    let first = store.register_external_model(&root).unwrap();
    let external = first
        .models
        .iter()
        .find(|model| model.source == CoreAiModelSource::ExternalLocal)
        .unwrap();
    assert_eq!(external.status, CoreAiModelStatus::Detected);
    let id = external.id.clone();
    assert_eq!(
        store.register_external_model(&root).unwrap().models.len(),
        first.models.len()
    );
    store.select(&id, &helper).unwrap();
    let restored_helper = store_without_helper();
    let restored = CoreAiModelStore::default();
    restored.configure(Ok(data_dir), &restored_helper, None);
    assert_eq!(restored.list().selected_model_id, id);
    restored
        .unregister_external_model(&id, &restored_helper)
        .unwrap();
    assert_eq!(restored.list().selected_model_id, SYSTEM_MODEL_ID);
    assert!(root.join("hazakura-model.json").is_file());
}

#[test]
fn broken_local_bundle_is_reported_with_its_contract_code() {
    let data_dir = temp_data_dir();
    let helper = store_without_helper();
    let store = CoreAiModelStore::default();
    store.configure(Ok(data_dir.clone()), &helper, None);
    create_broken_local_bundle(&data_dir, "Broken");

    let catalog = store.list();

    assert_eq!(catalog.models.len(), 2);
    let local = &catalog.models[1];
    assert_eq!(local.source, CoreAiModelSource::AppManagedLocal);
    assert_eq!(local.status, CoreAiModelStatus::Failed);
    // The frontend owns the wording; Rust only reports the contract code.
    assert_eq!(local.error_code.as_deref(), Some("missing-tokenizer"));
    assert_eq!(local.error, None);
    assert!(store.select(&local.id, &helper).is_err());

    std::fs::remove_dir_all(data_dir).unwrap();
}

#[test]
fn local_detection_is_absent_while_the_data_dir_is_uninitialized() {
    let store = CoreAiModelStore::default();

    assert_eq!(store.list().models.len(), 1);
    assert_eq!(
        store.list().models[0].source,
        CoreAiModelSource::AppleHosted
    );
}
