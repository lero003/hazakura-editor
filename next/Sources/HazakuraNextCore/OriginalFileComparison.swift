import Foundation

/// Compares an editable copy against two captured snapshots without retaining a path or doing I/O.
public struct OriginalFileComparison: Sendable {
    public enum DiskStatus: Equatable, Sendable {
        case unchanged
        case modified
        /// The captured file identifiers differ; this does not establish which path was selected.
        case differentIdentity
    }

    public let baseline: SelectedTextFile
    public let disk: SelectedTextFile
    public let draftSource: String

    private let result: (diskStatus: DiskStatus, draftMatchesDisk: Bool, draftMatchesBaseline: Bool)

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

        let prefix: [UInt8] = baseline.format.hasUTF8BOM ? [0xEF, 0xBB, 0xBF] : []
        let body = draftSource.utf8
        func matchesDraft(_ bytes: Data) -> Bool {
            // Compare prefix + body without allocating that byte buffer. A literal leading U+FEFF
            // belongs to the body even if the disk reader interpreted those bytes as the BOM.
            bytes.starts(with: prefix) && bytes.dropFirst(prefix.count).elementsEqual(body)
        }
        let matchesBaseline = matchesDraft(baseline.originalBytes)
        let matchesDisk = diskStatus == .unchanged ? matchesBaseline : matchesDraft(disk.originalBytes)
        result = (diskStatus, matchesDisk, matchesBaseline)
    }

    /// Compares captured device/inode and bytes, not a live file or a write precondition.
    public var diskStatus: DiskStatus { result.diskStatus }

    /// Whether the draft's UTF-8 bytes with the baseline BOM policy match the captured disk bytes.
    public var draftMatchesDisk: Bool { result.draftMatchesDisk }

    /// Whether the draft's UTF-8 bytes with the baseline BOM policy match the original bytes.
    public var draftMatchesBaseline: Bool { result.draftMatchesBaseline }
}
