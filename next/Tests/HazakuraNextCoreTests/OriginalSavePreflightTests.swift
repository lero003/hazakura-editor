import Darwin
import Foundation
@testable import HazakuraNextCore
import Testing

struct OriginalSavePreflightTests {
    @Test func confirmedUnchangedTargetIsCheckedButNeverWritten() async throws {
        try await withOriginal { url, baseline in
            let draft = "新しい原文 か\u{3099}\r\n"
            let result = try await OriginalSavePreflight.check(baseline: baseline, draftSource: draft, at: url) { review in
                #expect(review.disk.originalBytes == baseline.originalBytes)
                #expect(review.proposedBytes == Data(("\u{FEFF}" + draft).utf8))
                try Self.expectBytes(baseline.originalBytes, at: url)
                return true
            }
            #expect(result == .checkedWithoutWriting)
            try Self.expectBytes(baseline.originalBytes, at: url)
        }
    }

    @Test func canonicallyEquivalentDraftStillRequiresConsentIfItsBytesDiffer() async throws {
        try await withOriginal { url, baseline in
            let draft = "開いた時点 が\r\n"
            #expect(draft == baseline.source)
            let result = try await OriginalSavePreflight.check(baseline: baseline, draftSource: draft, at: url) { review in
                #expect(review.proposedBytes != review.disk.originalBytes)
                #expect(review.proposedBytes == Data(("\u{FEFF}" + draft).utf8))
                return false
            }
            #expect(result == .declined)
            try Self.expectBytes(baseline.originalBytes, at: url)
        }
    }

    @Test func noChangeAndDeclinedDoNotProduceAConfirmedCheck() async throws {
        try await withOriginal { url, baseline in
            let noChange = try await OriginalSavePreflight.check(baseline: baseline, draftSource: baseline.source, at: url) { _ in
                Issue.record("No byte-level change should not ask for approval.")
                return true
            }
            #expect(noChange == .noChanges)
            let declined = try await OriginalSavePreflight.check(baseline: baseline, draftSource: "新しい原文", at: url) { _ in false }
            #expect(declined == .declined)
            try Self.expectBytes(baseline.originalBytes, at: url)
        }
    }

