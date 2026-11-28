import Foundation
@testable import HazakuraNext
import HazakuraNextCore
import Testing

struct MarkdownEPUBExportTests {
    @Test func buildsEPUB3FromReaderChapterRangesInOrder() async throws {
        let files = try await exportedFiles("""
            前書き

            # 同じ < &

            一章の本文

            > ## 引用見出し
            > 引用本文

            - # リスト内見出し

            ### 小見出し

            ---

            ## 同じ < &

            原稿末尾
            """)
        let expectedHrefs = ["chapter-1.xhtml", "chapter-2.xhtml", "chapter-3.xhtml"]
        #expect(Set(files.keys) == Set(["mimetype", "META-INF/container.xml", "EPUB/package.opf", "EPUB/nav.xhtml"]
            + expectedHrefs.map { "EPUB/" + $0 }))
        #expect(files["mimetype"] == Data("application/epub+zip".utf8))

        let container = try document("META-INF/container.xml", in: files, namespace: "urn:oasis:names:tc:opendocument:xmlns:container")
        let rootfile = try #require(nodes("rootfile", in: container).first as? XMLElement)
        #expect(rootfile.attribute(forName: "full-path")?.stringValue == "EPUB/package.opf")
        #expect(rootfile.attribute(forName: "media-type")?.stringValue == "application/oebps-package+xml")

        let package = try document("EPUB/package.opf", in: files, namespace: "http://www.idpf.org/2007/opf")
        let root = try #require(package.rootElement())
        #expect(root.attribute(forName: "version")?.stringValue == "3.0")
        #expect(try nodes("title", in: package).map(\.stringValue) == ["Hazakura Editor"])
        #expect(try nodes("language", in: package).map(\.stringValue) == ["und"])
        let id = try #require(nodes("identifier", in: package).first as? XMLElement)
        #expect(root.attribute(forName: "unique-identifier")?.stringValue == id.attribute(forName: "id")?.stringValue)
        let identifier = try #require(id.stringValue)
        try #require(identifier.hasPrefix("urn:uuid:"))
        #expect(UUID(uuidString: String(identifier.dropFirst("urn:uuid:".count))) != nil)
        let modified = try #require(nodes("meta", in: package).first as? XMLElement)
        #expect(modified.attribute(forName: "property")?.stringValue == "dcterms:modified")
        let timestamp = try #require(modified.stringValue)
        #expect(timestamp.count == 20 && timestamp.hasSuffix("Z"))
        #expect(ISO8601DateFormatter().date(from: timestamp) != nil)

        let manifest = try nodes("item", in: package).compactMap { $0 as? XMLElement }
        let ids = manifest.compactMap { $0.attribute(forName: "id")?.stringValue }
        let hrefs = manifest.compactMap { $0.attribute(forName: "href")?.stringValue }
        #expect(Set(ids).count == 4)
        #expect(Set(hrefs) == Set(["nav.xhtml"] + expectedHrefs))
        #expect(manifest.allSatisfy { $0.attribute(forName: "media-type")?.stringValue == "application/xhtml+xml" })
        let navItem = try #require(manifest.first { $0.attribute(forName: "href")?.stringValue == "nav.xhtml" })
        #expect(navItem.attribute(forName: "properties")?.stringValue == "nav")
        let spine = try nodes("itemref", in: package).compactMap { ($0 as? XMLElement)?.attribute(forName: "idref")?.stringValue }
        let itemsById = zip(ids, hrefs)
        #expect(spine.compactMap { id in itemsById.first { $0.0 == id }?.1 } == expectedHrefs)

        let nav = try document("EPUB/nav.xhtml", in: files)
        let navElements = try nodes("nav", in: nav)
        try #require(navElements.count == 1)
        let toc = try #require(navElements.first as? XMLElement)
        #expect(toc.attribute(forLocalName: "type", uri: "http://www.idpf.org/2007/ops")?.stringValue == "toc")
        let links = try nodes("a", in: nav).compactMap { $0 as? XMLElement }
        #expect(links.compactMap { $0.attribute(forName: "href")?.stringValue } == expectedHrefs)
        #expect(links.map(\.stringValue) == ["前書き", "同じ < &", "同じ < &"])

        let intro = try document("EPUB/chapter-1.xhtml", in: files)
        #expect(try nodes("p", in: intro).map(\.stringValue) == ["前書き"])
        let first = try document("EPUB/chapter-2.xhtml", in: files)
        #expect(try nodes("h1", in: first).map(\.stringValue) == ["同じ < &", "リスト内見出し"])
        #expect(try nodes("h2", in: first).map(\.stringValue) == ["引用見出し"])
        #expect(try nodes("h3", in: first).map(\.stringValue) == ["小見出し"])
        #expect(try nodes("hr", in: first).count == 1)
        #expect(try nodes("p", in: first).map(\.stringValue) == ["一章の本文", "引用本文"])
        let last = try document("EPUB/chapter-3.xhtml", in: files)
        #expect(try nodes("h2", in: last).map(\.stringValue) == ["同じ < &"])
        #expect(try nodes("p", in: last).map(\.stringValue) == ["原稿末尾"])
    }

    @Test func keepsLiteralsAndLabelsAsTextAndReplacesInvalidXMLScalars() async throws {
        let files = try await exportedFiles("""
            # `\" ' < &` 章\u{FFFF}

            [ラベル](https://example.invalid/epub-target) ![絵](file:///never-read-epub-fixture)

            <script>authorScriptMarker</script>

            ```text
            </code> <img src=\"not-an-attribute\"> & \u{1}\u{FFFE}
            ```
            """)
        let chapter = try document("EPUB/chapter-1.xhtml", in: files)
        let h1 = try #require(nodes("h1", in: chapter).first?.stringValue)
        #expect(h1 == "\" ' < & 章\u{FFFD}")
        let code = try #require(nodes("pre", in: chapter).first?.stringValue)
        #expect(code == "</code> <img src=\"not-an-attribute\"> & \u{FFFD}\u{FFFD}\n")
        #expect(try nodes("p", in: chapter).map(\.stringValue).contains("ラベル ［画像：絵］"))
        #expect(try chapter.nodes(forXPath: "//*[@href or @src or @srcset or @style or @onclick]").isEmpty)
        for tag in ["a", "img", "script", "iframe", "object", "link", "base"] {
            #expect(try nodes(tag, in: chapter).isEmpty)
        }
        let raw = String(decoding: try #require(files["EPUB/chapter-1.xhtml"]), as: UTF8.self)
        for discarded in ["epub-target", "never-read-epub-fixture", "authorScriptMarker"] {
            #expect(raw.contains(discarded) == false)
        }
        let nav = try document("EPUB/nav.xhtml", in: files)
        #expect(try nodes("a", in: nav).map(\.stringValue) == [h1])
    }

    @Test func includesSemanticTableInTheReadingChapterWithoutActiveReferences() async throws {
        let files = try await exportedFiles("""
            # 章

            | 項目 | 値 |
            | --- | --- |
            | [しおり](./hidden.md) | `</td>` |
            """)
        let chapter = try document("EPUB/chapter-1.xhtml", in: files)
        #expect(try nodes("table", in: chapter).count == 1)
        #expect(try nodes("thead", in: chapter).count == 1)
        #expect(try nodes("th", in: chapter).map(\.stringValue) == ["項目", "値"])
        #expect(try nodes("td", in: chapter).map(\.stringValue) == ["しおり", "</td>"])
        #expect(try chapter.nodes(forXPath: "//*[@href or @src]").isEmpty)
        let style = try #require(nodes("style", in: chapter).first?.stringValue)
        #expect(style.contains("table-layout: fixed"))
        #expect(style.contains("pre,th,td { white-space: pre-wrap; overflow-wrap: anywhere }"))
        let raw = String(decoding: try #require(files["EPUB/chapter-1.xhtml"]), as: UTF8.self)
        #expect(!raw.contains("hidden.md"))
    }

    @Test func usesOneFallbackChapterWithoutRootChapterHeadings() async throws {
        let files = try await exportedFiles("本文\n\n### 小見出し\n\n> # 引用")
        let nav = try document("EPUB/nav.xhtml", in: files)
        #expect(try nodes("a", in: nav).map(\.stringValue) == ["本文"])
        let chapter = try document("EPUB/chapter-1.xhtml", in: files)
        #expect(try nodes("p", in: chapter).map(\.stringValue) == ["本文"])
        #expect(try nodes("h3", in: chapter).map(\.stringValue) == ["小見出し"])
        #expect(try nodes("h1", in: chapter).map(\.stringValue) == ["引用"])
    }

    @Test func capsChaptersIncludingAnyIntroduction() async throws {
        let source = "前書き\n\n" + String(repeating: "# 同名\n\n", count: 127)
        let files = try await exportedFiles(source)
        let nav = try document("EPUB/nav.xhtml", in: files)
        #expect(try nodes("a", in: nav).count == 128)
        #expect(files["EPUB/chapter-128.xhtml"] != nil)
        await #expect(throws: MarkdownEPUBExport.ExportError.tooManyChapters) {
            try await MarkdownEPUBExport.render(source: source + "## 129番目")
        }
    }

    @Test func refusesAnEmptyProjection() async {
        await #expect(throws: MarkdownEPUBExport.ExportError.emptyDocument) {
            try await MarkdownEPUBExport.render(source: " \n\t\n")
        }
    }

    @Test func preservesPreviewLimitsAndCancellation() async {
        await #expect(throws: MarkdownHTMLExport.ExportError.unavailable(.inputTooLarge)) {
            try await MarkdownEPUBExport.render(source: String(repeating: "a", count: 128 * 1024 + 1))
        }
        await withThrowingTaskGroup(of: Data.self) { group in
            group.cancelAll()
            group.addTask { try await MarkdownEPUBExport.render(source: "# Cancelled") }
            await #expect(throws: CancellationError.self) { try await group.next() }
        }
    }

    @Test func bookKeepsInputOrderAndParsesEachManuscriptSeparately() async throws {
        let sources = [
            manuscript("""
                [shared]: https://example.invalid/reference-target

                [同じ原稿の参照][shared]

                ```text
                閉じていないコード
                """, title: "Z.md"),
            manuscript(" \n\t\n", title: "B.md"),
            manuscript("""
                # 次の原稿

                [別の原稿の参照][shared]

                ## 区切らない見出し

                末尾
                """, title: "A.md"),
        ]
        let render: @Sendable ([MarkdownBookPreview.Source]) async throws -> Data = MarkdownEPUBExport.renderBook
        let files = try storedFiles(try await render(sources))
        let chapterIDs = ["chapter-1", "chapter-2", "chapter-3"]
        let hrefs = chapterIDs.map { $0 + ".xhtml" }
        #expect(Set(files.keys) == Set(["mimetype", "META-INF/container.xml", "EPUB/package.opf", "EPUB/nav.xhtml"]
            + hrefs.map { "EPUB/" + $0 }))

        let package = try document("EPUB/package.opf", in: files, namespace: "http://www.idpf.org/2007/opf")
        let spine = try nodes("itemref", in: package).compactMap { ($0 as? XMLElement)?.attribute(forName: "idref")?.stringValue }
        #expect(spine == chapterIDs)
        for (id, href) in zip(chapterIDs, hrefs) {
            let items = try package.nodes(forXPath: "//*[local-name()='item'][@id='\(id)']")
            let item = try #require(items.first as? XMLElement)
            #expect(item.attribute(forName: "href")?.stringValue == href)
        }
        let nav = try document("EPUB/nav.xhtml", in: files)
        let links = try nodes("a", in: nav).compactMap { $0 as? XMLElement }
        #expect(links.compactMap { $0.attribute(forName: "href")?.stringValue } == hrefs)
        #expect(links.map(\.stringValue) == ["原稿 1", "原稿 2", "原稿 3"])

        let first = try document("EPUB/chapter-1.xhtml", in: files)
        #expect(try nodes("title", in: first).map(\.stringValue) == ["原稿 1"])
        #expect(try nodes("p", in: first).map(\.stringValue) == ["同じ原稿の参照"])
        let code = try #require(nodes("pre", in: first).first?.stringValue)
        #expect(code.trimmingCharacters(in: .newlines) == "閉じていないコード")

        let empty = try document("EPUB/chapter-2.xhtml", in: files)
        #expect(try nodes("title", in: empty).map(\.stringValue) == ["原稿 2"])
        #expect(try nodes("p", in: empty).map(\.stringValue) == ["表示する本文がありません。"])

        let last = try document("EPUB/chapter-3.xhtml", in: files)
        #expect(try nodes("title", in: last).map(\.stringValue) == ["原稿 3"])
        #expect(try nodes("h1", in: last).map(\.stringValue) == ["次の原稿"])
        #expect(try nodes("h2", in: last).map(\.stringValue) == ["区切らない見出し"])
        #expect(try nodes("p", in: last).map(\.stringValue) == ["[別の原稿の参照][shared]", "末尾"])
        #expect(try nodes("pre", in: last).isEmpty)
    }

    @Test func bookNeverUsesManuscriptNamesOrContentForMetadataOrActiveMarkup() async throws {
        let sources = [
            manuscript("""
                # `ManuscriptHeadingMarker < &`

                [ラベル](https://example.invalid/book-link-target) ![絵](file:///book-image-target)

                <script>bookScriptMarker</script>

                ```text
                </code> <img src="bookLiteralMarker" /> &
                ```
                """, title: "../PrivateFilenameMarker <img src='name-target'>.md"),
            manuscript("末尾", title: "SecondFilenameMarker.md"),
        ]
        let files = try storedFiles(try await MarkdownEPUBExport.renderBook(sources: sources))
        for xml in files.values.map({ String(decoding: $0, as: UTF8.self) }) {
            for marker in ["PrivateFilenameMarker", "SecondFilenameMarker", "name-target",
                           "book-link-target", "book-image-target", "bookScriptMarker"] {
                #expect(xml.contains(marker) == false)
            }
            for source in sources {
                #expect(xml.lowercased().contains(source.id.uuidString.lowercased()) == false)
            }
        }
        let chapter = try document("EPUB/chapter-1.xhtml", in: files)
        #expect(try nodes("title", in: chapter).map(\.stringValue) == ["原稿 1"])
        #expect(try nodes("h1", in: chapter).map(\.stringValue) == ["ManuscriptHeadingMarker < &"])
        #expect(try nodes("pre", in: chapter).map(\.stringValue) == ["</code> <img src=\"bookLiteralMarker\" /> &\n"])
        #expect(try nodes("p", in: chapter).map(\.stringValue).contains("ラベル ［画像：絵］"))
        #expect(try chapter.nodes(forXPath: "//*[@href or @src or @srcset or @style or @onclick]").isEmpty)
        for tag in ["a", "img", "script", "iframe", "object", "link", "base"] {
            #expect(try nodes(tag, in: chapter).isEmpty)
        }
        let package = try document("EPUB/package.opf", in: files, namespace: "http://www.idpf.org/2007/opf")
        #expect(try nodes("title", in: package).map(\.stringValue) == ["Hazakura Editor"])
        #expect(try nodes("language", in: package).map(\.stringValue) == ["und"])
        for path in ["EPUB/package.opf", "EPUB/nav.xhtml"] {
            let raw = String(decoding: try #require(files[path]), as: UTF8.self)
            #expect(raw.contains("ManuscriptHeadingMarker") == false)
            #expect(raw.contains("bookLiteralMarker") == false)
        }
    }

    @Test func bookWithOnlyEmptyManuscriptsStillExportsEntries() async throws {
        let files = try storedFiles(try await MarkdownEPUBExport.renderBook(sources: [manuscript(""), manuscript("\n")]))
        let nav = try document("EPUB/nav.xhtml", in: files)
        #expect(try nodes("a", in: nav).map(\.stringValue) == ["原稿 1", "原稿 2"])
        for number in 1...2 {
            let chapter = try document("EPUB/chapter-\(number).xhtml", in: files)
            #expect(try nodes("p", in: chapter).map(\.stringValue) == ["表示する本文がありません。"])
        }
    }

    @Test func bookPreservesPerManuscriptAndAggregateByteLimits() async {
        let half = String(repeating: "é", count: 65_536) // 128 KiB in UTF-8.
        let oversized = manuscript(half + "!")
        await #expect(throws: MarkdownBookPreview.Failure.unavailable(sectionID: oversized.id, .inputTooLarge)) {
            try await MarkdownEPUBExport.renderBook(sources: [manuscript("最初"), oversized])
        }
        await #expect(throws: MarkdownBookPreview.Failure.tooLarge) {
            try await MarkdownEPUBExport.renderBook(sources: [manuscript(half), manuscript(half), manuscript("!")])
        }
    }

    @Test func bookPropagatesCancellationWithoutAnArchive() async {
        let sources = [manuscript("# 先頭"), manuscript("# 末尾")]
        await withThrowingTaskGroup(of: Data.self) { group in
            group.cancelAll()
            group.addTask { try await MarkdownEPUBExport.renderBook(sources: sources) }
            await #expect(throws: CancellationError.self) { try await group.next() }
        }
    }

    private func manuscript(_ text: String, title: String = "原稿.md") -> MarkdownBookPreview.Source {
        MarkdownBookPreview.Source(id: UUID(), title: title, text: text)
    }

    private func document(
        _ path: String, in files: [String: Data], namespace: String = "http://www.w3.org/1999/xhtml"
    ) throws -> XMLDocument {
        let document = try XMLDocument(data: #require(files[path]), options: .nodeLoadExternalEntitiesNever)
        #expect(document.rootElement()?.uri == namespace)
        return document
    }

    private func nodes(_ localName: String, in document: XMLDocument) throws -> [XMLNode] {
        try document.nodes(forXPath: "//*[local-name()='\(localName)']")
    }

    private func exportedFiles(_ source: String) async throws -> [String: Data] {
        try storedFiles(try await MarkdownEPUBExport.render(source: source))
    }

    /// Extract stored local entries (ZIP metadata and CRCs are verified in archive tests).
    private func storedFiles(_ archive: Data) throws -> [String: Data] {
        func uint16(_ offset: Int) -> Int {
            Int(archive.withUnsafeBytes { UInt16(littleEndian: $0.loadUnaligned(fromByteOffset: offset, as: UInt16.self)) })
        }
        func uint32(_ offset: Int) -> Int {
            Int(archive.withUnsafeBytes { UInt32(littleEndian: $0.loadUnaligned(fromByteOffset: offset, as: UInt32.self)) })
        }
        var offset = 0
        var files: [String: Data] = [:]
        while offset + 30 <= archive.count, uint32(offset) == 0x04034B50 {
            try #require(uint16(offset + 8) == 0) // Stored, not compressed.
            let pathStart = offset + 30
            let pathEnd = pathStart + uint16(offset + 26)
            let dataStart = pathEnd + uint16(offset + 28)
            let dataEnd = dataStart + uint32(offset + 18)
            try #require(dataEnd <= archive.count)
            let path = String(decoding: archive[pathStart..<pathEnd], as: UTF8.self)
            try #require(files[path] == nil)
            files[path] = Data(archive[dataStart..<dataEnd])
            offset = dataEnd
        }
        return files
    }
}
