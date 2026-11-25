import Darwin
import Foundation
@testable import HazakuraNextCore
import Testing

struct SelectedFolderCatalogTests {
    @Test func listsImmediateRegularNamesInDeterministicOrder() async throws {
        try await withFixture { folder in
            let selected = folder.appending(path: "原稿", directoryHint: .isDirectory)
            let nested = selected.appending(path: "subfolder.md", directoryHint: .isDirectory)
            try FileManager.default.createDirectory(at: nested, withIntermediateDirectories: true)
            try Data().write(to: nested.appending(path: "nested.md"))
            for leaf in ["z.TxT", "A.MD", "原稿.MarkDown", "a.txt", ".private.md", "other.rtf", "fake.md.exe", "no-extension"] {
                try Data().write(to: selected.appending(path: leaf))
            }
            let hidden = selected.appending(path: "finder-hidden.txt")
            try Data().write(to: hidden)
            try #require(hidden.withUnsafeFileSystemRepresentation { chflags($0!, UInt32(UF_HIDDEN)) } == 0)
            let fifo = selected.appending(path: "pipe.txt")
            try #require(fifo.withUnsafeFileSystemRepresentation { mkfifo($0!, 0o600) } == 0)

            let first = try await SelectedFolderCatalog.read(from: selected)
            let second = try await SelectedFolderCatalog.read(from: selected)
            #expect(first.folderName == "原稿")
            #expect(first.names == ["A.MD", "a.txt", "z.TxT", "原稿.MarkDown"])
            #expect(first.names == second.names)
        }
    }

    @Test func doesNotRequireReadableOrTextualBodies() async throws {
        try await withFixture { folder in
            let unreadable = folder.appending(path: "unreadable.md")
            try Data([0x00, 0xFF, 0x80]).write(to: unreadable)
            try #require(unreadable.withUnsafeFileSystemRepresentation { chmod($0!, 0) } == 0)
            let invalid = folder.appending(path: "not-text.txt")
            try Data([0x00, 0xFF, 0x80]).write(to: invalid)

            let catalog = try await SelectedFolderCatalog.read(from: folder)
            #expect(catalog.names == ["not-text.txt", "unreadable.md"])
        }
    }

    @Test(arguments: ["\n", "\u{007F}", "\u{0085}", "\u{061C}", "\u{200F}", "\u{202E}", "\u{2066}", "\u{2028}"])
    func omitsDeceptiveNamesAndDoesNotExposeUnsafeFolderLabel(_ scalar: String) async throws {
        try await withFixture { folder in
            let selected = folder.appending(path: "selected\(scalar)folder", directoryHint: .isDirectory)
            try FileManager.default.createDirectory(at: selected, withIntermediateDirectories: false)
            try Data().write(to: selected.appending(path: "unsafe\(scalar)leaf.md"))
            try Data().write(to: selected.appending(path: "安全.txt"))

            let catalog = try await SelectedFolderCatalog.read(from: selected)
            #expect(catalog.folderName == "選択したフォルダ")
            #expect(catalog.names == ["安全.txt"])
        }
    }

