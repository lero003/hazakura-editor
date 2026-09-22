//! C-3: the **local** Core AI model contract - resolution and validation for
//! non Apple-hosted model sources.
//!
//! Two different contracts exist in this repository and they must not be
//! conflated:
//!
//! * `CoreAIResourceContract` (Swift, `CoreAITestResourceContract.swift`) is the
//!   *production* gate. It verifies official Apple-hosted bundles against a
//!   Hazakura-signed resource manifest, a fixed `modelId`, a reviewed licence
//!   status, and the licence / notice files that ship with an official model.
//! * The rules in this module are the *local* gate. A local bundle is chosen by
//!   the user (Hazakura's Custom Models directory, a resource folder, or a
//!   `.aimodel` directory). It has no Hazakura signature and no reviewed licence
//!   status, so the local gate checks structure and identity only and reports
//!   "unknown" instead of guessing a licence.
//!
//! The same local rules are implemented for the helper in
//! `CoreAILocalResourceContract.swift`, and both implementations are driven by
//! the shared fixture spec at
//! `src-tauri/resources/core-ai/local-model-contract-cases.json`. A bundle must
//! not be valid on one side and invalid on the other.
//!
//! Passing this gate means "a well-formed Core AI resource bundle the local path
//! may adopt". It is *not* permission to generate: the local backend wiring is a
//! later C-3 slice, and this gate replaces neither the production contract nor
//! the signed-manifest verification in `core_ai_models.rs` (gate G2).
//!
//! This module only inspects. It never writes to, repairs, converts, downloads,
//! or deletes anything under the inspected path. Symlinks inside the resource
//! root are rejected at every path component, not only at the final element.
//!
//! User-facing copy is intentionally absent here. Callers surface
//! [`LocalModelResolutionError::code`] so the wording stays in the frontend and
//! can be localized once the model list is wired up.
// The C-3 wiring slice (Custom Models directory + model list) consumes this
// surface. Until then only the test suite calls it, so keep the build warning
// free without pretending the module is finished.
#![allow(dead_code)]

use serde::Deserialize;
use std::collections::HashSet;
use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};

/// Hazakura's own descriptor for a converted Core AI bundle. Kept identical to
/// the filename the asset tooling writes and the helper reads.
pub(crate) const MODEL_DESCRIPTOR_FILENAME: &str = "hazakura-model.json";
/// Shared fixture spec that both this module's tests and the Swift helper tests
/// consume. Exported so the test suite reads exactly one source of truth.
pub(crate) const CONTRACT_CASES: &str =
    include_str!("../../resources/core-ai/local-model-contract-cases.json");

/// Directory that `layout.decoder` / `layout.bundle` points at inside a bundle.
const MODEL_DIRECTORY_EXTENSION: &str = "aimodel";
const LANGUAGE_BUNDLE_DESCRIPTOR: &str = "metadata.json";
const TOKENIZER_FILE: &str = "tokenizer/tokenizer.json";
const OPTIONAL_TOKENIZER_FILES: [&str; 4] = [
    "tokenizer/config.json",
    "tokenizer/tokenizer_config.json",
    "tokenizer/chat_template.jinja",
    "tokenizer/chat_template.json",
];
const MODEL_DIRECTORY_FILES: [&str; 3] = ["metadata.json", "main.hash", "main.mlirb"];
const GEMMA4_PLE_TABLE_FILES: [&str; 2] = ["embed_per_layer.i8", "embed_per_layer.scale.f32"];

const DESCRIPTOR_SCHEMA_VERSION: u32 = 1;
pub(crate) const RUNTIME_KIND_GEMMA4_PLE: &str = "coreai-kit-gemma4-ple";
pub(crate) const RUNTIME_KIND_LANGUAGE: &str = "coreai-kit-language";

/// Runtime shape of a resolved local bundle. Mirrors the helper's
/// `CoreAIProductionRuntimeKind`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum CoreAiLocalModelRuntimeKind {
    Gemma4Ple,
    Language,
}

impl CoreAiLocalModelRuntimeKind {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::Gemma4Ple => RUNTIME_KIND_GEMMA4_PLE,
            Self::Language => RUNTIME_KIND_LANGUAGE,
        }
    }
}

