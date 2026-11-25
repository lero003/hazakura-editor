import Foundation

/// A read-only experiment for a future original-file save. The result is neither permission
/// nor a filesystem lock: a non-cooperating writer can change the file after the last read.
package enum OriginalSavePreflight {
    package struct Review: Sendable {
        package let disk: SelectedTextFile
        package let proposedBytes: Data
    }

    package enum Outcome: Equatable, Sendable {
        case noChanges, declined, checkedWithoutWriting
    }

    package enum Rejection: Error, Equatable {
        case differentFile, changedSinceOpening, changedDuringConfirmation
    }

    /// `selectedURL` is the URL of an explicit new selection, not a previous comparison.
    /// Keep any granted scope only for this call. No path or grant is returned or persisted.
    @concurrent
    package static func check(
        baseline: SelectedTextFile,
        draftSource: String,
        at selectedURL: URL,
        confirm: @Sendable (Review) async throws -> Bool
    ) async throws -> Outcome {
        try Task.checkCancellation()
        let proposed = try SelectedTextCopyWriter.encode(draftSource, preservingUTF8BOM: baseline.format.hasUTF8BOM)
        let disk = try await SelectedTextFile.read(from: selectedURL)
        guard disk.identity == baseline.identity else { throw Rejection.differentFile }
        guard sameVersion(disk, baseline) else { throw Rejection.changedSinceOpening }
        try Task.checkCancellation()
        guard proposed != disk.originalBytes else { return .noChanges }

        let approved = try await confirm(Review(disk: disk, proposedBytes: proposed))
        try Task.checkCancellation()
        guard approved else { return .declined }

        let latest = try await SelectedTextFile.read(from: selectedURL)
        guard sameVersion(latest, disk) else { throw Rejection.changedDuringConfirmation }
        try Task.checkCancellation()
        return .checkedWithoutWriting
    }

    private static func sameVersion(_ lhs: SelectedTextFile, _ rhs: SelectedTextFile) -> Bool {
        lhs.version == rhs.version && lhs.originalBytes == rhs.originalBytes
    }
}
