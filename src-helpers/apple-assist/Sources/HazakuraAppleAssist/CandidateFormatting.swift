import Foundation

enum CandidateFormatting {
    static func reviewText(_ value: String, original: String) -> String {
        let text = stripOuterPromptEnvelope(
            stripOuterControlTokens(value, keepingTokensPresentIn: original),
            keepingMarkersPresentIn: original
        )
        // A source code block is content, not an assistant wrapper.
        guard !original.trimmingCharacters(in: .whitespacesAndNewlines).hasPrefix("```") else { return text }
        let lines = text.components(separatedBy: "\n")
        guard lines.count >= 3,
              ["```markdown", "```md"].contains(lines[0].trimmingCharacters(in: .whitespaces)),
              lines.last?.trimmingCharacters(in: .whitespaces) == "```" else { return text }
        let body = lines.dropFirst().dropLast()
        // Ambiguous nested/separate fences remain visible for Diff review.
        guard !body.contains(where: { $0.trimmingCharacters(in: .whitespaces).hasPrefix("```") }) else { return text }
        return stripOuterPromptEnvelope(
            stripOuterControlTokens(body.joined(separator: "\n"), keepingTokensPresentIn: original),
            keepingMarkersPresentIn: original
        )
    }

    private static let promptTextStart = "<<<HAZAKURA_TEXT_START"
    private static let promptTextEnd = "HAZAKURA_TEXT_END>>>"

    static func streamingReviewText(_ value: String, original: String) -> String {
        let stripped = stripOuterControlTokens(value, keepingTokensPresentIn: original)
        let trimmed = stripped.trimmingCharacters(in: .whitespacesAndNewlines)
        if !original.contains(promptTextStart), !original.contains(promptTextEnd),
           !trimmed.isEmpty, promptTextStart.hasPrefix(trimmed) {
            return ""
        }
        return reviewText(value, original: original)
    }

    /// Some `KitLanguageModel` bundles repeat the exact prompt envelope around
    /// an otherwise-correct candidate. Remove only a complete outer pair that
    /// Hazakura supplied. If the manuscript itself contains either marker, keep
    /// everything visible in Diff review. While a streamed envelope is still
    /// incomplete, return an empty partial so internal markers never flash in UI.
    private static func stripOuterPromptEnvelope(
        _ value: String,
        keepingMarkersPresentIn original: String
    ) -> String {
        guard !original.contains(promptTextStart), !original.contains(promptTextEnd) else {
            return value
        }
        var text = value.trimmingCharacters(in: .whitespacesAndNewlines)
        while true {
            let lines = text.components(separatedBy: "\n")
            guard lines.first?.trimmingCharacters(in: .whitespacesAndNewlines) == promptTextStart else {
                return text
            }
            guard lines.last?.trimmingCharacters(in: .whitespacesAndNewlines) == promptTextEnd else {
                let alreadyClosed = lines.dropFirst().contains {
                    $0.trimmingCharacters(in: .whitespacesAndNewlines) == promptTextEnd
                }
                return alreadyClosed ? text : ""
            }
            text = lines.dropFirst().dropLast().joined(separator: "\n")
                .trimmingCharacters(in: .whitespacesAndNewlines)
        }
    }

    /// The chat control tokens the shipping models can emit. `KitGemmaExecutor`
    /// stops on `<turn|>` and the tokenizer's EOS id, but the pinned E4B bundle
    /// declares `eos_token = "<turn|>"` with no `eos_token_id`, so `<eos>` (id 1)
    /// can pass the stop test and reach the body as literal text.
    private static let controlTokens = [
        "<eos>", "</s>", "<bos>", "<|endoftext|>",
        "<turn|>", "<|turn>", "<|channel>", "<channel|>",
        "<start_of_turn>", "<end_of_turn>",
        "<|start_header_id|>", "<|end_header_id|>", "<|eot_id|>",
    ]

    /// Strips whole control tokens from the outer edges only, and never removes a
    /// token the manuscript itself contains. The model can legitimately echo
    /// `<eos>` because the author wrote it, and stripping that would corrupt the
    /// candidate (or empty it) even though the model was correct. This is a
    /// last-resort mitigation: the real fix belongs in the conversion bundle's
    /// tokenizer config and the runtime stop check.
    static func stripOuterControlTokens(
        _ value: String,
        keepingTokensPresentIn original: String = ""
    ) -> String {
        let preserved = Set(controlTokens.filter { original.contains($0) })
        var text = value
        var changed = true
        while changed {
            changed = false
            for token in controlTokens where !preserved.contains(token) {
                if text.hasPrefix(token) {
                    text.removeFirst(token.count)
                    changed = true
                }
                if text.hasSuffix(token) {
                    text.removeLast(token.count)
                    changed = true
                }
            }
            let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed != text {
                text = trimmed
                changed = true
            }
        }
        return text
    }
}

struct CandidateStreamFormatter {
    private let original: String
    private var latestRaw = ""
    private var latestPartial = ""

    init(original: String) {
        self.original = original
    }

    var latestRawSnapshot: String { latestRaw }

    mutating func receive(_ raw: String) -> String? {
        latestRaw = raw
        let candidate = CandidateFormatting.streamingReviewText(raw, original: original)
        guard !candidate.isEmpty, candidate != latestPartial else { return nil }
        latestPartial = candidate
        return candidate
    }

    func finalCandidate() -> String? {
        let candidate = CandidateFormatting.streamingReviewText(latestRaw, original: original)
        return candidate.isEmpty ? nil : candidate
    }
}
