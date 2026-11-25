import Darwin
import Foundation
import HazakuraNextCore
import Testing

struct OriginalFileComparisonTests {
    private static let bom = Data([0xEF, 0xBB, 0xBF])

    @Test func unchangedReselectMatchesExactMixedBytes() async throws {
        try await withFixture { folder in
            let url = folder.appending(path: "original.md")
            let source = "# か\u{3099}\r\n🌸\n末尾\r"
            let bytes = Self.bom + Data(source.utf8)
            try bytes.write(to: url)
            let baseline = try await SelectedTextFile.read(from: url)
            let reselected = try await SelectedTextFile.read(from: url)
            let comparison = OriginalFileComparison(baseline: baseline, disk: reselected, draftSource: source)

            #expect(comparison.baseline.originalBytes == bytes)
            #expect(comparison.disk.originalBytes == bytes)
            #expect(comparison.draftSource.utf8.elementsEqual(source.utf8))
            #expect(comparison.disk.format.lineEndings == .mixed)
            #expect(comparison.diskStatus == .unchanged)
            #expect(comparison.draftByteStatus == .compared(matchesBaseline: true, matchesDisk: true))

            let precomposed = "# が\r\n🌸\n末尾\r"
            try #require(precomposed == source)
            for draft in [precomposed, "# か\u{3099}\n🌸\n末尾\n"] {
                let changed = OriginalFileComparison(baseline: baseline, disk: reselected, draftSource: draft)
                #expect(changed.diskStatus == .unchanged)
                #expect(changed.draftByteStatus == .compared(matchesBaseline: false, matchesDisk: false))
            }
            #expect(try Data(contentsOf: url) == bytes)
        }
    }

    @Test func inPlaceExternalEditUpdatesDiskStatusIndependentlyOfDraft() async throws {
        try await withFixture { folder in
            let url = folder.appending(path: "original.txt")
            let source = "first\r\n"
            let updated = "later\r\n"
            try Data(source.utf8).write(to: url)
            let baseline = try await SelectedTextFile.read(from: url)
            try Data(updated.utf8).write(to: url, options: [])
            let disk = try await SelectedTextFile.read(from: url)
            try #require(baseline.identity == disk.identity)

            let originalDraft = OriginalFileComparison(baseline: baseline, disk: disk, draftSource: source)
            #expect(originalDraft.diskStatus == .modified)
            #expect(originalDraft.draftByteStatus == .compared(matchesBaseline: true, matchesDisk: false))

            let revisedDraft = OriginalFileComparison(baseline: baseline, disk: disk, draftSource: updated)
            #expect(revisedDraft.diskStatus == .modified)
            #expect(revisedDraft.draftByteStatus == .compared(matchesBaseline: false, matchesDisk: true))
            #expect(try Data(contentsOf: url) == Data(updated.utf8))
        }
    }

    @Test func separateAndReplacementInodesAreDifferentEvenWithEqualBytes() async throws {
        try await withFixture { folder in
            let original = folder.appending(path: "original.txt")
            let separate = folder.appending(path: "separate.txt")
            let source = "same bytes\n"
            let bytes = Data(source.utf8)
            try bytes.write(to: original)
            try bytes.write(to: separate)
            let baseline = try await SelectedTextFile.read(from: original)
            let otherFile = try await SelectedTextFile.read(from: separate)

            try bytes.write(to: original, options: .atomic)
            let replacement = try await SelectedTextFile.read(from: original)
            try #require(replacement.name == baseline.name)
            for disk in [otherFile, replacement] {
                try #require(disk.identity != baseline.identity)
                let comparison = OriginalFileComparison(baseline: baseline, disk: disk, draftSource: source)
                #expect(comparison.diskStatus == .differentIdentity)
                #expect(comparison.draftByteStatus == .compared(matchesBaseline: true, matchesDisk: true))
            }

            try Data("changed\n".utf8).write(to: separate)
            let changedOther = try await SelectedTextFile.read(from: separate)
            let comparison = OriginalFileComparison(baseline: baseline, disk: changedOther, draftSource: source)
            #expect(comparison.diskStatus == .differentIdentity)
            #expect(comparison.draftByteStatus == .compared(matchesBaseline: true, matchesDisk: false))
        }
    }

