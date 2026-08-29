#if !FIXTURE_MODE
import FoundationModels

@available(macOS 26.0, *)
enum SystemAssistRuntime {
    static let model = SystemLanguageModel.default

    static func makeSession(instructions: Instructions) -> LanguageModelSession {
        LanguageModelSession(model: model, instructions: instructions)
    }
}
#endif
