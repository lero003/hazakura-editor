import Foundation
#if COREAI_TEST_BACKEND && !FIXTURE_MODE
import CoreAILanguageModels
import FoundationModels
#endif

enum CoreAITestRuntime {
    static let requiresMacOS27 = "Core AI test models require macOS 27 or later."
    static let requiresAppleSilicon = "Core AI test models require Apple Silicon."
    static let adapterNotBuilt = "The Core AI test adapter is not included in this Developer build."
    static let resourceMissing = "The fixed Core AI test resource is missing."
    static let resourceInvalid = "The fixed Core AI test resource is invalid."
    static let modelLoadFailed = "The Core AI test model failed to load."
    static let generationFailed = "Core AI test generation failed."
    static let emptyCandidate = "Core AI returned an empty candidate."
    static let maximumResponseTokens = 128

    static func probe(modelPath: String?) async -> AppleAssistAvailabilityResponse {
        guard #available(macOS 27.0, *) else {
            return unavailable(requiresMacOS27)
        }
        #if arch(arm64)
        #if COREAI_TEST_BACKEND && !FIXTURE_MODE
        do {
            _ = try await loadModel(modelPath: modelPath)
            return AppleAssistAvailabilityResponse(kind: "available", reason: nil)
        } catch let failure as CoreAITestRuntimeFailure {
            return unavailable(message(for: failure))
        } catch {
            return unavailable(modelLoadFailed)
        }
        #else
        return unavailable(adapterNotBuilt)
        #endif
        #else
        return unavailable(requiresAppleSilicon)
        #endif
    }

    static func unavailableErrorForCurrentHost() -> AppleAssistErrorEnvelope? {
        guard #available(macOS 27.0, *) else {
            return AppleAssistErrorEnvelope(error: requiresMacOS27, kind: "unavailable")
        }
        #if arch(arm64)
        #if COREAI_TEST_BACKEND && !FIXTURE_MODE
        return nil
        #else
        return AppleAssistErrorEnvelope(error: adapterNotBuilt, kind: "unavailable")
        #endif
        #else
        return AppleAssistErrorEnvelope(error: requiresAppleSilicon, kind: "unavailable")
        #endif
    }

    private static func unavailable(_ reason: String) -> AppleAssistAvailabilityResponse {
        AppleAssistAvailabilityResponse(kind: "unavailable", reason: reason)
    }

    #if COREAI_TEST_BACKEND && !FIXTURE_MODE
    enum CoreAITestRuntimeFailure: Error {
        case resourceMissing
        case resourceInvalid
        case modelLoadFailed
    }

    @available(macOS 27.0, *)
    static func loadModel(modelPath: String?) async throws -> CoreAILanguageModel {
        let resourceURL: URL
        switch CoreAITestResourceContract.validate(path: modelPath) {
        case .ready(let url):
            resourceURL = url
        case .missing:
            throw CoreAITestRuntimeFailure.resourceMissing
        case .invalid:
            throw CoreAITestRuntimeFailure.resourceInvalid
        }

        do {
            let model = try await CoreAILanguageModel(resourcesAt: resourceURL, mode: .eager)
            try await model.load()
            return model
        } catch {
            throw CoreAITestRuntimeFailure.modelLoadFailed
        }
    }

    static func loadError(_ error: Error) -> AppleAssistErrorEnvelope {
        let message: String
        if let failure = error as? CoreAITestRuntimeFailure {
            message = self.message(for: failure)
        } else {
            message = modelLoadFailed
        }
        return AppleAssistErrorEnvelope(error: message, kind: "unavailable")
    }

    @available(macOS 27.0, *)
    static func generationError(_ error: Error) -> AppleAssistErrorEnvelope {
        if let generationError = error as? LanguageModelSession.GenerationError {
            switch generationError {
            case .exceededContextWindowSize(_):
                return AppleAssistErrorEnvelope(
                    error: "Core AI input is too large for this request. Try a smaller selection.",
                    kind: "context_exceeded"
                )
            case .assetsUnavailable(_):
                return AppleAssistErrorEnvelope(error: modelLoadFailed, kind: "unavailable")
            case .guardrailViolation(_):
                return AppleAssistErrorEnvelope(
                    error: "Core AI refused this request because it hit a guardrail.",
                    kind: "guardrail"
                )
            case .unsupportedGuide(_):
                return AppleAssistErrorEnvelope(
                    error: "Core AI does not support this generation guide.",
                    kind: "unsupported_capability"
                )
            case .unsupportedLanguageOrLocale(_):
                return AppleAssistErrorEnvelope(
                    error: "Core AI does not support this language or locale for generation.",
                    kind: "unsupported_capability"
                )
            case .decodingFailure(_):
                return AppleAssistErrorEnvelope(error: generationFailed, kind: "internal")
            case .rateLimited(_), .concurrentRequests(_):
                return AppleAssistErrorEnvelope(
                    error: "Core AI is busy with another request. Try again shortly.",
                    kind: "throttled"
                )
            case .refusal(_, _):
                return AppleAssistErrorEnvelope(
                    error: "Core AI refused this request.",
                    kind: "refusal"
                )
            @unknown default:
                break
            }
        }
        return AppleAssistErrorEnvelope(error: generationFailed, kind: "internal")
    }

    private static func message(for failure: CoreAITestRuntimeFailure) -> String {
        switch failure {
        case .resourceMissing:
            return resourceMissing
        case .resourceInvalid:
            return resourceInvalid
        case .modelLoadFailed:
            return modelLoadFailed
        }
    }
    #endif
}
