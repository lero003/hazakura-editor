#if !FIXTURE_MODE
import Foundation
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

    // Both generation paths share the System-only availability contract.
    // The public four-state probe stays unchanged; no other backend uses it.
    static func generationAvailabilityError(for backend: AssistBackend) -> AppleAssistErrorEnvelope? {
        let availability = AvailabilityProbe.probe()
        guard availability.kind == "available" else {
            return AppleAssistErrorEnvelope(
                error: availability.reason ?? "Foundation Models is not available.", kind: "unavailable"
            )
        }
        guard model(for: backend).supportsLocale() else {
            return AppleAssistErrorEnvelope(
                error: "Apple Foundation Models does not support the current app language or locale for generation yet: \(Locale.current.identifier)",
                kind: "unsupported_language"
            )
        }
        return nil
    }

    static func makeSession(
        for backend: AssistBackend,
        instructions: Instructions
    ) -> LanguageModelSession {
        LanguageModelSession(model: model(for: backend), instructions: instructions)
    }
}
#endif
