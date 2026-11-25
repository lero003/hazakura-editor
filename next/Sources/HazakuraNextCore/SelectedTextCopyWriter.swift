import Darwin
import Foundation

/// Creates a new copy at an explicitly selected destination, never at a default location.
public enum SelectedTextCopyWriter {
    public enum WriteError: Error, Equatable {
        case invalidLocation, invalidText, ambiguousLeadingBOM, invalidPDF, invalidEPUB, tooLarge, alreadyExists, accessDenied
    }

    package static let pdfByteLimit = 16 * 1024 * 1024

    /// Pass the URL from an explicit save-picker action and keep its existing access alive
    /// through this call. If it does not permit sibling staging, fail without a direct-write fallback.
    @concurrent
    public static func write(source: String, encoding: SelectedTextFile.Encoding, to url: URL) async throws {
        try Task.checkCancellation()
        let destination = try Destination(url)
        let bytes = try encode(source, encoding: encoding)
        try writeNewFile(bytes, to: destination)
    }

    /// Generated HTML declares UTF-8 regardless of the encoding of its source document.
    @concurrent
    package static func writeHTML(_ html: String, to url: URL) async throws {
        try await write(source: html, encoding: .utf8, to: url)
    }

    /// Writes renderer-validated PDF bytes to an explicitly selected new file.
    @concurrent
    package static func writePDF(data: Data, to url: URL) async throws {
        try Task.checkCancellation()
        let destination = try Destination(url)
        guard (destination.leaf as NSString).pathExtension.lowercased() == "pdf" else {
            throw WriteError.invalidLocation
        }
        guard data.count <= pdfByteLimit else { throw WriteError.tooLarge }
        guard data.starts(with: "%PDF-".utf8) else { throw WriteError.invalidPDF }
        try writeNewFile(data, to: destination)
    }

    /// Pass renderer-produced EPUB bytes and the explicitly selected new file.
    /// This boundary checks the OCF envelope, not the whole publication.
    @concurrent
    package static func writeEPUB(data: Data, to url: URL) async throws {
        try Task.checkCancellation()
        let destination = try Destination(url)
        guard (destination.leaf as NSString).pathExtension.lowercased() == "epub" else {
            throw WriteError.invalidLocation
        }
        guard data.count <= EPUBStoredArchive.byteLimit else { throw WriteError.tooLarge }
        guard EPUBStoredArchive.hasMimetypePrefix(data) else { throw WriteError.invalidEPUB }
        try writeNewFile(data, to: destination)
    }

    private static func writeNewFile(_ bytes: Data, to destination: Destination) throws {
        try Task.checkCancellation()

        let parent = try openParent(destination.parentPath)
        defer { _ = Darwin.close(parent) }
        let parentInfo = try trustedParentInfo(parent)
        try requireNewLeaf(destination.leaf, in: parent)
        try Task.checkCancellation()

        // Choose a different ASCII prefix even if the leaf is named like a stage on a
        // case-insensitive volume. O_EXCL also protects unrelated entries at the stage name.
        let prefix = destination.leaf.lowercased().hasPrefix(".hazakura-copy-a-")
            ? ".hazakura-copy-b-" : ".hazakura-copy-a-"
        let stageName = prefix + UUID().uuidString
        let stage = openat(parent, stageName, O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW_ANY | O_CLOEXEC, 0o600)
        guard stage >= 0 else { throw WriteError.accessDenied }
        var committed = false
        defer {
            if !committed {
                var current = stat()
                if fstat(stage, &current) == 0, stageMatchesName(current, name: stageName, in: parent) {
                    _ = unlinkat(parent, stageName, 0)
                }
            }
            _ = Darwin.close(stage)
        }

        var stageInfo = stat()
        guard fstat(stage, &stageInfo) == 0, isPrivateStage(stageInfo) else { throw WriteError.accessDenied }
        // A parent ACL can grant extra access despite 0600. Do not put bytes in a stage
        // with an inherited ACL, or change the inherited permissions to make it writable.
        try requireNoACL(stage)
        try writeAll(bytes, to: stage)
        try sync(stage)

        // Reopen without following links. Pinning the directory fd prevents redirection
        // to a replacement directory. This cannot lock the pathname or protect against
        // a privileged or same-user process making further namespace changes.
        let currentParent = try openParent(destination.parentPath)
        defer { _ = Darwin.close(currentParent) }
        let currentParentInfo = try trustedParentInfo(currentParent)
        guard sameIdentity(parentInfo, currentParentInfo) else { throw WriteError.invalidLocation }
        guard fstat(stage, &stageInfo) == 0, isPrivateStage(stageInfo), stageInfo.st_size == bytes.count,
              stageMatchesName(stageInfo, name: stageName, in: parent) else { throw WriteError.accessDenied }
        try requireNoACL(stage)
        try Task.checkCancellation()

        // The exclusive rename, not the earlier existence check, guards the selected leaf.
        // No fallback may replace an existing entry if the filesystem rejects these flags.
        guard renameatx_np(parent, stageName, parent, destination.leaf,
                           UInt32(RENAME_EXCL | RENAME_NOFOLLOW_ANY)) == 0 else {
            if errno == EEXIST { throw WriteError.alreadyExists }
            throw WriteError.accessDenied
        }
        committed = true
        // Do not report cancellation or a close error after the new copy is visible.
    }