    @Test func differentNameDoesNotOverrideMatchingIdentityAndBytes() async throws {
        try await withFixture { folder in
            let original = folder.appending(path: "original.txt")
            let alias = folder.appending(path: "alias.txt")
            let source = "原稿"
            try Data(source.utf8).write(to: original)
            let baseline = try await SelectedTextFile.read(from: original)
            try FileManager.default.linkItem(at: original, to: alias)
            let disk = try await SelectedTextFile.read(from: alias)
            try #require(disk.name != baseline.name)
            try #require(disk.identity == baseline.identity)
            let comparison = OriginalFileComparison(baseline: baseline, disk: disk, draftSource: source)
            #expect(comparison.diskStatus == .unchanged)
        }
    }

    @Test func bomOnlyDiskChangeIsAByteChangeDespiteIdenticalDecodedSource() async throws {
        try await withFixture { folder in
            let url = folder.appending(path: "original.txt")
            let source = "a\r\nb\nc\r"
            let body = Data(source.utf8)
            try (Self.bom + body).write(to: url)
            let baseline = try await SelectedTextFile.read(from: url)
            try body.write(to: url, options: [])
            let disk = try await SelectedTextFile.read(from: url)
            try #require(baseline.source.utf8.elementsEqual(disk.source.utf8))
            let comparison = OriginalFileComparison(baseline: baseline, disk: disk, draftSource: source)
            #expect(comparison.diskStatus == .modified)
            #expect(comparison.draftByteStatus == .compared(matchesBaseline: true, matchesDisk: false))
        }
    }

    @Test(arguments: [false, true])
    func literalLeadingFEFFContributesBytesAlongsideTheBaselineBOM(hasBaselineBOM: Bool) async throws {
        try await withFixture { folder in
            let url = folder.appending(path: "original.txt")
            let source = "a\r\nb\nc\r"
            let draft = "\u{FEFF}" + source
            let body = Data(source.utf8)
            let prefix = hasBaselineBOM ? Self.bom : Data()
            try (prefix + body).write(to: url)
            let baseline = try await SelectedTextFile.read(from: url)
            try (prefix + Self.bom + body).write(to: url, options: [])
            let disk = try await SelectedTextFile.read(from: url)
            #expect(disk.format.encoding == .utf8BOM)
            #expect(disk.source.utf8.elementsEqual((hasBaselineBOM ? draft : source).utf8))
            let comparison = OriginalFileComparison(baseline: baseline, disk: disk, draftSource: draft)
            #expect(comparison.diskStatus == .modified)
            #expect(comparison.draftByteStatus == .compared(matchesBaseline: false, matchesDisk: true))
        }
    }

    @Test func utf16SaveLimitIncludesTheBOMWhenComparingDraftBytes() async throws {
        try await withFixture { folder in
            let url = folder.appending(path: "original.txt")
            let originalBytes = Data([0xFE, 0xFF, 0, 0x61])
            try originalBytes.write(to: url)
            let baseline = try await SelectedTextFile.read(from: url)
            let fits = String(repeating: "a", count: SelectedTextFile.byteLimit / 2 - 1)
            let atLimit = OriginalFileComparison(baseline: baseline, disk: baseline, draftSource: fits)
            let tooLarge = OriginalFileComparison(baseline: baseline, disk: baseline, draftSource: fits + "a")

            #expect(atLimit.draftByteStatus == .compared(matchesBaseline: false, matchesDisk: false))
            #expect(tooLarge.draftByteStatus == .tooLarge)
            #expect(tooLarge.diskStatus == .unchanged)
            #expect(try Data(contentsOf: url) == originalBytes)
        }
    }

