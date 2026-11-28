import FoundationModels

/// An isolated comparison probe; the caller cannot supply text or retain a session.
@MainActor
enum AssistFoundationModelProbe {
    enum Availability: String, Codable, Sendable {
        case available
        case deviceNotEligible
        case appleIntelligenceNotEnabled
        case modelNotReady
        case unavailable
    }

    private enum ProbeError: Error {
        case unavailable
        case generationFailed
    }

    static func availability() -> Availability {
        switch SystemLanguageModel.default.availability {
        case .available:
            return .available
        case .unavailable(let reason):
            switch reason {
            case .deviceNotEligible:
                return .deviceNotEligible
            case .appleIntelligenceNotEnabled:
                return .appleIntelligenceNotEnabled
            case .modelNotReady:
                return .modelNotReady
            @unknown default:
                return .unavailable
            }
        }
    }

    static func generate() async throws -> String {
        try Task.checkCancellation()
        let model = SystemLanguageModel.default
        guard model.isAvailable else { throw ProbeError.unavailable }

        let instructions = Instructions("原文の意味を変えず、重複を減らして、短く自然な日本語に書き直してください。書き直した本文だけを返してください。")
        let source = Prompt("図書室の窓を開けたら、外からすずしい風が入ってきました。その風が気持ちよかったので、しばらく窓を開けたままにしました。")
        let session = LanguageModelSession(model: model, tools: [], instructions: instructions)

        try Task.checkCancellation()
        let candidate: String
        do {
            candidate = try await session.respond(
                to: source,
                options: GenerationOptions(maximumResponseTokens: 128)
            ).content
        } catch is CancellationError {
            throw CancellationError()
        } catch {
            try Task.checkCancellation()
            throw ProbeError.generationFailed
        }
        try Task.checkCancellation()
        return candidate
    }
}
