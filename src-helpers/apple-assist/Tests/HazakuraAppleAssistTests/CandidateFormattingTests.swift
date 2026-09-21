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
    func testStripsControlTokensAroundUnwrappedMarkdownPresentation() {
        let text = "```markdown\n本文です。\n```<eos>"
        XCTAssertEqual(CandidateFormatting.reviewText(text, original: "本文です。"), "本文です。")
    }
}