/// Why a candidate path is not a usable local Core AI bundle. Every variant has
/// a stable `code`; the Swift `CoreAILocalModelErrorCode` uses the same strings
/// so the shared fixture spec can assert both languages at once.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum LocalModelResolutionError {
    /// The selected path does not exist.
    RootMissing,
    /// The selected path exists but is not a directory.
    RootNotDirectory,
    /// No `hazakura-model.json` and no language-bundle `metadata.json` was found.
    MissingDescriptor,
    /// `hazakura-model.json` is not valid JSON, or lacks an identity.
    MalformedDescriptor,
    /// The language-bundle `metadata.json` cannot be decoded as loader metadata.
    MalformedBundleMetadata,
    /// `hazakura-model.json` has a schema version this build does not read.
    UnsupportedDescriptor,
    /// `hazakura-model.json` names a runtime kind this build does not read.
    UnknownRuntimeKind,
    /// The descriptor points at a directory that is missing or not a directory.
    MissingBundleDirectory,
    /// No `*.aimodel` directory was found inside the bundle.
    MissingModelDirectory,
    /// More than one `*.aimodel` directory was found; the main asset is ambiguous.
    MultipleModelDirectories,
    /// `metadata.json` points the loader at a different model than the verified one.
    ModelDirectoryMismatch,
    /// The `*.aimodel` directory is missing `metadata.json`, `main.hash`, or `main.mlirb`.
    IncompleteModelDirectory,
    /// The tokenizer that decides prompt formatting and stopping is missing.
    MissingTokenizer,
    /// Local models must never fall back to downloading a tokenizer.
    ExternalTokenizerNotAllowed,
    /// A Gemma4 PLE bundle is missing its embedding tables.
    MissingTables,
    /// A path escapes the bundle, or a symlink was found inside it.
    UnsafePath,
    /// The filesystem refused a read while validating.
    Unreadable,
}

impl LocalModelResolutionError {
    pub(crate) fn code(self) -> &'static str {
        match self {
            Self::RootMissing => "root-missing",
            Self::RootNotDirectory => "root-not-a-directory",
            Self::MissingDescriptor => "missing-descriptor",
            Self::MalformedDescriptor => "malformed-descriptor",
            Self::MalformedBundleMetadata => "malformed-bundle-metadata",
            Self::UnsupportedDescriptor => "unsupported-descriptor",
            Self::UnknownRuntimeKind => "unknown-runtime-kind",
            Self::MissingBundleDirectory => "missing-bundle-directory",
            Self::MissingModelDirectory => "missing-model-directory",
            Self::MultipleModelDirectories => "multiple-model-directories",
            Self::ModelDirectoryMismatch => "model-directory-mismatch",
            Self::IncompleteModelDirectory => "incomplete-model-directory",
            Self::MissingTokenizer => "missing-tokenizer",
            Self::ExternalTokenizerNotAllowed => "external-tokenizer-not-allowed",
            Self::MissingTables => "missing-tables",
            Self::UnsafePath => "unsafe-path",
            Self::Unreadable => "unreadable",
        }
    }

    /// English message for logs and Rust-side diagnostics. Not shown to users;
    /// the IPC layer is expected to localize [`Self::code`].
    pub(crate) fn message(self) -> &'static str {
        match self {
            Self::RootMissing => "The selected Core AI model location does not exist.",
            Self::RootNotDirectory => "The selected Core AI model location is not a directory.",
            Self::MissingDescriptor => {
                "The folder has no hazakura-model.json or language-bundle metadata.json."
            }
            Self::MalformedDescriptor => "hazakura-model.json could not be read as JSON.",
            Self::MalformedBundleMetadata => {
                "The language-bundle metadata.json is not valid loader metadata."
            }
            Self::UnsupportedDescriptor => {
                "hazakura-model.json uses a schema version this build does not support."
            }
            Self::UnknownRuntimeKind => {
                "hazakura-model.json names a Core AI runtime this build does not support."
            }
            Self::MissingBundleDirectory => {
                "The metadata descriptor points at a missing bundle directory."
            }
            Self::MissingModelDirectory => {
                "No .aimodel directory was found inside the model bundle."
            }
            Self::MultipleModelDirectories => {
                "More than one .aimodel directory was found, so the main model asset is ambiguous."
            }
            Self::ModelDirectoryMismatch => {
                "The loader metadata points at a different model than the verified .aimodel directory."
            }
            Self::IncompleteModelDirectory => {
                "The .aimodel directory is missing metadata.json, main.hash, or main.mlirb."
            }
            Self::MissingTokenizer => {
                "The tokenizer resource required to run the model is missing."
            }
            Self::ExternalTokenizerNotAllowed => {
                "Local models must use the tokenizer embedded in their bundle."
            }
            Self::MissingTables => "The Gemma4 embedding tables are missing.",
            Self::UnsafePath => "The model bundle contains a symlink or a path outside the bundle.",
            Self::Unreadable => "The model bundle could not be read.",
        }
    }
}

