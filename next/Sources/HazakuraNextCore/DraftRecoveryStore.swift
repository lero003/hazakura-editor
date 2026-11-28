import CryptoKit
import Darwin
import Foundation

/// An unsaved snapshot, with no original file path or access grant.
public struct RecoveryDraft: Equatable, Sendable {
    static let sourceByteLimit = 2 * 1024 * 1024

    public let id: UUID
    public let revision: UInt64
    public let source: String

    public init(id: UUID, revision: UInt64, source: String) {
        self.id = id
        self.revision = revision
        self.source = source
    }

    public static func == (lhs: Self, rhs: Self) -> Bool {
        lhs.id == rhs.id && lhs.revision == rhs.revision && lhs.source.utf8.elementsEqual(rhs.source.utf8)
    }
}

/// Bounded, local (not encrypted) recovery for unsaved drafts. Never touches a source file.
/// Cooperating instances and processes serialize the whole read/modify/replace operation.
/// Manifest lock acquisition is cancellable and sustained contention throws `StoreError.lockContended`.
public actor DraftRecoveryStore {
    public enum StoreError: Error, Equatable, Sendable {
        case invalidLocation, unsafeLocation, ioFailure, lockContended
        case corruptManifest, unsupportedVersion, capacityExceeded
        case invalidRevision, staleRevision, revisionConflict
    }

    /// An exclusive lease held until the last reference is released.
    public final class ApplicationSession: Sendable {
        private let lockFD: Int32

        fileprivate init(lockFD: Int32) {
            self.lockFD = lockFD
        }

        deinit { _ = close(lockFD) }
    }

    private let directory: URL

    /// The directory's parent must exist and be trusted. The store does not follow symlinks
    /// in the supplied path. Use a directory dedicated to this store, not a workspace.
    public init(directory: URL) {
        self.directory = directory
    }

    /// Resolves the second-generation development location without creating it or its parent.
    public static func defaultDirectory() throws -> URL {
        guard let support = try? FileManager.default.url(for: .applicationSupportDirectory,
                                                        in: .userDomainMask, appropriateFor: nil, create: false) else {
            throw StoreError.ioFailure
        }
        return support.appending(path: "dev.hazakura.editor.next.dev.draft-recovery", directoryHint: .isDirectory)
    }

    /// Claims the cooperating app's session for this recovery directory without touching the manifest.
    /// A competing session causes `StoreError.lockContended` immediately.
    public static func claimApplicationSession(in directory: URL) throws -> ApplicationSession {
        let fd = try openDirectory(directory)
        defer { _ = close(fd) }
        let lockFD = try openLock(in: fd, named: applicationLockName)
        guard flock(lockFD, LOCK_EX | LOCK_NB) == 0 else {
            let error = errno
            _ = close(lockFD)
            throw error == EWOULDBLOCK ? StoreError.lockContended : StoreError.ioFailure
        }
        return ApplicationSession(lockFD: lockFD)
    }

    public func drafts() async throws -> [RecoveryDraft] {
        try await withLockedDirectory { try Self.readManifest(in: $0) }
    }

    /// A newer positive revision replaces the old one; an exact repeat is a no-op. A stale
    /// revision or different bytes at the same revision throw. Capacity failures never evict drafts.
    public func checkpoint(_ draft: RecoveryDraft) async throws {
        guard draft.revision > 0 else { throw StoreError.invalidRevision }
        guard draft.source.utf8.count <= RecoveryDraft.sourceByteLimit else { throw StoreError.capacityExceeded }
        try await withLockedDirectory { fd in
            var drafts = try Self.readManifest(in: fd)
            if let index = drafts.firstIndex(where: { $0.id == draft.id }) {
                let stored = drafts[index]
                guard draft.revision >= stored.revision else { throw StoreError.staleRevision }
                if draft.revision == stored.revision {
                    guard draft == stored else { throw StoreError.revisionConflict }
                    return
                }
                drafts[index] = draft
            } else {
                drafts.append(draft)
            }
            try Self.replaceManifest(in: fd, with: Manifest.encode(drafts))
        }
    }

    /// Removes only the exact stored ID, revision and UTF-8 bytes. There is no tombstone:
    /// callers must drain pending checkpoints for this ID before discard and not reuse it.
    @discardableResult
    public func discard(_ draft: RecoveryDraft) async throws -> Bool {
        try await withLockedDirectory { fd in
            var drafts = try Self.readManifest(in: fd)
            guard let index = drafts.firstIndex(of: draft) else { return false }
            drafts.remove(at: index)
            try Self.replaceManifest(in: fd, with: Manifest.encode(drafts))
            return true
        }
    }

    /// Removes confirmed drafts in one transaction. Absent IDs are no-ops and older stored
    /// revisions can be removed, but every confirmation must match the exact source bytes at
    /// the same revision. A newer stored revision or a byte conflict aborts the entire batch.
    /// As with `discard`, drain pending checkpoints for these IDs before calling.
    public func discardConfirmed(_ drafts: [RecoveryDraft]) async throws {
        guard !drafts.isEmpty else { return }
        try await withLockedDirectory { fd in
            let stored = try Self.readManifest(in: fd)
            let snapshots = Dictionary(uniqueKeysWithValues: stored.map { ($0.id, $0) })
            var removing = Set<UUID>()
            // Validate even duplicate confirmations against the original snapshot before removing any ID.
            for draft in drafts {
                guard let snapshot = snapshots[draft.id] else { continue }
                guard snapshot.revision <= draft.revision else { throw StoreError.staleRevision }
                if snapshot.revision == draft.revision, snapshot != draft {
                    throw StoreError.revisionConflict
                }
                removing.insert(draft.id)
            }
            guard !removing.isEmpty else { return }
            let remaining = stored.filter { !removing.contains($0.id) }
            try Self.replaceManifest(in: fd, with: Manifest.encode(remaining))
        }
    }
}

