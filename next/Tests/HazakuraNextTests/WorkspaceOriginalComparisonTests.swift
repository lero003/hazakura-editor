import AppKit
import Darwin
import Foundation
@testable import HazakuraNext
import HazakuraNextCore
import Testing

@MainActor
@Suite(.timeLimit(.minutes(1)))
struct WorkspaceOriginalComparisonTests {
    @Test func comparisonKeepsOpeningDiskAndDraftVersionsWithoutWritingAnyOfThem() async throws {
        try await withOriginal { url, baseline, session, documentID in
            let edited = "手元の編集\n"
            session.applyCommittedSource(edited, to: documentID)
            let external = Data("\u{FEFF}外部変更\r\n".utf8)
            try external.write(to: url)
            let recoveryBefore = session.tabs.recoveryDrafts

            session.requestOriginalComparison()
            let id = try #require(session.comparisonRequestID)
            #expect(session.isBusy)
            #expect(!session.canEditSource)
            session.requestSaveCopy()
            #expect(session.saveCopyRequest == nil)
            await session.readOriginalComparison(id) { try await SelectedTextFile.read(from: url) }

            let report = try #require(session.comparisonReport)
            #expect(report.id == id)
            #expect(report.comparison.diskStatus == .modified)
            #expect(report.comparison.baseline.originalBytes == baseline.originalBytes)
            #expect(report.comparison.disk.originalBytes == external)
            #expect(report.comparison.draftSource == edited)
            #expect(!report.comparison.draftMatchesDisk)
            #expect(try Data(contentsOf: url) == external)
            #expect(session.tabs.recoveryDrafts == recoveryBefore)
            #expect(session.tabs.selectedID == documentID)
            #expect(session.isBusy)
            session.dismissOriginalComparison(id)
            #expect(!session.isBusy)
            #expect(session.canEditSource)
        }
    }

    @Test func rejectsCancelledOrStaleResultsAndDoesNotIssueAnotherRead() async throws {
        try await withOriginal { _, baseline, session, documentID in
            session.tabs.setComposing(true, in: documentID)
            session.requestOriginalComparison()
            #expect(session.comparisonRequestID == nil)
            session.tabs.setComposing(false, in: documentID)

            session.requestOriginalComparison()
            let cancelled = try #require(session.comparisonRequestID)
            session.cancelOriginalComparison(cancelled)
            session.requestOriginalComparison()
            let active = try #require(session.comparisonRequestID)
            await session.readOriginalComparison(cancelled) {
                Issue.record("A cancelled request must not read the file.")
                return baseline
            }
            #expect(session.comparisonRequestID == active)
            await session.readOriginalComparison(active) {
                // Simulate a late callback from the native editor despite the UI edit gate.
                session.applyCommittedSource("さらに編集", to: documentID)
                return baseline
            }
            #expect(session.comparisonReport == nil)
            #expect(!session.isBusy)
            #expect(session.tabs.selectedTab?.document.source == "さらに編集")
            #expect(session.fileNotice != nil)
        }
    }

    @Test func cancellingAnInFlightReadDoesNotOverlapOrPublishALateComparison() async throws {
        try await withOriginal { _, baseline, session, _ in
            session.requestOriginalComparison()
            let id = try #require(session.comparisonRequestID)
            let began = AsyncStream<Void>.makeStream()
            let release = AsyncStream<Void>.makeStream()
            defer { began.continuation.finish(); release.continuation.finish() }
            let reading = Task {
                await session.readOriginalComparison(id) {
                    began.continuation.finish()
                    for await _ in release.stream {}
                    return baseline
                }
            }
            for await _ in began.stream {}
            await session.readOriginalComparison(id) {
                Issue.record("Only one reader can own the selection.")
                return baseline
            }
            session.cancelOriginalComparison(id)
            #expect(session.isBusy)
            session.requestOriginalComparison()
            #expect(session.comparisonRequestID == nil)
            release.continuation.finish()
            await reading.value
            #expect(session.comparisonReport == nil)
            #expect(!session.isBusy)

            session.requestOriginalComparison()
            let nextID = try #require(session.comparisonRequestID)
            await session.readOriginalComparison(nextID) { baseline }
            session.dismissOriginalComparison(id)
            #expect(session.comparisonReport?.id == nextID)
            session.dismissOriginalComparison(nextID)
            #expect(session.canEditSource)
        }
    }

    @Test func comparisonFailureAndPickerCancelDoNotShowAnUnchangedResult() async throws {
        try await withOriginal { _, _, session, documentID in
            session.applyCommittedSource("手元の編集", to: documentID)
            session.requestOriginalComparison()
            let cancelled = try #require(session.comparisonRequestID)
            await session.readOriginalComparison(cancelled) { nil }
            #expect(!session.isBusy)
            #expect(session.comparisonReport == nil)
            #expect(session.fileNotice == nil)
            session.requestOriginalComparison()
            let failed = try #require(session.comparisonRequestID)
            await session.readOriginalComparison(failed) { throw SelectedTextFile.ReadError.changedWhileReading }
            #expect(!session.isBusy)
            #expect(session.comparisonReport == nil)
            #expect(session.fileNotice != nil)
            #expect(session.tabs.selectedTab?.document.source == "手元の編集")
        }
    }

    private func withOriginal(
        _ body: (URL, SelectedTextFile, WorkspaceSession, UUID) async throws -> Void
    ) async throws {
        let root = FileManager.default.temporaryDirectory.withUnsafeFileSystemRepresentation { path in
            path.flatMap { Darwin.realpath($0, nil) }
        }
        let canonical = try #require(root)
        defer { free(canonical) }
        let directory = URL(fileURLWithPath: String(cString: canonical), isDirectory: true)
            .appending(path: "hazakura-compare-\(UUID())", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: false)
        defer { try? FileManager.default.removeItem(at: directory) }
        let url = directory.appending(path: "original.md")
        try Data("\u{FEFF}開いた時点\r\n".utf8).write(to: url)
        let baseline = try await SelectedTextFile.read(from: url)
        let session = WorkspaceSession(source: "サンプル")
        session.requestOriginalComparison()
        #expect(session.comparisonRequestID == nil)
        session.tabs.openReadOnly(baseline)
        session.makeEditableCopy()
        let id = try #require(session.tabs.selectedID)
        try await body(url, baseline, session, id)
    }
}