impl std::fmt::Display for LocalModelResolutionError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(self.message())
    }
}

/// A local bundle that passed the local contract. Contains no digests: unlike
/// Apple-hosted assets these sources are not covered by a signed manifest. The
/// helper re-runs [`Self`]'s rules through `CoreAILocalResourceContract` before
/// loading, so both sides agree on what "valid" means.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ResolvedLocalModel {
    /// Canonical directory that owns the bundle (contains `hazakura-model.json`
    /// when the source is a Hazakura-described bundle).
    pub(crate) resource_root: PathBuf,
    pub(crate) runtime_kind: CoreAiLocalModelRuntimeKind,
    /// Directory holding `metadata.json`, `tokenizer/`, and the `*.aimodel`
    /// directory.
    pub(crate) bundle: PathBuf,
    /// The single verified `*.aimodel` directory.
    pub(crate) model_directory: PathBuf,
    /// Embedding tables for the Gemma4 PLE runtime.
    pub(crate) tables: Option<PathBuf>,
    /// `modelId` from `hazakura-model.json`. `None` for a bare language resource,
    /// because the identity is unknown rather than guessed.
    pub(crate) model_id: Option<String>,
    /// `displayName` from `hazakura-model.json`. `None` when unknown.
    pub(crate) display_name: Option<String>,
}

impl ResolvedLocalModel {
    /// Stable identifier for de-duplication. Uses the canonical resource root
    /// plus the declared model identity where present, never the raw selected
    /// path string.
    pub(crate) fn identity_key(&self) -> String {
        match self.model_id.as_deref() {
            Some(model_id) => format!("{}|{model_id}", self.resource_root.display()),
            None => self.resource_root.display().to_string(),
        }
    }
}

/// One entry of a Custom Models directory scan. Broken entries are reported, not
/// hidden, so the model list can mark them unavailable with a reason instead of
/// silently dropping the user's folder.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct CustomModelCandidate {
    pub(crate) directory_name: String,
    pub(crate) outcome: Result<ResolvedLocalModel, LocalModelResolutionError>,
}

/// Resolve a user-selected or app-managed path into a validated local model.
///
/// Accepts a resource root, a language bundle directory, or a `*.aimodel`
/// directory whose parent is a language bundle. Symlinks are rejected both for
/// the selected root and for every component inside the resource root: a
/// selection cannot redirect validation elsewhere, and a bundle cannot hide a
/// missing or external resource behind a link.
pub(crate) fn resolve_local_model_root(
    path: &Path,
) -> Result<ResolvedLocalModel, LocalModelResolutionError> {
    let metadata = fs::symlink_metadata(path).map_err(|error| {
        if error.kind() == ErrorKind::NotFound {
            LocalModelResolutionError::RootMissing
        } else {
            LocalModelResolutionError::Unreadable
        }
    })?;
    if metadata.file_type().is_symlink() {
        return Err(LocalModelResolutionError::UnsafePath);
    }
    if !metadata.is_dir() {
        return Err(LocalModelResolutionError::RootNotDirectory);
    }
    let root = fs::canonicalize(path).map_err(|_| LocalModelResolutionError::Unreadable)?;

    // A `*.aimodel` directory on its own is a best-effort selection: use its
    // parent bundle when that parent is structurally valid.
    if is_model_directory_name(&root) {
        let parent = root
            .parent()
            .ok_or(LocalModelResolutionError::MissingDescriptor)?
            .to_path_buf();
        return resolve_bundle(&parent);
    }

    // A symlink at the descriptor path is reported as unsafe rather than "missing",
    // so a bundle cannot avoid inspection by linking its descriptor away.
    match probe_kind(&root.join(MODEL_DESCRIPTOR_FILENAME))? {
        PathKind::File => return resolve_described_root(&root),
        PathKind::Symlink => return Err(LocalModelResolutionError::UnsafePath),
        PathKind::Other => {}
    }
    match probe_kind(&root.join(LANGUAGE_BUNDLE_DESCRIPTOR))? {
        PathKind::File => {
            let declared_model_path = validate_language_bundle(&root)?;
            let model_directory = single_model_directory(&root)?;
            validate_model_directory(&model_directory)?;
            validate_declared_model_directory(&root, &declared_model_path, &model_directory)?;
            return Ok(ResolvedLocalModel {
                resource_root: root.clone(),
                runtime_kind: CoreAiLocalModelRuntimeKind::Language,
                bundle: root,
                model_directory,
                tables: None,
                model_id: None,
                display_name: None,
            });
        }
        PathKind::Symlink => return Err(LocalModelResolutionError::UnsafePath),
        PathKind::Other => {}
    }
    Err(LocalModelResolutionError::MissingDescriptor)
}

