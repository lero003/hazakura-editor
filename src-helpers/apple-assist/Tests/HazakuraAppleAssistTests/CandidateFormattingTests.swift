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
}