    @Test func wrongFileWithIdenticalBytesIsRefusedBeforeConfirmation() async throws {
        try await withOriginal { url, baseline in
            let other = url.deletingLastPathComponent().appending(path: "other.md")
            try baseline.originalBytes.write(to: other)
            await #expect(throws: OriginalSavePreflight.Rejection.differentFile) {
                try await OriginalSavePreflight.check(baseline: baseline, draftSource: "下書き", at: other) { _ in
                    Issue.record("A different file must not reach confirmation.")
                    return true
                }
            }
            try Self.expectBytes(baseline.originalBytes, at: url)
            try Self.expectBytes(baseline.originalBytes, at: other)
        }
    }

    @Test func bytesAlreadyChangedAreNeverPresentedAsWritable() async throws {
        try await withOriginal { url, baseline in
            let external = Data("\u{FEFF}外部の変更\r\n".utf8)
            try external.write(to: url)
            await #expect(throws: OriginalSavePreflight.Rejection.changedSinceOpening) {
                try await OriginalSavePreflight.check(baseline: baseline, draftSource: "手元の原稿", at: url) { _ in
                    Issue.record("A modified original must not reach confirmation.")
                    return true
                }
            }
            try Self.expectBytes(external, at: url)
        }
    }

    @Test func identicalObservedMetadataDoesNotReplaceTheFullByteCheck() async throws {
        try await withOriginal { url, baseline in
            // Isolate byte equality from the metadata check; a real fixture write changes ctime.
            var differentBytes = baseline.originalBytes
            differentBytes[differentBytes.startIndex + 3] ^= 1
            let savedBaseline = SelectedTextFile(name: baseline.name, source: baseline.source, format: baseline.format,
                                                 originalBytes: differentBytes, version: baseline.version)
            await #expect(throws: OriginalSavePreflight.Rejection.changedSinceOpening) {
                try await OriginalSavePreflight.check(baseline: savedBaseline, draftSource: "編集済み", at: url) { _ in
                    Issue.record("Equal metadata alone is not enough to confirm.")
                    return true
                }
            }
            try Self.expectBytes(baseline.originalBytes, at: url)
        }
    }

    @Test func metadataOnlyChangeIsAlsoAConservativeConflict() async throws {
        try await withOriginal { url, baseline in
            try FileManager.default.setAttributes([.modificationDate: Date(timeIntervalSince1970: 1_600_000_000)],
                                                  ofItemAtPath: url.path(percentEncoded: false))
            await #expect(throws: OriginalSavePreflight.Rejection.changedSinceOpening) {
                try await OriginalSavePreflight.check(baseline: baseline, draftSource: "編集済み", at: url) { _ in
                    Issue.record("Metadata changes must not authorize an original-file write.")
                    return true
                }
            }
            try Self.expectBytes(baseline.originalBytes, at: url)
        }
    }

    @Test func detectsAnExternalEditWhileConfirmationIsOpen() async throws {
        try await withOriginal { url, baseline in
            let external = Data("\u{FEFF}外部の変更\r\n".utf8)
            await #expect(throws: OriginalSavePreflight.Rejection.changedDuringConfirmation) {
                try await OriginalSavePreflight.check(baseline: baseline, draftSource: "手元の原稿", at: url) { _ in
                    try external.write(to: url)
                    return true
                }
            }
            try Self.expectBytes(external, at: url)
        }
    }

    @Test func detectsAReplacementWithIdenticalBytesWhileConfirmationIsOpen() async throws {
        try await withOriginal { url, baseline in
            await #expect(throws: OriginalSavePreflight.Rejection.changedDuringConfirmation) {
                try await OriginalSavePreflight.check(baseline: baseline, draftSource: "新しい原文", at: url) { _ in
                    let replacement = url.deletingLastPathComponent().appending(path: "replacement.md")
                    try baseline.originalBytes.write(to: replacement)
                    // Synthetic, owned fixture only. Confirm the object is changed independently of bytes.
                    let original = url.deletingLastPathComponent().appending(path: "old.md")
                    try FileManager.default.moveItem(at: url, to: original)
                    try FileManager.default.moveItem(at: replacement, to: url)
                    return true
                }
            }
            try Self.expectBytes(baseline.originalBytes, at: url)
        }
    }

    @Test func aMissingTargetAfterConfirmationIsNotRecreated() async throws {
        try await withOriginal { url, baseline in
            let moved = url.deletingLastPathComponent().appending(path: "moved.md")
            await #expect(throws: SelectedTextFile.ReadError.accessDenied) {
                try await OriginalSavePreflight.check(baseline: baseline, draftSource: "新稿", at: url) { _ in
                    try FileManager.default.moveItem(at: url, to: moved)
                    return true
                }
            }
            #expect(!FileManager.default.fileExists(atPath: url.path(percentEncoded: false)))
            try Self.expectBytes(baseline.originalBytes, at: moved)
        }
    }

    @Test func cancellationAfterConsentDoesNotReturnACheckedResult() async throws {
        try await withOriginal { url, baseline in
            let operation = Task {
                try await OriginalSavePreflight.check(baseline: baseline, draftSource: "新稿", at: url) { _ in
                    withUnsafeCurrentTask { $0?.cancel() }
                    return true
                }
            }
            await #expect(throws: CancellationError.self) { try await operation.value }
            try Self.expectBytes(baseline.originalBytes, at: url)
        }
    }

    @Test func rejectsDraftThatCannotBeRepresentedBeforeAskingForConsent() async throws {
        try await withOriginal { url, baseline in
            await #expect(throws: SelectedTextCopyWriter.WriteError.invalidText) {
                try await OriginalSavePreflight.check(baseline: baseline, draftSource: "本文\u{1B}", at: url) { _ in
                    Issue.record("Unsupported text must be rejected before confirmation.")
                    return true
                }
            }
            try Self.expectBytes(baseline.originalBytes, at: url)
        }
    }

    private static func expectBytes(_ expected: Data, at url: URL, sourceLocation: SourceLocation = #_sourceLocation) throws {
        let bytes = try Data(contentsOf: url)
        #expect(bytes == expected, sourceLocation: sourceLocation)
    }

    private func withOriginal(_ body: (URL, SelectedTextFile) async throws -> Void) async throws {
        let root = FileManager.default.temporaryDirectory.withUnsafeFileSystemRepresentation { path in
            path.flatMap { Darwin.realpath($0, nil) }
        }
        let canonical = try #require(root)
        defer { free(canonical) }
        let folder = URL(fileURLWithPath: String(cString: canonical), isDirectory: true)
            .appending(path: "hazakura-original-save-\(UUID())", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: false)
        defer { try? FileManager.default.removeItem(at: folder) }
        let url = folder.appending(path: "original.md")
        try Data("\u{FEFF}開いた時点 か\u{3099}\r\n".utf8).write(to: url)
        let baseline = try await SelectedTextFile.read(from: url)
        try await body(url, baseline)
    }
}
