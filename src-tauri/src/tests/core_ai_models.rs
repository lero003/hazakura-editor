use crate::commands::apple_assist_supervisor::store_without_helper;
use crate::commands::core_ai_models::{
    CoreAiCatalogEntry, CoreAiDistributionStatus, CoreAiModelKind, CoreAiModelStatus,
    CoreAiModelStore, SYSTEM_MODEL_ID,
};

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

#[test]
fn production_catalog_fails_closed_until_a_model_is_published() {
    let data_dir = temp_data_dir();
    let helper = store_without_helper();
    let store = CoreAiModelStore::default();
    store
        .configure(data_dir.clone(), &helper)
        .expect("configure");

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
fn ready_catalog_model_can_be_selected_and_restored_without_frontend_path_input() {
    let data_dir = temp_data_dir();
    let model_id = "apple:core-ai:fixture-ready";
    let entry = CoreAiCatalogEntry::fixture(model_id, "Fixture Ready", "fixture-ready");
    let model_dir = data_dir.join("CoreAIModels/fixture-ready");
    std::fs::create_dir_all(&model_dir).expect("model fixture");
    let helper = store_without_helper();
    let store = CoreAiModelStore::with_fixture_catalog(vec![entry.clone()]);
    store
        .configure(data_dir.clone(), &helper)
        .expect("configure");

    let selected = store.select(model_id, &helper).expect("select ready model");
    assert_eq!(selected.selected_model_id, model_id);
    assert_eq!(helper.selected_model_id().expect("helper model"), model_id);

    let restored_helper = store_without_helper();
    let restored = CoreAiModelStore::with_fixture_catalog(vec![entry]);
    restored
        .configure(data_dir.clone(), &restored_helper)
        .expect("restore selection");
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
    store
        .configure(data_dir.clone(), &helper)
        .expect("configure");

    assert!(store.select(model_id, &helper).is_err());
    let download_error = store
        .start_download(model_id)
        .expect_err("transport is gated");
    assert!(download_error.contains("not active"), "{download_error}");

    std::fs::remove_dir_all(data_dir).expect("cleanup");
}