    @Test func unsavableDraftDoesNotTurnAnObservedDiskChangeIntoAMismatchReport() async throws {
        try await withFixture { folder in
            let url = folder.appending(path: "original.txt")
            try Data("原本\n".utf8).write(to: url)
            let baseline = try await SelectedTextFile.read(from: url)
            let updated = Data("外部編集\n".utf8)
            try updated.write(to: url, options: [])
            let disk = try await SelectedTextFile.read(from: url)
            let draft = "編集\u{0}\r\n"
            let comparison = OriginalFileComparison(baseline: baseline, disk: disk, draftSource: draft)

            #expect(comparison.draftByteStatus == .unavailable)
            #expect(comparison.draftSource.utf8.elementsEqual(draft.utf8))
            #expect(comparison.diskStatus == .modified)
            #expect(try Data(contentsOf: url) == updated)
        }
    }

    @Test func copyRetainsBaselineAfterOriginalClosesWithoutSharingRecovery() async throws {
        try await withFixture { folder in
            let url = folder.appending(path: "original.txt")
            let source = "原稿\r\n次の行\n"
            let bytes = Self.bom + Data(source.utf8)
            try bytes.write(to: url)
            let original = try await SelectedTextFile.read(from: url)
            var tabs = ScratchTabs(source: "")
            let opened = tabs.openReadOnly(original)
            let originalID = try #require(opened)
            let createdFirst = tabs.makeEditableCopyOfSelection()
            let firstCopyID = try #require(createdFirst)
            let firstDraft = try #require(tabs.recoveryDraft(for: firstCopyID))
            let selectedOriginal = tabs.select(originalID)
            try #require(selectedOriginal)
            let createdSecond = tabs.makeEditableCopyOfSelection()
            let secondCopyID = try #require(createdSecond)
            let secondDraft = try #require(tabs.recoveryDraft(for: secondCopyID))
            #expect(firstDraft.id != secondDraft.id)
            #expect(tabs.recoveryDraft(for: originalID) == nil)

            let reselectedOriginal = tabs.select(originalID)
            try #require(reselectedOriginal)
            #expect(tabs.requestCloseSelected() == .closed)
            #expect(tabs.tabs.contains { $0.id == originalID } == false)
            let edited = tabs.applyCommittedSource("編集後", to: firstCopyID)
            let editedDraft = try #require(edited)
            #expect(editedDraft.id == firstDraft.id)
            #expect(tabs.recoveryDraft(for: secondCopyID) == secondDraft)
            let firstCopy = try #require(tabs.tabs.first { $0.id == firstCopyID })
            let origin = try #require(firstCopy.copyOrigin)
            #expect(firstCopy.isReadOnly == false)
            #expect(firstCopy.selectedFile == nil)
            #expect(origin.baseline.identity == original.identity)
            #expect(origin.baseline.originalBytes == bytes)
            #expect(origin.name == original.name)
            #expect(origin.format.encoding == .utf8BOM)
            #expect(origin.format.lineEndings == .mixed)

            let disk = try await SelectedTextFile.read(from: url)
            let comparison = OriginalFileComparison(baseline: origin.baseline, disk: disk, draftSource: firstCopy.document.source)
            #expect(comparison.diskStatus == .unchanged)
            #expect(comparison.draftByteStatus == .compared(matchesBaseline: false, matchesDisk: false))
            #expect(tabs.recoveryDrafts == [editedDraft, secondDraft])

            let restored = tabs.restoreDraft(editedDraft)
            let restoredID = try #require(restored)
            let restoredDraft = try #require(tabs.recoveryDraft(for: restoredID))
            #expect(restoredDraft.id != editedDraft.id)
            #expect(tabs.selectedTab?.copyOrigin == nil)
            #expect(try Data(contentsOf: url) == bytes)
        }
    }

    private func withFixture(_ test: (URL) async throws -> Void) async throws {
        // The reader rejects even parent symlinks, including the host's temporary-directory alias.
        let resolved = FileManager.default.temporaryDirectory.withUnsafeFileSystemRepresentation { path in
            path.flatMap { Darwin.realpath($0, nil) }
        }
        let canonical = try #require(resolved)
        defer { free(canonical) }
        let root = URL(fileURLWithPath: String(cString: canonical), isDirectory: true)
        let folder = root.appending(path: "hazakura-compare-\(UUID())", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: false)
        defer { try? FileManager.default.removeItem(at: folder) }
        try await test(folder)
    }
}
