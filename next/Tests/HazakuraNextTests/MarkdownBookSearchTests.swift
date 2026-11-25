import Foundation
@testable import HazakuraNext
import HazakuraNextCore
import Testing

struct MarkdownBookSearchTests {
    @Test func returnsOneMatchPerBlockInInputOrderWithSectionLocalIndices() async throws {
        let firstID = try #require(UUID(uuidString: "FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF"))
        let lastID = try #require(UUID(uuidString: "00000000-0000-0000-0000-000000000000"))
        let sections = try await MarkdownBookPreview.render([
            source("桜 桜\n\n別の段落\n\n桜", title: "同名", id: firstID),
            source("", title: "空の原稿"),
            source("# 桜\n\n別の段落\n\n桜", title: "同名", id: lastID),
        ])

        #expect(MarkdownReaderSearch.searchBook(" \t\n桜\u{3000}", in: sections) == .matches([
            .init(sectionID: firstID, blockIndex: 0),
            .init(sectionID: firstID, blockIndex: 2),
            .init(sectionID: lastID, blockIndex: 0),
            .init(sectionID: lastID, blockIndex: 2),
        ]))
    }

    @Test func joinsInlineRunsButNeverTextAcrossBlocksOrDocuments() async throws {
        let first = source("青い**桜**が *咲く*\n\n凍る\n\n海\n\n北")
        let second = source("風")
        let sections = try await MarkdownBookPreview.render([first, second])

        #expect(MarkdownReaderSearch.searchBook("青い桜が 咲く", in: sections) == .matches([
            .init(sectionID: first.id, blockIndex: 0),
        ]))
        for query in ["凍る海", "凍る\n\n海", "北風", "北\n\n風"] {
            #expect(MarkdownReaderSearch.searchBook(query, in: sections) == .matches([]))
        }
    }

    @Test(arguments: ["\n", "\r\n", "\r"])
    func distinguishesSoftAndExplicitBreaksInBothSearchModes(_ lineEnd: String) async throws {
        let first = source("青い\(lineEnd)**桜**\(lineEnd)\(lineEnd)青い  \(lineEnd)**桜**")
        let second = source("# 記録\(lineEnd)\(lineEnd)青い\\\(lineEnd)**桜**")
        let sections = try await MarkdownBookPreview.render([first, second])
        let blocks = try #require(sections.first?.blocks)

        #expect(MarkdownReaderSearch.search("青い 桜", in: blocks) == .matches([0]))
        #expect(MarkdownReaderSearch.search("青い\n桜", in: blocks) == .matches([1]))
        #expect(MarkdownReaderSearch.searchBook("青い 桜", in: sections) == .matches([
            .init(sectionID: first.id, blockIndex: 0),
        ]))
        #expect(MarkdownReaderSearch.searchBook("青い\n桜", in: sections) == .matches([
            .init(sectionID: first.id, blockIndex: 1),
            .init(sectionID: second.id, blockIndex: 1),
        ]))
    }

    @Test func keepsSingleDocumentCaseAndCanonicalEquivalenceWithoutFoldingWidthOrDiacritics() async throws {
        let first = source("**E**\u{301}lan が ＡＢＣ")
        let sections = try await MarkdownBookPreview.render([first, source("別の本文")])

        for query in ["élan", "か\u{3099}", "ＡｂＣ"] {
            #expect(MarkdownReaderSearch.searchBook(query, in: sections) == .matches([
                .init(sectionID: first.id, blockIndex: 0),
            ]))
        }
        for query in ["elan", "か", "abc"] {
            #expect(MarkdownReaderSearch.searchBook(query, in: sections) == .matches([]))
        }
    }

    @Test func searchesVisibleRunsButNotSectionTitlesDestinationsOrFallbackLabels() async throws {
        let first = source("""
            # 見出し

            [リンク](../private-link.md) ![眺め](../private-image.png) `../visible-literal.md`
            """)
        let second = source("<section>hidden-html</section>\n\n---", title: "private-title.md")
        let sections = try await MarkdownBookPreview.render([first, second])

        #expect(MarkdownReaderSearch.searchBook("見出し", in: sections) == .matches([
            .init(sectionID: first.id, blockIndex: 0),
        ]))
        for query in ["リンク", "眺め", "../visible-literal.md"] {
            #expect(MarkdownReaderSearch.searchBook(query, in: sections) == .matches([
                .init(sectionID: first.id, blockIndex: 1),
            ]))
        }
        for query in ["private-title.md", "../private-link.md", "../private-image.png", "hidden-html", "HTML", "---"] {
            #expect(MarkdownReaderSearch.searchBook(query, in: sections) == .matches([]))
        }
    }

    @Test func distinguishesEmptyAndOverLimitQueriesBeforeTrimming() async throws {
        let limitQuery = String(repeating: "é", count: 256)
        let first = source(limitQuery)
        let sections = try await MarkdownBookPreview.render([first, source("")])

        #expect(MarkdownReaderSearch.searchBook("", in: sections) == .emptyQuery)
        #expect(MarkdownReaderSearch.searchBook(" \t\n\u{00A0}\u{3000}", in: sections) == .emptyQuery)
        #expect(MarkdownReaderSearch.searchBook(limitQuery, in: sections) == .matches([
            .init(sectionID: first.id, blockIndex: 0),
        ]))
        #expect(MarkdownReaderSearch.searchBook(limitQuery + " ", in: sections) == .queryTooLong)
        #expect(MarkdownReaderSearch.searchBook(String(repeating: " ", count: 513), in: sections) == .queryTooLong)
    }

    private func source(_ text: String, title: String = "原稿", id: UUID = UUID()) -> MarkdownBookPreview.Source {
        MarkdownBookPreview.Source(id: id, title: title, text: text)
    }
}
