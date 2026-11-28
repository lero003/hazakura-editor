import Darwin

/// A read-only comparison of two source strings. File identity and BOM policy are separate.
package enum LineDiff {
    package enum Result: Sendable, Equatable {
        case identical
        case rows([Row])
        case exceedsBudget
    }

    package struct Row: Sendable, Equatable, Identifiable {
        package enum Kind: Sendable, Equatable { case unchanged, removed, added }
        package enum Ending: Sendable, Equatable { case none, lf, crlf, cr }

        /// Zero-based position in this result. Source line numbers are one-based.
        package let id: Int
        package let kind: Kind
        package let beforeLine: Int?
        package let afterLine: Int?
        package let text: String
        package let ending: Ending

        package static func == (lhs: Self, rhs: Self) -> Bool {
            lhs.id == rhs.id && lhs.kind == rhs.kind && lhs.beforeLine == rhs.beforeLine &&
                lhs.afterLine == rhs.afterLine && lhs.ending == rhs.ending &&
                lhs.text.utf8.elementsEqual(rhs.text.utf8)
        }
    }

    // Input limits apply to both sources combined, even if they are identical.
    private static let byteLimit = 4 * 1_024 * 1_024
    private static let lineLimit = 12_000
    private static let cellLimit = 1_000_000
    private static let sortByteLimit = 128 * 1_024 * 1_024

    @concurrent
    package static func compare(before: String, after: String) async throws -> Result {
        try Task.checkCancellation()
        guard let beforeBytes = try boundedBytes(before, limit: byteLimit),
              let afterBytes = try boundedBytes(after, limit: byteLimit - beforeBytes.count),
              let beforeLines = try split(beforeBytes, limit: lineLimit),
              let afterLines = try split(afterBytes, limit: lineLimit - beforeLines.count) else {
            try Task.checkCancellation()
            return .exceedsBudget
        }

        var leading = 0
        while leading < min(beforeLines.count, afterLines.count) {
            try Task.checkCancellation()
            guard beforeLines[leading].order(relativeTo: afterLines[leading]) == 0 else { break }
            leading += 1
        }
        if leading == beforeLines.count, leading == afterLines.count {
            try Task.checkCancellation()
            return .identical
        }

        var beforeEnd = beforeLines.count
        var afterEnd = afterLines.count
        while beforeEnd > leading, afterEnd > leading {
            try Task.checkCancellation()
            guard beforeLines[beforeEnd - 1].order(relativeTo: afterLines[afterEnd - 1]) == 0 else { break }
            beforeEnd -= 1
            afterEnd -= 1
        }

        guard (beforeEnd - leading) * (afterEnd - leading) <= cellLimit else {
            try Task.checkCancellation()
            return .exceedsBudget
        }
        let matches: [(Int, Int)]
        do {
            matches = try middleMatches(beforeLines[leading..<beforeEnd], afterLines[leading..<afterEnd])
        } catch BudgetError.sortWork {
            try Task.checkCancellation()
            return .exceedsBudget
        }

        var rows: [Row] = []
        rows.reserveCapacity(max(beforeLines.count, afterLines.count))
        func append(_ kind: Row.Kind, _ line: Line, before: Int? = nil, after: Int? = nil) throws {
            if rows.count.isMultiple(of: 128) { try Task.checkCancellation() }
            rows.append(Row(id: rows.count, kind: kind, beforeLine: before.map { $0 + 1 },
                            afterLine: after.map { $0 + 1 }, text: line.text, ending: line.ending))
        }
        for index in 0..<leading {
            try append(.unchanged, beforeLines[index], before: index, after: index)
        }
        var i = leading
        var j = leading
        func appendEdits(untilBefore: Int, untilAfter: Int) throws {
            while i < untilBefore {
                try append(.removed, beforeLines[i], before: i)
                i += 1
            }
            while j < untilAfter {
                try append(.added, afterLines[j], after: j)
                j += 1
            }
        }
        for (matchBefore, matchAfter) in matches {
            try appendEdits(untilBefore: matchBefore, untilAfter: matchAfter)
            try append(.unchanged, beforeLines[i], before: i, after: j)
            i += 1
            j += 1
        }
        try appendEdits(untilBefore: beforeEnd, untilAfter: afterEnd)
        while i < beforeLines.count {
            try append(.unchanged, beforeLines[i], before: i, after: j)
            i += 1
            j += 1
        }
        try Task.checkCancellation()
        return .rows(rows)
    }

    private struct Line {
        let bytes: ArraySlice<UInt8>
        let ending: Row.Ending

        var text: String {
            let terminatorLength = switch ending {
            case .none: 0
            case .lf, .cr: 1
            case .crlf: 2
            }
            return String(decoding: bytes.dropLast(terminatorLength), as: UTF8.self)
        }

        // Length-first order is enough to group equal lines. The bytes include the terminator.
        func order(relativeTo other: Self) -> Int32 {
            if bytes.count != other.bytes.count { return bytes.count < other.bytes.count ? -1 : 1 }
            return bytes.withUnsafeBufferPointer { lhs in
                other.bytes.withUnsafeBufferPointer { rhs in
                    // The splitter never produces an empty byte range.
                    memcmp(lhs.baseAddress, rhs.baseAddress, lhs.count)
                }
            }
        }
    }

    private static func boundedBytes(_ source: String, limit: Int) throws -> [UInt8]? {
        // Avoid scanning an oversized native string or materializing a full UTF-8 copy of bridged text.
        if let contiguous = source.utf8.withContiguousStorageIfAvailable({ (bytes) -> [UInt8]? in
            bytes.count <= limit ? Array(bytes) : nil
        }) {
            return contiguous
        }
        var bytes: [UInt8] = []
        for byte in source.utf8 {
            guard bytes.count < limit else { return nil }
            if bytes.count.isMultiple(of: 4_096) { try Task.checkCancellation() }
            bytes.append(byte)
        }
        return bytes
    }

    private static func split(_ bytes: [UInt8], limit: Int) throws -> [Line]? {
        var lines: [Line] = []
        var start = 0
        var index = 0
        var nextCancellationCheck = 0
        while index < bytes.count {
            if index >= nextCancellationCheck {
                try Task.checkCancellation()
                nextCancellationCheck = index + 4_096
            }
            let ending: Row.Ending
            switch bytes[index] {
            case 0x0D:
                let followedByLF = index + 1 < bytes.count && bytes[index + 1] == 0x0A
                ending = followedByLF ? .crlf : .cr
                index += followedByLF ? 2 : 1
            case 0x0A:
                ending = .lf
                index += 1
            default:
                index += 1
                continue
            }
            guard lines.count < limit else { return nil }
            lines.append(Line(bytes: bytes[start..<index], ending: ending))
            start = index
        }
        if start < bytes.count {
            guard lines.count < limit else { return nil }
            lines.append(Line(bytes: bytes[start...], ending: .none))
        }
        return lines
    }

    private enum BudgetError: Error { case sortWork }

    // Intern exact lines before building the matrix. Charge worst-case byte work of sort comparisons
    // so neither long shared line prefixes nor hash collisions can multiply the LCS cost.
    private static func lineIDs(_ lines: [Line]) throws -> [Int] {
        var remainingByteWork = sortByteLimit
        var comparisons = 0
        let sorted = try lines.indices.sorted { lhs, rhs in
            comparisons += 1
            if comparisons.isMultiple(of: 256) { try Task.checkCancellation() }
            let left = lines[lhs]
            let right = lines[rhs]
            if left.bytes.count == right.bytes.count {
                remainingByteWork -= left.bytes.count
                guard remainingByteWork >= 0 else { throw BudgetError.sortWork }
            }
            return left.order(relativeTo: right) < 0
        }
        var ids = Array(repeating: 0, count: lines.count)
        var id = 0
        for (previous, current) in zip(sorted, sorted.dropFirst()) {
            try Task.checkCancellation()
            if lines[previous].order(relativeTo: lines[current]) != 0 { id += 1 }
            ids[current] = id
        }
        return ids
    }

    private static func middleMatches(_ before: ArraySlice<Line>, _ after: ArraySlice<Line>) throws -> [(Int, Int)] {
        guard !before.isEmpty, !after.isEmpty else { return [] }
        let ids = try lineIDs(Array(before) + Array(after))
        let beforeCount = before.count
        let afterCount = after.count
        let stride = afterCount + 1
        var lengths = Array(repeating: 0, count: (beforeCount + 1) * stride)
        for i in (0..<beforeCount).reversed() {
            try Task.checkCancellation()
            for j in (0..<afterCount).reversed() {
                let cell = i * stride + j
                lengths[cell] = ids[i] == ids[beforeCount + j]
                    ? 1 + lengths[cell + stride + 1]
                    : max(lengths[cell + stride], lengths[cell + 1])
            }
        }

        var matches: [(Int, Int)] = []
        var i = 0
        var j = 0
        while i < beforeCount, j < afterCount {
            try Task.checkCancellation()
            let cell = i * stride + j
            if ids[i] == ids[beforeCount + j] {
                matches.append((before.startIndex + i, after.startIndex + j))
                i += 1
                j += 1
            } else if lengths[cell + stride] >= lengths[cell + 1] {
                i += 1 // Resolve equal alternatives by consuming a before-line first.
            } else {
                j += 1
            }
        }
        return matches
    }
}
