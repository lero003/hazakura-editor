@testable import HazakuraNext
import HazakuraNextCore
import Testing

struct AssistReviewPresentationTests {
    @Test func keepsJapaneseAndMakesEveryASCIISpaceVisible() {
        let visible = AssistReviewPresentation.literal("  青い\t空  \r\n")
        #expect(visible.utf8.elementsEqual(#"\s\s青い\t空\s\s\r\n"#.utf8))
    }

    @Test func candidateTextCannotSpellItsOwnEscape() {
        let raw = #"\s\t\r\n\u{200B}\"#
        #expect(AssistReviewPresentation.literal(raw) == #"\\s\\t\\r\\n\\u{200B}\\"#)
        #expect(AssistReviewPresentation.literal("\u{200B}") == #"\u{200B}"#)
    }

    @Test func exposesInvisibleAndUncertainScalarsInPlace() {
        let text = "桜\u{200B}\u{FEFF}\u{FE0F}\u{E0100}\u{115F}\u{2800}\u{3000}\u{2028}\u{0000}\u{007F}\u{0378}\u{E000}\u{10FFFF}花"
        #expect(AssistReviewPresentation.literal(text) == #"桜\u{200B}\u{FEFF}\u{FE0F}\u{E0100}\u{115F}\u{2800}\u{3000}\u{2028}\u{0000}\u{007F}\u{0378}\u{E000}\u{10FFFF}花"#)
    }

    @Test func escapesAllBidiControlsAndFallsBackForUncertainDirection() {
        let text = "前\u{061C}\u{200E}\u{200F}\u{202A}\u{202B}\u{202C}\u{202D}\u{202E}\u{2066}\u{2067}\u{2068}\u{2069}א後"
        #expect(AssistReviewPresentation.literal(text) == #"前\u{061C}\u{200E}\u{200F}\u{202A}\u{202B}\u{202C}\u{202D}\u{202E}\u{2066}\u{2067}\u{2068}\u{2069}\u{05D0}後"#)
    }

    @Test func preservesExactScalarsAcrossCanonicalEquivalence() {
        let composed = "\u{00E9}が"
        let decomposed = "e\u{0301}か\u{3099}"
        #expect(composed == decomposed)
        #expect(AssistReviewPresentation.literal(composed).utf8.elementsEqual(composed.utf8))
        #expect(AssistReviewPresentation.literal(decomposed) == #"e\u{0301}か\u{3099}"#)
        #expect(AssistReviewPresentation.scalarCodes(composed) == "U+00E9 U+304C")
        #expect(AssistReviewPresentation.scalarCodes(decomposed) == "U+0065 U+0301 U+304B U+3099")
    }

    @Test func exactFormIncludesEveryScalarInOrderAndAcceptsEmptyText() {
        let text = " \\\r\n\u{200B}\u{FEFF}\u{FE0F}\u{E0100}🧪\u{202E}"
        #expect(AssistReviewPresentation.scalarCodes(text) ==
            "U+0020 U+005C U+000D U+000A U+200B U+FEFF U+FE0F U+E0100 U+1F9EA U+202E")
        #expect(AssistReviewPresentation.scalarCodes("").isEmpty)
        #expect(AssistReviewPresentation.literal("").isEmpty)
    }

    @Test func neitherFormTruncatesAtTheReviewLineByteLimit() {
        let visiblePrefix = String(repeating: "a", count: 1_019)
        let text = visiblePrefix + "\u{E0100} "
        #expect(text.utf8.count == 1_024)
        #expect(AssistReviewPresentation.literal(text) == visiblePrefix + #"\u{E0100}\s"#)
        #expect(AssistReviewPresentation.scalarCodes(text) ==
            String(repeating: "U+0061 ", count: 1_019) + "U+E0100 U+0020")
    }

    @Test func labelsEveryLineEndingSeparatelyFromTheDiffBody() async throws {
        let diff = try await LineDiff.compare(before: "桜\r\n", after: "桜\n梅\r菊")
        guard case .rows(let rows) = diff else {
            Issue.record("Expected non-identical line diff rows")
            return
        }
        #expect(rows.map { AssistReviewPresentation.ending($0.ending) } == ["CRLF", "LF", "CR", "改行なし"])
        #expect(rows.map { AssistReviewPresentation.literal($0.text) } == ["桜", "桜", "梅", "菊"])
        #expect(rows.map { AssistReviewPresentation.scalarCodes($0.text) } == ["U+685C", "U+685C", "U+6885", "U+83CA"])
    }
}
