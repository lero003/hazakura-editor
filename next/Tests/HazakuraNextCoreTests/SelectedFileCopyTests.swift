import Darwin
import Foundation
import HazakuraNextCore
import Testing

struct SelectedFileCopyTests {
    private static let bom = Data([0xEF, 0xBB, 0xBF])

    @Test(arguments: [
        ("# か\u{3099}\r\n🌸\n末尾\r", false, SelectedTextFile.LineEndings.mixed),
        ("\u{FEFF}# か\u{3099}\r\n🌸", true, .crlf),
        ("", true, .none),
        ("", false, .none),
    ])
    func copiesExactDecodedBytesAndProtectsTheUnchangedCopy(
        fixture: (source: String, hasBOM: Bool, lineEndings: SelectedTextFile.LineEndings)
    ) async throws {
        let body = Data(fixture.source.utf8)
        let bytes = (fixture.hasBOM ? Self.bom : Data()) + body
        try await withSelectedFile(bytes) { file, url in
            var tabs = ScratchTabs(source: "既存の原稿")
            let scratchID = try #require(tabs.selectedID)
            let opened = tabs.openReadOnly(file)
            let originalID = try #require(opened)
            let original = try #require(tabs.selectedTab)
            #expect(original.copyOrigin == nil)
            #expect(tabs.recoveryDraft(for: scratchID) == nil)
            #expect(tabs.recoveryDraft(for: originalID) == nil)

            let created = tabs.makeEditableCopyOfSelection()
            let copyID = try #require(created)
            let copy = try #require(tabs.selectedTab)
            #expect(tabs.selectedID == copyID)
            #expect(tabs.tabs.map(\.id) == [scratchID, originalID, copyID])
            #expect(copy.isReadOnly == false)
            #expect(copy.selectedFile == nil)
            #expect(copy.document.revision == 1)
            #expect(Data(copy.document.source.utf8) == body)
            let origin = try #require(copy.copyOrigin)
            #expect(origin.name == file.name)
            #expect(origin.format.hasUTF8BOM == fixture.hasBOM)
            #expect(origin.format.lineEndings == fixture.lineEndings)

            let unchanged = tabs.applyCommittedSource(fixture.source, to: copyID)
            #expect(unchanged == nil)
            let draft = try #require(tabs.recoveryDraft(for: copyID))
            #expect(draft.id != originalID && draft.id != copyID)
            #expect(draft.revision == 1)
            #expect(Data(draft.source.utf8) == body)
            #expect(tabs.recoveryDrafts == [draft])
            guard case let .confirm(ticket) = tabs.requestCloseSelected() else {
                Issue.record("An explicit editable copy must require discard confirmation even before editing.")
                return
            }
            #expect(tabs.draftForDiscard(ticket) == draft)

            let attemptedOriginalEdit = tabs.applyCommittedSource("書き換えない", to: originalID)
            #expect(attemptedOriginalEdit == nil)
            let selectedOriginal = tabs.select(originalID)
            try #require(selectedOriginal)
            let retained = try #require(tabs.selectedTab)
            let snapshot = try #require(retained.selectedFile)
            #expect(retained.id == original.id)
            #expect(retained.number == original.number)
            #expect(retained.isReadOnly)
            #expect(retained.document.revision == 0)
            #expect(Data(retained.document.source.utf8) == body)
            #expect(snapshot.identity == file.identity)
            #expect(snapshot.originalBytes == bytes)
            #expect(try Data(contentsOf: url) == bytes)
            let attributes = try FileManager.default.attributesOfItem(atPath: url.path(percentEncoded: false))
            #expect((attributes[.posixPermissions] as? NSNumber)?.intValue == 0o400)
            #expect(tabs.requestCloseSelected() == .closed)
            #expect(tabs.selectedID == copyID)
        }
    }

