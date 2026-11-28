import Foundation

/// Compares an editable copy against two captured snapshots without retaining a path or doing I/O.
public struct OriginalFileComparison: Sendable {
    public enum DiskStatus: Equatable, Sendable {
        case unchanged
        case modified
        /// The captured file identifiers differ; this does not establish which path was selected.
        case differentIdentity
    }

    public enum DraftByteStatus: Equatable, Sendable {
        case compared(matchesBaseline: Bool, matchesDisk: Bool)
        case tooLarge
        case unavailable
    }

    public let baseline: SelectedTextFile
    public let disk: SelectedTextFile
    public let draftSource: String

    /// Compares captured device/inode and bytes, not a live file or a write precondition.
    public let diskStatus: DiskStatus
    /// Compares draft bytes in the baseline format only when the draft can be encoded for saving.
    public let draftByteStatus: DraftByteStatus

    public init(baseline: SelectedTextFile, disk: SelectedTextFile, draftSource: String) {
        self.baseline = baseline
        self.disk = disk
        self.draftSource = draftSource

        let diskStatus: DiskStatus
        if baseline.identity != disk.identity {
            diskStatus = .differentIdentity
        } else {
            diskStatus = baseline.originalBytes == disk.originalBytes ? .unchanged : .modified
        }

        // Use the opened encoding, not the reselected one's. Compare exact bytes, not
        // Swift String equality (which treats canonically equivalent text as equal).
        self.diskStatus = diskStatus
        do {
            let draftBytes = try SelectedTextCopyWriter.encode(draftSource, encoding: baseline.format.encoding)
            let matchesBaseline = draftBytes == baseline.originalBytes
            let matchesDisk = diskStatus == .unchanged ? matchesBaseline : draftBytes == disk.originalBytes
            draftByteStatus = .compared(matchesBaseline: matchesBaseline, matchesDisk: matchesDisk)
        } catch SelectedTextCopyWriter.WriteError.tooLarge {
            draftByteStatus = .tooLarge
        } catch {
            draftByteStatus = .unavailable
        }
    }
}
