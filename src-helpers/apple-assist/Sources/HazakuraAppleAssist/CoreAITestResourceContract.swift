import Foundation

enum CoreAITestResourceState: Equatable {
    case ready(URL)
    case missing
    case invalid
}

enum CoreAIProductionRuntimeKind: String, Decodable, Equatable {
    case gemma4PLE = "coreai-kit-gemma4-ple"
    case language = "coreai-kit-language"
}

struct CoreAIProductionResource: Equatable {
    let root: URL
    let runtimeKind: CoreAIProductionRuntimeKind
    let bundle: URL
    /// The `*.aimodel` directory that `validLanguageBundle` verified. The cache
    /// signature must look here, not at `bundle/main.hash` which never exists.
    let modelDirectory: URL
    let tables: URL?
}

enum CoreAIProductionResourceState: Equatable {
    case ready(CoreAIProductionResource)
    case missing
    case invalid
}

private struct CoreAIProductionMetadata: Decodable {
    struct Layout: Decodable {
        let decoder: String?
        let tables: String?
        let bundle: String?
    }

    struct Licensing: Decodable {
        let reviewStatus: String
        let licenseFiles: [String]
    }

    let schemaVersion: Int
    let modelId: String
    let runtimeKind: CoreAIProductionRuntimeKind
    let layout: Layout
    let licensing: Licensing
}

/// Structural gate for the fixed Developer-only Qwen bundle. This is not the
/// C-1 digest/manifest verifier; it only keeps missing and malformed resources
/// distinct before Core AI attempts to load them.
enum CoreAITestResourceContract {
    private static let modelDirectory = "hazakura-qwen3-0.6b-test.aimodel"

    static func validate(path: String?) -> CoreAITestResourceState {
        guard let path, !path.isEmpty else { return .missing }
        let root = URL(fileURLWithPath: path, isDirectory: true).standardizedFileURL
        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: root.path, isDirectory: &isDirectory),
              isDirectory.boolValue else {
            return .missing
        }

        let requiredFiles = [
            "metadata.json",
            "LICENSE",
            "tokenizer/tokenizer.json",
            "\(modelDirectory)/metadata.json",
            "\(modelDirectory)/main.hash",
            "\(modelDirectory)/main.mlirb",
        ]
        for relativePath in requiredFiles {
            var childIsDirectory: ObjCBool = false
            let child = root.appendingPathComponent(relativePath)
            guard FileManager.default.fileExists(atPath: child.path, isDirectory: &childIsDirectory),
                  !childIsDirectory.boolValue else {
                return .invalid
            }
        }
        return .ready(root)
    }
}

/// Structural gate for production Core AI assets selected by the native
/// catalog. The catalog owns identity and location; the helper only accepts a
/// converted Core AI bundle with one `.aimodel` directory. It never accepts a
/// URL, GGUF file, or a model identity supplied by the webview.
enum CoreAIResourceContract {
    /// License-review statuses the production catalog may ship.
    /// `reviewed-apache-2.0` is the 12B entry: the Gemma 4 weights are
    /// Apache-2.0, and the conversion repository's own LICENSE file (which still
    /// carries the Gemma Terms text) is retained verbatim for provenance.
    private static let acceptedReviewStatuses: Set<String> = [
        "manual-review-required",
        "reviewed-apache-2.0",
    ]

    /// Identity of a loaded resource: the verified metadata plus every input that
    /// changes what the engine produces, including the real `.aimodel/main.hash`
    /// and the tokenizer files that decide stopping and prompt formatting.
    ///
    /// Returns `nil` when a required input cannot be read. Callers must treat that
    /// as "identity unknown" and skip the cache rather than reuse a stale model.
    static func signature(for resource: CoreAIProductionResource) -> String? {
        var parts = [
            resource.root.path,
            resource.runtimeKind.rawValue,
            resource.bundle.path,
            resource.modelDirectory.path,
        ]
        let required = [
            resource.root.appendingPathComponent("hazakura-model.json"),
            resource.modelDirectory.appendingPathComponent("main.hash"),
            resource.bundle.appendingPathComponent("tokenizer/tokenizer.json"),
            resource.bundle.appendingPathComponent("tokenizer/tokenizer_config.json"),
            resource.bundle.appendingPathComponent("tokenizer/chat_template.jinja"),
        ]
        for url in required {
            guard let stamp = fileStamp(url) else { return nil }
            parts.append("\(url.lastPathComponent)=\(stamp)")
        }
        if let tables = resource.tables {
            parts.append(tables.path)
            for name in ["embed_per_layer.i8", "embed_per_layer.scale.f32"] {
                guard let stamp = fileStamp(tables.appendingPathComponent(name)) else { return nil }
                parts.append("\(name)=\(stamp)")
            }
        }
        return parts.joined(separator: "|")
    }

    private static func fileStamp(_ url: URL) -> String? {
        guard let values = try? url.resourceValues(forKeys: [.fileSizeKey, .contentModificationDateKey]),
              let size = values.fileSize,
              let modified = values.contentModificationDate else {
            return nil
        }
        return "\(size):\(Int(modified.timeIntervalSince1970))"
    }

