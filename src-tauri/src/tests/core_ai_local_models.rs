use crate::commands::core_ai_local_models::{
    resolve_local_model_root, scan_custom_models_directory, CoreAiLocalModelRuntimeKind,
    LocalModelResolutionError,
};
use std::path::{Path, PathBuf};

fn temp_root(label: &str) -> PathBuf {
    let directory = std::env::temp_dir().join(format!(
        "hazakura-core-ai-local-{label}-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("clock")
            .as_nanos()
    ));
    std::fs::create_dir_all(&directory).expect("temp root");
    directory
}

fn write_file(path: &Path) {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).expect("fixture parent");
    }
    std::fs::write(path, b"fixture").expect("fixture file");
}

fn write_language_bundle(bundle: &Path, model_directory_name: &str) {
    write_file(&bundle.join("metadata.json"));
    write_file(&bundle.join("tokenizer/tokenizer.json"));
    let model_directory = bundle.join(model_directory_name);
    for file in ["metadata.json", "main.hash", "main.mlirb"] {
        write_file(&model_directory.join(file));
    }
}

fn write_descriptor(root: &Path, contents: &str) {
    std::fs::write(root.join("hazakura-model.json"), contents).expect("descriptor");
}

fn canonical(path: &Path) -> PathBuf {
    std::fs::canonicalize(path).expect("canonical path")
}

#[test]
fn resolves_a_language_bundle_selected_by_its_resource_root() {
    let root = temp_root("language-root");
    write_language_bundle(&root, "my-qwen.aimodel");

    let model = resolve_local_model_root(&root).expect("resolved bundle");

    assert_eq!(model.runtime_kind, CoreAiLocalModelRuntimeKind::Language);
    assert_eq!(model.resource_root, canonical(&root));
    assert_eq!(model.bundle, canonical(&root));
    assert_eq!(
        model.model_directory,
        canonical(&root.join("my-qwen.aimodel"))
    );
    assert_eq!(model.tables, None);
    assert_eq!(model.model_id, None);
    assert_eq!(model.display_name, None);
    assert_eq!(model.identity_key(), canonical(&root).display().to_string());
}

#[test]
fn resolves_a_language_bundle_selected_by_its_aimodel_directory() {
    let root = temp_root("aimodel-selection");
    write_language_bundle(&root, "my-qwen.aimodel");

    let model =
        resolve_local_model_root(&root.join("my-qwen.aimodel")).expect("resolved parent bundle");

    assert_eq!(model.resource_root, canonical(&root));
    assert_eq!(model.bundle, canonical(&root));
    assert_eq!(
        model.model_directory,
        canonical(&root.join("my-qwen.aimodel"))
    );
}

#[test]
fn resolves_a_described_gemma4_ple_bundle() {
    let root = temp_root("ple-root");
    write_descriptor(
        &root,
        r#"{
          "schemaVersion": 1,
          "modelId": "local:test:gemma4-ple",
          "displayName": "Local Gemma",
          "runtimeKind": "coreai-kit-gemma4-ple",
          "layout": { "decoder": "decoder", "tables": "tables" }
        }"#,
    );
    write_language_bundle(&root.join("decoder"), "gemma.aimodel");
    write_file(&root.join("tables/embed_per_layer.i8"));
    write_file(&root.join("tables/embed_per_layer.scale.f32"));

    let model = resolve_local_model_root(&root).expect("resolved ple bundle");

    assert_eq!(model.runtime_kind, CoreAiLocalModelRuntimeKind::Gemma4Ple);
    assert_eq!(model.bundle, canonical(&root.join("decoder")));
    assert_eq!(
        model.model_directory,
        canonical(&root.join("decoder/gemma.aimodel"))
    );
    assert_eq!(model.tables, Some(canonical(&root.join("tables"))));
    assert_eq!(model.model_id.as_deref(), Some("local:test:gemma4-ple"));
    assert_eq!(model.display_name.as_deref(), Some("Local Gemma"));
}

