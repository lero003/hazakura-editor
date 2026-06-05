import Foundation

// Request types — must stay byte-compatible with the Rust
// `AppleAssistRequest` / Tauri-side serde structures defined in
// `src-tauri/src/commands/apple_assist.rs`. The Rust side caps
// `selectedText` (4000 chars) and `documentContext` (8000 chars)
// and `instruction` (1000 chars)
// before invocation; this helper trusts the caller did so and
// does NOT re-validate sizes — the boundary check belongs to the
// Rust side, not Swift.

struct AppleAssistRequest: Codable {
    let operation: String
    let selectedText: String
    let documentContext: String?
    let instruction: String?
}

// `IntentAllowlist` mirrors the v0.12 implemented-operations set
// (`summarize`, `rephrase`, `proofread`). The helper rejects any other
// operation as "deferred" — even though the enum on the Rust
// side already filters them — so a future bypass of the Rust
// gate cannot ride through into a real Foundation Models call.
enum IntentAllowlist {
    static let implementedInV0_12: Set<String> = ["summarize", "rephrase", "proofread"]
    static let allOperations: Set<String> = [
        "summarize", "rephrase", "extract", "proofread", "explain_diff"
    ]
}
