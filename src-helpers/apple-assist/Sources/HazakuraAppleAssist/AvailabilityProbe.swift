import Foundation

// `AvailabilityProbe` answers the "can we call Foundation Models
// right now?" question. In fixture mode it always answers
// `available` (the JSON envelope is identical to the live mode
// "available" answer) so the Rust→helper→Rust path can be
// exercised without an Apple Silicon Mac with Apple Intelligence
// enabled.
//
// Live mode is intentionally a stub at this slice (Slice 5
// feasibility spike). The real binding will:
//   1. Check `if #available(macOS 26.0, *)` to gate the call.
//   2. Open a `LanguageModelSession` and check its readiness.
//   3. Map the readiness state onto our 4-state enum:
//      * model loaded + warmed up → `available`
//      * Apple Intelligence disabled in System Settings → `disabled`
//      * macOS older than 26 / Foundation Models missing → `unsupported`
//      * model still downloading / device busy → `unavailable` with reason
// The current implementation returns `unsupported` from the
// live path so an accidental shipping of a partial helper does
// NOT advertise `available` and trigger the UI commands.

enum AvailabilityProbe {
    static func probe() -> AppleAssistAvailabilityResponse {
        #if FIXTURE_MODE
        return AppleAssistAvailabilityResponse(kind: "available", reason: nil)
        #else
        // TODO(slice-5+): real Foundation Models availability check.
        // Until then, claim `unsupported` so the React layer hides
        // the command palette entries; this is the safe default.
        return AppleAssistAvailabilityResponse(
            kind: "unsupported",
            reason: nil
        )
        #endif
    }
}
