import Foundation

// LA-1 (v3.0): the common runtime contract that separates the two
// questions the System-only probe used to answer together:
//
//   * 利用可否 (availability) — can the System backend be used at all right
//     now? Four states, wire-compatible with the frozen
//     `probe_apple_assist_availability` response (D24).
//   * 生成能力 (capability) — what can this backend generate for the current
//     app language/locale? Independent of availability, and explicitly
//     *unknown* when it cannot be evaluated (for example below macOS 26).
//
// The product wire does not change: `probeResponse` composes the same
// available / disabled / unsupported / unavailable answers the app already
// consumed (locale failure first, as before). `generationError` is the gate
// used by both generation paths; it classifies a locale capability failure
// as `unsupported_language` instead of folding it into `unavailable`.
//
// This file compiles in both fixture and live builds, so the composition is
// testable without Foundation Models; the live readers live in
// `SystemAssistRuntime`.

/// Availability of one Local Assist backend (System-only in v3.0).
/// Reasons are user-facing strings and must stay byte-stable: the TS layer
/// classifies failures from these messages (src/lib/appleAssist/errors.ts).
enum AssistAvailabilityState: Equatable {
    case available
    /// Apple Intelligence is off.
    case disabled(reason: String)
    /// This Mac or OS cannot run the model (device not eligible, OS < 26).
    case unsupported(reason: String)
    /// The model exists but cannot be used right now (model not ready, unknown).
    case unavailable(reason: String)
}

/// Generation capability of a backend, independent of availability.
/// macOS 26 exposes one generation-blocking capability: locale support.
/// Future capabilities (budget observation, guided generation) extend this
/// type in their own slices; nothing speculative is modeled here.
struct AssistGenerationCapability: Equatable {
    let localeSupported: Bool
    let localeIdentifier: String
}

/// Observed status for one backend. `capability == nil` means "could not be
/// evaluated" (below macOS 26) — callers must not guess it.
struct AssistRuntimeStatus: Equatable {
    let availability: AssistAvailabilityState
    let capability: AssistGenerationCapability?
}

extension AssistRuntimeStatus {
    /// Below macOS 26: unsupported, and generation capability is not measurable.
    static var unsupportedOS: AssistRuntimeStatus {
        AssistRuntimeStatus(
            availability: .unsupported(reason: AssistRuntimeMessages.requiresMacOS26),
            capability: nil
        )
    }
}

#if FIXTURE_MODE
extension AssistRuntimeStatus {
    /// Fixture builds answer as a supported Mac with Apple Intelligence on.
    static var fixture: AssistRuntimeStatus {
        AssistRuntimeStatus(
            availability: .available,
            capability: AssistGenerationCapability(
                localeSupported: true,
                localeIdentifier: Locale.current.identifier
            )
        )
    }
}
#endif

/// Stable user-facing reasons. The TS side classifies failures from these
/// strings, so treat them as a wire contract. Byte-stable >= a new message.
enum AssistRuntimeMessages {
    static let requiresMacOS26 = "Foundation Models requires macOS 26 or later."
    static let appleIntelligenceNotEnabled = "Apple Intelligence is not enabled on this Mac."
    static let deviceNotEligible = "This Mac is not eligible for Apple Intelligence."
    static let modelNotReady = "The Apple Intelligence model is not ready yet."
    static let unavailableUnknownReason = "Foundation Models is unavailable for an unknown reason."
    static func localeUnsupported(_ localeIdentifier: String) -> String {
        "Apple Foundation Models does not support the current app language or locale for generation yet: \(localeIdentifier)"
    }
}

enum AssistRuntimeContract {
    /// Compose the frozen four-state availability wire from the two concerns.
    /// The current order is kept: a locale capability failure answers
    /// `unsupported` even when availability also fails.
    static func probeResponse(status: AssistRuntimeStatus) -> AppleAssistAvailabilityResponse {
        if let capability = status.capability, !capability.localeSupported {
            return AppleAssistAvailabilityResponse(
                kind: "unsupported",
                reason: AssistRuntimeMessages.localeUnsupported(capability.localeIdentifier)
            )
        }
        switch status.availability {
        case .available:
            return AppleAssistAvailabilityResponse(kind: "available", reason: nil)
        case .disabled(let reason):
            return AppleAssistAvailabilityResponse(kind: "disabled", reason: reason)
        case .unsupported(let reason):
            return AppleAssistAvailabilityResponse(kind: "unsupported", reason: reason)
        case .unavailable(let reason):
            return AppleAssistAvailabilityResponse(kind: "unavailable", reason: reason)
        }
    }

    /// The gate shared by both generation paths (stream / non-stream).
    /// Availability failures stay `unavailable`; a locale capability failure
    /// is `unsupported_language` — the same kind the SDK error fold uses for
    /// `unsupportedLanguageOrLocale`, so pre-flight and at-generation failures
    /// classify identically.
    static func generationError(status: AssistRuntimeStatus) -> AppleAssistErrorEnvelope? {
        if let capability = status.capability, !capability.localeSupported {
            return AppleAssistErrorEnvelope(
                error: AssistRuntimeMessages.localeUnsupported(capability.localeIdentifier),
                kind: "unsupported_language"
            )
        }
        switch status.availability {
        case .available:
            return nil
        case .disabled(let reason), .unsupported(let reason), .unavailable(let reason):
            return AppleAssistErrorEnvelope(error: reason, kind: "unavailable")
        }
    }
}