/// Scan an app-managed Custom Models directory. Each immediate subdirectory or
/// symlink is one candidate. A symlinked entry is handed to the resolver so it is
/// reported as `unsafe-path` instead of being dropped. Missing directories and
/// unreadable roots yield an empty list rather than an error, because absence
/// simply means "no custom models yet".
pub(crate) fn scan_custom_models_directory(root: &Path) -> Vec<CustomModelCandidate> {
    let metadata = match fs::symlink_metadata(root) {
        Ok(metadata) => metadata,
        Err(_) => return Vec::new(),
    };
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Vec::new();
    }
    let entries = match fs::read_dir(root) {
        Ok(entries) => entries,
        Err(_) => return Vec::new(),
    };

    let mut names: Vec<String> = Vec::new();
    for entry in entries {
        // An entry error carries no name, so it cannot be attributed to a
        // candidate. Named entries are never dropped: unknown kinds are handed
        // to the resolver, which reports `unreadable` for them.
        let Ok(entry) = entry else { continue };
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') {
            continue;
        }
        let kind = entry
            .file_type()
            .or_else(|_| fs::symlink_metadata(entry.path()).map(|metadata| metadata.file_type()));
        let include = match kind {
            Ok(file_type) => file_type.is_dir() || file_type.is_symlink(),
            Err(_) => true,
        };
        if include {
            names.push(name);
        }
    }
    names.sort();

    let mut seen = HashSet::new();
    let mut candidates = Vec::with_capacity(names.len());
    for name in names {
        let outcome = resolve_local_model_root(&root.join(&name));
        if let Ok(model) = &outcome {
            if !seen.insert(model.identity_key()) {
                continue;
            }
        }
        candidates.push(CustomModelCandidate {
            directory_name: name,
            outcome,
        });
    }
    candidates
}

fn resolve_bundle(bundle: &Path) -> Result<ResolvedLocalModel, LocalModelResolutionError> {
    let root = fs::canonicalize(bundle).map_err(|_| LocalModelResolutionError::Unreadable)?;
    let declared_model_path = validate_language_bundle(&root)?;
    let model_directory = single_model_directory(&root)?;
    validate_model_directory(&model_directory)?;
    validate_declared_model_directory(&root, &declared_model_path, &model_directory)?;
    Ok(ResolvedLocalModel {
        resource_root: root.clone(),
        runtime_kind: CoreAiLocalModelRuntimeKind::Language,
        bundle: root,
        model_directory,
        tables: None,
        model_id: None,
        display_name: None,
    })
}

