import Foundation

package enum SourceSearch {
    package struct Match: Identifiable, Sendable, Equatable {
        package let range: NSRange
        package let line: Int
        package var id: Int { range.location }
    }

    package struct Results: Sendable, Equatable {
        package let matches: [Match]
        package let hasMore: Bool
    }

    private static let matchLimit = 64
    private static let cancellationInterval = 4_096

    package static func canSearch(_ query: String) -> Bool {
        let bytes = query.utf8
        return !bytes.isEmpty && bytes.count <= 512 && !bytes.contains { $0 == 0x0D || $0 == 0x0A }
    }

    /// Searches a read-only snapshot. Returns nil for invalid input or cancellation.
    package static func search(_ query: String, in source: String) -> Results? {
        guard !Task.isCancelled, canSearch(query), source.utf8.count <= 2 * 1_024 * 1_024 else { return nil }

        let pattern = Array(query.utf8)
        let fallback = prefixTable(for: pattern)
        let matchLength = query.utf16.count
        var storage = source
        storage.makeContiguousUTF8()
        let text = storage
        return storage.withUTF8 { bytes in
            var matches: [Match] = []
            var start = BoundaryCursor(index: text.startIndex)
            var end = start
            var prefixLength = 0
            var utf16Offset = 0
            var line = 1
            var previous: UInt8 = 0

            for (offset, byte) in bytes.enumerated() {
                if offset.isMultiple(of: cancellationInterval), Task.isCancelled { return nil }
                if byte == 0x0D || (byte == 0x0A && previous != 0x0D) { line += 1 }
                previous = byte
                // Count UTF-16 units at each UTF-8 scalar's leading byte.
                if byte & 0xC0 != 0x80 { utf16Offset += byte >= 0xF0 ? 2 : 1 }

                while prefixLength > 0, pattern[prefixLength] != byte {
                    prefixLength = fallback[prefixLength - 1]
                }
                if pattern[prefixLength] == byte { prefixLength += 1 }
                guard prefixLength == pattern.count else { continue }

                let endOffset = offset + 1
                if start.contains(endOffset - pattern.count, in: text), end.contains(endOffset, in: text) {
                    if matches.count == matchLimit { return Results(matches: matches, hasMore: true) }
                    // No query contains CR or LF, so its start and end share the current line.
                    let range = NSRange(location: utf16Offset - matchLength, length: matchLength)
                    matches.append(Match(range: range, line: line))
                    prefixLength = 0
                } else {
                    // Invalid candidates must not hide an overlapping valid match.
                    prefixLength = fallback[prefixLength - 1]
                }
            }
            return Task.isCancelled ? nil : Results(matches: matches, hasMore: false)
        }
    }

    // KMP fallback lengths keep the raw search linear, including overlapping invalid candidates.
    private static func prefixTable(for pattern: [UInt8]) -> [Int] {
        var table = Array(repeating: 0, count: pattern.count)
        var prefixLength = 0
        for index in 1..<pattern.count {
            while prefixLength > 0, pattern[prefixLength] != pattern[index] {
                prefixLength = table[prefixLength - 1]
            }
            if pattern[prefixLength] == pattern[index] { prefixLength += 1 }
            table[index] = prefixLength
        }
        return table
    }

    // Start/end candidates each advance monotonically. Walk the original String's
    // Character boundaries without rescanning any prefix or storing a document-wide map.
    private struct BoundaryCursor {
        var index: String.Index
        private var offset = 0

        init(index: String.Index) { self.index = index }

        mutating func contains(_ target: Int, in source: String) -> Bool {
            var nextCheck = offset + SourceSearch.cancellationInterval
            while offset < target {
                if offset >= nextCheck {
                    if Task.isCancelled { return false }
                    nextCheck = offset + SourceSearch.cancellationInterval
                }
                let next = source.index(after: index)
                offset += source.utf8.distance(from: index, to: next)
                index = next
            }
            return offset == target
        }
    }
}
