import Darwin
import Foundation

/// Names and versions observed in one explicitly selected folder. No retained filesystem access.
public struct SelectedFolderCatalog: Sendable {
    public struct Entry: Identifiable, Sendable {
        /// The exact UTF-8 bytes supplied by the directory, not a normalized display key.
        public let id: Data
        public let name: String
        fileprivate let version: ObservedVersion
    }

    public let folderName: String
    public let entries: [Entry]
    public var names: [String] { entries.map(\.name) }
    public static let entryLimit = 512

    private let rootVersion: ObservedVersion

    public enum ScanError: Error, Equatable {
        case invalidLocation, accessDenied, tooManyEntries, changedWhileScanning
        case entryNotListed, selectionChanged
    }

    @concurrent
    public static func read(from url: URL) async throws -> Self {
        try read(from: url, beforePathRevalidation: {})
    }

    // Per-scan test seam. The directory descriptor remains pinned through both revalidation checks.
    static func read(from url: URL, beforePathRevalidation: () throws -> Void) throws -> Self {
        try Task.checkCancellation()
        return try withFolderPath(url) { pathname, leaf in
            let folderName = leaf.flatMap { String(validating: $0, as: UTF8.self) }
                .flatMap { isSafeDisplayName($0) ? $0 : nil } ?? "選択したフォルダ"
            return try withOpenedFolder(at: pathname, invalid: .invalidLocation) { fd, stream, before in
                let version = ObservedVersion(before)
                var entries = try readEntries(from: stream, in: fd)
                // Stable byte order; do not collapse canonically equivalent names.
                entries.sort { $0.id.lexicographicallyPrecedes($1.id) }

                try Task.checkCancellation()
                try beforePathRevalidation()
                try Task.checkCancellation()
                let unchanged = folderMatches(version, at: pathname, pinned: fd)
                try Task.checkCancellation()
                guard unchanged else { throw ScanError.changedWhileScanning }
                return Self(folderName: folderName, entries: entries, rootVersion: version)
            }
        }
    }

    /// Requires the folder URL from a fresh explicit picker selection. The caller owns that
    /// selection's permission; neither the catalog nor the returned snapshot carries it forward.
    @concurrent
    public func readEntry(_ id: Data, from folder: URL) async throws -> SelectedTextFile {
        try readEntry(id, from: folder, beforePathRevalidation: {})
    }

    // Per-read test seam after parsing, while both descriptors remain pinned.
    func readEntry(_ id: Data, from folder: URL, beforePathRevalidation: () throws -> Void) throws -> SelectedTextFile {
        try Task.checkCancellation()
        // A listed ID is necessarily a validated, non-dot, single leaf with no NUL or slash.
        guard let entry = entries.first(where: { $0.id == id }) else { throw ScanError.entryNotListed }
        return try Self.withFolderPath(folder) { pathname, _ in
            var named = stat()
            guard fstatat(AT_FDCWD, pathname, &named, AT_SYMLINK_NOFOLLOW_ANY) == 0,
                  ObservedVersion(named) == rootVersion else { throw ScanError.selectionChanged }
            guard named.st_flags & UInt32(SF_DATALESS) == 0 else { throw ScanError.accessDenied }

            return try Self.withOpenedFolder(at: pathname, invalid: .selectionChanged) { fd, stream, before in
                guard ObservedVersion(before) == rootVersion,
                      try Self.hasExactLeaf(entry.id, in: stream) else { throw ScanError.selectionChanged }
                // Pass only the captured leaf bytes to openat/fstatat, never the displayed name or a child URL.
                var leaf = entry.id
                leaf.append(0)
                return try leaf.withUnsafeBytes { raw in
                    guard let name = raw.bindMemory(to: CChar.self).baseAddress else { throw ScanError.entryNotListed }
                    return try Self.readPinnedEntry(entry, named: name, in: fd, rootDevice: before.st_dev) { child in
                        try beforePathRevalidation()
                        try Task.checkCancellation()
                        // A case/normalization-insensitive lookup may still find a renamed inode.
                        // Recheck the exact leaf bytes and both named entries before delivery. Not a lock.
                        var namedChild = stat()
                        var pinnedChild = stat()
                        let unchanged = try Self.hasExactLeaf(entry.id, in: stream)
                            && fstatat(fd, name, &namedChild, AT_SYMLINK_NOFOLLOW_ANY) == 0
                            && ObservedVersion(namedChild) == entry.version
                            && Self.folderMatches(rootVersion, at: pathname, pinned: fd)
                            && fstat(child, &pinnedChild) == 0 && ObservedVersion(pinnedChild) == entry.version
                        try Task.checkCancellation()
                        guard unchanged else { throw ScanError.selectionChanged }
                    }
                }
            }
        }
    }