#[test]
fn resolves_a_described_language_bundle() {
    let root = temp_root("described-language");
    write_descriptor(
        &root,
        r#"{
          "schemaVersion": 1,
          "modelId": "local:test:language",
          "runtimeKind": "coreai-kit-language",
          "layout": { "bundle": "bundle" }
        }"#,
    );
    write_language_bundle(&root.join("bundle"), "local.aimodel");

    let model = resolve_local_model_root(&root).expect("resolved described bundle");

    assert_eq!(model.runtime_kind, CoreAiLocalModelRuntimeKind::Language);
    assert_eq!(model.bundle, canonical(&root.join("bundle")));
    assert_eq!(model.tables, None);
    assert_eq!(model.model_id.as_deref(), Some("local:test:language"));
    assert_eq!(model.display_name, None);
}

#[test]
fn rejects_a_gemma4_ple_bundle_without_tables() {
    let root = temp_root("ple-no-tables");
    write_descriptor(
        &root,
        r#"{
          "schemaVersion": 1,
          "modelId": "local:test:gemma4-ple",
          "runtimeKind": "coreai-kit-gemma4-ple",
          "layout": { "decoder": "decoder", "tables": "tables" }
        }"#,
    );
    write_language_bundle(&root.join("decoder"), "gemma.aimodel");
    std::fs::create_dir_all(root.join("tables")).expect("tables dir");

    assert_eq!(
        resolve_local_model_root(&root).unwrap_err(),
        LocalModelResolutionError::MissingTables
    );
}

#[test]
fn rejects_a_bundle_without_its_tokenizer() {
    let root = temp_root("no-tokenizer");
    write_file(&root.join("metadata.json"));
    let model_directory = root.join("local.aimodel");
    for file in ["metadata.json", "main.hash", "main.mlirb"] {
        write_file(&model_directory.join(file));
    }

    assert_eq!(
        resolve_local_model_root(&root).unwrap_err(),
        LocalModelResolutionError::MissingTokenizer
    );
}

#[test]
fn rejects_a_bundle_with_two_aimodel_directories() {
    let root = temp_root("two-models");
    write_language_bundle(&root, "first.aimodel");
    write_language_bundle(&root, "second.aimodel");

    assert_eq!(
        resolve_local_model_root(&root).unwrap_err(),
        LocalModelResolutionError::MultipleModelDirectories
    );
}

#[test]
fn rejects_an_incomplete_aimodel_directory() {
    let root = temp_root("incomplete-model");
    write_file(&root.join("metadata.json"));
    write_file(&root.join("tokenizer/tokenizer.json"));
    write_file(&root.join("local.aimodel/metadata.json"));
    write_file(&root.join("local.aimodel/main.hash"));

    assert_eq!(
        resolve_local_model_root(&root).unwrap_err(),
        LocalModelResolutionError::IncompleteModelDirectory
    );
}

#[test]
fn rejects_a_bundle_without_an_aimodel_directory() {
    let root = temp_root("no-model-dir");
    write_file(&root.join("metadata.json"));
    write_file(&root.join("tokenizer/tokenizer.json"));

    assert_eq!(
        resolve_local_model_root(&root).unwrap_err(),
        LocalModelResolutionError::MissingModelDirectory
    );
}

#[test]
fn rejects_a_descriptor_layout_that_escapes_the_root() {
    let root = temp_root("escaping-layout");
    write_descriptor(
        &root,
        r#"{
          "schemaVersion": 1,
          "modelId": "local:test:escape",
          "runtimeKind": "coreai-kit-language",
          "layout": { "bundle": "../outside" }
        }"#,
    );

    assert_eq!(
        resolve_local_model_root(&root).unwrap_err(),
        LocalModelResolutionError::UnsafePath
    );
}

#[test]
fn rejects_an_unsupported_descriptor_schema() {
    let root = temp_root("bad-schema");
    write_descriptor(
        &root,
        r#"{
          "schemaVersion": 2,
          "modelId": "local:test:schema",
          "runtimeKind": "coreai-kit-language",
          "layout": { "bundle": "bundle" }
        }"#,
    );

    assert_eq!(
        resolve_local_model_root(&root).unwrap_err(),
        LocalModelResolutionError::UnsupportedDescriptor
    );
}

