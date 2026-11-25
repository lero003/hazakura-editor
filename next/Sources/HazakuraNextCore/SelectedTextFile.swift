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

    public let name: String
    public let source: String
    public let format: Format
    public let originalBytes: Data
    public let identity: Identity

    /// Accept only the URL delivered by the app's explicit open action. I/O is off the UI actor.
    @concurrent
    public static func read(from url: URL) async throws -> SelectedTextFile {
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

        var after = stat()
        guard fstat(fd, &after) == 0 else { throw ReadError.accessDenied }
        // Detect ordinary in-place changes during the read; this is not a filesystem lock.
        guard before.st_size == after.st_size, bytes.count == after.st_size,
              sameTime(before.st_mtimespec, after.st_mtimespec),
              sameTime(before.st_ctimespec, after.st_ctimespec) else { throw ReadError.changedWhileReading }
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
        return SelectedTextFile(name: url.lastPathComponent, source: source, format: format,
                                originalBytes: bytes, identity: Identity(device: before.st_dev, inode: before.st_ino))
    }

    private static func sameTime(_ lhs: timespec, _ rhs: timespec) -> Bool {
        lhs.tv_sec == rhs.tv_sec && lhs.tv_nsec == rhs.tv_nsec
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
