import Foundation

// Response envelopes — kept symmetric with the Rust side. The
// helper writes ONE JSON object per stdin request to stdout,
// terminated by a newline. Anything written to stderr is
// treated as a log line by the Rust supervisor and is NEVER
// shown to the user. Errors are first-class members of the
// envelope so the Rust side can pattern-match instead of having
// to parse stderr.

struct AppleAssistResponse: Codable {
    let operation: String
    let candidateText: String
    let modelId: String
    let latencyMs: Int
}

struct AppleAssistPartialResponse: Codable {
    let candidateText: String
}

struct AppleAssistAvailabilityResponse: Codable {
    // tag is one of "available" | "unavailable" | "disabled" | "unsupported"
    // (matches the AppleAssistAvailability serde enum on the Rust side)
    let kind: String
    let reason: String?
}

// Error envelope — written when the helper cannot honor the
// request at all. The Rust side maps this onto a `Result::Err`
// so the React layer surfaces the same locale-aware
// `availabilityUnavailablePrefix + reason` UX as a probe
// failure. The helper never throws an OS-level error to the
// caller; it returns a JSON envelope.
struct AppleAssistErrorEnvelope: Codable {
    let error: String
    let kind: String  // "deferred" | "validation" | "unavailable" | "guardrail" | "throttled" | "internal"
}