fn resolve_described_root(root: &Path) -> Result<ResolvedLocalModel, LocalModelResolutionError> {
    let data = fs::read(root.join(MODEL_DESCRIPTOR_FILENAME)).map_err(|error| {
        if error.kind() == ErrorKind::NotFound {
            LocalModelResolutionError::MissingDescriptor
        } else {
            LocalModelResolutionError::Unreadable
        }
    })?;
    let descriptor: HazakuraModelDescriptor = serde_json::from_slice(&data)
        .map_err(|_| LocalModelResolutionError::MalformedDescriptor)?;
    if descriptor.schema_version != DESCRIPTOR_SCHEMA_VERSION {
        return Err(LocalModelResolutionError::UnsupportedDescriptor);
    }
    if descriptor.model_id.trim().is_empty() {
        return Err(LocalModelResolutionError::MalformedDescriptor);
    }
    let runtime_kind = match descriptor.runtime_kind.as_str() {
        RUNTIME_KIND_GEMMA4_PLE => CoreAiLocalModelRuntimeKind::Gemma4Ple,
        RUNTIME_KIND_LANGUAGE => CoreAiLocalModelRuntimeKind::Language,
        _ => return Err(LocalModelResolutionError::UnknownRuntimeKind),
    };

    let (bundle, tables) = match runtime_kind {
        CoreAiLocalModelRuntimeKind::Gemma4Ple => {
            let decoder = require_directory(
                root,
                descriptor.layout.decoder.as_deref(),
                LocalModelResolutionError::MissingBundleDirectory,
            )?;
            let tables = require_directory(
                root,
                descriptor.layout.tables.as_deref(),
                LocalModelResolutionError::MissingBundleDirectory,
            )?;
            for table in GEMMA4_PLE_TABLE_FILES {
                require_file(&tables, table, LocalModelResolutionError::MissingTables)?;
            }
            (decoder, Some(tables))
        }
        CoreAiLocalModelRuntimeKind::Language => {
            let bundle = require_directory(
                root,
                descriptor.layout.bundle.as_deref(),
                LocalModelResolutionError::MissingBundleDirectory,
            )?;
            (bundle, None)
        }
    };

    let declared_model_path = validate_language_bundle(&bundle)?;
    let model_directory = single_model_directory(&bundle)?;
    validate_model_directory(&model_directory)?;
    validate_declared_model_directory(&bundle, &declared_model_path, &model_directory)?;
    Ok(ResolvedLocalModel {
        resource_root: root.to_path_buf(),
        runtime_kind,
        bundle,
        model_directory,
        tables,
        model_id: Some(descriptor.model_id),
        display_name: descriptor
            .display_name
            .filter(|name| !name.trim().is_empty()),
    })
}

fn validate_language_bundle(bundle: &Path) -> Result<String, LocalModelResolutionError> {
    let metadata_path = require_file(
        bundle,
        LANGUAGE_BUNDLE_DESCRIPTOR,
        LocalModelResolutionError::MissingDescriptor,
    )?;
    let data = fs::read(metadata_path).map_err(|_| LocalModelResolutionError::Unreadable)?;
    let metadata: LanguageBundleMetadata = serde_json::from_slice(&data)
        .map_err(|_| LocalModelResolutionError::MalformedBundleMetadata)?;
    if metadata.metadata_version != "0.2"
        || metadata.kind != "llm"
        || metadata.language.vocab_size == 0
        || metadata.language.max_context_length == 0
    {
        return Err(LocalModelResolutionError::MalformedBundleMetadata);
    }
    if !metadata.language.embedded_tokenizer {
        return Err(LocalModelResolutionError::ExternalTokenizerNotAllowed);
    }
    require_file(
        bundle,
        TOKENIZER_FILE,
        LocalModelResolutionError::MissingTokenizer,
    )?;
    for relative in OPTIONAL_TOKENIZER_FILES {
        validate_optional_file(bundle, relative)?;
    }
    Ok(metadata.assets.main)
}

fn validate_declared_model_directory(
    bundle: &Path,
    declared_path: &str,
    verified: &Path,
) -> Result<(), LocalModelResolutionError> {
    let declared = require_directory(
        bundle,
        Some(declared_path),
        LocalModelResolutionError::ModelDirectoryMismatch,
    )?;
    if declared == verified {
        Ok(())
    } else {
        Err(LocalModelResolutionError::ModelDirectoryMismatch)
    }
}

fn single_model_directory(bundle: &Path) -> Result<PathBuf, LocalModelResolutionError> {
    let entries = fs::read_dir(bundle).map_err(|_| LocalModelResolutionError::Unreadable)?;
    let mut found = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if !is_model_directory_name(&path) {
            continue;
        }
        let metadata = match fs::symlink_metadata(&path) {
            Ok(metadata) => metadata,
            Err(_) => continue,
        };
        if metadata.file_type().is_symlink() {
            return Err(LocalModelResolutionError::UnsafePath);
        }
        if metadata.is_dir() {
            found.push(path);
        }
    }
    found.sort();
    match found.len() {
        0 => Err(LocalModelResolutionError::MissingModelDirectory),
        1 => Ok(found.remove(0)),
        _ => Err(LocalModelResolutionError::MultipleModelDirectories),
    }
}

fn validate_model_directory(directory: &Path) -> Result<(), LocalModelResolutionError> {
    for file in MODEL_DIRECTORY_FILES {
        require_file(
            directory,
            file,
            LocalModelResolutionError::IncompleteModelDirectory,
        )?;
    }
    Ok(())
}

