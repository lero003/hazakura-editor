import Foundation
import HazakuraNextCore

/// Searches rendered preview snapshots, not their Markdown source.
enum MarkdownReaderSearch {
    static let queryByteLimit = 512

    struct Request: Identifiable {
        let id = UUID()
        let query: String

        func isActive(_ current: Request?, readerIsCurrent: () -> Bool) -> Bool {
            !Task.isCancelled && current?.id == id && readerIsCurrent()
        }
    }

    enum Result: Equatable, Sendable {
        case emptyQuery
        case queryTooLong
        case matches([Int])
    }

    struct BookMatch: Equatable, Sendable {
        let sectionID: UUID
        let blockIndex: Int
    }

    enum BookResult: Equatable, Sendable {
        case emptyQuery
        case queryTooLong
        case matches([BookMatch])
    }

    /// Pass the full rendered array so the returned indices stay global in chapter view.
    @concurrent
    static func search(_ query: String, in blocks: [MarkdownPreview.Block]) async throws -> Result {
        try Task.checkCancellation()
        switch validate(query) {
        case .emptyQuery: return .emptyQuery
        case .queryTooLong: return .queryTooLong
        case .needle(let needle): return .matches(try matchingBlockIndices(for: needle, in: blocks))
        }
    }

    /// Searches frozen sections in input order. Block indices are local to each section.
    @concurrent
    static func searchBook(_ query: String, in sections: [MarkdownBookPreview.Section]) async throws -> BookResult {
        try Task.checkCancellation()
        switch validate(query) {
        case .emptyQuery: return .emptyQuery
        case .queryTooLong: return .queryTooLong
        case .needle(let needle):
            let matches = try sections.flatMap { section in
                try matchingBlockIndices(for: needle, in: section.blocks).map { index in
                    BookMatch(sectionID: section.id, blockIndex: index)
                }
            }
            try Task.checkCancellation()
            return .matches(matches)
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
    private static func matchingBlockIndices(for needle: String, in blocks: [MarkdownPreview.Block]) throws -> [Int] {
        func matches(_ runs: [MarkdownPreview.Run]) throws -> Bool {
            try Task.checkCancellation()
            // Nonliteral matching preserves canonical equivalence without folding width or diacritics.
            return runs.map(\.text).joined().range(of: needle, options: .caseInsensitive) != nil
        }
        let indices = try blocks.indices.filter { index in
            let block = blocks[index]
            if let table = block.table {
                return try table.rows.contains { row in try row.contains(where: matches) }
            }
            return try matches(block.runs)
        }
        try Task.checkCancellation()
        return indices
    }
}
