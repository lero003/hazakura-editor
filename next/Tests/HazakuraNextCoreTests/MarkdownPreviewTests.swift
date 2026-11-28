import HazakuraNextCore
import Testing

struct MarkdownPreviewTests {
    @Test func rendersHeadingsParagraphsAndInlineStyles() async throws {
        let blocks = try await render("# 見出し\n\n本文の *強調*、**太字**、`コード`、~~削除~~。\n\n### 小見出し")

        #expect(blocks.map(\.kind) == [.heading(level: 1), .paragraph, .heading(level: 3)])
        #expect(blocks.map(text) == ["見出し", "本文の 強調、太字、コード、削除。", "小見出し"])
        #expect(blocks.first?.headingLocation?.line == 1)
        #expect(blocks.first?.headingLocation?.utf16Offset == 0)
        let runs = try #require(blocks.first { $0.kind == .paragraph }).runs
        #expect(runs.filter(\.emphasis).map(\.text).joined() == "強調")
        #expect(runs.filter(\.strong).map(\.text).joined() == "太字")
        #expect(runs.filter(\.code).map(\.text).joined() == "コード")
        #expect(runs.filter(\.strikethrough).map(\.text).joined() == "削除")
    }

    @Test(arguments: ["\n", "\r\n", "\r"])
    func locatesRepeatedHeadingsWithoutMatchingFencedOrIndentedCode(newline: String) async throws {
        let lines = ["前書き👩‍💻", "", "```md", "## 同じ🎉", "同じ🎉", "----", "```", "",
                     "    ## 同じ🎉", "", "  ## **同じ🎉** ##", "", "同じ🎉", "----", "", "## 同じ🎉"]
        let blocks = try await render(lines.joined(separator: newline))

        #expect(blocks.map(\.kind) == [.paragraph, .codeBlock, .codeBlock,
                                       .heading(level: 2), .heading(level: 2), .heading(level: 2)])
        #expect(blocks.prefix(3).allSatisfy { $0.headingLocation == nil })
        let headings = Array(blocks.suffix(3))
        #expect(headings.map(text) == ["同じ🎉", "同じ🎉", "同じ🎉"])
        #expect(headings.map { $0.headingLocation?.line } == [11, 13, 16])
        #expect(headings.map { $0.headingLocation?.utf16Offset } == [11, 13, 16].map { line in
            (lines.prefix(line - 1).joined(separator: newline) + newline).utf16.count
        })
    }

    @Test func locatesFirstSourceLineOfMultilineAndNestedHeadings() async throws {
        let prefix = "👩‍💻 と日本語\r\n\n"
        let first = "> - # *引用の見出し*\r\r"
        let second = "> **一行目**\n> 二行目\r\n> ======\n\n"
        let blocks = try await render(prefix + first + second + "末尾")

        #expect(blocks.map(\.kind) == [.paragraph, .heading(level: 1), .heading(level: 1), .paragraph])
        #expect(blocks.map(containerMarkers) == [[], [">", "•"], [">"], []])
        #expect(blocks.map { $0.headingLocation?.line } == [nil, 3, 5, nil])
        #expect(blocks.map { $0.headingLocation?.utf16Offset } == [nil, prefix.utf16.count,
                                                                (prefix + first).utf16.count, nil])
    }

    @Test func leavesMissingOrUnreliableSourcePositionsUnmapped() async throws {
        // Empty image labels carry no source position. Foundation can also report a
        // preceding reference definition as the source of a Setext heading.
        let prefix = "# ![](https://example.invalid/image)\n\n[r]: target\n見出し\n====\n\n# a\u{0}b\n\n"
        let blocks = try await render(prefix + "# [最後](https://example.invalid/target)")

        #expect(blocks.map(text) == ["［画像］", "見出し", "a�b", "最後"])
        #expect(blocks.map { $0.headingLocation?.line } == [nil, nil, nil, 9])
        #expect(blocks.map { $0.headingLocation?.utf16Offset } == [nil, nil, nil, prefix.utf16.count])
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
        #expect(blocks.map(containerMarkers) == [
            [">"], [">", "4."], [">", nil], [">", nil, "•"], [">", "5."], ["•", ">"],
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
        #expect(blocks.map(containerMarkers) == [[], [], [], [">"], []])
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

    @Test func htmlRemainsInertBeforeAndAlongsideATable() async throws {
        let blocks = try await render("""
            前 <span title="補足">中</span> 後

            <section>外部のHTML</section>

            | *項目* | 値 | コード |
            | --- | --- | --- |
            | [原稿](./private.md) **太字** | ![眺め](https://example.invalid/image) | `x` <b>中</b> |

            最後
            """)

        #expect(blocks.map(\.kind) == [.paragraph, .unsupported(.html), .table, .paragraph])
        #expect(blocks.map(text) == ["前 ［HTML非表示］中［HTML非表示］ 後", "", "", "最後"])
        let rows = try #require(blocks.first { $0.kind == .table }?.table?.rows)
        #expect(cellText(rows) == [["項目", "値", "コード"], ["原稿 太字", "［画像：眺め］", "x ［HTML非表示］中［HTML非表示］"]])
        let runs = rows.flatMap { $0.flatMap { $0 } }
        #expect(runs.filter(\.emphasis).map(\.text) == ["項目"])
        #expect(runs.filter(\.strong).map(\.text) == ["太字"])
        #expect(runs.filter(\.code).map(\.text) == ["x"])
    }

    @Test func tableReconstructsEmptyCellsAndRowsFromParserOrdinals() async throws {
        let blocks = try await render("""
            | | | |
            | :--- | :---: | ---: |
            | 一 | | 三 |
            | | | |
            | a\\|b | 二 |
            """)

        #expect(blocks.map(\.kind) == [.table])
        let rows = try #require(blocks.first?.table?.rows)
        #expect(cellText(rows) == [["", "", ""], ["一", "", "三"], ["", "", ""], ["a|b", "二", ""]])
        #expect(rows.flatMap { $0 }.filter(\.isEmpty).count == 8)
    }

    @Test func tablesRetainWrappersAndKeepHeadingLocations() async throws {
        let blocks = try await render("""
            # 前

            > 4. | 項目 | 値 |
            >    | --- | --- |
            >    | 一 | 二 |
            >
            >    続き

            ## 次

            | 最後 |
            | --- |
            """)

        #expect(blocks.map(\.kind) == [.heading(level: 1), .table, .paragraph, .heading(level: 2), .table])
        #expect(blocks.map(containerMarkers) == [[], [">", "4."], [">", nil], [], []])
        #expect(blocks.map { $0.headingLocation?.line } == [1, nil, nil, 9, nil])
        #expect(blocks.compactMap(\.table).map { cellText($0.rows) } == [[["項目", "値"], ["一", "二"]], [["最後"]]])
    }

    @Test(arguments: [(8, 32), (9, 32), (8, 33)])
    func tableDimensionLimitsAreInclusive(columns: Int, rows: Int) async throws {
        let blocks = try await render("前\n\n" + tableSource(columns: columns, rows: rows) + "\n\n後")

        if columns == 8, rows == 32 {
            #expect(blocks.map(\.kind) == [.paragraph, .table, .paragraph])
            let table = try #require(blocks.first { $0.kind == .table }?.table)
            #expect(cellText(table.rows) == Array(repeating: Array(repeating: "値", count: 8), count: 32))
        } else {
            #expect(blocks.map(\.kind) == [.paragraph, .unsupported(.table), .paragraph])
            #expect(blocks.allSatisfy { $0.table == nil })
            #expect(blocks.map(text) == ["前", "", "後"])
        }
    }

    @Test func tableRunLimitFallsBackWithoutDiscardingSurroundingBlocks() async throws {
        let prefix = "前\n\n| 甲 | 乙 |\n| --- | --- |\n| "
        let suffix = " | |\n\n後"
        let atLimit = String(repeating: "`甲` 乙 ", count: 255)
        let bounded = try await render(prefix + atLimit + suffix)
        #expect(bounded.map(\.kind) == [.paragraph, .table, .paragraph])
        let table = try #require(bounded.first { $0.kind == .table }?.table)
        #expect(table.rows.flatMap { $0 }.reduce(0) { $0 + $1.count } == 512)

        let excessive = try await render(prefix + atLimit + "`甲`" + suffix)
        #expect(excessive.map(\.kind) == [.paragraph, .unsupported(.table), .paragraph])
        #expect(excessive.allSatisfy { $0.table == nil })
        #expect(excessive.map(text) == ["前", "", "後"])
    }

    @Test func tableFallbacksStillCountTowardCumulativeProjectionWork() async throws {
        let table = tableSource(columns: 9, rows: 32)
        let source = Array(repeating: table, count: 8).joined(separator: "\n\n")
        #expect(try await MarkdownPreview.render(source) == .unavailable(.tooComplex))
    }

    @Test func sparseTablesCountEmptySlotsTowardDocumentWork() async throws {
        let emptyRow = String(repeating: "| ", count: 8) + "|"
        let separator = String(repeating: "| --- ", count: 8) + "|"
        let lastRow = "| 終点 " + String(repeating: "| ", count: 7) + "|"
        let table = ([emptyRow, separator] + Array(repeating: emptyRow, count: 30) + [lastRow]).joined(separator: "\n")
        let bounded = Array(repeating: table, count: 31).joined(separator: "\n\n")
        let blocks = try await render(bounded)
        #expect(blocks.count == 31)
        #expect(blocks.allSatisfy { $0.table?.rows.count == 32 })
        #expect(try await MarkdownPreview.render(bounded + "\n\n" + table) == .unavailable(.tooComplex))
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

    private func containerMarkers(_ block: MarkdownPreview.Block) -> [String?] {
        block.containers.map { container in
            switch container {
            case .quote: ">"
            case .listItem(let item): item.marker
            }
        }
    }

    private func cellText(_ rows: [[[MarkdownPreview.Run]]]) -> [[String]] {
        rows.map { $0.map { $0.map(\.text).joined() } }
    }

    private func tableSource(columns: Int, rows: Int) -> String {
        let row = "|" + String(repeating: " 値 |", count: columns)
        let separator = "|" + String(repeating: " --- |", count: columns)
        return ([row, separator] + Array(repeating: row, count: rows - 1)).joined(separator: "\n")
    }

    private struct RenderUnavailable: Error {}
}
