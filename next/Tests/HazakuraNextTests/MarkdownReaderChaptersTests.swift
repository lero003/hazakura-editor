@testable import HazakuraNext
import HazakuraNextCore
import Testing

struct MarkdownReaderChaptersTests {
    @Test func mixedRootHeadingsKeepTheirGlobalIdentityAndCoverEveryBlock() async throws {
        let blocks = try await render("""
            導入

            # 章
            ## 章

            > # 章
            > - ## 章

            - ## 章

            ### 章

            ~~~
            ## 章
            ~~~

            ## 章
            本文

            # 章
            """)
        let outline = MarkdownPreviewOutline(blocks: blocks)
        // The outline includes nested headings and H3, unlike the chapter boundaries.
        try #require(outline.entries.map(\.id) == [1, 2, 3, 4, 5, 6, 8, 10])
        let projection = MarkdownReaderChapters(blocks: blocks, outline: outline)
        let chapters = projection.chapters

        #expect(chapters.map(\.range) == [0..<1, 1..<2, 2..<8, 8..<10, 10..<11])
        #expect(chapters.flatMap(\.range) == Array(blocks.indices))
        #expect(chapters.map(\.id) == [0, 1, 2, 8, 10])
        #expect(chapters.map { $0.heading?.id } == [nil, 1, 2, 8, 10])
        #expect(chapters.map { $0.heading?.title } == [nil, "章", "章", "章", "章"])
        #expect(chapters.map { $0.heading?.sourceLine } == [nil, 3, 4, 17, 20])
        #expect(blocks.indices.map { projection.chapterIndex(containing: $0) } == [0, 1, 2, 2, 2, 2, 2, 2, 3, 3, 4])
        for invalidIndex in [Int.min, -1, blocks.endIndex, Int.max] {
            #expect(projection.chapterIndex(containing: invalidIndex) == nil)
        }
    }

    @Test func rootH1AlsoSplitsWhenThereAreNoRootH2Headings() async throws {
        let blocks = try await render("""
            一
            ===

            本文

            # 二
            """)
        let chapters = project(blocks).chapters

        #expect(chapters.map(\.range) == [0..<2, 2..<3])
        #expect(chapters.map { $0.heading?.title } == ["一", "二"])
    }

    @Test func rootH2AlsoSplitsWhenThereAreNoRootH1Headings() async throws {
        let blocks = try await render("""
            一
            ---

            本文

            ## 二
            """)
        let chapters = project(blocks).chapters

        #expect(chapters.map(\.range) == [0..<2, 2..<3])
        #expect(chapters.map { $0.heading?.title } == ["一", "二"])
    }

    @Test(arguments: ["本文\n\n---\n\n    # code", "### 小見出し\n\n本文", "> # 引用\n\n- ## リスト"])
    func nonemptyPreviewWithoutQualifyingHeadingsHasOneUnnamedChapter(source: String) async throws {
        let blocks = try await render(source)
        try #require(blocks.isEmpty == false)
        let projection = project(blocks)

        #expect(projection.chapters.map(\.range) == [blocks.indices])
        #expect(projection.chapters.first?.heading == nil)
        #expect(blocks.indices.allSatisfy { projection.chapterIndex(containing: $0) == 0 })
    }

    @Test func emptyPreviewHasNoChaptersOrBookmarks() {
        let projection = project([])

        #expect(projection.chapters.isEmpty)
        #expect(projection.chapterIndex(containing: 0) == nil)
    }

    @Test func missingSourceLocationDoesNotRemoveAChapterBoundary() async throws {
        let blocks = try await render("本文\n\n# ![](https://example.invalid/image)")
        let outline = MarkdownPreviewOutline(blocks: blocks)
        let entry = try #require(outline.entries.first)
        try #require(entry.sourceLine == nil)
        let projection = MarkdownReaderChapters(blocks: blocks, outline: outline)

        #expect(projection.chapters.map(\.range) == [0..<1, 1..<2])
        let heading = try #require(projection.chapters.last?.heading)
        #expect(heading.id == entry.id)
        #expect(heading.title == entry.title)
        #expect(heading.sourceLine == nil)
        #expect(projection.chapterIndex(containing: heading.id) == 1)
    }

    private func project(_ blocks: [MarkdownPreview.Block]) -> MarkdownReaderChapters {
        MarkdownReaderChapters(blocks: blocks, outline: MarkdownPreviewOutline(blocks: blocks))
    }

    private func render(
        _ source: String,
        sourceLocation: SourceLocation = #_sourceLocation
    ) async throws -> [MarkdownPreview.Block] {
        let result = try await MarkdownPreview.render(source)
        guard case .rendered(let blocks) = result else {
            Issue.record("Expected rendered blocks, got \(result)", sourceLocation: sourceLocation)
            throw RenderUnavailable()
        }
        return blocks
    }

    private struct RenderUnavailable: Error {}
}
