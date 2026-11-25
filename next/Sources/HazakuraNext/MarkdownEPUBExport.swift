import Foundation
import HazakuraNextCore

/// Builds one inert, reflowable EPUB from the same projection and root chapter boundaries as Reader.
enum MarkdownEPUBExport {
    enum ExportError: Error, Equatable {
        case tooManyChapters, emptyDocument
    }

    private static let chapterLimit = 128
    private static let title = "Hazakura Editor"
    private static let language = "und" // No language is inferred from the manuscript.
    private static let contentDirectory = "EPUB/"
    private static let packagePath = contentDirectory + "package.opf"
    private static let navHref = "nav.xhtml"

    @concurrent
    static func render(source: String) async throws -> Data {
        let blocks = try await MarkdownHTMLExport.projectedBlocks(source: source)
        let outline = MarkdownPreviewOutline(blocks: blocks)
        let chapters = MarkdownReaderChapters(blocks: blocks, outline: outline).chapters
        try Task.checkCancellation()
        guard !chapters.isEmpty else { throw ExportError.emptyDocument }
        guard chapters.count <= chapterLimit else { throw ExportError.tooManyChapters }

        var entries: [(path: String, data: Data)] = [("META-INF/container.xml", Data(containerXML.utf8))]
        var navItems = ""
        var manifestItems = "<item id=\"nav\" href=\"\(navHref)\" media-type=\"application/xhtml+xml\" properties=\"nav\" />\n"
        var spineItems = ""
        for (index, chapter) in chapters.enumerated() {
            try Task.checkCancellation()
            let number = index + 1
            // The path, manifest ID, spine reference, and nav target must agree.
            // None of them may incorporate the heading, source, or destination filename.
            let id = "chapter-\(number)"
            let href = id + ".xhtml"
            let label: String
            if let heading = chapter.heading {
                label = heading.title.isEmpty ? "第\(number)章" : heading.title
            } else {
                label = chapters.count == 1 ? "本文" : "前書き"
            }
            let escapedLabel = try MarkdownHTMLExport.escapedXMLText(label)
            let body = try MarkdownHTMLExport.renderXHTMLFragment(blocks[chapter.range])
            entries.append((contentDirectory + href, Data(xhtml(escapedTitle: escapedLabel, body: body).utf8)))
            navItems += "<li><a href=\"\(href)\">\(escapedLabel)</a></li>\n"
            manifestItems += "<item id=\"\(id)\" href=\"\(href)\" media-type=\"application/xhtml+xml\" />\n"
            spineItems += "<itemref idref=\"\(id)\" />\n"
        }

        let nav = xhtml(escapedTitle: "目次", body: """
            <nav epub:type="toc">
            <h1>目次</h1>
            <ol>
            \(navItems)</ol>
            </nav>
            """)
        entries.append((contentDirectory + navHref, Data(nav.utf8)))
        entries.append((packagePath, Data(packageXML(manifestItems: manifestItems, spineItems: spineItems).utf8)))
        try Task.checkCancellation()
        return try EPUBStoredArchive.build(entries: entries)
    }

    private static let containerXML = """
        <?xml version="1.0" encoding="UTF-8"?>
        <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
        <rootfiles>
        <rootfile full-path="\(packagePath)" media-type="application/oebps-package+xml" />
        </rootfiles>
        </container>
        """

    private static func packageXML(manifestItems: String, spineItems: String) -> String {
        // Mint one identifier for this publication, without using or revealing manuscript metadata.
        let identifier = "urn:uuid:\(UUID().uuidString.lowercased())"
        let modified = Date.ISO8601FormatStyle(timeZone: .gmt).format(Date())
        return """
            <?xml version="1.0" encoding="UTF-8"?>
            <package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="publication-id">
            <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
            <dc:identifier id="publication-id">\(identifier)</dc:identifier>
            <dc:title>\(title)</dc:title>
            <dc:language>\(language)</dc:language>
            <meta property="dcterms:modified">\(modified)</meta>
            </metadata>
            <manifest>
            \(manifestItems)</manifest>
            <spine>
            \(spineItems)</spine>
            </package>
            """
    }

    // Accept only the shared renderer's escaped text and generated block/nav markup here.
    private static func xhtml(escapedTitle: String, body: String) -> String {
        """
        <?xml version="1.0" encoding="UTF-8"?>
        <html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="\(language)" lang="\(language)">
        <head>
        <title>\(escapedTitle)</title>
        <style>p,h1,h2,h3,h4,h5,h6,pre { white-space: pre-wrap; overflow-wrap: anywhere }</style>
        </head>
        <body>
        \(body)
        </body>
        </html>
        """
    }
}
