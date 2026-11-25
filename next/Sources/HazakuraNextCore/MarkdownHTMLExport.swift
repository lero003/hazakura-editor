/// Serializes only the safe preview projection, without access to URLs, parser attributes, or files.
package enum MarkdownHTMLExport {
    package enum ExportError: Error, Equatable {
        case unavailable(MarkdownPreview.Limit), tooLarge
    }

    // Fixed by the renderer; no styles or attributes are taken from the source.
    package static let blockStyles: StaticString = """
        p,h1,h2,h3,h4,h5,h6,pre,th,td { white-space: pre-wrap; overflow-wrap: anywhere }
        table { width: 100%; table-layout: fixed; border-collapse: collapse }
        th,td { border: 1px solid; padding: 0.3em; text-align: start; vertical-align: top }
        """

    @concurrent
    package static func render(source: String) async throws -> String {
        let blocks = try await projectedBlocks(source: source)
        var output = Output()
        // Preserve projected whitespace (including hard breaks) without author-supplied CSS.
        try output.appendMarkup("""
            <!doctype html>
            <html>
            <head>
            <meta charset="utf-8">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Hazakura Editor</title>
            <style>

            """)
        try output.appendMarkup(blockStyles)
        try output.appendMarkup("""

            </style>
            </head>
            <body>

            """)
        try appendBlocks(blocks[...], to: &output)
        try output.appendMarkup("</body>\n</html>\n")
        return try output.finish()
    }

    @concurrent
    package static func projectedBlocks(source: String) async throws -> [MarkdownPreview.Block] {
        let preview = try await MarkdownPreview.render(source)
        try Task.checkCancellation()
        switch preview {
        case .rendered(let blocks): return blocks
        case .unavailable(let reason): throw ExportError.unavailable(reason)
        }
    }

    package static func renderXHTMLFragment(_ blocks: ArraySlice<MarkdownPreview.Block>) throws -> String {
        var output = Output(xhtml: true)
        try appendBlocks(blocks, to: &output)
        return try output.finish()
    }

    /// Escapes a label for XML text, never allowing it to become markup.
    package static func escapedXMLText(_ text: String) throws -> String {
        var output = Output(xhtml: true)
        try output.appendText(text)
        return try output.finish()
    }

    private static func appendBlocks(_ blocks: ArraySlice<MarkdownPreview.Block>, to output: inout Output) throws {
        var open: [Wrapper] = []
        for block in blocks {
            try Task.checkCancellation()
            try adjustWrappers(&open, to: block.containers, output: &output)
            try appendBlock(block, to: &output)
        }
        try adjustWrappers(&open, to: [], output: &output)
    }

    private enum Wrapper {
        case quote, list(ordered: Bool)

        func continues(_ container: MarkdownPreview.Container) -> Bool {
            switch (self, container) {
            case (.quote, .quote), (.list, .listItem(nil)): true
            default: false
            }
        }

        var closingMarkup: StaticString {
            switch self {
            case .quote: "</blockquote>\n"
            case .list(true): "</li>\n</ol>\n"
            case .list(false): "</li>\n</ul>\n"
            }
        }
    }

    private static func adjustWrappers(
        _ open: inout [Wrapper], to wanted: [MarkdownPreview.Container], output: inout Output
    ) throws {
        // A nil marker continues the item at this depth. Container identities aren't
        // in the projection, so contiguous quotes or lists of the same type may share a wrapper.
        let common = zip(open, wanted).prefix { $0.continues($1) }.count
        while open.count > common {
            let previous = open.removeLast()
            if open.count == common, wanted.indices.contains(common),
               case .list(let ordered) = previous, case .listItem(let marker?) = wanted[common] {
                let ordinal = ordinal(from: marker)
                if ordered == (ordinal != nil) {
                    try output.appendMarkup("</li>\n")
                    try appendItem(ordinal, to: &output)
                    open.append(previous)
                    break
                }
            }
            try output.appendMarkup(previous.closingMarkup)
        }
        for container in wanted.dropFirst(open.count) {
            switch container {
            case .quote:
                try output.appendMarkup("<blockquote>\n")
                open.append(.quote)
            case .listItem(let marker):
                let ordinal = marker.flatMap(ordinal(from:))
                try output.appendMarkup(ordinal == nil ? "<ul>\n" : "<ol>\n")
                try appendItem(ordinal, to: &output)
                open.append(.list(ordered: ordinal != nil))
            }
        }
    }

    private static func ordinal(from marker: String) -> Int? {
        // The projection emits either a bullet or a decimal ordinal followed by a period.
        marker.last == "." ? Int(marker.dropLast()) : nil
    }

    private static func appendItem(_ ordinal: Int?, to output: inout Output) throws {
        if let ordinal {
            try output.appendMarkup("<li value=\"")
            try output.appendText(String(ordinal))
            try output.appendMarkup("\">\n")
        } else {
            try output.appendMarkup("<li>\n")
        }
    }

    private static func appendBlock(_ block: MarkdownPreview.Block, to output: inout Output) throws {
        let tags: (open: StaticString, close: StaticString)
        switch block.kind {
        case .paragraph: tags = ("<p>", "</p>\n")
        case .heading(1): tags = ("<h1>", "</h1>\n")
        case .heading(2): tags = ("<h2>", "</h2>\n")
        case .heading(3): tags = ("<h3>", "</h3>\n")
        case .heading(4): tags = ("<h4>", "</h4>\n")
        case .heading(5): tags = ("<h5>", "</h5>\n")
        case .heading: tags = ("<h6>", "</h6>\n")
        case .codeBlock: tags = ("<pre><code>", "</code></pre>\n")
        case .thematicBreak: return try output.appendMarkup(output.xhtml ? "<hr />\n" : "<hr>\n")
        case .table:
            if let table = block.table { return try appendTable(table, to: &output) }
            fallthrough
        case .unsupported(.table): return try output.appendMarkup("<p>この表は表示できません。</p>\n")
        case .unsupported(.html): return try output.appendMarkup("<p>HTMLの表示には対応していません。</p>\n")
        case .unsupported(.other): return try output.appendMarkup("<p>このMarkdown記法には対応していません。</p>\n")
        }
        try output.appendMarkup(tags.open)
        for run in block.runs {
            if block.kind == .codeBlock {
                try output.appendText(run.text)
            } else {
                try appendInlineRun(run, to: &output)
            }
        }
        try output.appendMarkup(tags.close)
    }

    private static func appendTable(_ table: MarkdownPreview.Table, to output: inout Output) throws {
        try output.appendMarkup("<table>\n<thead>\n")
        for (index, row) in table.rows.enumerated() {
            try Task.checkCancellation()
            if index == 1 { try output.appendMarkup("<tbody>\n") }
            try output.appendMarkup("<tr>")
            for cell in row {
                try output.appendMarkup(index == 0 ? "<th scope=\"col\">" : "<td>")
                for run in cell { try appendInlineRun(run, to: &output) }
                try output.appendMarkup(index == 0 ? "</th>" : "</td>")
            }
            try output.appendMarkup("</tr>\n")
            if index == 0 { try output.appendMarkup("</thead>\n") }
        }
        if table.rows.count > 1 { try output.appendMarkup("</tbody>\n") }
        try output.appendMarkup("</table>\n")
    }

    private static func appendInlineRun(_ run: MarkdownPreview.Run, to output: inout Output) throws {
        if run.strong { try output.appendMarkup("<strong>") }
        if run.emphasis { try output.appendMarkup("<em>") }
        if run.strikethrough { try output.appendMarkup("<del>") }
        if run.code { try output.appendMarkup("<code>") }
        try output.appendText(run.text)
        if run.code { try output.appendMarkup("</code>") }
        if run.strikethrough { try output.appendMarkup("</del>") }
        if run.emphasis { try output.appendMarkup("</em>") }
        if run.strong { try output.appendMarkup("</strong>") }
    }

    // Markup must be a literal. Both markup and escaped display text count toward
    // the same UTF-8 budget (the whole HTML document or one XHTML fragment).
    struct Output {
        let xhtml: Bool
        private var bytes: [UInt8] = []

        init(xhtml: Bool = false) {
            self.xhtml = xhtml
        }

        mutating func appendMarkup(_ markup: StaticString) throws {
            try requireSpace(for: markup.utf8CodeUnitCount)
            markup.withUTF8Buffer { bytes.append(contentsOf: $0) }
        }

        mutating func appendText(_ text: String) throws {
            if xhtml {
                for (index, scalar) in text.unicodeScalars.enumerated() {
                    if index.isMultiple(of: 1_024) { try Task.checkCancellation() }
                    switch scalar.value {
                    case 0...127: try appendTextByte(UInt8(scalar.value))
                    case 0xFFFE, 0xFFFF: try appendMarkup("&#xfffd;")
                    default:
                        // Apart from the ASCII controls and the two BMP noncharacters,
                        // every representable Swift Unicode scalar is an XML 1.0 Char.
                        try requireSpace(for: scalar.utf8.count)
                        bytes.append(contentsOf: scalar.utf8)
                    }
                }
            } else {
                for (index, byte) in text.utf8.enumerated() {
                    if index.isMultiple(of: 1_024) { try Task.checkCancellation() }
                    try appendTextByte(byte)
                }
            }
        }

        private mutating func appendTextByte(_ byte: UInt8) throws {
            switch byte {
            case 38: try appendMarkup("&amp;")
            case 60: try appendMarkup("&lt;")
            case 62: try appendMarkup("&gt;")
            case 34: try appendMarkup("&quot;")
            case 39: try appendMarkup("&#39;")
            case 13 where xhtml: try appendMarkup("&#13;") // Preserve through XML line-end normalization.
            case 0...8, 11...12, 14...31, 127:
                // The new-file writer refuses non-text ASCII controls.
                try appendMarkup("&#xfffd;")
            default:
                try requireSpace(for: 1)
                bytes.append(byte)
            }
        }

        func finish() throws -> String {
            try Task.checkCancellation()
            let html = String(decoding: bytes, as: UTF8.self)
            try Task.checkCancellation()
            return html
        }

        private func requireSpace(for count: Int) throws {
            guard count <= SelectedTextFile.byteLimit - bytes.count else {
                try Task.checkCancellation()
                throw ExportError.tooLarge
            }
        }
    }
}