/// Classify one path component without following links.
fn probe_kind(path: &Path) -> Result<PathKind, LocalModelResolutionError> {
    match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.file_type().is_symlink() => Ok(PathKind::Symlink),
        Ok(metadata) if metadata.is_file() => Ok(PathKind::File),
        Ok(_) => Ok(PathKind::Other),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(PathKind::Other),
        Err(_) => Err(LocalModelResolutionError::Unreadable),
    }
}

enum PathKind {
    File,
    Symlink,
    Other,
}

/// Walk `relative` from a trusted `root`, rejecting a symlink at *any*
/// component. Returns the joined path; the caller still has to check the type of
/// the final component, because the missing-path error differs per call site.
fn walk_from_root(
    root: &Path,
    relative: &str,
    missing: LocalModelResolutionError,
) -> Result<PathBuf, LocalModelResolutionError> {
    if relative.is_empty() || relative.starts_with('/') {
        return Err(LocalModelResolutionError::UnsafePath);
    }
    let mut current = root.to_path_buf();
    for component in relative.split('/') {
        if component.is_empty() || component == "." || component == ".." {
            return Err(LocalModelResolutionError::UnsafePath);
        }
        current.push(component);
        match fs::symlink_metadata(&current) {
            Ok(metadata) if metadata.file_type().is_symlink() => {
                return Err(LocalModelResolutionError::UnsafePath)
            }
            Ok(_) => {}
            Err(error) if error.kind() == ErrorKind::NotFound => return Err(missing),
            Err(_) => return Err(LocalModelResolutionError::Unreadable),
        }
    }
    Ok(current)
}

fn require_file(
    root: &Path,
    relative: &str,
    missing: LocalModelResolutionError,
) -> Result<PathBuf, LocalModelResolutionError> {
    let path = walk_from_root(root, relative, missing)?;
    match fs::symlink_metadata(&path) {
        Ok(metadata) if metadata.is_file() => Ok(path),
        Ok(_) => Err(missing),
        Err(_) => Err(missing),
    }
}

fn require_directory(
    root: &Path,
    relative: Option<&str>,
    missing: LocalModelResolutionError,
) -> Result<PathBuf, LocalModelResolutionError> {
    let relative = relative.ok_or(missing)?;
    let path = walk_from_root(root, relative, missing)?;
    match fs::symlink_metadata(&path) {
        Ok(metadata) if metadata.is_dir() => Ok(path),
        Ok(_) => Err(missing),
        Err(_) => Err(missing),
    }
}

fn validate_optional_file(root: &Path, relative: &str) -> Result<(), LocalModelResolutionError> {
    let path = root.join(relative);
    match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.file_type().is_symlink() => {
            Err(LocalModelResolutionError::UnsafePath)
        }
        Ok(metadata) if metadata.is_file() => Ok(()),
        Ok(_) => Err(LocalModelResolutionError::Unreadable),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(()),
        Err(_) => Err(LocalModelResolutionError::Unreadable),
    }
}

fn is_model_directory_name(path: &Path) -> bool {
    path.extension().and_then(|extension| extension.to_str()) == Some(MODEL_DIRECTORY_EXTENSION)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HazakuraModelDescriptor {
    schema_version: u32,
    model_id: String,
    #[serde(default)]
    display_name: Option<String>,
    runtime_kind: String,
    layout: HazakuraModelLayout,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HazakuraModelLayout {
    #[serde(default)]
    decoder: Option<String>,
    #[serde(default)]
    tables: Option<String>,
    #[serde(default)]
    bundle: Option<String>,
}

#[derive(Debug, Deserialize)]
struct LanguageBundleMetadata {
    metadata_version: String,
    kind: String,
    #[allow(dead_code)]
    name: String,
    assets: LanguageBundleAssets,
    language: LanguageBundleLanguage,
}

#[derive(Debug, Deserialize)]
struct LanguageBundleAssets {
    main: String,
}

#[derive(Debug, Deserialize)]
struct LanguageBundleLanguage {
    #[allow(dead_code)]
    tokenizer: String,
    #[allow(dead_code)]
    vocab_size: usize,
    #[allow(dead_code)]
    max_context_length: usize,
    #[serde(default = "default_true")]
    embedded_tokenizer: bool,
}

fn default_true() -> bool {
    true
}
