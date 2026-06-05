import Foundation

// `GenerateCandidate.run` is the single dispatch point for the
// `generate_apple_assist_candidate` request. In fixture mode it
// returns prefix + selected text — the same shape the Rust stub
// produces, so the Rust integration test can be one assertion
// against either side.
//
// Live mode is the same TODO as `AvailabilityProbe` — it falls
// back to a `deferred` error envelope so a half-shipped helper
// does NOT leak partial / hallucinated text.

enum GenerateCandidate {
    enum RunResult {
        case ok(AppleAssistResponse)
        case error(AppleAssistErrorEnvelope)
    }

    static func run(_ request: AppleAssistRequest) -> RunResult {
        guard IntentAllowlist.allOperations.contains(request.operation) else {
            return .error(
                AppleAssistErrorEnvelope(
                    error: "Unknown operation: \(request.operation)",
                    kind: "validation"
                )
            )
        }

        guard IntentAllowlist.implementedInV0_12.contains(request.operation) else {
            return .error(
                AppleAssistErrorEnvelope(
                    error: "Operation '\(request.operation)' is deferred in v0.12.",
                    kind: "deferred"
                )
            )
        }

        #if FIXTURE_MODE
        let candidate =
            CandidatePrefix.prefix(for: request.operation) + request.selectedText
        return .ok(
            AppleAssistResponse(
                operation: request.operation,
                candidateText: candidate,
                modelId: CandidatePrefix.fixtureModelId(),
                latencyMs: 0
            )
        )
        #else
        // TODO(slice-5+): wire LanguageModelSession here. Until
        // the live binding lands, the helper refuses to invent
        // text so the user can't get a hallucinated edit.
        return .error(
            AppleAssistErrorEnvelope(
                error:
                    "Foundation Models binding is not implemented yet in this build.",
                kind: "deferred"
            )
        )
        #endif
    }
}