private extension DraftRecoveryStore {
    static let manifestName = "drafts.manifest"
    static let lockName = "drafts.lock"
    static let applicationLockName = "application.lock"
    static let stageName = "drafts.pending"
    static let directoryFlags = O_RDONLY | O_DIRECTORY | O_NOFOLLOW_ANY | O_CLOEXEC
    static let fileFlags = O_NOFOLLOW | O_CLOEXEC | O_NONBLOCK | O_NOCTTY

    func withLockedDirectory<Result>(_ body: (Int32) throws -> Result) async throws -> Result {
        try Task.checkCancellation()
        let fd = try Self.openDirectory(directory)
        defer { _ = close(fd) }
        let lockFD = try Self.openLock(in: fd)
        defer { _ = close(lockFD) }

        let clock = ContinuousClock()
        let deadline = clock.now + .seconds(1)
        while true {
            try Task.checkCancellation()
            if flock(lockFD, LOCK_EX | LOCK_NB) == 0 {
                // No suspension while the lock is held. Closing the descriptor releases it.
                return try body(fd)
            }
            let error = errno
            guard error == EWOULDBLOCK || error == EINTR else { throw StoreError.ioFailure }
            let now = clock.now
            guard now < deadline else { throw StoreError.lockContended }
            try await clock.sleep(until: min(now + .milliseconds(5), deadline))
        }
    }

    static func openLock(in directoryFD: Int32, named name: String = lockName) throws -> Int32 {
        let fd = try openLockFile(in: directoryFD, named: name)
        do {
            let info = try stat(of: fd)
            try validatePrivateFile(info)
            try validateNoACL(on: fd)
            guard info.st_size == 0 else { throw StoreError.unsafeLocation }
            return fd
        } catch {
            _ = close(fd)
            throw error
        }
    }

    // Both lock inodes are stable across all manifest replacements. Never unlink them.
    static func openLockFile(in directoryFD: Int32, named name: String) throws -> Int32 {
        let flags = O_RDWR | fileFlags
        let existing = openat(directoryFD, name, flags)
        if existing >= 0 { return existing }
        guard errno == ENOENT else { throw openError(errno) }

        // Distinguish a first creation race from any other error. Darwin can return
        // ENOENT when two ordinary O_CREAT opens race to create an absent name.
        let created = openat(directoryFD, name, flags | O_CREAT | O_EXCL, 0o600)
        if created >= 0 { return created }
        guard errno == EEXIST else { throw openError(errno) }
        let raced = openat(directoryFD, name, flags)
        guard raced >= 0 else { throw openError(errno) }
        return raced
    }

    static func openDirectory(_ directory: URL) throws -> Int32 {
        let host = directory.host(percentEncoded: false) ?? ""
        let path = directory.path(percentEncoded: false)
        let parts = path.split(separator: "/")
        let name = directory.lastPathComponent
        guard SelectedFileURL.hasNoExtraComponents(directory), host.isEmpty || host == "localhost",
              path.hasPrefix("/"), !path.utf8.contains(0),
              !name.isEmpty, !name.contains("/"), !name.utf8.contains(0),
              parts.last.map({ $0.utf8.elementsEqual(name.utf8) }) == true,
              !parts.contains("."), !parts.contains("..") else {
            throw StoreError.invalidLocation
        }
        let parent = directory.deletingLastPathComponent()
        let parentFD = parent.withUnsafeFileSystemRepresentation { pathname in
            pathname.map { open($0, Self.directoryFlags) } ?? -1
        }
        guard parentFD >= 0 else { throw Self.openError(errno) }
        defer { _ = close(parentFD) }

        // Refuse aliased path components before any creation. Only this leaf can be created.
        if mkdirat(parentFD, name, 0o700) != 0, errno != EEXIST { throw Self.openError(errno) }
        let fd = openat(parentFD, name, Self.directoryFlags)
        guard fd >= 0 else { throw Self.openError(errno) }
        do {
            let info = try Self.stat(of: fd)
            guard info.st_uid == geteuid(), info.st_mode & 0o7777 == 0o700 else {
                throw StoreError.unsafeLocation
            }
            try Self.validateNoACL(on: fd)
            return fd
        } catch {
            _ = close(fd)
            throw error
        }
    }