    private struct Destination {
        let parentPath: String
        let leaf: String

        init(_ url: URL) throws {
            let host = url.host(percentEncoded: false) ?? ""
            let path = url.path(percentEncoded: true)
            guard SelectedFileURL.hasNoExtraComponents(url), host.isEmpty || host.lowercased() == "localhost",
                  path.hasPrefix("/") else { throw WriteError.invalidLocation }
            // Decode per component so an encoded separator cannot change the chosen path.
            let components = try path.dropFirst().split(separator: "/", omittingEmptySubsequences: false).map { name in
                guard let decoded = String(name).removingPercentEncoding, !decoded.isEmpty,
                      decoded != ".", decoded != "..", !decoded.utf8.contains(0), !decoded.utf8.contains(47) else {
                    throw WriteError.invalidLocation
                }
                return decoded
            }
            guard let leaf = components.last else { throw WriteError.invalidLocation }
            self.leaf = leaf
            parentPath = "/" + components.dropLast().joined(separator: "/")
        }
    }

    // Shared by copy publication and original-file byte checks.
    static func encode(_ source: String, encoding: SelectedTextFile.Encoding) throws -> Data {
        let mark = encoding.byteOrderMark
        let limit = SelectedTextFile.byteLimit - mark.count
        let bodyEncoding: String.Encoding
        switch encoding {
        case .utf8, .utf8BOM:
            guard source.utf8.prefix(limit + 1).count <= limit else { throw WriteError.tooLarge }
            bodyEncoding = .utf8
        case .utf16LE, .utf16BE:
            let unitLimit = limit / 2
            guard source.utf16.prefix(unitLimit + 1).count <= unitLimit else { throw WriteError.tooLarge }
            bodyEncoding = encoding == .utf16LE ? .utf16LittleEndian : .utf16BigEndian
        }
        // Without a separate BOM, reopening would consume this body scalar as the format marker.
        if encoding == .utf8, source.unicodeScalars.first?.value == 0xFEFF {
            throw WriteError.ambiguousLeadingBOM
        }
        // Test the text, not the serialized bytes (NUL bytes are common in UTF-16).
        guard !source.utf8.contains(where: { ($0 < 32 && $0 != 9 && $0 != 10 && $0 != 13) || $0 == 127 }),
              let body = source.data(using: bodyEncoding, allowLossyConversion: false) else {
            throw WriteError.invalidText
        }
        return mark.isEmpty ? body : Data(mark) + body
    }

    private static func openParent(_ path: String) throws -> Int32 {
        let fd = Darwin.open(path, O_RDONLY | O_DIRECTORY | O_NOFOLLOW_ANY | O_CLOEXEC)
        guard fd >= 0 else {
            switch errno {
            case ELOOP, ENOENT, ENOTDIR, ENAMETOOLONG: throw WriteError.invalidLocation
            default: throw WriteError.accessDenied
            }
        }
        return fd
    }

