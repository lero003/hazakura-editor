//! C-3: resolution and validation for non Apple-hosted Core AI model sources.
//!
//! Apple-hosted models arrive through Background Assets and are verified against
//! a signed resource manifest (see `core_ai_models.rs`, gate G2). Local sources
//! (Hazakura's Custom Models directory and user-selected resource folders) have
//! no Hazakura-signed manifest, so this module applies the structural contract
//! the Core AI helper already enforces at load time
//! (`CoreAITestResourceContract` / `CoreAIResourceContract`): one resource root,
//! one `*.aimodel` directory carrying `metadata.json` / `main.hash` /
//! `main.mlirb`, and a tokenizer next to it.
//!
//! This module only inspects. It never writes to, repairs, converts, downloads,
//! or deletes anything under the inspected path, and it never guesses a missing
//! tokenizer or follows a symlink to paper over a broken bundle.
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
use std::path::{Path, PathBuf};

/// Hazakura's own descriptor for a converted Core AI bundle. Kept identical to
/// the filename the asset tooling writes and the helper reads.
const MODEL_DESCRIPTOR_FILENAME: &str = "hazakura-model.json";
/// Directory that `layout.decoder` / `layout.bundle` points at inside a bundle.
const MODEL_DIRECTORY_EXTENSION: &str = "aimodel";
const LANGUAGE_BUNDLE_DESCRIPTOR: &str = "metadata.json";
const TOKENIZER_FILE: &str = "tokenizer/tokenizer.json";
const MODEL_DIRECTORY_FILES: [&str; 3] = ["metadata.json", "main.hash", "main.mlirb"];
const GEMMA4_PLE_TABLE_FILES: [&str; 2] = ["embed_per_layer.i8", "embed_per_layer.scale.f32"];

const DESCRIPTOR_SCHEMA_VERSION: u32 = 1;
const RUNTIME_KIND_GEMMA4_PLE: &str = "coreai-kit-gemma4-ple";
const RUNTIME_KIND_LANGUAGE: &str = "coreai-kit-language";

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

/// Why a candidate path is not a usable Core AI model bundle. Every variant has
/// a stable `code` so the frontend owns the wording.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum LocalModelResolutionError {
    /// The selected path does not exist.
    RootMissing,
    /// The selected path exists but is not a directory.
    RootNotDirectory,
    /// No `hazakura-model.json` and no language-bundle descriptor was found.
    MissingDescriptor,
    /// `hazakura-model.json` is not valid JSON.
    MalformedDescriptor,
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
    /// The `*.aimodel` directory is missing `metadata.json`, `main.hash`, or `main.mlirb`.
    IncompleteModelDirectory,
    /// The tokenizer that decides prompt formatting and stopping is missing.
    MissingTokenizer,
    /// A Gemma4 PLE bundle is missing its embedding tables.
    MissingTables,
    /// A path escapes the bundle, or a symlink was encountered.
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
            Self::UnsupportedDescriptor => "unsupported-descriptor",
            Self::UnknownRuntimeKind => "unknown-runtime-kind",
            Self::MissingBundleDirectory => "missing-bundle-directory",
            Self::MissingModelDirectory => "missing-model-directory",
            Self::MultipleModelDirectories => "multiple-model-directories",
            Self::IncompleteModelDirectory => "incomplete-model-directory",
            Self::MissingTokenizer => "missing-tokenizer",
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
            Self::IncompleteModelDirectory => {
                "The .aimodel directory is missing metadata.json, main.hash, or main.mlirb."
            }
            Self::MissingTokenizer => {
                "The tokenizer resource required to run the model is missing."
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

/// A local bundle that passed the structural contract and is safe to hand to the
/// Core AI helper. Contains no digests: unlike Apple-hosted assets these sources
/// are not covered by a signed manifest, and the helper re-verifies the shape at
/// load time.
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
    /// `modelId` from `hazakura-model.json`. `None` for a bare language bundle,
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
/// directory whose parent is a language bundle. Rejects symlinked roots so a
/// selection cannot silently redirect validation at a different location.
pub(crate) fn resolve_local_model_root(
    path: &Path,
) -> Result<ResolvedLocalModel, LocalModelResolutionError> {
    let metadata = fs::symlink_metadata(path).map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
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

    if is_regular_file(&root.join(MODEL_DESCRIPTOR_FILENAME)) {
        return resolve_described_root(&root);
    }
    if is_regular_file(&root.join(LANGUAGE_BUNDLE_DESCRIPTOR)) {
        validate_language_bundle(&root)?;
        let model_directory = single_model_directory(&root)?;
        validate_model_directory(&model_directory)?;
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
    Err(LocalModelResolutionError::MissingDescriptor)
}

/// Scan an app-managed Custom Models directory. Each immediate subdirectory is
/// one candidate. Missing directories and unreadable roots yield an empty list
/// rather than an error, because absence simply means "no custom models yet".
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
    let mut names: Vec<String> = entries
        .flatten()
        .filter_map(|entry| {
            if !entry.file_type().ok()?.is_dir() {
                return None;
            }
            let name = entry.file_name().to_string_lossy().into_owned();
            if name.starts_with('.') {
                return None;
            }
            Some(name)
        })
        .collect();
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
    validate_language_bundle(bundle)?;
    let model_directory = single_model_directory(bundle)?;
    validate_model_directory(&model_directory)?;
    let resource_root =
        fs::canonicalize(bundle).map_err(|_| LocalModelResolutionError::Unreadable)?;
    Ok(ResolvedLocalModel {
        resource_root,
        runtime_kind: CoreAiLocalModelRuntimeKind::Language,
        bundle: bundle.to_path_buf(),
        model_directory,
        tables: None,
        model_id: None,
        display_name: None,
    })
}

fn resolve_described_root(root: &Path) -> Result<ResolvedLocalModel, LocalModelResolutionError> {
    let data = fs::read(root.join(MODEL_DESCRIPTOR_FILENAME))
        .map_err(|_| LocalModelResolutionError::MalformedDescriptor)?;
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
            let decoder = resolve_relative_directory(descriptor.layout.decoder.as_deref(), root)?;
            let tables = resolve_relative_directory(descriptor.layout.tables.as_deref(), root)?;
            for table in GEMMA4_PLE_TABLE_FILES {
                if !is_regular_file(&tables.join(table)) {
                    return Err(LocalModelResolutionError::MissingTables);
                }
            }
            (decoder, Some(tables))
        }
        CoreAiLocalModelRuntimeKind::Language => {
            let bundle = resolve_relative_directory(descriptor.layout.bundle.as_deref(), root)?;
            (bundle, None)
        }
    };

    validate_language_bundle(&bundle)?;
    let model_directory = single_model_directory(&bundle)?;
    validate_model_directory(&model_directory)?;
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

