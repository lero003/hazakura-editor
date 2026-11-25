import Darwin
import Foundation

/// Creates a new copy at an explicitly selected destination, never at a default location.
public enum SelectedTextCopyWriter {
    public enum WriteError: Error, Equatable {
        case invalidLocation, invalidText, tooLarge, alreadyExists, accessDenied
    }

    /// Pass the URL from an explicit save-picker action and keep its existing access alive
    /// through this call. If it does not permit sibling staging, fail without a direct-write fallback.
    @concurrent
    public static func write(source: String, preservingUTF8BOM: Bool, to url: URL) async throws {
        try Task.checkCancellation()
        let destination = try Destination(url)
        let bytes = try encode(source, preservingUTF8BOM: preservingUTF8BOM)
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
        // A parent ACL can grant extra access despite 0600. Do not put text in a stage
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
            guard url.isFileURL, url.baseURL == nil, host.isEmpty || host.lowercased() == "localhost",
                  url.user == nil, url.password == nil, url.port == nil, url.query == nil, url.fragment == nil,
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

    private static func encode(_ source: String, preservingUTF8BOM: Bool) throws -> Data {
        let prefix: [UInt8] = preservingUTF8BOM ? [0xEF, 0xBB, 0xBF] : []
        let body = source.utf8
        guard body.count <= SelectedTextFile.byteLimit - prefix.count else { throw WriteError.tooLarge }
        // Match SelectedTextFile's text boundary: ASCII TAB, LF and CR only among controls.
        guard !body.contains(where: { ($0 < 32 && $0 != 9 && $0 != 10 && $0 != 13) || $0 == 127 }) else {
            throw WriteError.invalidText
        }
        var bytes = Data()
        bytes.reserveCapacity(prefix.count + body.count)
        bytes.append(contentsOf: prefix)
        bytes.append(contentsOf: body)
        return bytes
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