    static func validate(path: String?, expectedModelId: String) -> CoreAIProductionResourceState {
        guard let path, !path.isEmpty else { return .missing }
        let root = URL(fileURLWithPath: path, isDirectory: true).standardizedFileURL
        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: root.path, isDirectory: &isDirectory),
              isDirectory.boolValue else {
            return .missing
        }

        let metadataURL = root.appendingPathComponent("hazakura-model.json")
        guard let data = try? Data(contentsOf: metadataURL),
              let metadata = try? JSONDecoder().decode(CoreAIProductionMetadata.self, from: data),
              metadata.schemaVersion == 1,
              metadata.modelId == expectedModelId,
              acceptedReviewStatuses.contains(metadata.licensing.reviewStatus),
              metadata.licensing.licenseFiles.contains("LICENSE-APACHE-2.0.txt") else {
            return .invalid
        }
        let requiredRootFiles = [
            "hazakura-model.json",
            "THIRD_PARTY_MODEL_NOTICE.md",
        ] + metadata.licensing.licenseFiles
        for relativePath in requiredRootFiles {
            guard safeRootFile(relativePath, under: root) else { return .invalid }
        }

        switch metadata.runtimeKind {
        case .gemma4PLE:
            guard let decoder = safeDirectory(metadata.layout.decoder, under: root),
                  let tables = safeDirectory(metadata.layout.tables, under: root),
                  let decoderModel = languageModelDirectory(decoder),
                  regularFile(tables.appendingPathComponent("embed_per_layer.i8")),
                  regularFile(tables.appendingPathComponent("embed_per_layer.scale.f32")) else {
                return .invalid
            }
            return .ready(CoreAIProductionResource(
                root: root,
                runtimeKind: metadata.runtimeKind,
                bundle: decoder,
                modelDirectory: decoderModel,
                tables: tables
            ))
        case .language:
            guard let bundle = safeDirectory(metadata.layout.bundle, under: root),
                  let bundleModel = languageModelDirectory(bundle) else {
                return .invalid
            }
            return .ready(CoreAIProductionResource(
                root: root,
                runtimeKind: metadata.runtimeKind,
                bundle: bundle,
                modelDirectory: bundleModel,
                tables: nil
            ))
        }
    }

    private static func safeDirectory(_ relativePath: String?, under root: URL) -> URL? {
        guard let relativePath,
              !relativePath.isEmpty,
              !relativePath.hasPrefix("/"),
              !relativePath.split(separator: "/", omittingEmptySubsequences: false).contains("..") else {
            return nil
        }
        let candidate = root.appendingPathComponent(relativePath, isDirectory: true).standardizedFileURL
        guard candidate.path.hasPrefix(root.path + "/") else { return nil }
        guard let values = try? candidate.resourceValues(forKeys: [
            .isDirectoryKey,
            .isSymbolicLinkKey,
        ]),
              values.isDirectory == true,
              values.isSymbolicLink != true else { return nil }
        return candidate
    }

    private static func safeRootFile(_ relativePath: String, under root: URL) -> Bool {
        guard !relativePath.isEmpty,
              !relativePath.hasPrefix("/"),
              !relativePath.split(separator: "/", omittingEmptySubsequences: false).contains("..") else {
            return false
        }
        let candidate = root.appendingPathComponent(relativePath).standardizedFileURL
        guard candidate.path.hasPrefix(root.path + "/") else { return false }
        return regularFile(candidate)
    }

    /// Returns the single verified `*.aimodel` directory inside a language
    /// bundle, or `nil` when the bundle is not the expected shape.
    private static func languageModelDirectory(_ root: URL) -> URL? {
        guard regularFile(root.appendingPathComponent("metadata.json")),
              regularFile(root.appendingPathComponent("tokenizer/tokenizer.json")),
              let children = try? FileManager.default.contentsOfDirectory(
                  at: root,
                  includingPropertiesForKeys: [.isDirectoryKey],
                  options: [.skipsHiddenFiles]
              ) else { return nil }
        let modelDirectories = children.filter { child in
            guard child.pathExtension == "aimodel",
                  let values = try? child.resourceValues(forKeys: [
                      .isDirectoryKey,
                      .isSymbolicLinkKey,
                  ]) else { return false }
            return values.isDirectory == true && values.isSymbolicLink != true
        }
        guard modelDirectories.count == 1, let modelDirectory = modelDirectories.first else {
            return nil
        }
        guard ["metadata.json", "main.hash", "main.mlirb"].allSatisfy({
            regularFile(modelDirectory.appendingPathComponent($0))
        }) else { return nil }
        // Rebuild from the caller's root so the returned path uses the same
        // normalization as `bundle`. `contentsOfDirectory` resolves /var to
        // /private/var, which would otherwise make Equatable comparisons and
        // cache signatures inconsistent.
        return root
            .appendingPathComponent(modelDirectory.lastPathComponent, isDirectory: true)
            .standardizedFileURL
    }

    private static func regularFile(_ url: URL) -> Bool {
        guard let values = try? url.resourceValues(forKeys: [
            .isRegularFileKey,
            .isSymbolicLinkKey,
        ]) else { return false }
        return values.isRegularFile == true && values.isSymbolicLink != true
    }
}
