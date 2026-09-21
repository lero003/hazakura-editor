import Foundation

enum CandidateFormatting {
    static func reviewText(_ value: String, original: String) -> String {
        let text = stripOuterControlTokens(value)
        // A source code block is content, not an assistant wrapper.
        guard !original.trimmingCharacters(in: .whitespacesAndNewlines).hasPrefix("```") else { return text }
        let lines = text.components(separatedBy: "\n")
        guard lines.count >= 3,
              ["```markdown", "```md"].contains(lines[0].trimmingCharacters(in: .whitespaces)),
              lines.last?.trimmingCharacters(in: .whitespaces) == "```" else { return text }
        let body = lines.dropFirst().dropLast()
        // Ambiguous nested/separate fences remain visible for Diff review.
        guard !body.contains(where: { $0.trimmingCharacters(in: .whitespaces).hasPrefix("```") }) else { return text }
        return stripOuterControlTokens(body.joined(separator: "\n"))
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

    /// Strips whole control tokens from the outer edges only, so a manuscript
    /// that merely mentions a token in its body keeps it. This is a last-resort
    /// mitigation: the real fix belongs in the conversion bundle's tokenizer
    /// config and the stop check.
    static func stripOuterControlTokens(_ value: String) -> String {
        var text = value
        var changed = true
        while changed {
            changed = false
            for token in controlTokens {
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
