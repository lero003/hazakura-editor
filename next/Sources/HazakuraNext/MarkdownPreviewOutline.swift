import HazakuraNextCore

/// Heading navigation within one immutable preview, independent of source navigation.
struct MarkdownPreviewOutline {
    struct Entry: Identifiable {
        /// Index in the original rendered blocks, including non-heading blocks.
        let id: Int
        let level: Int
        let title: String
        let sourceLine: Int?
    }

    let entries: [Entry]

    init(blocks: [MarkdownPreview.Block]) {
        entries = blocks.enumerated().compactMap { index, block in
            guard case .heading(let level) = block.kind else { return nil }
            return Entry(id: index, level: level, title: Self.title(from: block.runs),
                         sourceLine: block.headingLocation?.line)
        }
    }

    // A Character limit alone would allow one arbitrarily large combining sequence.
    private static let titleScalarLimit = 160

    private static func title(from runs: [MarkdownPreview.Run]) -> String {
        var title = ""
        var scalarCount = 0
        var needsSpace = false
        for run in runs {
            for scalar in run.text.unicodeScalars {
                if scalar.properties.isWhitespace {
                    needsSpace = scalarCount > 0
                    continue
                }
                let addedScalars = needsSpace ? 2 : 1
                guard scalarCount + addedScalars <= titleScalarLimit else {
                    // Make room for the ellipsis without showing a partial grapheme.
                    if scalarCount == titleScalarLimit { title.removeLast() }
                    if title.last == " " { title.removeLast() }
                    title.append("…")
                    return title
                }
                if needsSpace {
                    title.append(" ")
                    needsSpace = false
                }
                title.unicodeScalars.append(scalar)
                scalarCount += addedScalars
            }
        }
        return title
    }
}