    @Test func ignoresSymlinkChildrenAndRejectsSelectedSymlinkLocations() async throws {
        try await withFixture { folder in
            let selected = folder.appending(path: "selected", directoryHint: .isDirectory)
            let real = selected.appending(path: "real", directoryHint: .isDirectory)
            try FileManager.default.createDirectory(at: real, withIntermediateDirectories: true)
            let outside = folder.appending(path: "outside.md")
            try Data().write(to: outside)
            let fm = FileManager.default
            try fm.createSymbolicLink(at: selected.appending(path: "leaf.txt"), withDestinationURL: outside)
            try fm.createSymbolicLink(at: selected.appending(path: "broken.md"), withDestinationURL: folder.appending(path: "missing"))
            try fm.createSymbolicLink(at: selected.appending(path: "folder.md"), withDestinationURL: real)
            let alias = folder.appending(path: "alias", directoryHint: .isDirectory)
            try fm.createSymbolicLink(at: alias, withDestinationURL: selected)

            let catalog = try await SelectedFolderCatalog.read(from: selected)
            #expect(catalog.names.isEmpty)
            for rejected in [alias, alias.appending(path: "real", directoryHint: .isDirectory), outside] {
                await #expect(throws: SelectedFolderCatalog.ScanError.invalidLocation) {
                    try await SelectedFolderCatalog.read(from: rejected)
                }
            }
        }
    }

    @Test(arguments: ["https://example.invalid/selected/", "file://elsewhere.invalid/selected/", "file:///selected%00suffix/"])
    func rejectsInvalidLocationWithoutExposingPath(_ input: String) async throws {
        let url = try #require(URL(string: input))
        await #expect(throws: SelectedFolderCatalog.ScanError.invalidLocation) {
            try await SelectedFolderCatalog.read(from: url)
        }
    }

    @Test func countsHiddenAndNoncandidateEntriesAtTheLimit() async throws {
        #expect(SelectedFolderCatalog.entryLimit == 512)
        try await withFixture { folder in
            let empty = try await SelectedFolderCatalog.read(from: folder)
            #expect(empty.names.isEmpty)
            try Data().write(to: folder.appending(path: "visible.md"))
            for number in 1..<512 {
                let name = number.isMultiple(of: 2) ? ".hidden-\(number).txt" : "other-\(number).bin"
                try Data().write(to: folder.appending(path: name))
            }
            let atLimit = try await SelectedFolderCatalog.read(from: folder)
            #expect(atLimit.names == ["visible.md"])
            try FileManager.default.createDirectory(
                at: folder.appending(path: "extra", directoryHint: .isDirectory), withIntermediateDirectories: false
            )
            await #expect(throws: SelectedFolderCatalog.ScanError.tooManyEntries) {
                try await SelectedFolderCatalog.read(from: folder)
            }
        }
    }

    @Test func checksCancellationBeforeDoingIO() async throws {
        try await withFixture { folder in
            let missing = folder.appending(path: "missing", directoryHint: .isDirectory)
            let task = Task {
                withUnsafeCurrentTask { $0?.cancel() }
                return try await SelectedFolderCatalog.read(from: missing)
            }
            await #expect(throws: CancellationError.self) { try await task.value }
        }
    }

    @Test func rejectsDirectoryMutationBeforeDelivery() async throws {
        try await withFixture { folder in
            try Data().write(to: folder.appending(path: "initial.txt"))
            #expect(throws: SelectedFolderCatalog.ScanError.changedWhileScanning) {
                try SelectedFolderCatalog.read(from: folder, beforePathRevalidation: {
                    try FileManager.default.createDirectory(
                        at: folder.appending(path: "added", directoryHint: .isDirectory), withIntermediateDirectories: false
                    )
                })
            }
        }
    }

    @Test func rejectsSelectedPathRedirectedThroughAnAncestorLink() async throws {
        try await withFixture { folder in
            let parent = folder.appending(path: "parent", directoryHint: .isDirectory)
            let selected = parent.appending(path: "selected", directoryHint: .isDirectory)
            let moved = folder.appending(path: "moved", directoryHint: .isDirectory)
            let fm = FileManager.default
            try fm.createDirectory(at: selected, withIntermediateDirectories: true)
            try Data().write(to: selected.appending(path: "initial.txt"))
            #expect(throws: SelectedFolderCatalog.ScanError.changedWhileScanning) {
                try SelectedFolderCatalog.read(from: selected, beforePathRevalidation: {
                    try fm.moveItem(at: parent, to: moved)
                    try fm.createSymbolicLink(at: parent, withDestinationURL: moved)
                })
            }
        }
    }

    private func withFixture(_ body: (URL) async throws -> Void) async throws {
        let fm = FileManager.default
        // Foundation may preserve /var even after resolving symlinks. Canonicalize only the fixture root.
        let resolved = fm.temporaryDirectory.withUnsafeFileSystemRepresentation { path in
            path.flatMap { Darwin.realpath($0, nil) }
        }
        let canonical = try #require(resolved)
        defer { free(canonical) }
        let folder = URL(fileURLWithPath: String(cString: canonical), isDirectory: true)
            .appending(path: "HazakuraCatalogTests-\(UUID().uuidString)", directoryHint: .isDirectory)
        try fm.createDirectory(at: folder, withIntermediateDirectories: false)
        defer { try? fm.removeItem(at: folder) }
        try await body(folder)
    }
}
