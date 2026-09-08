import Foundation

enum CandidateFormatting {
    static func reviewText(_ value: String, original: String) -> String {
        let text = value.trimmingCharacters(in: .whitespacesAndNewlines)
        // A source code block is content, not an assistant wrapper.
        guard !original.trimmingCharacters(in: .whitespacesAndNewlines).hasPrefix("```") else { return text }
        let lines = text.components(separatedBy: "\n")
        guard lines.count >= 3,
              ["```markdown", "```md"].contains(lines[0].trimmingCharacters(in: .whitespaces)),
              lines.last?.trimmingCharacters(in: .whitespaces) == "```" else { return text }
        let body = lines.dropFirst().dropLast()
        // Ambiguous nested/separate fences remain visible for Diff review.
        guard !body.contains(where: { $0.trimmingCharacters(in: .whitespaces).hasPrefix("```") }) else { return text }
        return body.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
