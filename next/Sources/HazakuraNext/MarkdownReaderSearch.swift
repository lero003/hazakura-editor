import Foundation
import HazakuraNextCore

/// Searches rendered preview snapshots, not their Markdown source.
enum MarkdownReaderSearch {
    static let queryByteLimit = 512

    enum Result: Equatable {
        case emptyQuery
        case queryTooLong
        case matches([Int])
    }

    struct BookMatch: Equatable {
        let sectionID: UUID
        let blockIndex: Int
    }

    enum BookResult: Equatable {
        case emptyQuery
        case queryTooLong
        case matches([BookMatch])
    }

    /// Pass the full rendered array so the returned indices stay global in chapter view.
    static func search(_ query: String, in blocks: [MarkdownPreview.Block]) -> Result {
        switch validate(query) {
        case .emptyQuery: return .emptyQuery
        case .queryTooLong: return .queryTooLong
        case .needle(let needle): return .matches(matchingBlockIndices(for: needle, in: blocks))
        }
    }

    /// Searches frozen sections in input order. Block indices are local to each section.
    static func searchBook(_ query: String, in sections: [MarkdownBookPreview.Section]) -> BookResult {
        switch validate(query) {
        case .emptyQuery: return .emptyQuery
        case .queryTooLong: return .queryTooLong
        case .needle(let needle):
            return .matches(sections.flatMap { section in
                matchingBlockIndices(for: needle, in: section.blocks).map { index in
                    BookMatch(sectionID: section.id, blockIndex: index)
                }
            })
        }
    }

    private enum ValidatedQuery {
        case emptyQuery
        case queryTooLong
        case needle(String)
    }

    private static func validate(_ query: String) -> ValidatedQuery {
        guard query.utf8.prefix(queryByteLimit + 1).count <= queryByteLimit else {
            return .queryTooLong
        }
        let needle = query.trimmingCharacters(in: .whitespacesAndNewlines)
        return needle.isEmpty ? .emptyQuery : .needle(needle)
    }

    /// The renderer caps input, block and run counts. View-only labels with no runs are not searchable.
    private static func matchingBlockIndices(for needle: String, in blocks: [MarkdownPreview.Block]) -> [Int] {
        blocks.indices.filter { index in
            let text = blocks[index].runs.map(\.text).joined()
            // Nonliteral matching preserves canonical equivalence without folding width or diacritics.
            return text.range(of: needle, options: .caseInsensitive) != nil
        }
    }
}
