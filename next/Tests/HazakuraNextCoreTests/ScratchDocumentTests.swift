import Foundation
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

    @Test func distinguishesAnUnchangedBridgeFromAnEditNearTheEnd() throws {
        let prefix = String(repeating: "原稿👩‍💻\r\n", count: 2_000)
        let original = prefix + "が"
        let edited = prefix + "か\u{3099}"
        let identicalSnapshot = try #require(NSMutableString(string: original).copy() as? NSString)
        let editedSnapshot = try #require(NSMutableString(string: edited).copy() as? NSString)
        var document = ScratchDocument(source: original)
        let id = document.id

        document.replaceSource(identicalSnapshot as String)
        #expect(document.revision == 0)
        document.replaceSource(editedSnapshot as String)
        #expect(document.source.utf8.elementsEqual(edited.utf8))
        #expect(document.revision == 1)
        document.replaceSource(edited)
        #expect(document.revision == 1)
        document.replaceSource(identicalSnapshot as String)
        #expect(document.source.utf8.elementsEqual(original.utf8))
        #expect(document.revision == 2)
        #expect(document.id == id)
    }
}
