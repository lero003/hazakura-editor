import Foundation

/// A read-only projection of Markdown source. Only plain text, display hints, and heading locations cross into the view.
package enum MarkdownPreview {
    package enum Result: Sendable, Equatable {
        case rendered([Block])
        case unavailable(Limit)
    }

    package enum Limit: Sendable, Equatable {
        case inputTooLarge, tooManyBlocks, tooComplex, parseFailed
    }

    package enum Unsupported: Sendable, Equatable {
        case html, table, other
    }

    package enum Container: Sendable, Equatable {
        case quote
        /// A missing marker denotes a continuation of the same item.
        case listItem(marker: String?)
    }

    package struct HeadingLocation: Sendable, Equatable {
        /// The start of the heading's physical line in the input snapshot.
        package let utf16Offset: Int
        /// The 1-based source line, counting CRLF as one line break.
        package let line: Int
    }

    package struct Block: Sendable, Equatable {
        package enum Kind: Sendable, Equatable {
            case paragraph, heading(level: Int), codeBlock, thematicBreak, unsupported(Unsupported)
        }

        package let kind: Kind
        /// Outer to inner, preserving the relative nesting of quotes and lists.
        package let containers: [Container]
        package fileprivate(set) var runs: [Run]
        package fileprivate(set) var headingLocation: HeadingLocation?
    }

    package struct Run: Sendable, Equatable {
        package let text: String
        package let emphasis: Bool
        package let strong: Bool
        package let code: Bool
        package let strikethrough: Bool
    }

    private static let byteLimit = 128 * 1_024
    private static let blockLimit = 2_000
    private static let runsPerBlockLimit = 512
    private static let intentDepthLimit = 32
    // A parsed run and each of its intent components count as one unit, even for fallbacks.
    private static let projectionWorkLimit = 8_192

    @concurrent
    package static func render(_ source: String) async throws -> Result {
        try Task.checkCancellation()
        guard source.utf8.prefix(byteLimit + 1).count <= byteLimit else {
            try Task.checkCancellation()
            return .unavailable(.inputTooLarge)
        }

        // Parse in memory with no base URL or extended attributes. The parser's attributed
        // output is never displayed or passed to the caller, even when conversion fails.
        let parsed: AttributedString
        do {
            parsed = try AttributedString(markdown: source, options: .init(
                allowsExtendedAttributes: false, interpretedSyntax: .full, failurePolicy: .throwError,
                appliesSourcePositionAttributes: true
            ))
        } catch {
            try Task.checkCancellation()
            return .unavailable(.parseFailed)
        }
        try Task.checkCancellation()

        var blocks: [Block] = []
        var currentKey: BlockKey?
        var seenListItems: Set<Int> = []
        var remainingWork = projectionWorkLimit
        var sourceLines: SourceLines?
        var headingSpans: [HeadingSpan?] = []
        for (index, run) in parsed.runs.enumerated() {
            if index.isMultiple(of: 128) { try Task.checkCancellation() }
            let components = run.presentationIntent?.components ?? []
            guard components.count <= intentDepthLimit, components.count < remainingWork else {
                try Task.checkCancellation()
                return .unavailable(.tooComplex)
            }
            remainingWork -= 1 + components.count
            let inline = run.inlinePresentationIntent ?? []
            let (key, kind) = blockDetails(components, isBlockHTML: inline.contains(.blockHTML))
            if currentKey != key {
                guard blocks.count < blockLimit else {
                    try Task.checkCancellation()
                    return .unavailable(.tooManyBlocks)
                }
                currentKey = key
                blocks.append(Block(kind: kind, containers: containers(components, seenListItems: &seenListItems), runs: []))
                headingSpans.append(nil)
            }

            switch kind {
            case .thematicBreak, .unsupported:
                // No parser placeholder, HTML, or table attributes enter the model.
                continue
            case .paragraph, .heading, .codeBlock:
                let blockIndex = blocks.count - 1
                guard blocks[blockIndex].runs.count < runsPerBlockLimit else {
                    try Task.checkCancellation()
                    return .unavailable(.tooComplex)
                }
                if case .heading = kind {
                    if sourceLines == nil { sourceLines = SourceLines(source) }
                    let position = run[AttributeScopes.FoundationAttributes.MarkdownSourcePositionAttribute.self]
                    if let position, sourceLines?.contains(position) == true {
                        if blocks[blockIndex].runs.isEmpty {
                            headingSpans[blockIndex] = HeadingSpan(first: position, last: position, endLine: position.endLine)
                        } else if let span = headingSpans[blockIndex],
                                  (position.startLine, position.startColumn) >= (span.last.startLine, span.last.startColumn) {
                            headingSpans[blockIndex]?.last = position
                            headingSpans[blockIndex]?.endLine = max(span.endLine, position.endLine)
                        } else {
                            headingSpans[blockIndex] = nil
                        }
                    } else if position != nil || inline.intersection([.softBreak, .lineBreak]).isEmpty {
                        // Synthetic breaks may have no position. Other unlocated text could
                        // conceal the first or last source line of a Setext heading.
                        headingSpans[blockIndex] = nil
                    }
                }
                blocks[blockIndex].runs.append(displayRun(run, in: parsed, inline: inline))
            }
        }
        if let sourceLines { try sourceLines.locateHeadings(headingSpans, in: &blocks) }
        try Task.checkCancellation()
        return .rendered(blocks)
    }

    private typealias SourcePosition = AttributedString.MarkdownSourcePosition

    private struct HeadingSpan {
        let first: SourcePosition
        var last: SourcePosition
        var endLine: Int
    }

    private struct SourceLines {
        private struct Line {
            let bytes: Range<Int>
            let utf16Offset: Int
        }

        private let bytes: [UInt8]
        private let lines: [Line]

        init(_ source: String) {
            let bytes = Array(source.utf8)
            var lines: [Line] = []
            var cursor = 0
            var start = 0
            var lineOffset = 0
            var utf16Offset = 0
            while cursor < bytes.count {
                let byte = bytes[cursor]
                if byte == 0x0D || byte == 0x0A {
                    lines.append(Line(bytes: start..<cursor, utf16Offset: lineOffset))
                    if byte == 0x0D, cursor + 1 < bytes.count, bytes[cursor + 1] == 0x0A {
                        cursor += 1
                        utf16Offset += 1
                    }
                    start = cursor + 1
                    lineOffset = utf16Offset + 1
                }
                // Count at the leading byte of each scalar only. Four-byte scalars
                // occupy two UTF-16 code units. CRLF uses two units but one line break.
                if byte < 0x80 || byte >= 0xC0 { utf16Offset += byte >= 0xF0 ? 2 : 1 }
                cursor += 1
            }
            lines.append(Line(bytes: start..<bytes.count, utf16Offset: lineOffset))
            self.bytes = bytes
            self.lines = lines
        }

        func contains(_ position: SourcePosition) -> Bool {
            // Foundation's columns are 1-based UTF-8 bytes with an inclusive end.
            // Its internal NSRange conversion need not preserve the original CRLF offsets.
            guard position.startLine > 0, position.endLine <= lines.count,
                  position.startColumn > 0, position.endColumn > 0,
                  (position.startLine, position.startColumn) <= (position.endLine, position.endColumn) else { return false }
            let first = lines[position.startLine - 1].bytes
            let last = lines[position.endLine - 1].bytes
            guard position.startColumn <= first.count, position.endColumn <= last.count else { return false }
            let start = first.lowerBound + position.startColumn - 1
            let end = last.lowerBound + position.endColumn
            return bytes[start] & 0xC0 != 0x80 && (end == last.upperBound || bytes[end] & 0xC0 != 0x80)
        }

        func locateHeadings(_ spans: [HeadingSpan?], in blocks: inout [Block]) throws {
            // If spans overlap or are out of source order, don't expose any anchors.
            // The preview still renders, without deciding which positions to trust.
            var previousEndLine = 0
            for case let span? in spans {
                guard span.first.startLine > previousEndLine else { return }
                previousEndLine = span.endLine
            }
            for (index, span) in spans.enumerated() {
                if index.isMultiple(of: 128) { try Task.checkCancellation() }
                guard let span, case .heading(let level) = blocks[index].kind else { continue }
                let firstLine = span.first.startLine
                let containers = blocks[index].containers
                guard let first = content(of: firstLine, containers: containers, mayStartListItem: true),
                      first.startIndex < lines[firstLine - 1].bytes.lowerBound + span.first.startColumn else { continue }
                let hashes = first.prefix { $0 == 0x23 }
                if !hashes.isEmpty, first.dropFirst(hashes.count).first.map(Self.isIndent) == true {
                    guard hashes.count == level, span.endLine == firstLine else { continue }
                } else {
                    // A leading link reference definition can shift a Setext heading's
                    // inline positions onto the definition. Never use that line as an anchor.
                    guard first.first != 0x5B || !zip(first, first.dropFirst()).contains(where: { $0 == 0x5D && $1 == 0x3A }),
                          span.endLine < lines.count,
                          let underline = content(of: span.endLine + 1, containers: containers, mayStartListItem: false),
                          isSetextUnderline(underline, level: level) else { continue }
                }
                blocks[index].headingLocation = HeadingLocation(utf16Offset: lines[firstLine - 1].utf16Offset, line: firstLine)
            }
        }

        // Corroborate syntax only at the parser-provided lines; never discover headings
        // by scanning or matching against their rendered labels.
        private func content(of line: Int, containers: [Container], mayStartListItem: Bool) -> ArraySlice<UInt8>? {
            var text = bytes[lines[line - 1].bytes]
            if line == 1, text.starts(with: [0xEF, 0xBB, 0xBF]) { text = text.dropFirst(3) }
            for container in containers {
                text = text.drop(while: Self.isIndent)
                switch container {
                case .quote:
                    guard text.first == 0x3E else { return nil }
                    text = text.dropFirst()
                case .listItem:
                    guard mayStartListItem else { continue }
                    let digits = text.prefix { (0x30...0x39).contains($0) }
                    let marker = text.dropFirst(digits.count)
                    let allowed: [UInt8] = digits.isEmpty ? [0x2B, 0x2D, 0x2A] : [0x2E, 0x29]
                    if let byte = marker.first, allowed.contains(byte), marker.dropFirst().first.map(Self.isIndent) == true {
                        text = marker.dropFirst()
                    }
                }
            }
            return text.drop(while: Self.isIndent)
        }

        private func isSetextUnderline(_ text: ArraySlice<UInt8>, level: Int) -> Bool {
            guard level == 1 || level == 2 else { return false }
            let marker: UInt8 = level == 1 ? 0x3D : 0x2D
            guard text.first == marker else { return false }
            return text.drop(while: { $0 == marker }).allSatisfy(Self.isIndent)
        }

        private static func isIndent(_ byte: UInt8) -> Bool { byte == 0x20 || byte == 0x09 }
    }

    private enum BlockKey: Equatable {
        case intent(Int), html(Int?), plain
    }

    private static func blockDetails(
        _ components: [PresentationIntent.IntentType],
        isBlockHTML: Bool
    ) -> (BlockKey, Block.Kind) {
        if isBlockHTML { return (.html(components.first?.identity), .unsupported(.html)) }
        guard let first = components.first else { return (.plain, .paragraph) }
        let key = BlockKey.intent(first.identity)
        switch first.kind {
        case .paragraph: return (key, .paragraph)
        case .header(let level): return (key, .heading(level: level))
        case .codeBlock: return (key, .codeBlock)
        case .thematicBreak: return (key, .thematicBreak)
        case .table, .tableHeaderRow, .tableRow, .tableCell:
            // Foundation can split a table into runs per cell; use one fallback per table.
            let table = components.first { if case .table = $0.kind { true } else { false } }
            return (.intent(table?.identity ?? first.identity), .unsupported(.table))
        case .orderedList, .unorderedList, .listItem, .blockQuote:
            return (key, .unsupported(.other))
        @unknown default:
            return (key, .unsupported(.other))
        }
    }

    private static func containers(
        _ components: [PresentationIntent.IntentType],
        seenListItems: inout Set<Int>
    ) -> [Container] {
        var result: [Container] = []
        var ordered = false
        for component in components.reversed() {
            switch component.kind {
            case .blockQuote: result.append(.quote)
            case .orderedList: ordered = true
            case .unorderedList: ordered = false
            case .listItem(let ordinal):
                let marker: String? = seenListItems.insert(component.identity).inserted
                    ? (ordered ? "\(ordinal)." : "•") : nil
                result.append(.listItem(marker: marker))
            default: break
            }
        }
        return result
    }

    private static func displayRun(
        _ run: AttributedString.Runs.Run,
        in parsed: AttributedString,
        inline: InlinePresentationIntent
    ) -> Run {
        var text = ""
        var style = inline
        if inline.contains(.inlineHTML) {
            text = "［HTML非表示］"
            style = []
        } else {
            // A Foundation run can end inside a grapheme cluster. Preserve its exact scalars.
            text.unicodeScalars.append(contentsOf: parsed.unicodeScalars[run.range])
            if run.imageURL != nil {
                text = text.isEmpty || text == "\u{FFFC}" ? "［画像］" : "［画像：\(text)］"
                style = []
            }
            // Deliberately ignore link destinations; even an autolink is just visible text.
        }
        return Run(text: text, emphasis: style.contains(.emphasized), strong: style.contains(.stronglyEmphasized),
                   code: style.contains(.code), strikethrough: style.contains(.strikethrough))
    }
}