    private static func readPinnedEntry(
        _ entry: Entry, named name: UnsafePointer<CChar>, in root: Int32, rootDevice: dev_t,
        revalidate: (Int32) throws -> Void
    ) throws -> SelectedTextFile {
        var named = stat()
        guard fstatat(root, name, &named, AT_SYMLINK_NOFOLLOW_ANY) == 0 else {
            throw Self.lookupError(errno, invalid: .selectionChanged)
        }
        guard named.st_mode & S_IFMT == S_IFREG, named.st_dev == rootDevice,
              ObservedVersion(named) == entry.version else { throw ScanError.selectionChanged }
        guard named.st_flags & UInt32(SF_DATALESS) == 0 else { throw ScanError.accessDenied }
        try Task.checkCancellation()

        let fd = openat(root, name, O_RDONLY | O_NOFOLLOW_ANY | O_NONBLOCK | O_NOCTTY | O_CLOEXEC)
        guard fd >= 0 else { throw Self.lookupError(errno, invalid: .selectionChanged) }
        defer { _ = Darwin.close(fd) }
        var opened = stat()
        var volume = statfs()
        guard fstat(fd, &opened) == 0 else { throw ScanError.accessDenied }
        guard ObservedVersion(opened) == entry.version else { throw ScanError.selectionChanged }
        guard fstatfs(fd, &volume) == 0, volume.f_flags & UInt32(MNT_LOCAL) != 0 else { throw ScanError.accessDenied }
        do {
            return try SelectedTextFile.readPinned(fd, name: entry.name, before: opened) { _ in
                try revalidate(fd)
            }
        } catch SelectedTextFile.ReadError.changedWhileReading {
            throw ScanError.selectionChanged
        }
    }

    private static func withFolderPath<T>(
        _ url: URL, _ body: (UnsafePointer<CChar>, UnsafeRawBufferPointer.SubSequence?) throws -> T
    ) throws -> T {
        let host = url.host(percentEncoded: false) ?? ""
        let path = url.path(percentEncoded: false)
        guard SelectedFileURL.hasNoExtraComponents(url), host.isEmpty || host.lowercased() == "localhost",
              path.hasPrefix("/"), !path.utf8.contains(0) else { throw ScanError.invalidLocation }

        return try url.withUnsafeFileSystemRepresentation { pathname in
            guard let pathname else { throw ScanError.invalidLocation }
            let pathBytes = UnsafeRawBufferPointer(start: pathname, count: strlen(pathname))
            let components = pathBytes.split(separator: UInt8(ascii: "/"))
            guard pathBytes.first == UInt8(ascii: "/"), !components.contains(where: isDotEntry) else {
                throw ScanError.invalidLocation
            }
            return try body(pathname, components.last)
        }
    }

    private static func withOpenedFolder<T>(
        at pathname: UnsafePointer<CChar>, invalid: ScanError,
        _ body: (Int32, UnsafeMutablePointer<DIR>, stat) throws -> T
    ) throws -> T {
        try Task.checkCancellation()
        let fd = Darwin.open(pathname, O_RDONLY | O_DIRECTORY | O_NOFOLLOW_ANY | O_CLOEXEC | O_NONBLOCK)
        guard fd >= 0 else { throw lookupError(errno, invalid: invalid) }
        var stream: UnsafeMutablePointer<DIR>?
        defer {
            if let stream { _ = closedir(stream) } else { _ = Darwin.close(fd) }
        }

        var before = stat()
        var volume = statfs()
        guard fstat(fd, &before) == 0, fstatfs(fd, &volume) == 0 else { throw ScanError.accessDenied }
        guard before.st_mode & S_IFMT == S_IFDIR,
              volume.f_flags & UInt32(MNT_LOCAL) != 0 else { throw invalid }
        try Task.checkCancellation()
        guard let opened = fdopendir(fd) else { throw ScanError.accessDenied }
        stream = opened // fdopendir takes ownership only on success.
        return try body(fd, opened, before)
    }

