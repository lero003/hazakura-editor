import Foundation

/// Error codes shared with the Rust local model resolver. The strings are part
/// of the cross-language contract and must not be renamed independently.
enum CoreAILocalModelErrorCode: String, Error, Equatable {
    case rootMissing = "root-missing"
    case rootNotDirectory = "root-not-a-directory"
    case missingDescriptor = "missing-descriptor"
    case malformedDescriptor = "malformed-descriptor"
    case unsupportedDescriptor = "unsupported-descriptor"
    case unknownRuntimeKind = "unknown-runtime-kind"
    case missingBundleDirectory = "missing-bundle-directory"
    case missingModelDirectory = "missing-model-directory"
    case multipleModelDirectories = "multiple-model-directories"
    case incompleteModelDirectory = "incomplete-model-directory"
    case missingTokenizer = "missing-tokenizer"
    case missingTables = "missing-tables"
    case unsafePath = "unsafe-path"
    case unreadable = "unreadable"
}

enum CoreAILocalModelRuntimeKind: String, Equatable {
    case gemma4Ple = "coreai-kit-gemma4-ple"
    case language = "coreai-kit-language"
}

struct CoreAILocalModelResource: Equatable {
    /// Canonical directory that owns the bundle.
    let resourceRoot: URL
    let runtimeKind: CoreAILocalModelRuntimeKind
    /// Directory holding `metadata.json`, `tokenizer/` and the `.aimodel`.
    let bundle: URL
    /// The single verified `*.aimodel` directory.
    let modelDirectory: URL
    /// Embedding tables for the Gemma4 PLE runtime.
    let tables: URL?
    /// `modelId` from `hazakura-model.json`; `nil` for a bare language resource.
    let modelId: String?
    /// `displayName` from `hazakura-model.json`; `nil` when unknown.
    let displayName: String?
}

enum CoreAILocalModelResolution: Equatable {
    case ready(CoreAILocalModelResource)
    case error(CoreAILocalModelErrorCode)

    var resource: CoreAILocalModelResource? {
        if case let .ready(resource) = self { return resource }
        return nil
    }

    var errorCode: CoreAILocalModelErrorCode? {
        if case let .error(code) = self { return code }
        return nil
    }
}

/// The **local** Core AI model contract.
///
/// `CoreAIResourceContract` in `CoreAITestResourceContract.swift` is the
/// *production* gate: it verifies official Apple-hosted bundles against a
/// Hazakura-signed resource manifest, a fixed `modelId`, a reviewed licence
/// status and the licence / notice files that ship with an official model.
///
/// A local bundle - Hazakura's Custom Models directory, a resource folder the
/// user selected, or a `.aimodel` directory - has none of that. This contract
/// therefore checks structure and identity only, and reports "unknown" rather
/// than guessing a licence. It deliberately does not reuse the production gate:
/// a licence-free local bundle must not be reported as a production-valid model.
///
/// The same rules are implemented in Rust
/// (`src-tauri/src/commands/core_ai_local_models.rs`), and both implementations
/// are asserted against the shared fixture spec at
/// `src-tauri/resources/core-ai/local-model-contract-cases.json`. A bundle must
/// not be valid on one side and invalid on the other.
///
/// Passing this gate means "a well-formed Core AI resource bundle the local path
/// may adopt". It is not permission to generate; the local backend wiring is a
/// later C-3 slice.
enum CoreAILocalResourceContract {
    private static let descriptorFilename = "hazakura-model.json"
    private static let languageBundleDescriptor = "metadata.json"
    private static let tokenizerFile = "tokenizer/tokenizer.json"
    private static let modelDirectoryFiles = ["metadata.json", "main.hash", "main.mlirb"]
    private static let gemma4PleTableFiles = [
        "embed_per_layer.i8",
        "embed_per_layer.scale.f32",
    ]
    private static let descriptorSchemaVersion = 1

