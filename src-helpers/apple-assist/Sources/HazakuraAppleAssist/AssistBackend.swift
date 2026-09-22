import Foundation

enum AssistBackend {
    case systemDefault
    case coreAI(modelId: String)
    case coreAILocal(modelId: String)
    case coreAITest

    static let systemDefaultWireValue = "system_default"
    static let coreAIWireValue = "core_ai"
    static let coreAILocalWireValue = "core_ai_local"
    static let coreAITestWireValue = "core_ai_test"

    static func resolve(wireValue: String?, modelId: String? = nil) -> AssistBackend? {
        guard let wireValue else {
            return .systemDefault
        }
        switch wireValue {
        case systemDefaultWireValue:
            return .systemDefault
        case coreAIWireValue:
            guard let modelId,
                  modelId.hasPrefix("apple:core-ai:"),
                  modelId.count <= 160,
                  modelId.unicodeScalars.allSatisfy({
                      CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:._-")
                          .contains($0)
                  }) else {
                return nil
            }
            return .coreAI(modelId: modelId)
        case coreAILocalWireValue:
            let prefix = "local:app-managed:"
            guard let modelId,
                  modelId.hasPrefix(prefix),
                  modelId.count > prefix.count,
                  modelId.count <= 320,
                  modelId.unicodeScalars.allSatisfy({
                      !CharacterSet.controlCharacters.contains($0)
                  }) else {
                return nil
            }
            return .coreAILocal(modelId: modelId)
        case coreAITestWireValue:
            return .coreAITest
        default:
            return nil
        }
    }

    var modelId: String {
        switch self {
        case .systemDefault:
            return "apple:foundation-models:system-default"
        case .coreAI(let modelId):
            return modelId
        case .coreAILocal(let modelId):
            return modelId
        case .coreAITest:
            return "apple:core-ai:qwen3-0.6b-test"
        }
    }
}
