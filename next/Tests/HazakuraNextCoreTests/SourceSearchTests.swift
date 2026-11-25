import Foundation
import HazakuraNextCore
import Testing

struct SourceSearchTests {
    @Test(arguments: ["", "a\rb", "a\nb", "a\r\nb", String(repeating: "é", count: 256) + "a"])
    func rejectsInvalidQueries(query: String) {
        #expect(SourceSearch.canSearch(query) == false)
        #expect(SourceSearch.search(query, in: query) == nil)
    }

    @Test func acceptsExactly512UTF8BytesWithoutTrimming() throws {
        let query = " " + String(repeating: "あ", count: 170) + " "
        #expect(SourceSearch.canSearch(query))
        let result = try #require(SourceSearch.search(query, in: query))
        #expect(result.matches.map(\.range) == [NSRange(location: 0, length: 172)])
    }

    @Test func distinguishesAnEmptyResultFromRejectedInput() throws {
        let result = try #require(SourceSearch.search("a", in: ""))
        #expect(result.matches.isEmpty)
        #expect(result.hasMore == false)
    }

    @Test(arguments: [
        ("a.*", "A.* ab a.*", NSRange(location: 7, length: 3)),
        ("  ", "a b  c", NSRange(location: 3, length: 2)),
        ("é", "e\u{0301} é", NSRange(location: 3, length: 1)),
        ("e\u{0301}", "é e\u{0301}", NSRange(location: 2, length: 2)),
        ("\u{2028}", "a\u{2028}b", NSRange(location: 1, length: 1)),
    ])
    func searchesCaseSensitivelyAndLiterally(query: String, source: String, expected: NSRange) throws {
        let result = try #require(SourceSearch.search(query, in: source))
        #expect(result.matches.map(\.range) == [expected])
        #expect(result.matches.map(\.line) == [1])
        #expect(result.hasMore == false)
    }

    @Test func reportsUTF16RangesAndMixedLineNumbersInDocumentOrder() throws {
        let source = "x\r\n😀x\rxe\u{0301}\u{2028}x\nx\r\r\nx"
        let result = try #require(SourceSearch.search("x", in: source))
        let offsets = [0, 5, 7, 11, 13, 17]
        #expect(result.matches.map(\.range) == offsets.map { NSRange(location: $0, length: 1) })
        #expect(result.matches.map(\.id) == offsets)
        #expect(result.matches.map(\.line) == [1, 2, 3, 3, 4, 6])
    }

    @Test func validMatchesDoNotOverlap() throws {
        let result = try #require(SourceSearch.search("aa", in: "aaaaa"))
        #expect(result.matches.map(\.range) == [NSRange(location: 0, length: 2), NSRange(location: 2, length: 2)])
    }

    @Test func invalidCandidateDoesNotHideAnOverlappingValidMatch() throws {
        // U+0600 is a grapheme prepend; only the last two a's are separate graphemes.
        let result = try #require(SourceSearch.search("aa", in: "\u{0600}aaa"))
        #expect(result.matches.map(\.range) == [NSRange(location: 2, length: 2)])
    }

    @Test(arguments: [
        ("e", "e\u{0301} e", NSRange(location: 3, length: 1)),
        ("\u{0301}", "\u{0301} e\u{0301}", NSRange(location: 0, length: 1)),
        ("👩", "👩‍💻👩", NSRange(location: 5, length: 2)),
        ("🇯", "🇯🇵 🇯", NSRange(location: 5, length: 2)),
        ("👩‍💻", "👩 👩‍💻", NSRange(location: 3, length: 5)),
    ])
    func matchesOnlyWholeSourceGraphemes(query: String, source: String, expected: NSRange) throws {
        let result = try #require(SourceSearch.search(query, in: source))
        #expect(result.matches.map(\.range) == [expected])
        #expect(Range(expected, in: source) != nil)
    }

    @Test func onlyAnAdditionalValidMatchSetsHasMore() throws {
        let first64 = String(repeating: "a\r\n", count: 64)
        let invalidTail = String(repeating: "a\u{0301}\r", count: 100)
        let exact = try #require(SourceSearch.search("a", in: first64 + invalidTail))
        let overflow = try #require(SourceSearch.search("a", in: first64 + invalidTail + "a"))

        #expect(exact.matches.map(\.id) == (0..<64).map { $0 * 3 })
        #expect(exact.matches.map(\.line) == Array(1...64))
        #expect(exact.hasMore == false)
        #expect(overflow.matches == exact.matches)
        #expect(overflow.hasMore)
    }

    @Test func manyInvalidCandidatesDoNotDistortTheFinalMatch() throws {
        let repetitions = 16_384
        let source = String(repeating: "e\u{0301}\r\n", count: repetitions) + "e"
        let result = try #require(SourceSearch.search("e", in: source))
        #expect(result.matches.map(\.range) == [NSRange(location: 4 * repetitions, length: 1)])
        #expect(result.matches.map(\.line) == [repetitions + 1])
        #expect(result.hasMore == false)
    }

    @Test func alreadyCancelledWorkerDoesNotReturnResults() async {
        await withDiscardingTaskGroup { group in
            group.cancelAll()
            group.addTask {
                #expect(SourceSearch.search("x", in: "x") == nil)
            }
        }
    }

    @Test func sourceLimitUsesUTF8BytesAndIncludesExactly2MiB() throws {
        let source = String(repeating: "あ", count: 699_050) + "\nx"
        let result = try #require(SourceSearch.search("x", in: source))
        #expect(result.matches.map(\.range) == [NSRange(location: 699_051, length: 1)])
        #expect(result.matches.map(\.line) == [2])
        #expect(SourceSearch.search("x", in: source + "x") == nil)
    }
}
