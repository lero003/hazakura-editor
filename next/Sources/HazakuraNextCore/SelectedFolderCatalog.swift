import Darwin
import Foundation

/// Display-only names observed in one explicitly selected folder. No retained filesystem access.
public struct SelectedFolderCatalog: Sendable {
    public let folderName: String
    public let names: [String]
    public static let entryLimit = 512

    public enum ScanError: Error, Equatable {
        case invalidLocation, accessDenied, tooManyEntries, changedWhileScanning
    }

    @concurrent
    public static func read(from url: URL) async throws -> Self {
        try read(from: url, beforePathRevalidation: {})
    }

    // Per-scan test seam. The directory descriptor remains pinned through both revalidation checks.
    static func read(from url: URL, beforePathRevalidation: () throws -> Void) throws -> Self {
        try Task.checkCancellation()
        let host = url.host(percentEncoded: false) ?? ""
        let path = url.path(percentEncoded: false)
        guard url.isFileURL, host.isEmpty || host.lowercased() == "localhost",
              url.user == nil, url.password == nil, url.port == nil, url.query == nil, url.fragment == nil,
              path.hasPrefix("/"), !path.utf8.contains(0) else { throw ScanError.invalidLocation }

        return try url.withUnsafeFileSystemRepresentation { pathname in
            guard let pathname else { throw ScanError.invalidLocation }
            let pathBytes = UnsafeRawBufferPointer(start: pathname, count: strlen(pathname))
            let components = pathBytes.split(separator: UInt8(ascii: "/"))
            guard pathBytes.first == UInt8(ascii: "/"), !components.contains(where: isDotEntry) else {
                throw ScanError.invalidLocation
            }
            let folderName = components.last.flatMap { String(validating: $0, as: UTF8.self) }
                .flatMap { isSafeDisplayName($0) ? $0 : nil } ?? "選択したフォルダ"

            let fd = Darwin.open(pathname, O_RDONLY | O_DIRECTORY | O_NOFOLLOW_ANY | O_CLOEXEC | O_NONBLOCK)
            guard fd >= 0 else {
                switch errno {
                case ELOOP, ENOENT, ENOTDIR, ENAMETOOLONG: throw ScanError.invalidLocation
                default: throw ScanError.accessDenied
                }
            }
            var stream: UnsafeMutablePointer<DIR>?
            defer {
                if let stream { _ = closedir(stream) } else { _ = Darwin.close(fd) }
            }

            var before = stat()
            var volume = statfs()
            guard fstat(fd, &before) == 0, fstatfs(fd, &volume) == 0 else { throw ScanError.accessDenied }
            guard before.st_mode & S_IFMT == S_IFDIR,
                  volume.f_flags & UInt32(MNT_LOCAL) != 0 else { throw ScanError.invalidLocation }
            try Task.checkCancellation()
            guard let opened = fdopendir(fd) else { throw ScanError.accessDenied }
            stream = opened // fdopendir takes ownership only on success.

            var names = try readNames(from: opened, in: fd)
            // Deterministic, locale-independent order; do not collapse canonically equivalent names.
            names.sort { $0.utf8.lexicographicallyPrecedes($1.utf8) }

            try Task.checkCancellation()
            try beforePathRevalidation()
            try Task.checkCancellation()
            var named = stat()
            var after = stat()
            // The fd stays valid after a rename; check the selected path separately without following
            // links in any component, then check the pinned directory again. This is not a lock.
            let unchanged = fstatat(AT_FDCWD, pathname, &named, AT_SYMLINK_NOFOLLOW_ANY) == 0
                && fstat(fd, &after) == 0 && sameDirectoryVersion(before, named) && sameDirectoryVersion(before, after)
            try Task.checkCancellation()
            guard unchanged else { throw ScanError.changedWhileScanning }
            return Self(folderName: folderName, names: names)
        }
    }

    private static func readNames(from stream: UnsafeMutablePointer<DIR>, in fd: Int32) throws -> [String] {
        var names: [String] = []
        var count = 0
        while true {
            try Task.checkCancellation()
            errno = 0
            guard let entry = readdir(stream) else {
                guard errno == 0 else { throw ScanError.accessDenied }
                return names
            }
            let length = Int(entry.pointee.d_namlen)
            try withUnsafeBytes(of: &entry.pointee.d_name) { storage in
                // Count even invalid or excluded names; only literal '.' and '..' don't count.
                let bytes = storage.prefix(length)
                if isDotEntry(bytes) { return }
                count += 1
                guard count <= entryLimit else { throw ScanError.tooManyEntries }
                guard length > 0, length < storage.count, storage[length] == 0,
                      bytes.first != UInt8(ascii: "."), !bytes.contains(0), !bytes.contains(UInt8(ascii: "/")),
                      hasTextExtension(bytes), let name = String(validating: bytes, as: UTF8.self),
                      isSafeDisplayName(name), let base = storage.baseAddress else { return }

                // Use the original kernel bytes for lookup, never the decoded display name.
                var info = stat()
                guard fstatat(fd, base.assumingMemoryBound(to: CChar.self), &info, AT_SYMLINK_NOFOLLOW) == 0 else {
                    if errno == ENOENT { throw ScanError.changedWhileScanning }
                    throw ScanError.accessDenied
                }
                guard info.st_mode & S_IFMT == S_IFREG, info.st_flags & UInt32(UF_HIDDEN) == 0 else { return }
                names.append(name)
            }
        }
    }

    private static func isDotEntry(_ bytes: UnsafeRawBufferPointer.SubSequence) -> Bool {
        bytes.elementsEqual([UInt8(ascii: ".")]) || bytes.elementsEqual([UInt8(ascii: "."), UInt8(ascii: ".")])
    }

    private static func isSafeDisplayName(_ name: String) -> Bool {
        !name.unicodeScalars.contains { scalar in
            switch scalar.properties.generalCategory {
            case .control, .lineSeparator, .paragraphSeparator: return true
            default:
                // Also exclude deprecated bidi formatting controls that aren't in Bidi_Control.
                return scalar.properties.isBidiControl || (0x206A...0x206F).contains(scalar.value)
            }
        }
    }

    private static func hasTextExtension(_ bytes: UnsafeRawBufferPointer.SubSequence) -> Bool {
        guard let dot = bytes.lastIndex(of: UInt8(ascii: ".")) else { return false }
        let suffix = bytes.suffix(from: bytes.index(after: dot))
        guard suffix.allSatisfy({ $0 < 128 }) else { return false }
        switch String(decoding: suffix, as: UTF8.self).lowercased() {
        case "md", "markdown", "txt": return true
        default: return false
        }
    }

    private static func sameDirectoryVersion(_ lhs: stat, _ rhs: stat) -> Bool {
        lhs.st_dev == rhs.st_dev && lhs.st_ino == rhs.st_ino && lhs.st_gen == rhs.st_gen
            && lhs.st_mode == rhs.st_mode && lhs.st_flags == rhs.st_flags
            && lhs.st_nlink == rhs.st_nlink && lhs.st_size == rhs.st_size
            && sameTime(lhs.st_birthtimespec, rhs.st_birthtimespec)
            && sameTime(lhs.st_mtimespec, rhs.st_mtimespec) && sameTime(lhs.st_ctimespec, rhs.st_ctimespec)
    }

    private static func sameTime(_ lhs: timespec, _ rhs: timespec) -> Bool {
        lhs.tv_sec == rhs.tv_sec && lhs.tv_nsec == rhs.tv_nsec
    }
}
