use crate::commands::core_ai_local_models::{
    resolve_local_model_root, scan_custom_models_directory, CoreAiLocalModelRuntimeKind,
    LocalModelResolutionError, CONTRACT_CASES,
};
use serde::Deserialize;
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

fn write_model_directory(directory: &Path) {
    for file in ["metadata.json", "main.hash", "main.mlirb"] {
        write_file(&directory.join(file));
    }
}

fn write_language_bundle(bundle: &Path, model_directory_name: &str) {
    write_file(&bundle.join("metadata.json"));
    write_file(&bundle.join("tokenizer/tokenizer.json"));
    write_model_directory(&bundle.join(model_directory_name));
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
    write_model_directory(&root.join("local.aimodel"));

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
mod symlinks {
    use super::*;
    use std::os::unix::fs::symlink;

    #[test]
    fn rejects_a_symlinked_root() {
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
    fn rejects_a_symlinked_model_directory() {
        let root = temp_root("symlinked-model-dir");
        write_file(&root.join("metadata.json"));
        write_file(&root.join("tokenizer/tokenizer.json"));
        write_model_directory(&root.join("real-model"));
        symlink(root.join("real-model"), root.join("linked.aimodel")).expect("symlink");

        assert_eq!(
            resolve_local_model_root(&root).unwrap_err(),
            LocalModelResolutionError::UnsafePath
        );
    }

    #[test]
    fn rejects_a_symlinked_tokenizer_directory() {
        let root = temp_root("symlinked-tokenizer");
        write_file(&root.join("metadata.json"));
        write_file(&root.join("real-tokenizer/tokenizer.json"));
        write_model_directory(&root.join("local.aimodel"));
        symlink(root.join("real-tokenizer"), root.join("tokenizer")).expect("symlink");

        assert_eq!(
            resolve_local_model_root(&root).unwrap_err(),
            LocalModelResolutionError::UnsafePath
        );
    }

    #[test]
    fn rejects_a_symlinked_model_file() {
        let root = temp_root("symlinked-model-file");
        write_file(&root.join("metadata.json"));
        write_file(&root.join("tokenizer/tokenizer.json"));
        write_file(&root.join("local.aimodel/metadata.json"));
        write_file(&root.join("local.aimodel/main.mlirb"));
        write_file(&root.join("outside.hash"));
        symlink(
            root.join("outside.hash"),
            root.join("local.aimodel/main.hash"),
        )
        .expect("symlink");

        assert_eq!(
            resolve_local_model_root(&root).unwrap_err(),
            LocalModelResolutionError::UnsafePath
        );
    }

    #[test]
    fn rejects_a_symlinked_layout_directory() {
        let root = temp_root("symlinked-layout");
        write_descriptor(
            &root,
            r#"{
              "schemaVersion": 1,
              "modelId": "local:test:linked",
              "runtimeKind": "coreai-kit-language",
              "layout": { "bundle": "bundle" }
            }"#,
        );
        write_language_bundle(&root.join("real-bundle"), "local.aimodel");
        symlink(root.join("real-bundle"), root.join("bundle")).expect("symlink");

        assert_eq!(
            resolve_local_model_root(&root).unwrap_err(),
            LocalModelResolutionError::UnsafePath
        );
    }
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

#[cfg(unix)]
#[test]
fn scan_reports_a_symlinked_candidate_instead_of_dropping_it() {
    use std::os::unix::fs::symlink;

    let custom = temp_root("custom-symlink");
    write_language_bundle(&custom.join("Alpha"), "alpha.aimodel");
    let real = temp_root("custom-symlink-target");
    write_language_bundle(&real, "real.aimodel");
    symlink(&real, custom.join("Linked")).expect("symlink");

    let candidates = scan_custom_models_directory(&custom);

    assert_eq!(candidates.len(), 2);
    assert_eq!(candidates[0].directory_name, "Alpha");
    assert_eq!(candidates[1].directory_name, "Linked");
    assert_eq!(
        candidates[1].outcome.as_ref().unwrap_err(),
        &LocalModelResolutionError::UnsafePath
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

/// The Rust and Swift local contracts are asserted against one shared fixture
/// spec. Adding a case here requires both languages to agree on the outcome.
#[test]
fn contract_cases_match_the_shared_spec() {
    let spec: ContractSpec = serde_json::from_str(CONTRACT_CASES).expect("shared spec parses");
    assert_eq!(spec.schema_version, 1);
    assert!(!spec.cases.is_empty());

    for case in &spec.cases {
        if case.platform.as_deref() == Some("unix") && !cfg!(unix) {
            continue;
        }
        let root = temp_root(&format!("spec-{}", case.id));
        materialize(&root, &case.entries);
        let selected = if case.select == "." {
            root.clone()
        } else {
            root.join(&case.select)
        };
        let result = resolve_local_model_root(&selected);

        match case.expect.outcome.as_str() {
            "ready" => {
                let model = result.unwrap_or_else(|error| {
                    panic!("{}: expected ready, got {}", case.id, error.code())
                });
                assert_eq!(
                    model.runtime_kind.as_str(),
                    case.expect.runtime_kind.as_deref().unwrap_or_default(),
                    "{}: runtime kind",
                    case.id
                );
            }
            "error" => {
                let error = result.err().unwrap_or_else(|| {
                    panic!(
                        "{}: expected error {}, resolved instead",
                        case.id,
                        case.expect.code.as_deref().unwrap_or_default()
                    )
                });
                assert_eq!(
                    error.code(),
                    case.expect.code.as_deref().unwrap_or_default(),
                    "{}: error code",
                    case.id
                );
            }
            other => panic!("{}: unknown expected outcome {other}", case.id),
        }
    }
}

fn materialize(root: &Path, entries: &[SpecEntry]) {
    for entry in entries {
        let path = root.join(&entry.path);
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).expect("fixture parent");
        }
        match entry.kind.as_str() {
            "dir" => std::fs::create_dir_all(&path).expect("fixture dir"),
            "file" => std::fs::write(
                &path,
                entry.contents.clone().unwrap_or_else(|| "fixture".into()),
            )
            .expect("fixture file"),
            "symlink" => {
                #[cfg(unix)]
                {
                    use std::os::unix::fs::symlink;
                    symlink(entry.target.as_deref().expect("symlink target"), &path)
                        .expect("fixture symlink");
                }
                #[cfg(not(unix))]
                panic!("symlink fixtures are unix-only");
            }
            other => panic!("unknown entry kind {other}"),
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ContractSpec {
    schema_version: u32,
    cases: Vec<ContractCase>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ContractCase {
    id: String,
    #[serde(default)]
    platform: Option<String>,
    select: String,
    expect: ExpectedOutcome,
    #[serde(default)]
    entries: Vec<SpecEntry>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExpectedOutcome {
    outcome: String,
    #[serde(default)]
    code: Option<String>,
    #[serde(default)]
    runtime_kind: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SpecEntry {
    path: String,
    kind: String,
    #[serde(default)]
    target: Option<String>,
    #[serde(default)]
    contents: Option<String>,
}
