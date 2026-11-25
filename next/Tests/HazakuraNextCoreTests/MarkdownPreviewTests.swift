import HazakuraNextCore
import Testing

struct MarkdownPreviewTests {
    @Test func rendersHeadingsParagraphsAndInlineStyles() async throws {
        let blocks = try await render("# 見出し\n\n本文の *強調*、**太字**、`コード`、~~削除~~。\n\n### 小見出し")

        #expect(blocks.map(\.kind) == [.heading(level: 1), .paragraph, .heading(level: 3)])
        #expect(blocks.map(text) == ["見出し", "本文の 強調、太字、コード、削除。", "小見出し"])
        let runs = try #require(blocks.first { $0.kind == .paragraph }).runs
        #expect(runs.filter(\.emphasis).map(\.text).joined() == "強調")
        #expect(runs.filter(\.strong).map(\.text).joined() == "太字")
        #expect(runs.filter(\.code).map(\.text).joined() == "コード")
        #expect(runs.filter(\.strikethrough).map(\.text).joined() == "削除")
    }

    @Test func preservesQuoteAndListNestingAndMarksEachItemOnce() async throws {
        let blocks = try await render("""
            > 引用
            >
            > 4. 項目
            >
            >    続き
            >
            >    - 内側
            > 5. 次の項目

            - > 項目内の引用
            """)

        #expect(blocks.map(text) == ["引用", "項目", "続き", "内側", "次の項目", "項目内の引用"])
        #expect(blocks.map(\.containers) == [
            [.quote],
            [.quote, .listItem(marker: "4.")],
            [.quote, .listItem(marker: nil)],
            [.quote, .listItem(marker: nil), .listItem(marker: "•")],
            [.quote, .listItem(marker: "5.")],
            [.listItem(marker: "•"), .quote],
        ])
    }

    @Test func codeKeepsItsLiteralTextAndRulesRemainSeparate() async throws {
        let blocks = try await render("""
            前

            ```text
            <b>literal</b>
                [literal](example.md)
            ```

            ---

            > ***

            後
            """)

        #expect(blocks.map(\.kind) == [.paragraph, .codeBlock, .thematicBreak, .thematicBreak, .paragraph])
        #expect(blocks.map(text) == ["前", "<b>literal</b>\n    [literal](example.md)\n", "", "", "後"])
        #expect(blocks.map(\.containers) == [[], [], [], [.quote], []])
    }

    @Test func linksAndImagesExposeLabelsNotDestinations() async throws {
        let blocks = try await render("""
            [**リンク**](https://example.invalid/target) [原稿][draft] <https://example.invalid/visible>

            ![眺め](../private/example.png) ![](https://example.invalid/empty.png) ![絵](file:///example.png)

            [draft]: ./draft.md
            """)

        #expect(blocks.map(text) == [
            "リンク 原稿 https://example.invalid/visible",
            "［画像：眺め］ ［画像］ ［画像：絵］",
        ])
    }

    @Test func unicodeScalarsSurviveStyleBoundariesInsideACharacter() async throws {
        let blocks = try await render("**e**\u{301} と 👩‍💻")
        let block = try #require(blocks.first)
        #expect(text(block).utf8.elementsEqual("e\u{301} と 👩‍💻".utf8))
        #expect(block.runs.filter(\.strong).map(\.text).joined() == "e")
    }

    @Test func htmlAndTablesReduceToInertFallbacks() async throws {
        let blocks = try await render("""
            前 <span title="補足">中</span> 後

            <section>外部のHTML</section>

            | 項目 | 値 |
            | --- | --- |
            | 一 | 二 |

            最後
            """)

        #expect(blocks.map(\.kind) == [.paragraph, .unsupported(.html), .unsupported(.table), .paragraph])
        #expect(blocks.map(text) == ["前 ［HTML非表示］中［HTML非表示］ 後", "", "", "最後"])
    }

    @Test func emptyAndWhitespaceOnlyInputProduceNoBlocks() async throws {
        #expect(try await MarkdownPreview.render("") == .rendered([]))
        #expect(try await MarkdownPreview.render("  \n\n") == .rendered([]))
    }

    @Test func utf8LimitCountsBytesAndRejectsAllOutputAboveIt() async throws {
        let atLimit = String(repeating: "é", count: 65_536)
        let blocks = try await render(atLimit)
        #expect(blocks.map(text) == [atLimit])
        #expect(try await MarkdownPreview.render(atLimit + "!") == .unavailable(.inputTooLarge))
    }

    @Test func blockLimitRejectsAllOutputAboveIt() async throws {
        let atLimit = String(repeating: "項目\n\n", count: 2_000)
        let blocks = try await render(atLimit)
        #expect(blocks.count == 2_000)
        #expect(try await MarkdownPreview.render(atLimit + "末尾") == .unavailable(.tooManyBlocks))
    }

    @Test func denseInlineStylesRejectTheWholePreview() async throws {
        let source = "最初\n\n" + String(repeating: "`甲` 乙 ", count: 300)
        #expect(try await MarkdownPreview.render(source) == .unavailable(.tooComplex))
    }

    @Test func cumulativeProjectionWorkRejectsTheWholePreview() async throws {
        let source = String(repeating: "`甲` `乙` `丙`\n\n", count: 1_000)
        #expect(try await MarkdownPreview.render(source) == .unavailable(.tooComplex))
    }

    @Test func deeplyNestedQuotesRejectTheWholePreview() async throws {
        let nested = String(repeating: "> ", count: 31) + "引用"
        let blocks = try await render(nested)
        #expect(blocks.first?.containers.count == 31)
        #expect(try await MarkdownPreview.render("> " + nested) == .unavailable(.tooComplex))
    }

    @Test func alreadyCancelledTaskThrowsEvenForEmptyInput() async {
        await withThrowingTaskGroup(of: MarkdownPreview.Result.self) { group in
            group.cancelAll()
            group.addTask { try await MarkdownPreview.render("") }
            await #expect(throws: CancellationError.self) { try await group.next() }
        }
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

    private func text(_ block: MarkdownPreview.Block) -> String {
        block.runs.map(\.text).joined()
    }

    private struct RenderUnavailable: Error {}
}