    private static func trustedParentInfo(_ fd: Int32) throws -> stat {
        var info = stat()
        var volume = statfs()
        guard fstat(fd, &info) == 0, fstatfs(fd, &volume) == 0 else { throw WriteError.accessDenied }
        guard volume.f_flags & UInt32(MNT_LOCAL) != 0 else { throw WriteError.invalidLocation }
        // The name-to-inode checks and subsequent rename/unlink are separate syscalls.
        // Exclude directories where another user could exchange the staging entry.
        guard volume.f_flags & UInt32(MNT_IGNORE_OWNERSHIP) == 0,
              info.st_uid == geteuid(), info.st_mode & 0o022 == 0 else { throw WriteError.accessDenied }
        try validateParentACL(fd)
        return info
    }

    private static func validateParentACL(_ fd: Int32) throws {
        guard let acl = acl_get_fd_np(fd, ACL_TYPE_EXTENDED) else {
            guard errno == ENOENT else { throw WriteError.accessDenied }
            return
        }
        defer { _ = acl_free(UnsafeMutableRawPointer(acl)) }
        guard acl_valid(acl) == 0 else { throw WriteError.accessDenied }
        var index = ACL_FIRST_ENTRY
        while true {
            var entry: acl_entry_t?
            if acl_get_entry(acl, index.rawValue, &entry) != 0 {
                guard errno == EINVAL else { throw WriteError.accessDenied }
                return
            }
            var kind = ACL_UNDEFINED_TAG
            var flags: acl_flagset_t?
            var permissions: acl_permset_t?
            // Retain harmless denies (e.g. macOS's deny-delete on the parent itself).
            // Reject grants or denies that could be inherited by a stage or bar cleanup.
            guard let entry, acl_get_tag_type(entry, &kind) == 0, kind == ACL_EXTENDED_DENY,
                  acl_get_flagset_np(UnsafeMutableRawPointer(entry), &flags) == 0, let flags,
                  acl_get_flag_np(flags, ACL_ENTRY_FILE_INHERIT) == 0,
                  acl_get_permset(entry, &permissions) == 0, let permissions,
                  acl_get_perm_np(permissions, ACL_DELETE_CHILD) == 0 else { throw WriteError.accessDenied }
            index = ACL_NEXT_ENTRY
        }
    }

    private static func requireNewLeaf(_ name: String, in parent: Int32) throws {
        var info = stat()
        guard fstatat(parent, name, &info, AT_SYMLINK_NOFOLLOW) != 0 else { throw WriteError.alreadyExists }
        switch errno {
        case ENOENT: break
        case ENAMETOOLONG: throw WriteError.invalidLocation
        default: throw WriteError.accessDenied
        }
    }

    private static func sameIdentity(_ lhs: stat, _ rhs: stat) -> Bool {
        lhs.st_dev == rhs.st_dev && lhs.st_ino == rhs.st_ino
    }

    private static func stageMatchesName(_ info: stat, name: String, in parent: Int32) -> Bool {
        var named = stat()
        return fstatat(parent, name, &named, AT_SYMLINK_NOFOLLOW) == 0 && sameIdentity(info, named)
    }

    private static func isPrivateStage(_ info: stat) -> Bool {
        info.st_mode & S_IFMT == S_IFREG && info.st_uid == geteuid()
            && info.st_mode & 0o777 == 0o600 && info.st_nlink == 1
    }

    private static func requireNoACL(_ stage: Int32) throws {
        if let acl = acl_get_fd_np(stage, ACL_TYPE_EXTENDED) {
            _ = acl_free(UnsafeMutableRawPointer(acl))
            throw WriteError.accessDenied
        }
        guard errno == ENOENT else { throw WriteError.accessDenied }
    }

    private static func writeAll(_ bytes: Data, to fd: Int32) throws {
        try bytes.withUnsafeBytes { buffer in
            guard let base = buffer.baseAddress else { return }
            var offset = 0
            while offset < buffer.count {
                try Task.checkCancellation()
                let count = Darwin.write(fd, base.advanced(by: offset), min(buffer.count - offset, 64 * 1024))
                if count < 0 && errno == EINTR { continue }
                guard count > 0 else { throw WriteError.accessDenied }
                offset += count
            }
        }
    }

    private static func sync(_ fd: Int32) throws {
        while true {
            try Task.checkCancellation()
            if fsync(fd) == 0 { return }
            guard errno == EINTR else { throw WriteError.accessDenied }
        }
    }
}
