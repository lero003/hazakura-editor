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
    /// A cheap identity for a validated resource: paths plus the size and
    /// modification time of the files that define the loaded weights. A
    /// re-download or re-stage changes the stamp, so a cached runtime is not
    /// reused across the replacement.
    static func signature(for resource: CoreAIProductionResource) -> String {
        var parts = [
            resource.root.path,
            resource.runtimeKind.rawValue,
            resource.bundle.path,
            fileStamp(resource.root.appendingPathComponent("hazakura-model.json")),
            fileStamp(resource.bundle.appendingPathComponent("main.hash")),
        ]
        if let tables = resource.tables {
            parts.append(tables.path)
            parts.append(fileStamp(tables.appendingPathComponent("embed_per_layer.i8")))
            parts.append(fileStamp(tables.appendingPathComponent("embed_per_layer.scale.f32")))
        }
        return parts.joined(separator: "|")
    }

    private static func fileStamp(_ url: URL) -> String {
        let values = try? url.resourceValues(forKeys: [.fileSizeKey, .contentModificationDateKey])
        let size = values?.fileSize.map(String.init) ?? "?"
        let modified = values?.contentModificationDate.map { String(Int($0.timeIntervalSince1970)) } ?? "?"
        return "\(size):\(modified)"
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
              metadata.licensing.reviewStatus == "manual-review-required",
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
                  validLanguageBundle(decoder),
                  regularFile(tables.appendingPathComponent("embed_per_layer.i8")),
                  regularFile(tables.appendingPathComponent("embed_per_layer.scale.f32")) else {
                return .invalid
            }
            return .ready(CoreAIProductionResource(
                root: root,
                runtimeKind: metadata.runtimeKind,
                bundle: decoder,
                tables: tables
            ))
        case .language:
            guard let bundle = safeDirectory(metadata.layout.bundle, under: root),
                  validLanguageBundle(bundle) else {
                return .invalid
            }
            return .ready(CoreAIProductionResource(
                root: root,
                runtimeKind: metadata.runtimeKind,
                bundle: bundle,
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

    private static func validLanguageBundle(_ root: URL) -> Bool {
        guard regularFile(root.appendingPathComponent("metadata.json")),
              regularFile(root.appendingPathComponent("tokenizer/tokenizer.json")),
              let children = try? FileManager.default.contentsOfDirectory(
                  at: root,
                  includingPropertiesForKeys: [.isDirectoryKey],
                  options: [.skipsHiddenFiles]
              ) else { return false }
        let modelDirectories = children.filter { child in
            guard child.pathExtension == "aimodel",
                  let values = try? child.resourceValues(forKeys: [
                      .isDirectoryKey,
                      .isSymbolicLinkKey,
                  ]) else { return false }
            return values.isDirectory == true && values.isSymbolicLink != true
        }
        guard modelDirectories.count == 1, let modelDirectory = modelDirectories.first else {
            return false
        }
        return ["metadata.json", "main.hash", "main.mlirb"].allSatisfy {
            regularFile(modelDirectory.appendingPathComponent($0))
        }
    }

    private static func regularFile(_ url: URL) -> Bool {
        guard let values = try? url.resourceValues(forKeys: [
            .isRegularFileKey,
            .isSymbolicLinkKey,
        ]) else { return false }
        return values.isRegularFile == true && values.isSymbolicLink != true
    }
}
