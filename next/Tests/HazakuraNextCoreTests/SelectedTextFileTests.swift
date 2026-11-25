import Darwin
import Foundation
@testable import HazakuraNextCore
import Testing

struct SelectedTextFileTests {
    @Test(arguments: ["", "# が\n\n末尾", "# か\u{3099}\r\n🌸\r\n", "a\rb", "a\r\nb\nc\r", "\u{FEFF}本文\n"])
    func readsExactUTF8WithoutWritingToSource(_ body: String) async throws {
        try await withFixture { folder in
            let url = folder.appending(path: "原稿.md")
            let original = Data([0xEF, 0xBB, 0xBF]) + Data(body.utf8)
            try original.write(to: url)
            let selected = try await SelectedTextFile.read(from: url)
            #expect(selected.name == "原稿.md")
            #expect(selected.format.hasUTF8BOM)
            #expect(selected.source.utf8.elementsEqual(body.utf8))
            #expect(selected.originalBytes == original)
            #expect(try Data(contentsOf: url) == original)
        }
    }

    @Test(arguments: [("", SelectedTextFile.LineEndings.none), ("a\nb", .lf), ("a\r\nb", .crlf), ("a\rb", .cr), ("a\r\nb\nc", .mixed)])
    func reportsLineEndingsWithoutNormalizing(_ fixture: (String, SelectedTextFile.LineEndings)) async throws {
        try await withFixture { folder in
            let url = folder.appending(path: "原稿.txt")
            try Data(fixture.0.utf8).write(to: url)
            let selected = try await SelectedTextFile.read(from: url)
            #expect(selected.format.lineEndings == fixture.1)
            #expect(selected.format.hasUTF8BOM == false)
            #expect(selected.source.utf8.elementsEqual(fixture.0.utf8))
        }
    }