    @Test func canonicallyEquivalentEditsUseTheCopyRecoveryIDAndPersistExactBytes() async throws {
        let original = "# か\u{3099}\r\n"
        let precomposed = "# が\r\n"
        try await withSelectedFile(Self.bom + Data(original.utf8)) { file, url in
            var tabs = ScratchTabs(source: "")
            let opened = tabs.openReadOnly(file)
            let originalID = try #require(opened)
            let created = tabs.makeEditableCopyOfSelection()
            let copyID = try #require(created)
            let initial = try #require(tabs.recoveryDraft(for: copyID))
            let directory = url.deletingLastPathComponent().appending(path: "recovery", directoryHint: .isDirectory)
            let store = DraftRecoveryStore(directory: directory)
            try await store.checkpoint(initial)
            #expect(try await store.drafts() == [initial])
            #expect(original == precomposed)
            try #require(Data(original.utf8) != Data(precomposed.utf8))

            let change = tabs.applyCommittedSource(precomposed, to: copyID)
            let edited = try #require(change)
            #expect(edited.id == initial.id)
            #expect(edited.revision == 2)
            #expect(Data(edited.source.utf8) == Data(precomposed.utf8))
            try await store.checkpoint(edited)
            let reopened = try await DraftRecoveryStore(directory: directory).drafts()
            #expect(reopened == [edited])
            let candidate = try #require(reopened.first)
            let restoredTab = tabs.restoreDraft(candidate)
            let restoredID = try #require(restoredTab)
            let restored = try #require(tabs.recoveryDraft(for: restoredID))
            #expect(restored.id != edited.id)
            #expect(restored.revision == 1)
            #expect(Data(restored.source.utf8) == Data(precomposed.utf8))
            #expect(tabs.selectedTab?.copyOrigin == nil)

            let selectedOriginal = tabs.select(originalID)
            try #require(selectedOriginal)
            let createdOther = tabs.makeEditableCopyOfSelection()
            let otherCopyID = try #require(createdOther)
            let otherCopy = try #require(tabs.recoveryDraft(for: otherCopyID))
            #expect(otherCopy.id != initial.id)
            #expect(Data(otherCopy.source.utf8) == Data(original.utf8))
            #expect(tabs.recoveryDraft(for: originalID) == nil)
            #expect(try Data(contentsOf: url) == Self.bom + Data(original.utf8))
        }
    }

    @Test func onlySelectedReadOnlyTabsCanBeCopiedWithoutInterruptingComposition() async throws {
        try await withSelectedFile(Data("原稿".utf8)) { file, _ in
            var tabs = ScratchTabs(source: "スクラッチ")
            let scratchID = try #require(tabs.selectedID)
            let opened = tabs.openReadOnly(file)
            let originalID = try #require(opened)
            let selectedScratch = tabs.select(scratchID)
            try #require(selectedScratch)
            let refusedScratch = tabs.makeEditableCopyOfSelection()
            #expect(refusedScratch == nil)
            tabs.setComposing(true, in: scratchID)
            #expect(tabs.select(originalID) == false)
            #expect(tabs.makeEditableCopyOfSelection() == nil)
            #expect(tabs.isComposing)
            #expect(tabs.selectedID == scratchID)
            #expect(tabs.tabs.map(\.id) == [scratchID, originalID])
            #expect(tabs.recoveryDrafts.isEmpty)
            tabs.setComposing(false, in: scratchID)
            let selectedOriginal = tabs.select(originalID)
            try #require(selectedOriginal)
            let created = tabs.makeEditableCopyOfSelection()
            let copyID = try #require(created)
            #expect(tabs.makeEditableCopyOfSelection() == nil)
            #expect(tabs.selectedID == copyID)
        }

        var empty = ScratchTabs(source: "")
        #expect(empty.requestCloseSelected() == .closed)
        #expect(empty.makeEditableCopyOfSelection() == nil)
        #expect(empty.selectedID == nil)
        #expect(empty.tabs.isEmpty)
    }

    @Test func copyCanFillTheLastSlotButCannotEvictATab() async throws {
        try await withSelectedFile(Data("原稿".utf8)) { file, _ in
            var tabs = ScratchTabs(source: "")
            let opened = tabs.openReadOnly(file)
            let originalID = try #require(opened)
            for _ in tabs.tabs.count..<(ScratchTabs.limit - 1) { tabs.newTab() }
            let selectedOriginal = tabs.select(originalID)
            try #require(selectedOriginal)
            let created = tabs.makeEditableCopyOfSelection()
            try #require(created != nil)
            #expect(tabs.tabs.count == ScratchTabs.limit)
            let reselectedOriginal = tabs.select(originalID)
            try #require(reselectedOriginal)
            let existingIDs = tabs.tabs.map(\.id)
            let existingDrafts = tabs.recoveryDrafts
            #expect(tabs.makeEditableCopyOfSelection() == nil)
            #expect(tabs.selectedID == originalID)
            #expect(tabs.tabs.map(\.id) == existingIDs)
            #expect(tabs.recoveryDrafts == existingDrafts)
        }
    }

    private func withSelectedFile(_ bytes: Data, test: (SelectedTextFile, URL) async throws -> Void) async throws {
        // The reader rejects even parent symlinks; resolve the host's temporary-directory alias.
        let resolved = FileManager.default.temporaryDirectory.withUnsafeFileSystemRepresentation { path in
            path.flatMap { Darwin.realpath($0, nil) }
        }
        let canonical = try #require(resolved)
        defer { free(canonical) }
        let root = URL(fileURLWithPath: String(cString: canonical), isDirectory: true)
        let folder = root.appending(path: "hazakura-copy-\(UUID())", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: false)
        defer { try? FileManager.default.removeItem(at: folder) }
        let url = folder.appending(path: "原稿.md")
        try bytes.write(to: url)
        try FileManager.default.setAttributes([.posixPermissions: 0o400], ofItemAtPath: url.path(percentEncoded: false))
        let file = try await SelectedTextFile.read(from: url)
        try await test(file, url)
    }
}
