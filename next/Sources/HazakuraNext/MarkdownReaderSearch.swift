import Foundation
import HazakuraNextCore

/// Searches one rendered preview snapshot, not its Markdown source.
enum MarkdownReaderSearch {
    static let queryByteLimit = 512

    enum Result: Equatable {
        case emptyQuery
        case queryTooLong
        case matches([Int])
    }

    /// Pass the full rendered array so the returned indices stay global in chapter view.
    /// The renderer caps input, block and run counts. View-only labels with no runs are not searchable.
    static func search(_ query: String, in blocks: [MarkdownPreview.Block]) -> Result {
        guard query.utf8.prefix(queryByteLimit + 1).count <= queryByteLimit else {
            return .queryTooLong
        }
        let needle = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !needle.isEmpty else { return .emptyQuery }

        let matches = blocks.indices.filter { index in
            let text = blocks[index].runs.map(\.text).joined()
            // Nonliteral matching preserves canonical equivalence without folding width or diacritics.
            return text.range(of: needle, options: .caseInsensitive) != nil
        }
        return .matches(matches)
    }
}
