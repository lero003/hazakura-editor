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

    @Test func readsOnlyTheChosenImmediateChildAsTheSameSnapshotAsDirectOpen() async throws {
        try await withFixture { folder in
            let url = folder.appending(path: "原稿.txt")
            let bytes = Data([0xFF, 0xFE, 0x61, 0, 13, 0, 10, 0, 0x62, 0, 10, 0])
            try bytes.write(to: url)
            try Data([0xFF]).write(to: folder.appending(path: "another.md"))
            let catalog = try await SelectedFolderCatalog.read(from: folder)
            let entry = try #require(catalog.entries.first { $0.name == "原稿.txt" })
            #expect(catalog.entries.map(\.name) == catalog.names)
            #expect(entry.id == Data("原稿.txt".utf8))

            let selected = try await catalog.readEntry(entry.id, from: folder)
            let direct = try await SelectedTextFile.read(from: url)
            #expect(selected.name == entry.name)
            #expect(selected.originalBytes == bytes)
            #expect(selected.version == direct.version)
            #expect(selected.source == "a\r\nb\n")
            #expect(selected.format.encoding == .utf16LE)
            #expect(selected.format.lineEndings == .mixed)
        }
    }

    @Test func rejectsInvalidAndAliasedIDsWithoutUsingFilesystemCollation() async throws {
        try await withFixture { folder in
            let name = "Caf\u{00E9}.md"
            try Data("chosen".utf8).write(to: folder.appending(path: name))
            try Data("hidden".utf8).write(to: folder.appending(path: ".hidden.txt"))
            let catalog = try await SelectedFolderCatalog.read(from: folder)
            let entry = try #require(catalog.entries.first)
            #expect(entry.name == name)
            #expect(entry.id == Data(entry.name.utf8))
            let composed = Data(name.utf8)
            let decomposed = Data(name.decomposedStringWithCanonicalMapping.utf8)
            let variant = entry.id == composed ? decomposed : composed
            let rejected = [Data(), Data([0xFF]), Data(".".utf8), Data("..".utf8), Data(".hidden.txt".utf8),
                            Data("../Café.md".utf8), Data("Café.md\0suffix".utf8), Data("café.md".utf8), variant]
            for id in rejected {
                await #expect(throws: SelectedFolderCatalog.ScanError.entryNotListed) {
                    try await catalog.readEntry(id, from: folder)
                }
            }
            #expect(try await catalog.readEntry(entry.id, from: folder).source == "chosen")
        }
    }

    @Test func rejectsAnotherOrReplacedFolderEvenWithMatchingNamesAndContents() async throws {
        try await withFixture { base in
            let fm = FileManager.default
            let selected = base.appending(path: "first/selected", directoryHint: .isDirectory)
            let twin = base.appending(path: "second/selected", directoryHint: .isDirectory)
            for folder in [selected, twin] {
                try fm.createDirectory(at: folder, withIntermediateDirectories: true)
                try Data("same content".utf8).write(to: folder.appending(path: "draft.md"))
            }
            let catalog = try await SelectedFolderCatalog.read(from: selected)
            let id = try #require(catalog.entries.first?.id)
            await #expect(throws: SelectedFolderCatalog.ScanError.selectionChanged) {
                try await catalog.readEntry(id, from: twin)
            }
            try fm.moveItem(at: selected, to: base.appending(path: "old"))
            try fm.moveItem(at: twin, to: selected)
            await #expect(throws: SelectedFolderCatalog.ScanError.selectionChanged) {
                try await catalog.readEntry(id, from: selected)
            }
        }
    }

    @Test func rejectsRootVersionChangeEvenWhenChosenFileIsUnchanged() async throws {
        try await withFixture { folder in
            try Data().write(to: folder.appending(path: "draft.md"))
            let catalog = try await SelectedFolderCatalog.read(from: folder)
            let id = try #require(catalog.entries.first?.id)
            try Data().write(to: folder.appending(path: "unlisted.bin"))
            await #expect(throws: SelectedFolderCatalog.ScanError.selectionChanged) {
                try await catalog.readEntry(id, from: folder)
            }
        }
    }

    @Test func rejectsEditsInPlaceBeforeAndAfterReading() async throws {
        try await withFixture { folder in
            let url = folder.appending(path: "draft.md")
            try Data("one".utf8).write(to: url)
            let catalog = try await SelectedFolderCatalog.read(from: folder)
            let id = try #require(catalog.entries.first?.id)
            let changedTime = Date(timeIntervalSince1970: 1_700_000_000)
            #expect(throws: SelectedFolderCatalog.ScanError.selectionChanged) {
                try catalog.readEntry(id, from: folder, beforePathRevalidation: {
                    try Data("two".utf8).write(to: url, options: [])
                    try FileManager.default.setAttributes([.modificationDate: changedTime], ofItemAtPath: url.path)
                })
            }
            await #expect(throws: SelectedFolderCatalog.ScanError.selectionChanged) {
                try await catalog.readEntry(id, from: folder)
            }
        }
    }

    private enum ChildChange: CaseIterable {
        case replacement, symlink, fifo, caseOnlyRename
    }

    @Test(arguments: ChildChange.allCases)
    private func rejectsReplacedOrRenamedChild(_ change: ChildChange) async throws {
        try await withFixture { folder in
            let fm = FileManager.default
            let url = folder.appending(path: "draft.md")
            let moved = folder.appending(path: "moved")
            try Data("same content".utf8).write(to: url)
            let catalog = try await SelectedFolderCatalog.read(from: folder)
            let id = try #require(catalog.entries.first?.id)
            #expect(throws: SelectedFolderCatalog.ScanError.selectionChanged) {
                try catalog.readEntry(id, from: folder, beforePathRevalidation: {
                    try fm.moveItem(at: url, to: moved)
                    switch change {
                    case .replacement: try Data("same content".utf8).write(to: url)
                    case .symlink: try fm.createSymbolicLink(at: url, withDestinationURL: moved)
                    case .fifo: try #require(url.withUnsafeFileSystemRepresentation { mkfifo($0!, 0o600) } == 0)
                    case .caseOnlyRename: try fm.moveItem(at: moved, to: folder.appending(path: "Draft.md"))
                    }
                })
            }
            await #expect(throws: SelectedFolderCatalog.ScanError.selectionChanged) {
                try await catalog.readEntry(id, from: folder)
            }
        }
    }

    @Test func rejectsRootPathRedirectedThroughAnAncestorLinkAfterReading() async throws {
        try await withFixture { folder in
            let parent = folder.appending(path: "parent", directoryHint: .isDirectory)
            let selected = parent.appending(path: "selected", directoryHint: .isDirectory)
            let moved = folder.appending(path: "moved", directoryHint: .isDirectory)
            let fm = FileManager.default
            try fm.createDirectory(at: selected, withIntermediateDirectories: true)
            try Data("same file".utf8).write(to: selected.appending(path: "draft.md"))
            let catalog = try await SelectedFolderCatalog.read(from: selected)
            let id = try #require(catalog.entries.first?.id)
            #expect(throws: SelectedFolderCatalog.ScanError.selectionChanged) {
                try catalog.readEntry(id, from: selected, beforePathRevalidation: {
                    try fm.moveItem(at: parent, to: moved)
                    try fm.createSymbolicLink(at: parent, withDestinationURL: moved)
                })
            }
            await #expect(throws: SelectedFolderCatalog.ScanError.selectionChanged) {
                try await catalog.readEntry(id, from: selected)
            }
        }
    }

    @Test(arguments: [
        (Data([0xC0, 0xAF]), SelectedTextFile.ReadError.invalidUTF8),
        (Data([0xFF, 0xFE, 0x00, 0xD8]), .invalidUTF16),
        (Data([0x61, 0x00]), .nonTextControls),
        (Data(repeating: 0x61, count: SelectedTextFile.byteLimit + 1), .tooLarge),
    ])
    func sharesDirectReaderValidation(_ fixture: (Data, SelectedTextFile.ReadError)) async throws {
        try await withFixture { folder in
            try fixture.0.write(to: folder.appending(path: "invalid.txt"))
            let catalog = try await SelectedFolderCatalog.read(from: folder)
            let id = try #require(catalog.entries.first?.id)
            await #expect(throws: fixture.1) { try await catalog.readEntry(id, from: folder) }
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
