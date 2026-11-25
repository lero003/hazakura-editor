import CryptoKit
import Darwin
import Foundation
import HazakuraNextCore
import Testing

struct DraftRecoveryStoreTests {
    private typealias StoreError = DraftRecoveryStore.StoreError

    @Test func reopensExactBytesWithoutTouchingAnOriginalFile() async throws {
        try await withFixture { folder in
            let original = folder.appending(path: "original.md")
            let originalBytes = Data("# 原本\r\n".utf8)
            try originalBytes.write(to: original)
            let directory = folder.appending(path: "recovery", directoryHint: .isDirectory)
            let first = DraftRecoveryStore(directory: directory)
            #expect(try await first.drafts().isEmpty)
            let draft = RecoveryDraft(id: UUID(), revision: .max, source: "\u{FEFF}# か\u{3099}\r\n🌸\n\r末尾")
            try await first.checkpoint(draft)

            let reopened = DraftRecoveryStore(directory: directory)
            let recovered = try await reopened.drafts()
            #expect(recovered == [draft])
            #expect(try await reopened.discard(draft))
            #expect(try await first.drafts().isEmpty)
            #expect(try await first.discard(draft) == false)
            #expect(try Data(contentsOf: original) == originalBytes)
            #expect(try permissions(of: directory) == 0o700)
            for name in ["drafts.manifest", "drafts.lock"] {
                #expect(try permissions(of: directory.appending(path: name)) == 0o600)
            }
        }
    }

    @Test func sameRevisionAndDiscardCompareExactUTF8AcrossInstances() async throws {
        try await withFixture { directory in
            let first = DraftRecoveryStore(directory: directory)
            let second = DraftRecoveryStore(directory: directory)
            let id = UUID()
            let old = RecoveryDraft(id: id, revision: 1, source: "が")
            let latest = RecoveryDraft(id: id, revision: 2, source: "が")
            let equivalent = RecoveryDraft(id: id, revision: 2, source: "か\u{3099}")
            #expect(latest.source == equivalent.source)
            #expect(latest != equivalent)

            try await first.checkpoint(old)
            try await second.checkpoint(latest)
            let manifest = directory.appending(path: "drafts.manifest")
            let bytes = try Data(contentsOf: manifest)
            try await first.checkpoint(latest) // Exact repeat is idempotent.
            await #expect(throws: StoreError.staleRevision) { try await first.checkpoint(old) }
            await #expect(throws: StoreError.revisionConflict) { try await first.checkpoint(equivalent) }
            #expect(try await first.discard(old) == false)
            #expect(try await first.discard(equivalent) == false)
            #expect(try Data(contentsOf: manifest) == bytes)
            #expect(try await second.drafts() == [latest])
            #expect(try await first.discard(latest))
            #expect(try await second.drafts().isEmpty)
        }
    }

    @Test func concurrentStoresDoNotLoseUpdatesOrOverwriteNewerRevisions() async throws {
        try await withFixture { directory in
            let first = DraftRecoveryStore(directory: directory)
            let second = DraftRecoveryStore(directory: directory)
            let independent = (0..<16).map { RecoveryDraft(id: UUID(), revision: 1, source: "draft \($0)") }
            let old = RecoveryDraft(id: UUID(), revision: 1, source: "old")
            let latest = RecoveryDraft(id: old.id, revision: 2, source: "latest")
            try await withThrowingTaskGroup(of: Void.self) { group in
                for (index, draft) in independent.enumerated() {
                    let store = index.isMultiple(of: 2) ? first : second
                    group.addTask { try await store.checkpoint(draft) }
                }
                group.addTask {
                    do { try await first.checkpoint(old) }
                    catch StoreError.staleRevision { /* The newer checkpoint won the race. */ }
                }
                group.addTask { try await second.checkpoint(latest) }
                try await group.waitForAll()
            }
            let reopened = DraftRecoveryStore(directory: directory)
            let drafts = try await reopened.drafts()
            #expect(drafts.count == independent.count + 1)
            #expect(independent.allSatisfy { drafts.contains($0) })
            #expect(drafts.contains(latest))
            #expect(try await first.discard(old) == false)
        }
    }

    @Test(arguments: [false, true])
    func corruptOrUnsupportedManifestRejectsAllOperationsWithoutReplacement(unsupportedVersion: Bool) async throws {
        try await withFixture { directory in
            let store = DraftRecoveryStore(directory: directory)
            let draft = RecoveryDraft(id: UUID(), revision: 1, source: "baseline")
            try await store.checkpoint(draft)
            let manifest = directory.appending(path: "drafts.manifest")
            var fixture = try Data(contentsOf: manifest)
            if unsupportedVersion {
                fixture.removeLast(SHA256.Digest.byteCount)
                fixture[11] = 2 // The big-endian version follows the eight-byte magic.
                fixture.append(contentsOf: SHA256.hash(data: fixture))
            } else {
                // Leave framing and UTF-8 intact while altering the payload.
                fixture[fixture.count - SHA256.Digest.byteCount - 1] ^= 1
            }
            try fixture.write(to: manifest)

            let reopened = DraftRecoveryStore(directory: directory)
            let error: StoreError = unsupportedVersion ? .unsupportedVersion : .corruptManifest
            await #expect(throws: error) { _ = try await reopened.drafts() }
            await #expect(throws: error) { try await reopened.checkpoint(draft) }
            await #expect(throws: error) { _ = try await reopened.discard(draft) }
            #expect(try Data(contentsOf: manifest) == fixture)
        }
    }

