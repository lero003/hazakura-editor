import Foundation

/// A read-only projection of Markdown source. Only plain text and display hints cross into the view.
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

    package struct Block: Sendable, Equatable {
        package enum Kind: Sendable, Equatable {
            case paragraph, heading(level: Int), codeBlock, thematicBreak, unsupported(Unsupported)
        }

        package let kind: Kind
        /// Outer to inner, preserving the relative nesting of quotes and lists.
        package let containers: [Container]
        package fileprivate(set) var runs: [Run]
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
                allowsExtendedAttributes: false, interpretedSyntax: .full, failurePolicy: .throwError
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
                blocks[blockIndex].runs.append(displayRun(run, in: parsed, inline: inline))
            }
        }
        try Task.checkCancellation()
        return .rendered(blocks)
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
