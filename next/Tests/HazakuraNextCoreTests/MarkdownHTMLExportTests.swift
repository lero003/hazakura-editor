@testable import HazakuraNextCore
import Testing

struct MarkdownHTMLExportTests {
    @Test func exportsStandaloneDocumentWithBasicSemantics() async throws {
        let html = try await MarkdownHTMLExport.render(source: """
            ## 見出し👩‍💻

            本文の *強調*、**太字**、`コード`、~~削除~~。

            > 引用
            >
            > 4. 項目
            >
            >    続き
            >
            >    - 内側
            > 5. 次の項目

            ---

            ```text
            <b>literal</b>
                字下げ
            ```

            最後
            """)

        #expect(html.hasPrefix("<!doctype html>"))
        #expect(html.contains(#"<meta charset="utf-8">"#))
        #expect(html.contains(#"<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">"#))
        #expect(html.contains("<h2>見出し👩‍💻</h2>"))
        #expect(html.contains("<p>本文の <em>強調</em>、<strong>太字</strong>、<code>コード</code>、<del>削除</del>。</p>"))
        #expect(html.contains("<blockquote>\n<p>引用</p>"))
        #expect(html.contains(#"<li value="4">"# + "\n<p>項目</p>\n<p>続き</p>\n<ul>\n<li>\n<p>内側</p>"))
        #expect(html.contains(#"<li value="5">"# + "\n<p>次の項目</p>"))
        #expect(html.contains("</li>\n</ol>\n</blockquote>\n<hr>"))
        #expect(html.contains("<pre><code>&lt;b&gt;literal&lt;/b&gt;\n    字下げ\n</code></pre>"))
        #expect(html.hasSuffix("<p>最後</p>\n</body>\n</html>\n"))
    }

    @Test func keepsProjectedHardBreaksAndCodeSpacing() async throws {
        let html = try await MarkdownHTMLExport.render(source: "一行目  \n二行目 `二  語`")
        #expect(html.contains("<p>一行目\n二行目 <code>二  語</code></p>"))
        #expect(html.contains("white-space: pre-wrap"))
    }

    @Test func escapesLiteralExamplesAndKeepsUnsupportedMarkupInert() async throws {
        let html = try await MarkdownHTMLExport.render(source: """
            `</code> <span> &lt; & \" '`

            前 <span title="補足">中</span> 後

            <section>外部のHTML</section>

            <style>p { color: red; }</style>

            | 項目 | 値 |
            | --- | --- |
            | 一 | 二 |

            最後
            """)

        #expect(html.contains("<code>&lt;/code&gt; &lt;span&gt; &amp;lt; &amp; &quot; &#39;</code>"))
        #expect(html.contains("前 ［HTML非表示］中［HTML非表示］ 後"))
        #expect(html.contains("HTMLの表示には対応していません。"))
        #expect(html.contains("<table>"))
        #expect(html.contains("<th scope=\"col\">項目</th>"))
        #expect(html.contains("<td>二</td>"))
        #expect(html.contains("外部のHTML") == false)
        #expect(html.contains("color: red") == false)
        #expect(html.contains("<span") == false)
        #expect(html.contains("<section") == false)
        #expect(html.contains("<p>最後</p>"))
    }

    @Test func tableCellsUseTheSameEscapingForHTMLAndXHTML() async throws {
        let source = """
            | 見出し | 値 |
            | --- | --- |
            | **[参照](https://example.invalid/hidden)** | `</td><img>` & ![絵](https://example.invalid/image) |
            """
        let blocks = try await MarkdownHTMLExport.projectedBlocks(source: source)
        let html = try await MarkdownHTMLExport.render(source: source)
        let xhtml = try MarkdownHTMLExport.renderXHTMLFragment(blocks[...])
        for output in [html, xhtml] {
            #expect(output.contains("<thead>\n<tr><th scope=\"col\">見出し</th><th scope=\"col\">値</th></tr>"))
            #expect(output.contains("<td><strong>参照</strong></td>"))
            #expect(output.contains("<td><code>&lt;/td&gt;&lt;img&gt;</code> &amp; ［画像：絵］</td>"))
            for absent in ["example.invalid", "<a ", "<img", "href=", "src="] {
                #expect(output.contains(absent) == false)
            }
        }
    }

    @Test func exposesLabelsAndVisibleURLTextButNoActiveReferences() async throws {
        let html = try await MarkdownHTMLExport.render(source: """
            [**リンク**](https://example.invalid/target) [原稿](./not-a-resource.md) <https://example.invalid/visible>

            ![写真](https://example.invalid/image.png) ![絵](file:///private/example.png)
            """)

        #expect(html.contains("リンク"))
        #expect(html.contains("原稿 https://example.invalid/visible"))
        #expect(html.contains("［画像：写真］ ［画像：絵］"))
        for absent in ["<a ", "<img", "<script", "style=", "url(", "href=", "src=", "/target", "/image.png", "not-a-resource.md", "file:///"] {
            #expect(html.contains(absent) == false)
        }
    }

    @Test func preservesTheWholePreviewAtItsInputByteLimit() async throws {
        let source = String(repeating: "é", count: 65_535) + "ø"
        let html = try await MarkdownHTMLExport.render(source: source)
        #expect(source.utf8.count == 128 * 1024)
        #expect(html.contains("<p>\(source)</p>") == true)
        #expect(html.hasSuffix("</body>\n</html>\n"))
    }

    @Test(arguments: [MarkdownPreview.Limit.inputTooLarge, .tooManyBlocks, .tooComplex])
    func preservesPreviewLimits(reason: MarkdownPreview.Limit) async {
        let source: String
        switch reason {
        case .inputTooLarge: source = String(repeating: "é", count: 65_536) + "!"
        case .tooManyBlocks: source = String(repeating: "項目\n\n", count: 2_000) + "末尾"
        case .tooComplex: source = "最初\n\n" + String(repeating: "`甲` 乙 ", count: 300)
        case .parseFailed: return
        }
        await #expect(throws: MarkdownHTMLExport.ExportError.unavailable(reason)) {
            try await MarkdownHTMLExport.render(source: source)
        }
    }

    @Test func checksEscapedUTF8BytesAgainstTheWriterLimitWithoutClipping() throws {
        // Current preview limits keep a real projection well below the output budget.
        // Exercise the same output sink with a synthetic expansion at exactly 2 MiB.
        var output = MarkdownHTMLExport.Output()
        try output.appendText(String(repeating: "&", count: 2 * 1024 * 1024 / 5) + "é")
        let html = try output.finish()
        #expect(html.utf8.count == SelectedTextFile.byteLimit)
        #expect(html.hasSuffix("&amp;é"))
        #expect(throws: MarkdownHTMLExport.ExportError.tooLarge) { try output.appendMarkup("!") }
        #expect(throws: MarkdownHTMLExport.ExportError.tooLarge) { try output.appendText("&") }
    }

    @Test func alreadyCancelledTaskThrowsEvenForEmptyInput() async {
        await withThrowingTaskGroup(of: String.self) { group in
            group.cancelAll()
            group.addTask { try await MarkdownHTMLExport.render(source: "") }
            await #expect(throws: CancellationError.self) { try await group.next() }
        }
    }
}