#[test]
fn rejects_an_unknown_runtime_kind() {
    let root = temp_root("unknown-runtime");
    write_descriptor(
        &root,
        r#"{
          "schemaVersion": 1,
          "modelId": "local:test:unknown",
          "runtimeKind": "coreai-kit-unknown",
          "layout": { "bundle": "bundle" }
        }"#,
    );

    assert_eq!(
        resolve_local_model_root(&root).unwrap_err(),
        LocalModelResolutionError::UnknownRuntimeKind
    );
}

#[test]
fn rejects_a_malformed_descriptor() {
    let root = temp_root("malformed-descriptor");
    write_descriptor(&root, "{ not json");

    assert_eq!(
        resolve_local_model_root(&root).unwrap_err(),
        LocalModelResolutionError::MalformedDescriptor
    );
}

#[test]
fn rejects_a_missing_root() {
    let root = temp_root("missing-root");

    assert_eq!(
        resolve_local_model_root(&root.join("absent")).unwrap_err(),
        LocalModelResolutionError::RootMissing
    );
}

#[test]
fn rejects_a_file_selected_as_a_model_root() {
    let root = temp_root("file-root");
    let file = root.join("model.aimodel");
    write_file(&file);

    assert_eq!(
        resolve_local_model_root(&file).unwrap_err(),
        LocalModelResolutionError::RootNotDirectory
    );
}

#[test]
fn rejects_a_folder_without_any_descriptor() {
    let root = temp_root("empty-folder");
    write_file(&root.join("readme.txt"));

    assert_eq!(
        resolve_local_model_root(&root).unwrap_err(),
        LocalModelResolutionError::MissingDescriptor
    );
}

#[cfg(unix)]
#[test]
fn rejects_a_symlinked_model_directory() {
    use std::os::unix::fs::symlink;

    let root = temp_root("symlinked-model-dir");
    write_file(&root.join("metadata.json"));
    write_file(&root.join("tokenizer/tokenizer.json"));
    let real = root.join("real-model");
    for file in ["metadata.json", "main.hash", "main.mlirb"] {
        write_file(&real.join(file));
    }
    symlink(&real, root.join("linked.aimodel")).expect("symlink");

    assert_eq!(
        resolve_local_model_root(&root).unwrap_err(),
        LocalModelResolutionError::UnsafePath
    );
}

#[cfg(unix)]
#[test]
fn rejects_a_symlinked_root() {
    use std::os::unix::fs::symlink;

    let root = temp_root("symlinked-root");
    let real = temp_root("symlinked-root-target");
    write_language_bundle(&real, "local.aimodel");
    let link = root.join("linked-root");
    symlink(&real, &link).expect("symlink");

    assert_eq!(
        resolve_local_model_root(&link).unwrap_err(),
        LocalModelResolutionError::UnsafePath
    );
}

#[test]
fn scan_lists_candidates_sorted_and_flags_broken_entries() {
    let custom = temp_root("custom-models");
    write_language_bundle(&custom.join("Alpha"), "alpha.aimodel");
    // Beta has a descriptor but no tokenizer, so it must be reported, not hidden.
    write_file(&custom.join("Beta/metadata.json"));
    write_language_bundle(&custom.join(".Hidden"), "hidden.aimodel");
    write_file(&custom.join("notes.txt"));

    let candidates = scan_custom_models_directory(&custom);

    assert_eq!(candidates.len(), 2);
    assert_eq!(candidates[0].directory_name, "Alpha");
    assert!(candidates[0].outcome.is_ok());
    assert_eq!(candidates[1].directory_name, "Beta");
    assert_eq!(
        candidates[1].outcome.as_ref().unwrap_err(),
        &LocalModelResolutionError::MissingTokenizer
    );
}

#[test]
fn scan_returns_empty_for_a_missing_or_non_directory_root() {
    let root = temp_root("scan-absent");

    assert!(scan_custom_models_directory(&root.join("absent")).is_empty());

    let file = root.join("not-a-directory");
    write_file(&file);
    assert!(scan_custom_models_directory(&file).is_empty());
}