    @Test func rejectsRevisionZeroOnWriteAndOnRead() async throws {
        try await withFixture { directory in
            let store = DraftRecoveryStore(directory: directory)
            let invalid = RecoveryDraft(id: UUID(), revision: 0, source: "uncheckpointed")
            await #expect(throws: StoreError.invalidRevision) { try await store.checkpoint(invalid) }
            #expect(try await store.drafts().isEmpty)

            let valid = RecoveryDraft(id: invalid.id, revision: 1, source: invalid.source)
            try await store.checkpoint(valid)
            let manifest = directory.appending(path: "drafts.manifest")
            var bytes = try Data(contentsOf: manifest)
            bytes.removeLast(SHA256.Digest.byteCount)
            bytes[39] = 0 // Eight-byte revision after the 16-byte header and 16-byte UUID.
            let digest = SHA256.hash(data: bytes)
            bytes.append(contentsOf: digest)
            try bytes.write(to: manifest)
            await #expect(throws: StoreError.corruptManifest) { _ = try await store.drafts() }
            #expect(try Data(contentsOf: manifest) == bytes)
        }
    }

    @Test func byteBudgetAndEntryBudgetNeverEvictPreviouslyCommittedDrafts() async throws {
        try await withFixture { directory in
            let store = DraftRecoveryStore(directory: directory)
            let limit = 2 * 1024 * 1024
            let source = String(repeating: "é", count: limit / 2)
            let drafts = (0..<8).map { _ in RecoveryDraft(id: UUID(), revision: 1, source: source) }
            for draft in drafts { try await store.checkpoint(draft) }
            let first = try #require(drafts.first)
            let tooLarge = RecoveryDraft(id: first.id, revision: 2, source: source + "x")
            let overTotal = RecoveryDraft(id: UUID(), revision: 1, source: "x")
            await #expect(throws: StoreError.capacityExceeded) { try await store.checkpoint(tooLarge) }
            await #expect(throws: StoreError.capacityExceeded) { try await store.checkpoint(overTotal) }
            let afterRejections = try await store.drafts()
            #expect(afterRejections.count == drafts.count)
            #expect(drafts.allSatisfy { afterRejections.contains($0) })

            for draft in drafts { try await store.discard(draft) }
            for _ in 0..<32 { try await store.checkpoint(RecoveryDraft(id: UUID(), revision: 1, source: "")) }
            let full = try await store.drafts()
            await #expect(throws: StoreError.capacityExceeded) {
                try await store.checkpoint(RecoveryDraft(id: UUID(), revision: 1, source: ""))
            }
            #expect(try await store.drafts() == full)
        }
    }

    @Test func rejectsNonLocalAndLinkedDirectoriesIncludingAncestors() async throws {
        try await withFixture { folder in
            let real = folder.appending(path: "real", directoryHint: .isDirectory)
            try makePrivateDirectory(real)
            let link = folder.appending(path: "link", directoryHint: .isDirectory)
            try FileManager.default.createSymbolicLink(at: link, withDestinationURL: real)
            let draft = RecoveryDraft(id: UUID(), revision: 1, source: "untouched")
            for path in [link, link.appending(path: "new-store", directoryHint: .isDirectory)] {
                let store = DraftRecoveryStore(directory: path)
                await #expect(throws: StoreError.unsafeLocation) { try await store.checkpoint(draft) }
            }
            let remote = try #require(URL(string: "https://example.invalid/recovery"))
            let store = DraftRecoveryStore(directory: remote)
            await #expect(throws: StoreError.invalidLocation) { _ = try await store.drafts() }
            #expect(try FileManager.default.contentsOfDirectory(atPath: real.path).isEmpty)
        }
    }

    @Test(arguments: ["drafts.manifest", "drafts.lock", "drafts.pending"])
    func rejectsLinkedStorageEntriesWithoutTouchingTheirTarget(_ name: String) async throws {
        try await withFixture { folder in
            let directory = folder.appending(path: "recovery", directoryHint: .isDirectory)
            try makePrivateDirectory(directory)
            let outside = folder.appending(path: "outside.md")
            let bytes = Data("untouched".utf8)
            try bytes.write(to: outside)
            let store = DraftRecoveryStore(directory: directory)
            let baseline = RecoveryDraft(id: UUID(), revision: 1, source: "keep this draft")
            let manifest = directory.appending(path: "drafts.manifest")
            var original: Data?
            if name == "drafts.pending" {
                try await store.checkpoint(baseline)
                original = try Data(contentsOf: manifest)
            }
            let link = directory.appending(path: name)
            try FileManager.default.createSymbolicLink(at: link, withDestinationURL: outside)
            let draft = RecoveryDraft(id: baseline.id, revision: 2, source: "cannot commit")
            await #expect(throws: StoreError.unsafeLocation) { try await store.checkpoint(draft) }
            #expect(try FileManager.default.destinationOfSymbolicLink(atPath: link.path) == outside.path)
            #expect(try Data(contentsOf: outside) == bytes)
            if let original {
                #expect(try Data(contentsOf: manifest) == original)
                #expect(try await store.drafts() == [baseline])
            }
        }
    }

    @Test(arguments: ["directory", "manifest", "hard link"])
    func rejectsNonPrivateOrMultiplyLinkedStoreEntries(_ entry: String) async throws {
        try await withFixture { folder in
            let directory = folder.appending(path: "recovery", directoryHint: .isDirectory)
            let store = DraftRecoveryStore(directory: directory)
            let draft = RecoveryDraft(id: UUID(), revision: 1, source: "committed")
            try await store.checkpoint(draft)
            let manifest = directory.appending(path: "drafts.manifest")
            let original = try Data(contentsOf: manifest)
            switch entry {
            case "directory":
                try FileManager.default.setAttributes([.posixPermissions: 0o755], ofItemAtPath: directory.path)
            case "manifest":
                try FileManager.default.setAttributes([.posixPermissions: 0o644], ofItemAtPath: manifest.path)
            default:
                try FileManager.default.linkItem(at: manifest, to: folder.appending(path: "another-name"))
            }
            await #expect(throws: StoreError.unsafeLocation) { _ = try await store.drafts() }
            let next = RecoveryDraft(id: draft.id, revision: 2, source: "must not replace")
            await #expect(throws: StoreError.unsafeLocation) { try await store.checkpoint(next) }
            #expect(try Data(contentsOf: manifest) == original)
        }
    }

    @Test func rejectsFIFOAtManifestWithoutReadingFromIt() async throws {
        try await withFixture { directory in
            let manifest = directory.appending(path: "drafts.manifest")
            let created = manifest.withUnsafeFileSystemRepresentation { path in
                path.map { mkfifo($0, 0o600) } ?? -1
            }
            try #require(created == 0)
            let store = DraftRecoveryStore(directory: directory)
            await #expect(throws: StoreError.unsafeLocation) { _ = try await store.drafts() }
        }
    }

    @Test func ignoresInterruptedStagingUntilNextCommit() async throws {
        try await withFixture { directory in
            let store = DraftRecoveryStore(directory: directory)
            let draft = RecoveryDraft(id: UUID(), revision: 1, source: "committed")
            try await store.checkpoint(draft)
            let stage = directory.appending(path: "drafts.pending")
            try Data("partial".utf8).write(to: stage)
            try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: stage.path)
            let reopened = DraftRecoveryStore(directory: directory)
            #expect(try await reopened.drafts() == [draft])
            #expect(try await reopened.discard(draft))
            #expect(FileManager.default.fileExists(atPath: stage.path) == false)
        }
    }

    @Test func defaultLocationIsDedicatedToTheSecondGeneration() throws {
        let url = try DraftRecoveryStore.defaultDirectory() // Resolve only; never open or create it.
        #expect(url.isFileURL)
        #expect(url.lastPathComponent == "dev.hazakura.editor.next.dev.draft-recovery")
        #expect(url.deletingLastPathComponent().lastPathComponent == "Application Support")
    }

    private func permissions(of url: URL) throws -> Int {
        let attributes = try FileManager.default.attributesOfItem(atPath: url.path)
        return try #require(attributes[.posixPermissions] as? NSNumber).intValue
    }

    private func makePrivateDirectory(_ url: URL) throws {
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: false,
                                                attributes: [.posixPermissions: 0o700])
    }

    private func withFixture(_ test: (URL) async throws -> Void) async throws {
        let resolved = FileManager.default.temporaryDirectory.withUnsafeFileSystemRepresentation { path in
            path.flatMap { Darwin.realpath($0, nil) }
        }
        let canonical = try #require(resolved)
        defer { free(canonical) }
        let root = URL(fileURLWithPath: String(cString: canonical), isDirectory: true)
        let folder = root.appending(path: "hazakura-recovery-\(UUID())", directoryHint: .isDirectory)
        try makePrivateDirectory(folder)
        defer { try? FileManager.default.removeItem(at: folder) }
        try await test(folder)
    }
}
