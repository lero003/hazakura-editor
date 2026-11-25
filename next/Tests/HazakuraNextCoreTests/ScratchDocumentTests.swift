import HazakuraNextCore
import Testing

struct ScratchDocumentTests {
    @Test func identityIsIndependentOfSourceAndSurvivesEdits() {
        var document = ScratchDocument(source: "# 原稿\n")
        let id = document.id
        #expect(id != ScratchDocument(source: document.source).id)
        document.replaceSource("# 新稿\n")
        #expect(document.id == id)
        #expect(document.revision == 1)
    }

    @Test func exactSourceRetainsNaturalUnicodeAndLineEndings() {
        let original = "# か\u{3099}\r\n本文😀\r末尾\n"
        let revised = "# が\r\n本文😀\r末尾\n"
        var document = ScratchDocument(source: original)
        document.replaceSource(original)
        #expect(document.revision == 0)
        // Swift's grapheme-aware equality considers these equal; Markdown bytes do not.
        #expect(original == revised)
        document.replaceSource(revised)
        #expect(document.revision == 1)
        #expect(Array(document.source.utf8) == Array(revised.utf8))
    }
}