    /// Resolve a user-selected or app-managed path into a validated local model.
    ///
    /// Symlinks are rejected for the selected root and for every component
    /// inside the resource root, so a selection cannot redirect validation
    /// elsewhere and a bundle cannot hide a missing resource behind a link.
    static func resolve(path: String?) -> CoreAILocalModelResolution {
        guard let path, !path.isEmpty else { return .error(.rootMissing) }
        let selected = URL(fileURLWithPath: path, isDirectory: true)
        switch probe(selected) {
        case .missing: return .error(.rootMissing)
        case .symlink: return .error(.unsafePath)
        case .directory: break
        default: return .error(.rootNotDirectory)
        }
        let root = selected.resolvingSymlinksInPath()

        // A `*.aimodel` directory on its own resolves through its parent bundle.
        if root.pathExtension == "aimodel" {
            let parent = root.deletingLastPathComponent()
            guard parent.path != root.path, parent.path != "/" else {
                return .error(.missingDescriptor)
            }
            return resolveBundle(parent)
        }

        switch probe(root.appendingPathComponent(descriptorFilename)) {
        case .file: return resolveDescribedRoot(root)
        case .symlink: return .error(.unsafePath)
        default: break
        }
        switch probe(root.appendingPathComponent(languageBundleDescriptor)) {
        case .file: return resolveBundle(root)
        case .symlink: return .error(.unsafePath)
        default: break
        }
        return .error(.missingDescriptor)
    }

    private static func resolveBundle(_ bundle: URL) -> CoreAILocalModelResolution {
        if case let .failure(error) = validateLanguageBundle(bundle) {
            return .error(error)
        }
        let modelDirectory: URL
        switch singleModelDirectory(bundle) {
        case let .failure(error): return .error(error)
        case let .success(url): modelDirectory = url
        }
        if case let .failure(error) = validateModelDirectory(modelDirectory) {
            return .error(error)
        }
        return .ready(CoreAILocalModelResource(
            resourceRoot: bundle,
            runtimeKind: .language,
            bundle: bundle,
            modelDirectory: modelDirectory,
            tables: nil,
            modelId: nil,
            displayName: nil
        ))
    }

    private static func resolveDescribedRoot(_ root: URL) -> CoreAILocalModelResolution {
        let descriptorURL = root.appendingPathComponent(descriptorFilename)
        guard let data = try? Data(contentsOf: descriptorURL) else { return .error(.unreadable) }
        guard let descriptor = try? JSONDecoder().decode(HazakuraLocalModelDescriptor.self, from: data)
        else { return .error(.malformedDescriptor) }
        guard descriptor.schemaVersion == descriptorSchemaVersion else {
            return .error(.unsupportedDescriptor)
        }
        guard !descriptor.modelId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return .error(.malformedDescriptor)
        }
        guard let runtimeKind = CoreAILocalModelRuntimeKind(rawValue: descriptor.runtimeKind) else {
            return .error(.unknownRuntimeKind)
        }

        let bundle: URL
        let tables: URL?
        switch runtimeKind {
        case .gemma4Ple:
            let decoderResult = requireDirectory(
                root,
                descriptor.layout.decoder,
                missing: .missingBundleDirectory
            )
            let tablesResult = requireDirectory(
                root,
                descriptor.layout.tables,
                missing: .missingBundleDirectory
            )
            guard let decoder = resolvedValue(decoderResult) else {
                return .error(failureCode(decoderResult, fallback: .missingBundleDirectory))
            }
            guard let tablesURL = resolvedValue(tablesResult) else {
                return .error(failureCode(tablesResult, fallback: .missingBundleDirectory))
            }
            for table in gemma4PleTableFiles {
                if case let .failure(error) = requireFile(tablesURL, table, missing: .missingTables) {
                    return .error(error)
                }
            }
            bundle = decoder
            tables = tablesURL
        case .language:
            switch requireDirectory(
                root,
                descriptor.layout.bundle,
                missing: .missingBundleDirectory
            ) {
            case let .failure(error): return .error(error)
            case let .success(url):
                bundle = url
                tables = nil
            }
        }

