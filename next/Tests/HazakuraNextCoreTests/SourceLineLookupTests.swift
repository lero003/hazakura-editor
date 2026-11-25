import HazakuraNextCore
import Testing

struct SourceLineLookupTests {
    @Test(arguments: ["", "原稿👩‍💻"])
    func firstLineExistsWithoutATerminator(source: String) {
        #expect(SourceLineLookup.utf16Offset(of: 1, in: source) == 0)
        #expect(SourceLineLookup.utf16Offset(of: 2, in: source) == nil)
    }

    @Test func countsMixedTerminatorsAndUTF16CodeUnits() {
        let source = "\r\n甲👩‍💻\re\u{0301}\n\n😀\r\n尾"

        let offsets = (1...7).map { SourceLineLookup.utf16Offset(of: $0, in: source) }

        #expect(offsets == [0, 2, 9, 12, 13, 17, nil])
    }

    @Test func pairsCRLFOnlyInThatOrder() {
        let source = "\r\r\n\n\r"

        let offsets = (1...6).map { SourceLineLookup.utf16Offset(of: $0, in: source) }

        #expect(offsets == [0, 1, 3, 4, 5, nil])
    }

    @Test(arguments: [("\n", 3), ("\r", 3), ("\r\n", 4)])
    func trailingTerminatorCreatesAnEmptyLine(ending: String, offset: Int) {
        let source = "😀" + ending
        #expect(SourceLineLookup.utf16Offset(of: 2, in: source) == offset)
        #expect(SourceLineLookup.utf16Offset(of: 3, in: source) == nil)
    }

    @Test func doesNotSplitOnOtherWhitespaceOrUnicodeSeparators() {
        let source = "a\u{2028}b\u{2029}c\u{0085}d\u{000B}e\u{000C}f\t\u{3000}\n次"

        #expect(SourceLineLookup.utf16Offset(of: 2, in: source) == 14)
        #expect(SourceLineLookup.utf16Offset(of: 3, in: source) == nil)
    }

    @Test(arguments: [Int.min, -1, 0, 4, Int.max])
    func rejectsOutOfRangeLineNumbers(line: Int) {
        #expect(SourceLineLookup.utf16Offset(of: line, in: "甲\r\n乙\r\n") == nil)
    }

    @Test func findsTheFinalLineAtTheWorkspaceSizeLimit() {
        let count = 1_048_576
        let source = String(repeating: "\r\n", count: count) // Exactly 2 MiB in UTF-8.

        #expect(SourceLineLookup.utf16Offset(of: count + 1, in: source) == 2 * count)
        #expect(SourceLineLookup.utf16Offset(of: count + 2, in: source) == nil)
    }
}
