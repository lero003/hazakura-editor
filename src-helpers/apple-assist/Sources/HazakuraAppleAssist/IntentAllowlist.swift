import Foundation

// In fixture mode the candidate text is the same prefix +
// passthrough that the Rust stub returns from
// `generate_apple_assist_candidate_with_stub`. Keeping the two
// in sync is a deliberate choice: integration tests assert on
// the prefix, and the Rust unit tests assert on the same
// prefix. This file is the single source of truth for the
// prefix table.

enum CandidatePrefix {
    static func prefix(for operation: String) -> String {
        switch operation {
        case "summarize":
            return "【要約案】\n"
        case "rephrase":
            return "【書き換え案】\n"
        case "extract":
            return "【抽出案】\n"
        case "proofread":
            return "【校正案】\n"
        case "explain_diff":
            return "【差分説明案】\n"
        default:
            return "【候補】\n"
        }
    }

    static func fixtureModelId() -> String {
        return "fixture:helper-v0.12"
    }
}