        if case let .failure(error) = validateLanguageBundle(bundle) {
            return .error(error)
        }
        let modelDirectory: URL
        switch singleModelDirectory(bundle) {
        case let .failure(error): return .error(error)
        case let .success(url): modelDirectory = url
        }
        if case let .failure(error) = validateModelDirectory(modelDirectory) {
            return .error(error)
        }
        let displayName = descriptor.displayName?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return .ready(CoreAILocalModelResource(
            resourceRoot: root,
            runtimeKind: runtimeKind,
            bundle: bundle,
            modelDirectory: modelDirectory,
            tables: tables,
            modelId: descriptor.modelId,
            displayName: (displayName?.isEmpty == false) ? displayName : nil
        ))
    }

    private static func validateLanguageBundle(
        _ bundle: URL
    ) -> Result<Void, CoreAILocalModelErrorCode> {
        if case let .failure(error) = requireFile(
            bundle,
            languageBundleDescriptor,
            missing: .missingDescriptor
        ) {
            return .failure(error)
        }
        if case let .failure(error) = requireFile(bundle, tokenizerFile, missing: .missingTokenizer) {
            return .failure(error)
        }
        return .success(())
    }

    private static func validateModelDirectory(
        _ directory: URL
    ) -> Result<Void, CoreAILocalModelErrorCode> {
        for file in modelDirectoryFiles {
            if case let .failure(error) = requireFile(
                directory,
                file,
                missing: .incompleteModelDirectory
            ) {
                return .failure(error)
            }
        }
        return .success(())
    }

    /// Returns the single `*.aimodel` directory inside a language bundle.
    private static func singleModelDirectory(
        _ bundle: URL
    ) -> Result<URL, CoreAILocalModelErrorCode> {
        guard let children = try? FileManager.default.contentsOfDirectory(
            at: bundle,
            includingPropertiesForKeys: [.isDirectoryKey, .isSymbolicLinkKey],
            options: []
        ) else { return .failure(.unreadable) }

        var found: [URL] = []
        for child in children where child.pathExtension == "aimodel" {
            switch probe(child) {
            case .symlink: return .failure(.unsafePath)
            case .directory:
                found.append(bundle.appendingPathComponent(child.lastPathComponent, isDirectory: true))
            default: continue
            }
        }
        found.sort { $0.lastPathComponent < $1.lastPathComponent }
        if found.isEmpty { return .failure(.missingModelDirectory) }
        if found.count > 1 { return .failure(.multipleModelDirectories) }
        return .success(found[0])
    }

    private static func requireFile(
        _ root: URL,
        _ relative: String,
        missing: CoreAILocalModelErrorCode
    ) -> Result<URL, CoreAILocalModelErrorCode> {
        switch walk(root, relative, missing: missing) {
        case let .failure(error): return .failure(error)
        case let .success(url): return probe(url) == .file ? .success(url) : .failure(missing)
        }
    }

    private static func requireDirectory(
        _ root: URL,
        _ relative: String?,
        missing: CoreAILocalModelErrorCode
    ) -> Result<URL, CoreAILocalModelErrorCode> {
        guard let relative else { return .failure(missing) }
        switch walk(root, relative, missing: missing) {
        case let .failure(error): return .failure(error)
        case let .success(url): return probe(url) == .directory ? .success(url) : .failure(missing)
        }
    }

    private static func resolvedValue<T>(_ result: Result<T, CoreAILocalModelErrorCode>) -> T? {
        if case let .success(value) = result { return value }
        return nil
    }

    private static func failureCode<T>(
        _ result: Result<T, CoreAILocalModelErrorCode>,
        fallback: CoreAILocalModelErrorCode
    ) -> CoreAILocalModelErrorCode {
        if case let .failure(error) = result { return error }
        return fallback
    }

    /// Walk `relative` from a trusted `root`, rejecting a symlink at *any*
    /// component rather than only at the final element.
    private static func walk(
        _ root: URL,
        _ relative: String,
        missing: CoreAILocalModelErrorCode
    ) -> Result<URL, CoreAILocalModelErrorCode> {
        guard !relative.isEmpty, !relative.hasPrefix("/") else { return .failure(.unsafePath) }
        var current = root
        for component in relative.split(separator: "/", omittingEmptySubsequences: false) {
            if component.isEmpty || component == "." || component == ".." {
                return .failure(.unsafePath)
            }
            current.appendPathComponent(String(component))
            switch probe(current) {
            case .symlink: return .failure(.unsafePath)
            case .missing: return .failure(missing)
            default: break
            }
        }
        return .success(current)
    }

    private enum PathKind: Equatable {
        case file
        case directory
        case symlink
        case missing
        case other
    }

    private static func probe(_ url: URL) -> PathKind {
        guard let values = try? url.resourceValues(forKeys: [
            .isSymbolicLinkKey,
            .isDirectoryKey,
            .isRegularFileKey,
        ]) else { return .missing }
        if values.isSymbolicLink == true { return .symlink }
        if values.isDirectory == true { return .directory }
        if values.isRegularFile == true { return .file }
        return .other
    }
}

/// Minimal shape of a Hazakura local descriptor. Only identity and layout are
/// read; `licensing` deliberately stays unknown for local sources.
private struct HazakuraLocalModelDescriptor: Decodable {
    struct Layout: Decodable {
        let decoder: String?
        let tables: String?
        let bundle: String?
    }

    let schemaVersion: Int
    let modelId: String
    let displayName: String?
    let runtimeKind: String
    let layout: Layout
}
