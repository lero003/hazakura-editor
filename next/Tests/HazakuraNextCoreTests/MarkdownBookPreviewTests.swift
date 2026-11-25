import Foundation
import HazakuraNextCore
import Testing

struct MarkdownBookPreviewTests {
    @Test func preservesExplicitOrderAndKeepsEmptyChaptersWithDuplicateTitles() async throws {
        let sources = [source("# 最初", title: "乙"), source("", title: "甲"), source("# 最後", title: "乙")]
        let sections = try await MarkdownBookPreview.render(sources)

        #expect(sections.map(\.id) == sources.map(\.id))
        #expect(sections.map(\.title) == ["乙", "甲", "乙"])
        #expect(sections.map { $0.blocks.map(text) } == [["最初"], [], ["最後"]])
    }

    @Test(arguments: [0, 1, 9])
    func rejectsUnsupportedSelectionCounts(count: Int) async {
        let sources = (0..<count).map { _ in source("") }
        await #expect(throws: MarkdownBookPreview.Failure.invalidSelection) {
            try await MarkdownBookPreview.render(sources)
        }
    }

    @Test func acceptsEightDistinctChapters() async throws {
        let sources = (0..<8).map { _ in source("") }
        let sections = try await MarkdownBookPreview.render(sources)
        #expect(sections.map(\.id) == sources.map(\.id))
    }

    @Test func rejectsDuplicateIDsEvenWithDifferentTitlesAndText() async {
        let first = source("最初", title: "甲")
        let duplicate = MarkdownBookPreview.Source(id: first.id, title: "乙", text: "別の本文")
        await #expect(throws: MarkdownBookPreview.Failure.invalidSelection) {
            try await MarkdownBookPreview.render([first, source("間の章"), duplicate])
        }
    }

    @Test func aggregateLimitCountsUTF8AndAcceptsExactly256KiB() async throws {
        let half = String(repeating: "é", count: 65_536)
        let sources = [source(half), source(half)]
        let sections = try await MarkdownBookPreview.render(sources)
        #expect(sections.map { $0.blocks.map(text) } == [[half], [half]])

        // Each chapter fits on its own; the extra byte only exceeds the book limit.
        await #expect(throws: MarkdownBookPreview.Failure.tooLarge) {
            try await MarkdownBookPreview.render(sources + [source("!")])
        }
    }

    @Test(arguments: [MarkdownPreview.Limit.inputTooLarge, .tooManyBlocks, .tooComplex])
    func reportsAChapterFailureWithoutReturningAPartialBook(limit: MarkdownPreview.Limit) async {
        let body: String
        switch limit {
        case .inputTooLarge: body = String(repeating: "é", count: 65_536) + "!"
        case .tooManyBlocks: body = String(repeating: "項目\n\n", count: 2_000) + "末尾"
        case .tooComplex: body = "最初\n\n" + String(repeating: "`甲` 乙 ", count: 300)
        case .parseFailed:
            Issue.record("No deterministic fixture for a Foundation Markdown parser failure")
            return
        }
        let unavailable = source(body)
        let sources = [source("最初"), unavailable, source("最後")]
        await #expect(throws: MarkdownBookPreview.Failure.unavailable(sectionID: unavailable.id, limit)) {
            try await MarkdownBookPreview.render(sources)
        }
    }

    @Test func unclosedCodeFenceCannotConsumeNextChapter() async throws {
        let sections = try await MarkdownBookPreview.render([source("```text\n先頭"), source("# 見出し\n\n本文")])

        #expect(sections.map { $0.blocks.map(\.kind) } == [[.codeBlock], [.heading(level: 1), .paragraph]])
        let heading = try #require(sections.last?.blocks.first)
        #expect(text(heading) == "見出し")
        #expect(heading.headingLocation?.line == 1)
        #expect(heading.headingLocation?.utf16Offset == 0)
    }

    @Test func referenceDefinitionsCannotResolveAcrossChapters() async throws {
        let definition = source("[shared]: https://example.invalid/hidden\n\n[同じ章の参照][shared]")
        let reference = source("[別の章の参照][shared]")
        let sections = try await MarkdownBookPreview.render([definition, reference])

        #expect(sections.map { $0.blocks.map(text) } == [["同じ章の参照"], ["[別の章の参照][shared]"]])
    }

    @Test func linksAndImagesUseOnlyInertDisplayRuns() async throws {
        let chapters = [
            source("[**外部**](https://example.invalid/hidden) [別の章](chapter.md) ![眺め](file:///never.png)", title: "**原稿**"),
            source("# 次の章", title: "chapter.md"),
        ]
        let sections = try await MarkdownBookPreview.render(chapters)
        let first = try #require(sections.first)
        #expect(first.title == "**原稿**")
        #expect(first.blocks.map(text) == ["外部 別の章 ［画像：眺め］"])
        // Foundation's style runs inside a link may vary by SDK; use the single-document
        // projection as the contract, while still asserting that destinations are absent above.
        let single = try await MarkdownPreview.render(chapters[0].text)
        #expect(single == .rendered(first.blocks))
    }

    @Test(arguments: [0, 2])
    func alreadyCancelledTaskThrowsInsteadOfReturningSectionsOrValidationFailure(count: Int) async {
        let sources = (0..<count).map { _ in source("") }
        await withThrowingTaskGroup(of: [MarkdownBookPreview.Section].self) { group in
            group.cancelAll()
            group.addTask { try await MarkdownBookPreview.render(sources) }
            await #expect(throws: CancellationError.self) { try await group.next() }
        }
    }

    private func source(_ text: String, title: String = "原稿") -> MarkdownBookPreview.Source {
        MarkdownBookPreview.Source(id: UUID(), title: title, text: text)
    }

    private func text(_ block: MarkdownPreview.Block) -> String {
        block.runs.map(\.text).joined()
    }
}
