import Foundation

/// A selection pinned to the exact source of one committed document revision.
package struct AssistProposalTarget: Sendable {
    package enum ValidationError: Error, Equatable {
        case documentTooLarge
        case invalidSelection
        case emptySelection
        case selectionTooLarge
        case candidateTooLarge
        case invalidCandidateControls
        case unchangedCandidate
        case resultTooLarge
    }

    private static let documentByteLimit = 2 * 1024 * 1024
    private static let selectionAndCandidateByteLimit = 16 * 1024

    package let documentID: UUID
    package let revision: UInt64
    package let range: NSRange
    /// The only original text needed to generate a candidate.
    package let selectedSource: String

    private let baseline: String
    private let selectionBounds: Range<String.Index>
    private let unselectedByteCount: Int

    package init(document: ScratchDocument, selection: NSRange) throws {
        let source = document.source
        let sourceByteCount = source.utf8.count
        guard sourceByteCount <= Self.documentByteLimit else { throw ValidationError.documentTooLarge }

        let utf16 = source.utf16
        let length = utf16.count
        // Check by subtraction before converting any native offsets or adding them together.
        guard selection.location >= 0, selection.location <= length,
              selection.length >= 0, selection.length <= length - selection.location else {
            throw ValidationError.invalidSelection
        }
        guard selection.length > 0 else { throw ValidationError.emptySelection }

        let start = utf16.index(utf16.startIndex, offsetBy: selection.location)
        let end = utf16.index(start, offsetBy: selection.length)
        // Convert both UTF-16 indices exactly to Character boundaries, never widening the selection.
        guard let lower = String.Index(start, within: source), let upper = String.Index(end, within: source) else {
            throw ValidationError.invalidSelection
        }
        let bounds = lower..<upper
        let selected = source[bounds]
        let selectedByteCount = selected.utf8.count
        guard selectedByteCount <= Self.selectionAndCandidateByteLimit else { throw ValidationError.selectionTooLarge }

        documentID = document.id
        revision = document.revision
        range = selection
        selectedSource = String(selected)
        baseline = source
        selectionBounds = bounds
        unselectedByteCount = sourceByteCount - selectedByteCount
    }

    /// Builds the full prospective source without applying it or rebasing onto newer text.
    package func prepareReplacement(_ candidate: String) throws -> String {
        let bytes = candidate.utf8
        let candidateByteCount = bytes.count
        guard candidateByteCount <= Self.selectionAndCandidateByteLimit else { throw ValidationError.candidateTooLarge }
        // Match SelectedTextFile's ASCII text boundary: TAB, LF and CR only among controls.
        guard !bytes.contains(where: { ($0 < 32 && $0 != 9 && $0 != 10 && $0 != 13) || $0 == 127 }) else {
            throw ValidationError.invalidCandidateControls
        }
        guard !bytes.elementsEqual(selectedSource.utf8) else { throw ValidationError.unchangedCandidate }
        guard candidateByteCount <= Self.documentByteLimit - unselectedByteCount else {
            throw ValidationError.resultTooLarge
        }

        var replacement = String()
        replacement.reserveCapacity(unselectedByteCount + candidateByteCount)
        replacement.append(contentsOf: baseline[..<selectionBounds.lowerBound])
        replacement.append(candidate)
        replacement.append(contentsOf: baseline[selectionBounds.upperBound...])
        return replacement
    }

    package func matches(document: ScratchDocument, editorSource: String) -> Bool {
        document.id == documentID && document.revision == revision
            && document.source.utf8.elementsEqual(baseline.utf8)
            && editorSource.utf8.elementsEqual(baseline.utf8)
    }
}
