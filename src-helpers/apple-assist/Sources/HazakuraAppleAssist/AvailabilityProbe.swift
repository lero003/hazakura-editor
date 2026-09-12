import Foundation

// `AvailabilityProbe` answers the "can we call Foundation Models
// right now?" question for the System backend. In fixture mode it
// answers through the same contract composition as live mode (a
// supported Mac with Apple Intelligence on) so the Rust→helper→Rust
// path can be exercised without an Apple Silicon Mac.
//
// The four-state wire is frozen (D24): the response shape and the
// available / disabled / unsupported / unavailable answers do not
// change here. The composition lives in `AssistRuntimeContract`
// (availability and generation capability are separated there);
// live mode reads `SystemLanguageModel` through `SystemAssistRuntime`.

enum AvailabilityProbe {
    static func probe() -> AppleAssistAvailabilityResponse {
        #if FIXTURE_MODE
        return AssistRuntimeContract.probeResponse(status: .fixture)
        #else
        if #available(macOS 26.0, *) {
            return AssistRuntimeContract.probeResponse(status: SystemAssistRuntime.status(for: .systemDefault))
        }
        return AssistRuntimeContract.probeResponse(status: .unsupportedOS)
        #endif
    }
}