fn validate_language_bundle(bundle: &Path) -> Result<(), LocalModelResolutionError> {
    if !is_regular_file(&bundle.join(LANGUAGE_BUNDLE_DESCRIPTOR)) {
        return Err(LocalModelResolutionError::MissingDescriptor);
    }
    if !is_regular_file(&bundle.join(TOKENIZER_FILE)) {
        return Err(LocalModelResolutionError::MissingTokenizer);
    }
    Ok(())
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
        if !is_regular_file(&directory.join(file)) {
            return Err(LocalModelResolutionError::IncompleteModelDirectory);
        }
    }
    Ok(())
}

fn resolve_relative_directory(
    relative: Option<&str>,
    root: &Path,
) -> Result<PathBuf, LocalModelResolutionError> {
    let relative = relative.unwrap_or_default();
    if relative.is_empty()
        || relative.starts_with('/')
        || relative
            .split('/')
            .any(|component| component == ".." || component.is_empty())
    {
        return Err(LocalModelResolutionError::UnsafePath);
    }
    let candidate = root.join(relative);
    let metadata = match fs::symlink_metadata(&candidate) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Err(LocalModelResolutionError::MissingBundleDirectory)
        }
        Err(_) => return Err(LocalModelResolutionError::Unreadable),
    };
    if metadata.file_type().is_symlink() {
        return Err(LocalModelResolutionError::UnsafePath);
    }
    if !metadata.is_dir() {
        return Err(LocalModelResolutionError::MissingBundleDirectory);
    }
    let canonical =
        fs::canonicalize(&candidate).map_err(|_| LocalModelResolutionError::Unreadable)?;
    if !canonical.starts_with(root) {
        return Err(LocalModelResolutionError::UnsafePath);
    }
    Ok(canonical)
}

fn is_model_directory_name(path: &Path) -> bool {
    path.extension().and_then(|extension| extension.to_str()) == Some(MODEL_DIRECTORY_EXTENSION)
}

fn is_regular_file(path: &Path) -> bool {
    fs::symlink_metadata(path)
        .map(|metadata| metadata.is_file())
        .unwrap_or(false)
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
