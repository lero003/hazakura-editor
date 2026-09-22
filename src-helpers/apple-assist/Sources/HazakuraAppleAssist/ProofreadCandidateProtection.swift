import Foundation

enum ProofreadCandidateProtection {
    private static let japaneseNumerals = Set(
        "〇零一二三四五六七八九十百千万億兆壱弐参肆伍陸漆捌玖拾佰仟萬"
    )

    static func partialCandidate(
        _ candidate: String,
        for request: AppleAssistRequest
    ) -> String? {
        guard AssistPrompt.resolvedActionId(for: request) == "proofread_only" else {
            return candidate
        }
        return numericSpans(in: request.selectedText) == numericSpans(in: candidate)
            ? candidate
            : nil
    }

    static func finalCandidate(
        _ candidate: String,
        for request: AppleAssistRequest
    ) -> String {
        partialCandidate(candidate, for: request) ?? request.selectedText
    }

    private static func numericSpans(in text: String) -> [String] {
        var spans: [String] = []
        var current = ""
        for character in text {
            if character.wholeNumberValue != nil || japaneseNumerals.contains(character) {
                current.append(character)
            } else if !current.isEmpty {
                spans.append(current)
                current = ""
            }
        }
        if !current.isEmpty {
            spans.append(current)
        }
        return spans
    }
}
