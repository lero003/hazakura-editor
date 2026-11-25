import Foundation
@testable import HazakuraNext
import HazakuraNextCore
import Testing

struct DraftRecoveryPresentationTests {
    @Test func excerptDoesNotIncludeAnOversizedCombiningCharacter() {
        let oversized = "か" + String(repeating: "\u{3099}", count: 2_000)
        let draft = makeDraft("試験原稿\n" + oversized + "末尾")
        let excerpt = DraftRecoveryPresentation.excerpt(for: draft)
        #expect(excerpt.unicodeScalars.count <= 1_200)
        #expect(excerpt.hasPrefix("試験原稿\n"))
        #expect(excerpt.hasSuffix("…"))
        #expect(!excerpt.unicodeScalars.contains("\u{3099}"))
    }

    @Test func listLabelKeepsCompleteCharactersAndTheRecordIdentifier() {
        let prefix = String(repeating: "文", count: 119)
        let draft = makeDraft(prefix + "か\u{3099}あと\r\n次の行")
        let label = DraftRecoveryPresentation.label(for: draft)
        #expect(label == prefix + "… · " + draft.id.uuidString.prefix(8))
    }

    @Test func listLabelDoesNotShortenACompleteLineAtTheLimit() {
        let line = String(repeating: "文", count: 120)
        let draft = makeDraft(line + "\r\n次の行")
        #expect(DraftRecoveryPresentation.label(for: draft) == line + " · " + draft.id.uuidString.prefix(8))

        let blank = makeDraft(String(repeating: " ", count: 120) + "\n次の行")
        #expect(DraftRecoveryPresentation.label(for: blank) == "原稿 · " + blank.id.uuidString.prefix(8))
    }

    @Test func excerptKeepsExactBytesAtTheLimit() {
        let source = String(repeating: "か\u{3099}", count: 600)
        let excerpt = DraftRecoveryPresentation.excerpt(for: makeDraft(source))
        #expect(excerpt.utf8.elementsEqual(source.utf8))
    }

    @Test func shortAndEmptyDraftsKeepTheirExistingPresentation() {
        let draft = makeDraft("  原稿か\u{3099}  \r\n本文🌸")
        #expect(DraftRecoveryPresentation.label(for: draft) == "原稿か\u{3099} · " + draft.id.uuidString.prefix(8))
        #expect(DraftRecoveryPresentation.excerpt(for: draft).utf8.elementsEqual(draft.source.utf8))
        let empty = makeDraft("")
        #expect(DraftRecoveryPresentation.label(for: empty) == "原稿 · " + empty.id.uuidString.prefix(8))
        #expect(DraftRecoveryPresentation.excerpt(for: empty) == "（空の原稿）")
    }

    private func makeDraft(_ source: String) -> RecoveryDraft {
        RecoveryDraft(id: UUID(), revision: 1, source: source)
    }
}
