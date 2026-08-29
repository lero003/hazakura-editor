#if !FIXTURE_MODE
import FoundationModels

@available(macOS 26.0, *)
enum SystemAssistRuntime {
    static let model = SystemLanguageModel.default

    static func model(for backend: AssistBackend) -> SystemLanguageModel {
        switch backend {
        case .systemDefault:
            return model
        }
    }

    static func makeSession(
        for backend: AssistBackend,
        instructions: Instructions
    ) -> LanguageModelSession {
        LanguageModelSession(model: model(for: backend), instructions: instructions)
    }
}
#endif
