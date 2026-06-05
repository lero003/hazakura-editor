import Foundation
#if !FIXTURE_MODE
import FoundationModels
#endif

// `AvailabilityProbe` answers the "can we call Foundation Models
// right now?" question. In fixture mode it always answers
// `available` (the JSON envelope is identical to the live mode
// "available" answer) so the Rust→helper→Rust path can be
// exercised without an Apple Silicon Mac with Apple Intelligence
// enabled.
//
// Live mode maps `SystemLanguageModel.default.availability`
// onto the four-state Rust/React availability model.

enum AvailabilityProbe {
    static func probe() -> AppleAssistAvailabilityResponse {
        #if FIXTURE_MODE
        return AppleAssistAvailabilityResponse(kind: "available", reason: nil)
        #else
        if #available(macOS 26.0, *) {
            let model = SystemLanguageModel.default
            guard model.supportsLocale() else {
                return AppleAssistAvailabilityResponse(
                    kind: "unsupported",
                    reason: "Apple Foundation Models does not support the current app language or locale for generation yet: \(Locale.current.identifier)"
                )
            }
            switch model.availability {
            case .available:
                return AppleAssistAvailabilityResponse(kind: "available", reason: nil)
            case .unavailable(let reason):
                return unavailableResponse(for: reason)
            }
        }
        return AppleAssistAvailabilityResponse(
            kind: "unsupported",
            reason: "Foundation Models requires macOS 26 or later."
        )
        #endif
    }

    #if !FIXTURE_MODE
    @available(macOS 26.0, *)
    private static func unavailableResponse(
        for reason: SystemLanguageModel.Availability.UnavailableReason
    ) -> AppleAssistAvailabilityResponse {
        switch reason {
        case .appleIntelligenceNotEnabled:
            return AppleAssistAvailabilityResponse(
                kind: "disabled",
                reason: "Apple Intelligence is not enabled on this Mac."
            )
        case .deviceNotEligible:
            return AppleAssistAvailabilityResponse(
                kind: "unsupported",
                reason: "This Mac is not eligible for Apple Intelligence."
            )
        case .modelNotReady:
            return AppleAssistAvailabilityResponse(
                kind: "unavailable",
                reason: "The Apple Intelligence model is not ready yet."
            )
        @unknown default:
            return AppleAssistAvailabilityResponse(
                kind: "unavailable",
                reason: "Foundation Models is unavailable for an unknown reason."
            )
        }
    }
    #endif
}
