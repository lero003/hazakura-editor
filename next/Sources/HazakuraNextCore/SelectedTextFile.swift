import Darwin
import Foundation

/// A bounded, read-only snapshot. It holds no path or security scope for future I/O.
public struct SelectedTextFile: Sendable {
    public static let byteLimit = 2 * 1024 * 1024

    public enum ReadError: Error, Equatable {
        case invalidLocation, accessDenied, notRegularFile, tooLarge
        case invalidUTF8, nonTextControls, changedWhileReading
    }

    public enum LineEndings: Equatable, Sendable {
        case none, lf, crlf, cr, mixed
    }

    public struct Format: Sendable {
        public let hasUTF8BOM: Bool
        public let lineEndings: LineEndings
    }

    public struct Identity: Equatable, Sendable {
        fileprivate let device: dev_t
        fileprivate let inode: ino_t
    }

    /// An observed regular-file version, suitable for equality checks, not a lock or a write precondition.
    public struct Version: Equatable, Sendable {
        fileprivate let identity: Identity
        private let generation: UInt32
        private let birthTime: Timestamp
        private let modificationTime: Timestamp
        private let changeTime: Timestamp
        private let size: off_t

        init(_ info: stat) {
            identity = Identity(device: info.st_dev, inode: info.st_ino)
            generation = info.st_gen
            birthTime = Timestamp(info.st_birthtimespec)
            modificationTime = Timestamp(info.st_mtimespec)
            changeTime = Timestamp(info.st_ctimespec)
            size = info.st_size
        }

        private struct Timestamp: Equatable, Sendable {
            let seconds: time_t
            let nanoseconds: Int

            init(_ value: timespec) {
                seconds = value.tv_sec
                nanoseconds = value.tv_nsec
            }
        }
    }

    public let name: String
    public let source: String
    public let format: Format
    public let originalBytes: Data
    public let version: Version
    public var identity: Identity { version.identity }

    /// Accept only the URL delivered by the app's explicit open action. I/O is off the UI actor.
    @concurrent
    public static func read(from url: URL) async throws -> SelectedTextFile {
        try read(from: url, beforePathRevalidation: {})
    }

    // Per-read, module-internal test seam. The selected descriptor is still pinned here.
    static func read(from url: URL, beforePathRevalidation: () throws -> Void) throws -> SelectedTextFile {
        try Task.checkCancellation()
        let host = url.host(percentEncoded: false) ?? ""
        let path = url.path(percentEncoded: false)
        guard url.isFileURL, host.isEmpty || host == "localhost", path.hasPrefix("/"),
              !path.utf8.contains(0) else { throw ReadError.invalidLocation }

        let fd = url.withUnsafeFileSystemRepresentation { pathname in
            guard let pathname else { return -1 as Int32 }
            // O_NOFOLLOW_ANY applies to the whole path. NONBLOCK avoids waiting for a FIFO;
            // the kernel descriptor (not the filename or picker filter) decides its type.
            return Darwin.open(pathname, O_RDONLY | O_NOFOLLOW_ANY | O_NONBLOCK | O_NOCTTY | O_CLOEXEC)
        }
        guard fd >= 0 else { throw ReadError.accessDenied }
        defer { _ = Darwin.close(fd) }

        var before = stat()
        guard fstat(fd, &before) == 0 else { throw ReadError.accessDenied }
        guard before.st_mode & S_IFMT == S_IFREG else { throw ReadError.notRegularFile }
        guard before.st_size >= 0, before.st_size <= byteLimit else { throw ReadError.tooLarge }

        var bytes = Data()
        bytes.reserveCapacity(Int(before.st_size))
        var buffer = [UInt8](repeating: 0, count: 32 * 1024)
        while true {
            try Task.checkCancellation()
            let maximum = min(buffer.count, byteLimit - bytes.count + 1)
            let count = buffer.withUnsafeMutableBytes { Darwin.read(fd, $0.baseAddress, maximum) }
            if count == 0 { break }
            if count < 0 {
                if errno == EINTR { continue }
                throw ReadError.accessDenied
            }
            bytes.append(contentsOf: buffer.prefix(count))
            guard bytes.count <= byteLimit else { throw ReadError.tooLarge }
        }

        try Task.checkCancellation()
        var after = stat()
        guard fstat(fd, &after) == 0 else { throw ReadError.accessDenied }
        let version = Version(before)
        guard after.st_mode & S_IFMT == S_IFREG, bytes.count == after.st_size,
              Version(after) == version else { throw ReadError.changedWhileReading }
        try Task.checkCancellation()
        let bom: [UInt8] = [0xEF, 0xBB, 0xBF]
        let hasBOM = bytes.starts(with: bom)
        let body = bytes.dropFirst(hasBOM ? bom.count : 0)
        guard let source = String(validating: body, as: UTF8.self) else { throw ReadError.invalidUTF8 }
        // Allow text separators only; DEL and the other ASCII controls are not plain-text input.
        guard !body.contains(where: { ($0 < 32 && $0 != 9 && $0 != 10 && $0 != 13) || $0 == 127 }) else {
            throw ReadError.nonTextControls
        }
        let format = Format(hasUTF8BOM: hasBOM, lineEndings: detectLineEndings(body))
        try Task.checkCancellation()
        try beforePathRevalidation()
        try Task.checkCancellation()

        // The pinned fd alone cannot tell if the selected path was removed or redirected.
        // Check metadata without following links or opening a potential replacement.
        let pathMatches = url.withUnsafeFileSystemRepresentation { pathname in
            guard let pathname else { return false }
            var named = stat()
            return fstatat(AT_FDCWD, pathname, &named, AT_SYMLINK_NOFOLLOW_ANY) == 0
                && named.st_mode & S_IFMT == S_IFREG && Version(named) == version
        }
        try Task.checkCancellation()
        guard pathMatches else { throw ReadError.changedWhileReading }
        return SelectedTextFile(name: url.lastPathComponent, source: source, format: format,
                                originalBytes: bytes, version: version)
    }

    private static func detectLineEndings(_ bytes: Data) -> LineEndings {
        var found = LineEndings.none
        var index = bytes.startIndex
        while index < bytes.endIndex {
            let byte = bytes[index]
            index += 1
            let ending: LineEndings
            switch byte {
            case 10:
                ending = .lf
            case 13:
                if index < bytes.endIndex, bytes[index] == 10 {
                    ending = .crlf
                    index += 1
                } else {
                    ending = .cr
                }
            default:
                continue
            }
            if found != .none && found != ending { return .mixed }
            found = ending
        }
        return found
    }
}
