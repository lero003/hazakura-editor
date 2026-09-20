import Foundation

enum CoreAITestResourceState: Equatable {
    case ready(URL)
    case missing
    case invalid
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
    static func validate(path: String?) -> CoreAITestResourceState {
        guard let path, !path.isEmpty else { return .missing }
        let root = URL(fileURLWithPath: path, isDirectory: true).standardizedFileURL
        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: root.path, isDirectory: &isDirectory),
              isDirectory.boolValue else {
            return .missing
        }

        let requiredRootFiles = ["metadata.json", "LICENSE", "tokenizer/tokenizer.json"]
        for relativePath in requiredRootFiles {
            var childIsDirectory: ObjCBool = false
            let child = root.appendingPathComponent(relativePath)
            guard FileManager.default.fileExists(atPath: child.path, isDirectory: &childIsDirectory),
                  !childIsDirectory.boolValue else {
                return .invalid
            }
        }

        guard let children = try? FileManager.default.contentsOfDirectory(
            at: root,
            includingPropertiesForKeys: [.isDirectoryKey],
            options: [.skipsHiddenFiles]
        ) else {
            return .invalid
        }
        let modelDirectories = children.filter { $0.pathExtension == "aimodel" }
        guard modelDirectories.count == 1, let modelDirectory = modelDirectories.first else {
            return .invalid
        }
        for name in ["metadata.json", "main.hash", "main.mlirb"] {
            var childIsDirectory: ObjCBool = false
            let child = modelDirectory.appendingPathComponent(name)
            guard FileManager.default.fileExists(atPath: child.path, isDirectory: &childIsDirectory),
                  !childIsDirectory.boolValue else {
                return .invalid
            }
        }
        return .ready(root)
    }
}
