import XCTest
@testable import HazakuraAppleAssist

final class CandidateFormattingTests: XCTestCase {
    func testPreservesActualCodeAndUnclosedFences() {
        for text in ["```js\nconst count = 3;\n```", "```\nplain code\n```", "```markdown\nunfinished"] {
            XCTAssertEqual(CandidateFormatting.reviewText(text, original: text), text)
        }
    }
    func testUnwrapsOnlyPairedMarkdownPresentationAroundUnfencedSource() {
        XCTAssertEqual(CandidateFormatting.reviewText("```markdown\n# Title\n\nBody\n```", original: "# Old"), "# Title\n\nBody")
        XCTAssertEqual(CandidateFormatting.reviewText("```js\ncode\n```", original: "Explain code"), "```js\ncode\n```")
        XCTAssertEqual(CandidateFormatting.reviewText("```markdown\nunfinished", original: "text"), "```markdown\nunfinished")
    }
    func testDoesNotRemoveTheFirstAndLastOfSeparateCodeBlocks() {
        let text = "```markdown\n# One\n```\n\nBetween\n\n```js\nconst n = 1;\n```"
        XCTAssertEqual(CandidateFormatting.reviewText(text, original: "text"), text)
    }
    func testStripsOuterChatControlTokensThatLeakPastTheStopCheck() {
        XCTAssertEqual(CandidateFormatting.reviewText("本文です。<eos>", original: "本文です。"), "本文です。")
        XCTAssertEqual(CandidateFormatting.reviewText("<bos>本文です。<turn|>", original: "本文です。"), "本文です。")
        XCTAssertEqual(
            CandidateFormatting.reviewText("本文です。<eos>\n<turn|>\n", original: "本文です。"),
            "本文です。"
        )
    }
    func testKeepsTokensThatTheManuscriptItselfMentions() {
        let text = "トークン <eos> の意味を確認する。"
        XCTAssertEqual(CandidateFormatting.reviewText(text, original: text), text)
    }
    /// The model can correctly return the manuscript unchanged; the formatter
    /// must not delete a control token just because it sits at an edge.
    func testKeepsControlTokensTheManuscriptItselfUsesAtTheEdges() {
        for text in ["<eos>", "終了マーカーは <eos>", "</s> は終了タグです。"] {
            XCTAssertEqual(CandidateFormatting.reviewText(text, original: text), text)
        }
    }
    func testStripsControlTokensAroundUnwrappedMarkdownPresentation() {
        let text = "```markdown\n本文です。\n```<eos>"
        XCTAssertEqual(CandidateFormatting.reviewText(text, original: "本文です。"), "本文です。")
    }

    func testStripsExactOuterHazakuraTextEnvelope() {
        let wrapped = """
        <<<HAZAKURA_TEXT_START
        私は昨日、図書館へ行きました。
        HAZAKURA_TEXT_END>>>
        """
        XCTAssertEqual(
            CandidateFormatting.reviewText(wrapped, original: "私は昨日、図書館に行きました。"),
            "私は昨日、図書館へ行きました。"
        )
    }

    func testKeepsHazakuraMarkersAuthoredByTheUser() {
        let manuscript = """
        <<<HAZAKURA_TEXT_START
        この文字列は原稿の一部です。
        HAZAKURA_TEXT_END>>>
        """
        XCTAssertEqual(CandidateFormatting.reviewText(manuscript, original: manuscript), manuscript)
    }

    func testHidesAnIncompleteStreamingEnvelopeButKeepsEmbeddedMarkers() {
        XCTAssertEqual(
            CandidateFormatting.reviewText(
                "<<<HAZAKURA_TEXT_START\n本文だけ",
                original: "元の本文"
            ),
            ""
        )
        for text in [
            "前置き\n<<<HAZAKURA_TEXT_START\n本文\nHAZAKURA_TEXT_END>>>",
            "<<<HAZAKURA_TEXT_START\n本文\nHAZAKURA_TEXT_END>>>\n後書き",
        ] {
            XCTAssertEqual(CandidateFormatting.reviewText(text, original: "元の本文"), text)
        }
    }
}