    @Test func rejectsMalformedUTF8AndBinaryControlCharacters() async throws {
        try await withFixture { folder in
            let url = folder.appending(path: "not-text.txt")
            for bytes: [UInt8] in [[0xC0, 0xAF], [0xEF, 0xBB, 0xBF, 0xFF]] {
                try Data(bytes).write(to: url)
                await #expect(throws: SelectedTextFile.ReadError.invalidUTF8) {
                    try await SelectedTextFile.read(from: url)
                }
            }
            for bytes: [UInt8] in [[0x41, 0x00, 0x42], [0x41, 0x01], [0x41, 0x7F]] {
                try Data(bytes).write(to: url)
                await #expect(throws: SelectedTextFile.ReadError.nonTextControls) {
                    try await SelectedTextFile.read(from: url)
                }
            }
        }
    }

    @Test func boundsExactByteLimitBeforeBuildingAnEditorBuffer() async throws {
        try await withFixture { folder in
            let url = folder.appending(path: "sized.txt")
            let body = Data(repeating: 0x61, count: SelectedTextFile.byteLimit)
            try body.write(to: url)
            let selected = try await SelectedTextFile.read(from: url)
            #expect(selected.originalBytes == body)
            try (body + Data([0x61])).write(to: url)
            await #expect(throws: SelectedTextFile.ReadError.tooLarge) {
                try await SelectedTextFile.read(from: url)
            }
        }
    }

    @Test func rejectsSymbolicLinksInLeafAndParentPaths() async throws {
        try await withFixture { folder in
            let real = folder.appending(path: "real", directoryHint: .isDirectory)
            try FileManager.default.createDirectory(at: real, withIntermediateDirectories: false)
            let content = real.appending(path: "test.txt")
            try Data("original".utf8).write(to: content)
            let leafLink = folder.appending(path: "link.txt")
            let parentLink = folder.appending(path: "link-dir", directoryHint: .isDirectory)
            try FileManager.default.createSymbolicLink(at: leafLink, withDestinationURL: content)
            try FileManager.default.createSymbolicLink(at: parentLink, withDestinationURL: real)
            for url in [leafLink, parentLink.appending(path: "test.txt")] {
                await #expect(throws: SelectedTextFile.ReadError.accessDenied) {
                    try await SelectedTextFile.read(from: url)
                }
            }
            #expect(try Data(contentsOf: content) == Data("original".utf8))
        }
    }

    @Test func rejectsDirectoryFIFOAndNonFileURL() async throws {
        try await withFixture { folder in
            let fifo = folder.appending(path: "pipe.txt")
            let result = fifo.withUnsafeFileSystemRepresentation { Darwin.mkfifo($0!, 0o600) }
            try #require(result == 0)
            for url in [folder, fifo] {
                await #expect(throws: SelectedTextFile.ReadError.notRegularFile) {
                    try await SelectedTextFile.read(from: url)
                }
            }
            let remote = try #require(URL(string: "https://example.invalid/not-a-file.txt"))
            await #expect(throws: SelectedTextFile.ReadError.invalidLocation) {
                try await SelectedTextFile.read(from: remote)
            }
        }
    }

    @Test func snapshotsRemainBoundToTheCapturedFileVersion() async throws {
        try await withFixture { folder in
            let url = folder.appending(path: "versioned.md")
            let original = Data("# 元の稿".utf8)
            let edited = Data("# 次の稿".utf8)
            try original.write(to: url)
            let initialMTime = Date(timeIntervalSince1970: 2_147_000_000)
            try FileManager.default.setAttributes([.modificationDate: initialMTime], ofItemAtPath: url.path)
            let first = try await SelectedTextFile.read(from: url)
            let unchanged = try await SelectedTextFile.read(from: url)
            #expect(first.version == unchanged.version)

            // Overwrite the same inode with a same-length body and a known different mtime.
            try edited.write(to: url, options: [])
            try FileManager.default.setAttributes([.modificationDate: initialMTime.addingTimeInterval(60)],
                                                  ofItemAtPath: url.path)
            let second = try await SelectedTextFile.read(from: url)
            #expect(first.identity == second.identity)
            #expect(first.version != second.version)
            #expect(first.originalBytes == original)
            #expect(second.originalBytes == edited)

            let replacement = folder.appending(path: "replacement.md")
            try edited.write(to: replacement)
            let replaced = try await SelectedTextFile.read(from: replacement)
            #expect(replaced.identity != second.identity)
            #expect(replaced.version != second.version)
            #expect(replaced.originalBytes == second.originalBytes)
        }
    }

    @Test func metadataOnlyChangeInvalidatesVersionWithoutChangingIdentityOrBytes() async throws {
        try await withFixture { folder in
            let url = folder.appending(path: "metadata.md")
            try Data("# Unchanged".utf8).write(to: url)
            let before = try await SelectedTextFile.read(from: url)

            let mtime = Date(timeIntervalSince1970: 2_147_000_000)
            try FileManager.default.setAttributes([.modificationDate: mtime], ofItemAtPath: url.path)
            let after = try await SelectedTextFile.read(from: url)
            #expect(before.identity == after.identity)
            #expect(before.originalBytes == after.originalBytes)
            #expect(before.version != after.version)
        }
    }

    @Test func versionComparesNanosecondsAndInodeGenerationButNotAccessTime() {
        let original = stat()
        let version = SelectedTextFile.Version(original)
        var changed = original
        changed.st_birthtimespec.tv_nsec = 1
        #expect(version != SelectedTextFile.Version(changed))
        changed = original
        changed.st_mtimespec.tv_nsec = 1
        #expect(version != SelectedTextFile.Version(changed))
        changed = original
        changed.st_ctimespec.tv_nsec = 1
        #expect(version != SelectedTextFile.Version(changed))
        changed = original
        changed.st_gen = 1
        #expect(version != SelectedTextFile.Version(changed))
        changed = original
        changed.st_atimespec.tv_nsec = 1
        #expect(version == SelectedTextFile.Version(changed))
    }

    enum PathChange: CaseIterable {
        case missing, sameFileViaSymlink, replacementWithSameBytes
    }

    @Test(arguments: PathChange.allCases)
    func revalidatesSelectedPathAfterReadingPinnedFile(_ change: PathChange) async throws {
        try await withFixture { folder in
            let parent = folder.appending(path: "selected", directoryHint: .isDirectory)
            let moved = folder.appending(path: "moved", directoryHint: .isDirectory)
            try FileManager.default.createDirectory(at: parent, withIntermediateDirectories: false)
            let url = parent.appending(path: "draft.md")
            let body = Data("# Still the same body".utf8)
            try body.write(to: url)
            let baseline = try await SelectedTextFile.read(from: url)

            #expect(throws: SelectedTextFile.ReadError.changedWhileReading) {
                try SelectedTextFile.read(from: url, beforePathRevalidation: {
                    try FileManager.default.moveItem(at: parent, to: moved)
                    switch change {
                    case .missing:
                        break
                    case .sameFileViaSymlink:
                        // Following this link would still find the same inode and version.
                        try FileManager.default.createSymbolicLink(at: parent, withDestinationURL: moved)
                    case .replacementWithSameBytes:
                        try FileManager.default.createDirectory(at: parent, withIntermediateDirectories: false)
                        try body.write(to: url)
                    }
                })
            }
            let sameFile = try await SelectedTextFile.read(from: moved.appending(path: "draft.md"))
            #expect(sameFile.version == baseline.version)
            #expect(sameFile.originalBytes == body)
        }
    }

    @Test func rejectsCancellationBeforeReturningSnapshot() async throws {
        try await withFixture { folder in
            let url = folder.appending(path: "cancelled.md")
            try Data("# Never returned".utf8).write(to: url)
            await #expect(throws: CancellationError.self) {
                try await withThrowingTaskGroup(of: SelectedTextFile.self) { group in
                    group.addTask {
                        try SelectedTextFile.read(from: url, beforePathRevalidation: {
                            withUnsafeCurrentTask { $0?.cancel() }
                        })
                    }
                    _ = try await group.next()
                }
            }
        }
    }

    @Test func readOnlyTabRejectsEditorCallbacksAndDoesNotReplaceScratch() async throws {
        try await withFixture { folder in
            let url = folder.appending(path: "view.md")
            try Data("# 原文".utf8).write(to: url)
            let file = try await SelectedTextFile.read(from: url)
            var workspace = ScratchTabs(source: "# スクラッチ")
            let scratch = try #require(workspace.selectedID)
            workspace.setComposing(true, in: scratch)
            let blocked = workspace.openReadOnly(file)
            #expect(blocked == nil)
            workspace.setComposing(false, in: scratch)
            let opened = workspace.openReadOnly(file)
            let id = try #require(opened)
            #expect(id != scratch)
            #expect(workspace.selectedTab?.isReadOnly == true)
            let attemptedEdit = workspace.applyCommittedSource("変更しない", to: id)
            #expect(attemptedEdit == nil)
            #expect(workspace.recoveryDrafts.isEmpty)
            workspace.setComposing(true, in: id)
            #expect(workspace.isComposing == false)
            #expect(workspace.selectedTab?.document.source == "# 原文")
            let closed = workspace.requestCloseSelected()
            #expect(closed == .closed)
            #expect(workspace.selectedID == scratch)
            #expect(workspace.selectedTab?.document.source == "# スクラッチ")
        }
    }

    private func withFixture(_ test: (URL) async throws -> Void) async throws {
        // Foundation can preserve the /var alias even after resolving symlinks.
        let temporary = FileManager.default.temporaryDirectory
        let resolved = temporary.withUnsafeFileSystemRepresentation { path in
            path.flatMap { Darwin.realpath($0, nil) }
        }
        let canonical = try #require(resolved)
        defer { free(canonical) }
        let root = URL(fileURLWithPath: String(cString: canonical), isDirectory: true)
        let folder = root.appending(path: "hazakura-read-\(UUID())", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: false)
        defer { try? FileManager.default.removeItem(at: folder) }
        try await test(folder)
    }
}
