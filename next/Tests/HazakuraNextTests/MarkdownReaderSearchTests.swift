@testable import HazakuraNext
import HazakuraNextCore
import Testing

struct MarkdownReaderSearchTests {
    @Test func concatenatesInlineRunsButDoesNotCrossBlocks() async throws {
        let blocks = try await render("青い**桜**が *咲く*\n\n青い\n\n桜が 咲く")
        let paragraph = try #require(blocks.first)
        try #require(paragraph.runs.count > 1)

        #expect(MarkdownReaderSearch.search("青い桜が 咲く", in: blocks) == .matches([0]))
        #expect(MarkdownReaderSearch.search("青い\n\n桜", in: blocks) == .matches([]))
    }

    @Test(arguments: ["élan", "CAFÉ", "か\u{3099}", "👩‍💻", "ＡｂＣ"])
    func matchesUnicodeCaseAndCanonicalEquivalence(query: String) async throws {
        let blocks = try await render("**E**\u{301}lan Cafe\u{301} が 👩‍💻 ＡＢＣ")

        #expect(MarkdownReaderSearch.search(query, in: blocks) == .matches([0]))
    }

    @Test(arguments: ["elan", "cafe", "か", "abc", "ｶﾅ"])
    func doesNotFoldDiacriticsOrWidth(query: String) async throws {
        let blocks = try await render("Élan Café が ＡＢＣ カナ")

        #expect(MarkdownReaderSearch.search(query, in: blocks) == .matches([]))
    }

    @Test func trimsWhitespaceAndNewlinesAroundTheQuery() async throws {
        let blocks = try await render("本文")

        #expect(MarkdownReaderSearch.search(" \t\n本文\u{00A0}\u{3000}\r\n", in: blocks) == .matches([0]))
    }

    @Test(arguments: ["", " \t\n\r\u{00A0}\u{3000}"])
    func emptyOrBlankQueryDoesNotMatch(query: String) {
        #expect(MarkdownReaderSearch.search(query, in: []) == .emptyQuery)
    }

    @Test func appliesUTF8ByteLimitBeforeTrimming() async throws {
        let query = String(repeating: "é", count: 256)
        let blocks = try await render(query)

        #expect(MarkdownReaderSearch.queryByteLimit == 512)
        #expect(MarkdownReaderSearch.search(query, in: blocks) == .matches([0]))
        #expect(MarkdownReaderSearch.search(query + " ", in: blocks) == .queryTooLong)
        #expect(MarkdownReaderSearch.search(String(repeating: " ", count: 513), in: blocks) == .queryTooLong)
    }

    @Test func returnsEachMatchingBlockOnceInGlobalOrderAcrossChapters() async throws {
        let blocks = try await render("桜 桜\n\n# 日記\n\n桜\n\n## 次の日\n\n別の段落\n\n桜")

        let chapters = MarkdownReaderChapters(blocks: blocks, outline: MarkdownPreviewOutline(blocks: blocks))
        guard case .matches(let ids) = MarkdownReaderSearch.search("桜", in: blocks) else {
            Issue.record("Expected matching blocks")
            return
        }
        #expect(ids == [0, 2, 5])
        #expect(ids.map { chapters.chapterIndex(containing: $0) } == [0, 1, 2])
    }

    @Test func returnsAllMatchesAtThePreviewBlockLimit() async throws {
        let blocks = try await render(String(repeating: "項目\n\n", count: 2_000))

        #expect(MarkdownReaderSearch.search("項目", in: blocks) == .matches(Array(0..<2_000)))
    }

    @Test func searchesProjectedLabelsAndCodedLiteralsButNotHiddenAuthorReferences() async throws {
        let blocks = try await render("""
            # 見出し

            [リンク][private-ref] ![眺め](../private-image.png) <https://example.invalid/visible> `inlineLiteral`

            ```md
            [codeLabel](../coded-target.md)
            ```

            [private-ref]: ../private-link.md "private-title"
            """)

        #expect(MarkdownReaderSearch.search("見出し", in: blocks) == .matches([0]))
        #expect(MarkdownReaderSearch.search("眺め", in: blocks) == .matches([1]))
        #expect(MarkdownReaderSearch.search("リンク", in: blocks) == .matches([1]))
        #expect(MarkdownReaderSearch.search("https://example.invalid/visible", in: blocks) == .matches([1]))
        #expect(MarkdownReaderSearch.search("INLINELITERAL", in: blocks) == .matches([1]))
        #expect(MarkdownReaderSearch.search("[codelabel](../coded-target.md)", in: blocks) == .matches([2]))
        for hidden in ["private-ref", "../private-image.png", "../private-link.md", "private-title"] {
            #expect(MarkdownReaderSearch.search(hidden, in: blocks) == .matches([]))
        }
    }

    @Test func doesNotSearchFallbacksWithoutTextualRuns() async throws {
        let blocks = try await render("""
            <section>hidden-html</section>

            | hidden-cell | 値 |
            | --- | --- |
            | 内容 | 二 |

            ---
            """)
        try #require(blocks.map(\.kind) == [.unsupported(.html), .unsupported(.table), .thematicBreak])

        for hidden in ["hidden-html", "hidden-cell", "HTML", "表", "---"] {
            #expect(MarkdownReaderSearch.search(hidden, in: blocks) == .matches([]))
        }
    }

    private func render(_ source: String, sourceLocation: SourceLocation = #_sourceLocation) async throws -> [MarkdownPreview.Block] {
        let result = try await MarkdownPreview.render(source)
        guard case .rendered(let blocks) = result else {
            Issue.record("Expected rendered blocks, got \(result)", sourceLocation: sourceLocation)
            throw RenderUnavailable()
        }
        return blocks
    }

    private struct RenderUnavailable: Error {}
}
