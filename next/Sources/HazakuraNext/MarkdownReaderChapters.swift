import HazakuraNextCore

/// A chapter projection of one rendered preview, preserving its global block indices.
struct MarkdownReaderChapters {
    struct Chapter: Identifiable {
        let range: Range<Int>
        let heading: MarkdownPreviewOutline.Entry?
        var id: Int { range.lowerBound }
    }

    let chapters: [Chapter]

    /// The outline must come from the same rendered blocks.
    init(blocks: [MarkdownPreview.Block], outline: MarkdownPreviewOutline) {
        var chapters: [Chapter] = []
        var start = blocks.startIndex
        var heading: MarkdownPreviewOutline.Entry?

        // Outline entries follow render order. Only root H1 and H2 start chapters;
        // neither the label nor the presence of a source location affects identity.
        for entry in outline.entries {
            guard (1...2).contains(entry.level), blocks.indices.contains(entry.id) else { continue }
            let block = blocks[entry.id]
            guard block.containers.isEmpty, block.kind == .heading(level: entry.level) else { continue }
            if start < entry.id {
                chapters.append(Chapter(range: start..<entry.id, heading: heading))
            }
            start = entry.id
            heading = entry
        }
        if start < blocks.endIndex {
            chapters.append(Chapter(range: start..<blocks.endIndex, heading: heading))
        }
        self.chapters = chapters
    }

    /// Returns the position in `chapters`, not the chapter's global block ID.
    func chapterIndex(containing blockIndex: Int) -> Int? {
        chapters.firstIndex { $0.range.contains(blockIndex) }
    }
}
