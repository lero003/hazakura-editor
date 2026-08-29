enum AssistBackend {
    case systemDefault

    static let systemDefaultWireValue = "system_default"

    static func resolve(wireValue: String?) -> AssistBackend? {
        guard let wireValue else {
            return .systemDefault
        }
        guard wireValue == systemDefaultWireValue else {
            return nil
        }
        return .systemDefault
    }

    var modelId: String {
        switch self {
        case .systemDefault:
            return "apple:foundation-models:system-default"
        }
    }
}
