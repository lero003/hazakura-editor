@testable import HazakuraNext
import HazakuraNextCore
import Testing

struct MarkdownPreviewOutlineTests {
    @Test func headingIDsAreOriginalBlockIndicesEvenWithDuplicatesAndNestedHeadings() async throws {
        let blocks = try await render("""
            導入

            # 章

            ~~~
            ### 章
            ~~~

            > - ### 章

            終わり

            ###### 末尾
            """)
        try #require(blocks.map(\.kind) == [
            .paragraph, .heading(level: 1), .codeBlock, .heading(level: 3), .paragraph, .heading(level: 6),
        ])
        let entries = MarkdownPreviewOutline(blocks: blocks).entries

        #expect(entries.map(\.id) == [1, 3, 5])
        #expect(entries.map(\.level) == [1, 3, 6])
        #expect(entries.map(\.title) == ["章", "章", "末尾"])
        #expect(entries.map(\.sourceLine) == [3, 9, 13])
    }

    @Test func missingSourceLocationDoesNotRemoveTheHeading() async throws {
        let blocks = try await render("本文\n\n# ![](https://example.invalid/image)")
        try #require(blocks.last?.kind == .heading(level: 1))
        try #require(blocks.last?.headingLocation == nil)
        let entries = MarkdownPreviewOutline(blocks: blocks).entries
        let entry = try #require(entries.first)

        #expect(entries.count == 1)
        #expect(entry.id == 1)
        #expect(entry.title == "［画像］")
        #expect(entry.sourceLine == nil)
    }

    @Test func titleUsesOnlyDisplayRunsAndCollapsesWhitespaceAcrossThem() async throws {
        let blocks = try await render("""
            [**e**́](https://example.invalid/hidden)　　![景色](./hidden.png)
            `コード`   <span>中</span>
            =============
            """)
        let title = try #require(MarkdownPreviewOutline(blocks: blocks).entries.first?.title)

        #expect(title.utf8.elementsEqual("e\u{301} ［画像：景色］ コード ［HTML非表示］中［HTML非表示］".utf8))
    }

    @Test func aWhitespaceOnlyHeadingKeepsItsEmptyTitleForTheViewFallback() async throws {
        let blocks = try await render("# \u{2003}\u{00A0}")
        let entry = try #require(MarkdownPreviewOutline(blocks: blocks).entries.first)

        #expect(entry.id == 0)
        #expect(entry.title.isEmpty)
    }

    @Test func emptyAndHeadingFreePreviewsHaveNoEntries() async throws {
        let blocks = try await render("本文\n\n---\n\n    # code")

        #expect(MarkdownPreviewOutline(blocks: []).entries.isEmpty)
        #expect(MarkdownPreviewOutline(blocks: blocks).entries.isEmpty)
    }

    @Test func truncatedTitlesFitTheScalarBudgetWithoutSplittingTheLastGrapheme() async throws {
        let prefix = String(repeating: "章", count: 159)
        let oversizedCluster = "e" + String(repeating: "\u{301}", count: 2_048)
        let blocks = try await render("# \(prefix)末\n\n# \(prefix)👩‍💻末\n\n# 長文\(oversizedCluster)")
        let titles = MarkdownPreviewOutline(blocks: blocks).entries.map(\.title)

        #expect(titles == [prefix + "末", prefix + "…", "長文…"])
        #expect(titles.allSatisfy { $0.unicodeScalars.count <= 160 })
    }

    private func render(
        _ source: String,
        sourceLocation: SourceLocation = #_sourceLocation
    ) async throws -> [MarkdownPreview.Block] {
        switch try await MarkdownPreview.render(source) {
        case .rendered(let blocks):
            return blocks
        case .unavailable(let reason):
            Issue.record("Expected blocks, got \(reason)", sourceLocation: sourceLocation)
            throw RenderUnavailable()
        }
    }

    private struct RenderUnavailable: Error {}
}
