import Foundation
import HazakuraNextCore
import Testing

struct AssistProposalTargetTests {
    private typealias ValidationError = AssistProposalTarget.ValidationError

    @Test func capturesOnlyTheNativeSelectionAndPreservesUnselectedBytes() throws {
        let selected = "か\u{3099}👨‍👩‍👧\r\n"
        let prefix = "前👩🏽‍💻\r\n"
        let suffix = "\u{FEFF}e\u{301}\r\(selected)末\n"
        var document = ScratchDocument(source: "以前の版")
        document.replaceSource(prefix + selected + suffix)
        let selection = NSRange(location: (prefix as NSString).length, length: (selected as NSString).length)
        let target = try AssistProposalTarget(document: document, selection: selection)

        #expect(target.documentID == document.id)
        #expect(target.revision == document.revision)
        #expect(target.range == selection)
        #expect(target.selectedSource.utf8.elementsEqual(selected.utf8))
        #expect(target.matches(document: document, editorSource: prefix + selected + suffix))

        let replacement = try target.prepareReplacement("候補\r\n")
        #expect(replacement.utf8.elementsEqual((prefix + "候補\r\n" + suffix).utf8))
        #expect(document.source.utf8.elementsEqual((prefix + selected + suffix).utf8))
    }

    @Test func rejectsAnExactNoOpButAcceptsDifferentBytesWithTheSameSwiftEquality() throws {
        let original = "か\u{3099}"
        let candidate = "が"
        try #require(original == candidate)
        let document = ScratchDocument(source: original)
        let target = try AssistProposalTarget(document: document, selection: NSRange(location: 0, length: 2))

        #expect(throws: ValidationError.unchangedCandidate) {
            try target.prepareReplacement(original)
        }
        let replacement = try target.prepareReplacement(candidate)
        #expect(replacement.utf8.elementsEqual(candidate.utf8))
    }

    @Test func emptyCandidateDeletesOnlyTheSelectionIncludingAWholeDocument() throws {
        let document = ScratchDocument(source: "\r削\n")
        let target = try AssistProposalTarget(document: document, selection: NSRange(location: 1, length: 1))
        let replacement = try target.prepareReplacement("")
        #expect(replacement.utf8.elementsEqual("\r\n".utf8))

        let whole = try AssistProposalTarget(document: document, selection: NSRange(location: 0, length: 3))
        #expect(try whole.prepareReplacement("") == "")
    }

    @Test func rejectsAnEmptySelectionAtAValidOffset() {
        let document = ScratchDocument(source: "a")
        #expect(throws: ValidationError.emptySelection) {
            try AssistProposalTarget(document: document, selection: NSRange(location: 1, length: 0))
        }
    }

    @Test(arguments: [
        NSRange(location: NSNotFound, length: 1),
        NSRange(location: -1, length: 1),
        NSRange(location: 0, length: -1),
        NSRange(location: 4, length: 1),
        NSRange(location: 1, length: 3),
        NSRange(location: 1, length: Int.max),
    ])
    func rejectsInvalidUTF16Bounds(_ selection: NSRange) {
        let document = ScratchDocument(source: "原稿a")
        #expect(throws: ValidationError.invalidSelection) {
            try AssistProposalTarget(document: document, selection: selection)
        }
    }

    @Test(arguments: [("😀", 1), ("👩🏽‍💻", 2), ("🇯🇵", 2), ("か\u{3099}", 1), ("\r\n", 1)])
    func rejectsBothEndpointsInsideAGrapheme(_ grapheme: String, _ offset: Int) {
        let document = ScratchDocument(source: "a" + grapheme + "b")
        // Reject mid-grapheme offsets even when the offset is on a scalar boundary.
        #expect(throws: ValidationError.invalidSelection) {
            try AssistProposalTarget(document: document, selection: NSRange(location: 1, length: offset))
        }
        let length = (grapheme as NSString).length
        #expect(throws: ValidationError.invalidSelection) {
            try AssistProposalTarget(document: document, selection: NSRange(location: 1 + offset, length: length - offset))
        }
    }

    @Test(arguments: (UInt8(0)...31).filter { $0 != 9 && $0 != 10 && $0 != 13 } + [127])
    func rejectsDisallowedASCIIControls(_ code: UInt8) throws {
        let target = try AssistProposalTarget(
            document: ScratchDocument(source: "a"), selection: NSRange(location: 0, length: 1)
        )
        let candidate = "b\(Unicode.Scalar(code))c"
        #expect(throws: ValidationError.invalidCandidateControls) {
            try target.prepareReplacement(candidate)
        }
    }

    @Test func acceptsTabLineFeedsCarriageReturnsAndNonASCIITextWithoutNormalization() throws {
        let target = try AssistProposalTarget(
            document: ScratchDocument(source: "a"), selection: NSRange(location: 0, length: 1)
        )
        let candidate = "\t\r\n\u{0085}か\u{3099}\r本文\n"
        let replacement = try target.prepareReplacement(candidate)
        #expect(replacement.utf8.elementsEqual(candidate.utf8))
    }

    @Test func enforcesSelectionAndCandidateByteCapsInclusively() throws {
        let exact = String(repeating: "😀", count: 4_096)
        let document = ScratchDocument(source: exact + "a")
        let selectionLength = (exact as NSString).length
        let selection = NSRange(location: 0, length: selectionLength)
        let target = try AssistProposalTarget(document: document, selection: selection)
        let candidate = String(repeating: "🌸", count: 4_096)

        #expect(target.selectedSource.utf8.elementsEqual(exact.utf8))
        let replacement = try target.prepareReplacement(candidate)
        #expect(replacement.utf8.elementsEqual((candidate + "a").utf8))
        #expect(throws: ValidationError.selectionTooLarge) {
            try AssistProposalTarget(document: document, selection: NSRange(location: 0, length: selectionLength + 1))
        }
        #expect(throws: ValidationError.candidateTooLarge) {
            try target.prepareReplacement(candidate + "b")
        }
    }

    @Test func enforcesDocumentAndProspectiveResultByteCapsInclusively() throws {
        let suffix = String(repeating: "😀", count: 524_287) + "abc"
        let document = ScratchDocument(source: "x" + suffix)
        let selection = NSRange(location: 0, length: 1)
        let target = try AssistProposalTarget(document: document, selection: selection)

        let replacement = try target.prepareReplacement("y")
        #expect(replacement.utf8.elementsEqual(("y" + suffix).utf8))
        #expect(throws: ValidationError.resultTooLarge) {
            try target.prepareReplacement("yz")
        }
        #expect(throws: ValidationError.documentTooLarge) {
            try AssistProposalTarget(document: ScratchDocument(source: document.source + "d"), selection: selection)
        }
    }

    @Test func rejectsMismatchedIdentityAndRevisionEvenWithExactSource() throws {
        let document = ScratchDocument(source: "原稿")
        let target = try AssistProposalTarget(document: document, selection: NSRange(location: 0, length: 1))
        let other = ScratchDocument(source: document.source)
        #expect(target.matches(document: other, editorSource: document.source) == false)

        var edited = document
        edited.replaceSource("編集した原稿")
        edited.replaceSource(document.source)
        #expect(target.matches(document: edited, editorSource: document.source) == false)
    }

    @Test func rejectsCanonicalButByteDifferentDocumentOrEditorOutsideTheSelection() throws {
        let document = ScratchDocument(source: "[対象] 以前")
        let baseline = "[対象] か\u{3099}"
        let changed = "[対象] が"
        try #require(baseline == changed)
        var pinned = document
        pinned.replaceSource(baseline)
        var divergent = document
        divergent.replaceSource(changed)
        try #require(pinned.id == divergent.id && pinned.revision == divergent.revision)
        let target = try AssistProposalTarget(document: pinned, selection: NSRange(location: 1, length: 2))

        #expect(target.matches(document: pinned, editorSource: baseline))
        #expect(target.matches(document: divergent, editorSource: baseline) == false)
        #expect(target.matches(document: pinned, editorSource: changed) == false)
    }
}