    private static func readEntries(from stream: UnsafeMutablePointer<DIR>, in fd: Int32) throws -> [Entry] {
        var entries: [Entry] = []
        _ = try visitDirectory(stream) { bytes, namePointer in
            guard bytes.first != UInt8(ascii: "."), !bytes.contains(0), !bytes.contains(UInt8(ascii: "/")),
                  hasTextExtension(bytes), let name = String(validating: bytes, as: UTF8.self),
                  isSafeDisplayName(name) else { return false }

            var info = stat()
            // A validated single component has no ancestors to follow relative to this pinned fd.
            guard fstatat(fd, namePointer, &info, AT_SYMLINK_NOFOLLOW) == 0 else {
                throw lookupError(errno, invalid: .changedWhileScanning)
            }
            guard info.st_mode & S_IFMT == S_IFREG, info.st_flags & UInt32(UF_HIDDEN) == 0 else { return false }
            entries.append(Entry(id: Data(bytes), name: name, version: ObservedVersion(info)))
            return false
        }
        return entries
    }

    private static func hasExactLeaf(_ id: Data, in stream: UnsafeMutablePointer<DIR>) throws -> Bool {
        rewinddir(stream)
        do {
            return try visitDirectory(stream) { bytes, _ in id.elementsEqual(bytes) }
        } catch ScanError.tooManyEntries {
            throw ScanError.selectionChanged
        }
    }

    /// Visit at most the original scan bound and allow the caller to stop on one exact name.
    private static func visitDirectory(
        _ stream: UnsafeMutablePointer<DIR>,
        _ visit: (UnsafeRawBufferPointer.SubSequence, UnsafePointer<CChar>) throws -> Bool
    ) throws -> Bool {
        var count = 0
        while true {
            try Task.checkCancellation()
            errno = 0
            guard let entry = readdir(stream) else {
                guard errno == 0 else { throw ScanError.accessDenied }
                return false
            }
            let length = Int(entry.pointee.d_namlen)
            let found = try withUnsafeBytes(of: &entry.pointee.d_name) { storage in
                let bytes = storage.prefix(length)
                if isDotEntry(bytes) { return false }
                // Count even invalid or excluded names, not just displayed entries.
                count += 1
                guard count <= entryLimit else { throw ScanError.tooManyEntries }
                guard length > 0, length < storage.count, storage[length] == 0,
                      let base = storage.bindMemory(to: CChar.self).baseAddress else { return false }
                return try visit(bytes, base)
            }
            if found { return true }
        }
    }

    private static func folderMatches(_ version: ObservedVersion, at pathname: UnsafePointer<CChar>, pinned fd: Int32) -> Bool {
        var named = stat()
        var pinned = stat()
        return fstatat(AT_FDCWD, pathname, &named, AT_SYMLINK_NOFOLLOW_ANY) == 0
            && ObservedVersion(named) == version && fstat(fd, &pinned) == 0 && ObservedVersion(pinned) == version
    }

    private static func lookupError(_ code: Int32, invalid: ScanError) -> ScanError {
        switch code {
        case ELOOP, ENOENT, ENOTDIR, ENAMETOOLONG, ESTALE: invalid
        default: .accessDenied
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

    fileprivate struct ObservedVersion: Equatable, Sendable {
        private let version: SelectedTextFile.Version
        private let mode: mode_t
        private let flags: UInt32
        private let links: nlink_t
        private let owner: uid_t
        private let group: gid_t

        init(_ info: stat) {
            version = SelectedTextFile.Version(info)
            mode = info.st_mode
            flags = info.st_flags
            links = info.st_nlink
            owner = info.st_uid
            group = info.st_gid
        }
    }
}
