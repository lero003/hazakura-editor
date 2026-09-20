enum AssistBackend {
    case systemDefault
    case coreAITest

    static let systemDefaultWireValue = "system_default"
    static let coreAITestWireValue = "core_ai_test"

    static func resolve(wireValue: String?) -> AssistBackend? {
        guard let wireValue else {
            return .systemDefault
        }
        switch wireValue {
        case systemDefaultWireValue:
            return .systemDefault
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
        case .coreAITest:
            return "apple:core-ai:qwen3-0.6b-test"
        }
    }
}
