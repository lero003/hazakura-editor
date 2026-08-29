enum AssistBackend {
    case systemDefault

    var modelId: String {
        switch self {
        case .systemDefault:
            return "apple:foundation-models:system-default"
        }
    }
}
