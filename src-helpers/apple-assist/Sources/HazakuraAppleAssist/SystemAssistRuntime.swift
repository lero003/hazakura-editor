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

    /// Read the current availability and generation capability for one
    /// backend. Everything that cannot be evaluated stays explicit
    /// (`capability` exists only on macOS 26+, where it can be read).
    static func status(for backend: AssistBackend) -> AssistRuntimeStatus {
        AssistRuntimeStatus(
            availability: availabilityState(),
            capability: generationCapability(for: backend)
        )
    }

    static func availabilityState() -> AssistAvailabilityState {
        switch model.availability {
        case .available:
            return .available
        case .unavailable(let reason):
            return availabilityState(for: reason)
        }
    }

    static func generationCapability(for backend: AssistBackend) -> AssistGenerationCapability {
        AssistGenerationCapability(
            localeSupported: model(for: backend).supportsLocale(),
            localeIdentifier: Locale.current.identifier
        )
    }

    private static func availabilityState(
        for reason: SystemLanguageModel.Availability.UnavailableReason
    ) -> AssistAvailabilityState {
        switch reason {
        case .appleIntelligenceNotEnabled:
            return .disabled(reason: AssistRuntimeMessages.appleIntelligenceNotEnabled)
        case .deviceNotEligible:
            return .unsupported(reason: AssistRuntimeMessages.deviceNotEligible)
        case .modelNotReady:
            return .unavailable(reason: AssistRuntimeMessages.modelNotReady)
        @unknown default:
            return .unavailable(reason: AssistRuntimeMessages.unavailableUnknownReason)
        }
    }

    // Both generation paths share the System-only availability/capability
    // gate. The public four-state probe stays unchanged; no other backend
    // uses it.
    static func generationAvailabilityError(for backend: AssistBackend) -> AppleAssistErrorEnvelope? {
        AssistRuntimeContract.generationError(status: status(for: backend))
    }

    static func makeSession(
        for backend: AssistBackend,
        instructions: Instructions
    ) -> LanguageModelSession {
        LanguageModelSession(model: model(for: backend), instructions: instructions)
    }
}
#endif