    static func readManifest(in directoryFD: Int32) throws -> [RecoveryDraft] {
        let fd = openat(directoryFD, manifestName, O_RDONLY | fileFlags)
        if fd < 0, errno == ENOENT { return [] }
        guard fd >= 0 else { throw openError(errno) }
        defer { _ = close(fd) }
        let info = try stat(of: fd)
        try validatePrivateFile(info)
        try validateNoACL(on: fd)
        guard info.st_size >= Manifest.minimumSize, info.st_size <= Manifest.maximumSize else {
            throw StoreError.corruptManifest
        }
        var bytes = Data(count: Int(info.st_size))
        try bytes.withUnsafeMutableBytes { buffer in
            var offset = 0
            while offset < buffer.count {
                let count = Darwin.read(fd, buffer.baseAddress?.advanced(by: offset), buffer.count - offset)
                if count < 0 {
                    if errno == EINTR { continue }
                    throw StoreError.ioFailure
                }
                guard count != 0 else { throw StoreError.corruptManifest }
                offset += count
            }
        }
        var extra: UInt8 = 0
        while true {
            let count = Darwin.read(fd, &extra, 1)
            if count == 0 { break }
            if count > 0 { throw StoreError.corruptManifest }
            if errno != EINTR { throw StoreError.ioFailure }
        }
        return try Manifest.decode(bytes)
    }

    static func replaceManifest(in directoryFD: Int32, with bytes: Data) throws {
        // One fixed staging name bounds leftover disk use even across repeated interruptions.
        // Interrupted staging is not a committed snapshot and is ignored on reads.
        var orphan = Darwin.stat()
        if fstatat(directoryFD, stageName, &orphan, AT_SYMLINK_NOFOLLOW) == 0 {
            try validatePrivateFile(orphan)
            try retryOnInterrupt { unlinkat(directoryFD, stageName, 0) }
        } else if errno != ENOENT {
            throw openError(errno)
        }
        let fd = openat(directoryFD, stageName, O_WRONLY | O_CREAT | O_EXCL | fileFlags, 0o600)
        guard fd >= 0 else { throw openError(errno) }
        var committed = false
        defer {
            _ = close(fd)
            if !committed { _ = unlinkat(directoryFD, stageName, 0) }
        }
        try validatePrivateFile(stat(of: fd))
        try validateNoACL(on: fd)
        try bytes.withUnsafeBytes { buffer in
            var offset = 0
            while offset < buffer.count {
                let count = Darwin.write(fd, buffer.baseAddress?.advanced(by: offset), buffer.count - offset)
                if count < 0, errno == EINTR { continue }
                guard count > 0 else { throw StoreError.ioFailure }
                offset += count
            }
        }
        try retryOnInterrupt { fsync(fd) }
        // The manifest is never truncated and the old contents remain until this rename.
        // This is process-crash recovery, not a guarantee of persistence after power loss.
        guard renameat(directoryFD, stageName, directoryFD, manifestName) == 0 else { throw StoreError.ioFailure }
        committed = true
    }

    static func stat(of fd: Int32) throws -> Darwin.stat {
        var info = Darwin.stat()
        try retryOnInterrupt { fstat(fd, &info) }
        return info
    }

    static func validatePrivateFile(_ info: Darwin.stat) throws {
        guard info.st_mode & S_IFMT == S_IFREG, info.st_nlink == 1, info.st_uid == geteuid(),
              info.st_mode & 0o7777 == 0o600 else { throw StoreError.unsafeLocation }
    }

    static func validateNoACL(on fd: Int32) throws {
        // A Darwin ACL can grant access that the owner-only POSIX mode does not show.
        guard let acl = acl_get_fd_np(fd, ACL_TYPE_EXTENDED) else {
            if errno == ENOENT || errno == ENOTSUP { return }
            throw StoreError.ioFailure
        }
        defer { _ = acl_free(UnsafeMutableRawPointer(acl)) }
        var entry: acl_entry_t?
        guard acl_get_entry(acl, Int32(ACL_FIRST_ENTRY.rawValue), &entry) == -1, errno == EINVAL else {
            throw StoreError.unsafeLocation
        }
    }

    static func openError(_ code: Int32) -> StoreError {
        switch code {
        case ELOOP, ENOTDIR, EMLINK, EISDIR: .unsafeLocation
        default: .ioFailure
        }
    }

    static func retryOnInterrupt(_ operation: () -> Int32) throws {
        while operation() != 0 {
            if errno != EINTR { throw StoreError.ioFailure }
        }
    }
}

// Version 1 framing: magic, UInt32 version, UInt32 count, then entries of 16 UUID
// bytes, UInt64 revision, UInt32 UTF-8 byte count, and source bytes. Integers are
// big-endian. The trailing SHA-256 detects corruption, not deliberate tampering.
private enum Manifest {
    private static let magic = Data("HZDRAFT\n".utf8)
    private static let version: UInt32 = 1
    private static let totalLimit = 16 * 1024 * 1024
    private static let entryLimit = 32
    static let minimumSize = magic.count + 8 + SHA256.Digest.byteCount
    static let maximumSize = minimumSize + entryLimit * (16 + 8 + 4) + totalLimit

    static func encode(_ drafts: [RecoveryDraft]) throws -> Data {
        let total = drafts.reduce(0) { $0 + $1.source.utf8.count }
        guard drafts.count <= entryLimit, total <= totalLimit else { throw DraftRecoveryStore.StoreError.capacityExceeded }
        var bytes = magic
        append(version, to: &bytes)
        append(UInt32(drafts.count), to: &bytes)
        for draft in drafts {
            var uuid = draft.id.uuid
            withUnsafeBytes(of: &uuid) { bytes.append(contentsOf: $0) }
            append(draft.revision, to: &bytes)
            append(UInt32(draft.source.utf8.count), to: &bytes)
            bytes.append(contentsOf: draft.source.utf8)
        }
        let digest = SHA256.hash(data: bytes)
        bytes.append(contentsOf: digest)
        return bytes
    }

    static func decode(_ bytes: Data) throws -> [RecoveryDraft] {
        let payload = bytes.dropLast(SHA256.Digest.byteCount)
        guard SHA256.hash(data: payload).elementsEqual(bytes.suffix(SHA256.Digest.byteCount)) else {
            throw DraftRecoveryStore.StoreError.corruptManifest
        }
        var reader = Reader(bytes: payload)
        guard try reader.take(magic.count) == magic else { throw DraftRecoveryStore.StoreError.corruptManifest }
        guard try reader.integer(UInt32.self) == version else { throw DraftRecoveryStore.StoreError.unsupportedVersion }
        let count = Int(try reader.integer(UInt32.self))
        guard count <= entryLimit else { throw DraftRecoveryStore.StoreError.corruptManifest }
        var drafts = [RecoveryDraft]()
        var ids = Set<UUID>()
        var total = 0
        for _ in 0..<count {
            let uuid = try reader.take(16).withUnsafeBytes { $0.loadUnaligned(as: uuid_t.self) }
            let id = UUID(uuid: uuid)
            let revision = try reader.integer(UInt64.self)
            let size = Int(try reader.integer(UInt32.self))
            guard revision > 0, ids.insert(id).inserted, size <= RecoveryDraft.sourceByteLimit, size <= totalLimit - total,
                  let source = String(validating: try reader.take(size), as: UTF8.self) else {
                throw DraftRecoveryStore.StoreError.corruptManifest
            }
            drafts.append(RecoveryDraft(id: id, revision: revision, source: source))
            total += size
        }
        guard reader.atEnd else { throw DraftRecoveryStore.StoreError.corruptManifest }
        return drafts
    }

    private static func append<T: FixedWidthInteger>(_ value: T, to bytes: inout Data) {
        var bigEndian = value.bigEndian
        withUnsafeBytes(of: &bigEndian) { bytes.append(contentsOf: $0) }
    }

    private struct Reader {
        let bytes: Data
        private var offset = 0
        var atEnd: Bool { offset == bytes.count }

        init(bytes: Data) { self.bytes = bytes }

        mutating func take(_ count: Int) throws -> Data {
            guard count <= bytes.count - offset else { throw DraftRecoveryStore.StoreError.corruptManifest }
            defer { offset += count }
            return bytes[offset..<(offset + count)]
        }

        mutating func integer<T: FixedWidthInteger>(_ type: T.Type) throws -> T {
            try take(MemoryLayout<T>.size).withUnsafeBytes { T(bigEndian: $0.loadUnaligned(as: type)) }
        }
    }
}
