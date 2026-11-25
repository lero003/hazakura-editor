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
            #expect(report.comparison.draftByteStatus == .compared(matchesBaseline: false, matchesDisk: false))
            #expect(try Data(contentsOf: url) == external)
            #expect(session.tabs.recoveryDrafts == recoveryBefore)
            #expect(session.tabs.selectedID == documentID)
            #expect(session.isBusy)
            session.dismissOriginalComparison(id)
            #expect(!session.isBusy)
            #expect(session.canEditSource)
        }
    }

    @Test func lineDiffUsesTheChosenSnapshotsWithoutChangingTheDraftOrOriginal() async throws {
        try await withOriginal { url, baseline, session, documentID in
            let draft = "編集版\r"
            session.applyCommittedSource(draft, to: documentID)
            let diskBytes = Data("ディスク版\n".utf8)
            try diskBytes.write(to: url)
            let recoveryBefore = session.tabs.recoveryDrafts
            session.requestOriginalComparison()
            let id = try #require(session.comparisonRequestID)
            await session.readOriginalComparison(id) { try await SelectedTextFile.read(from: url) }
            let report = try #require(session.comparisonReport)
            let pairs: [(ComparisonLineDiffPair, String, String)] = [
                (.baselineToDisk, baseline.source, "ディスク版\n"),
                (.baselineToDraft, baseline.source, draft),
                (.diskToDraft, "ディスク版\n", draft),
            ]
            for (pair, before, after) in pairs {
                let sources = pair.sources(in: report.comparison)
                let result = try await LineDiff.compare(before: sources.before, after: sources.after)
                guard case .rows(let rows) = result else {
                    Issue.record("Different captured versions should yield line rows.")
                    continue
                }
                let restoredBefore = rows.filter { $0.beforeLine != nil }.map { $0.text + suffix($0.ending) }.joined()
                let restoredAfter = rows.filter { $0.afterLine != nil }.map { $0.text + suffix($0.ending) }.joined()
                #expect(Data(restoredBefore.utf8) == Data(before.utf8))
                #expect(Data(restoredAfter.utf8) == Data(after.utf8))
            }
            #expect(try Data(contentsOf: url) == diskBytes)
            #expect(session.tabs.recoveryDrafts == recoveryBefore)
            #expect(session.tabs.selectedID == documentID)
        }
    }

    @Test(arguments: [false, true])
    func encodingOnlyChangeKeepsTheByteMismatchEvenWhenLineBodiesMatch(_ utf16: Bool) async throws {
        try await withOriginal { url, baseline, session, _ in
            let changed = utf16
                ? Data([0xFE, 0xFF]) + (try #require(baseline.source.data(using: .utf16BigEndian)))
                : Data(baseline.source.utf8)
            try changed.write(to: url)
            session.requestOriginalComparison()
            let id = try #require(session.comparisonRequestID)
            await session.readOriginalComparison(id) { try await SelectedTextFile.read(from: url) }
            let comparison = try #require(session.comparisonReport).comparison
            let sources = ComparisonLineDiffPair.baselineToDisk.sources(in: comparison)
            let result = try await LineDiff.compare(before: sources.before, after: sources.after)
            #expect(result == .identical)
            #expect(comparison.diskStatus == .modified)
            #expect(comparison.baseline.format.encoding == .utf8BOM)
            #expect(comparison.disk.format.encoding == (utf16 ? .utf16BE : .utf8))
            #expect(comparison.draftByteStatus == .compared(matchesBaseline: true, matchesDisk: false))
        }
    }

    private func suffix(_ ending: LineDiff.Row.Ending) -> String {
        switch ending {
        case .none: ""
        case .lf: "\n"
        case .crlf: "\r\n"
        case .cr: "\r"
        }
    }

    @Test func nativeCompositionBlocksARequestAndADeferredPicker() async throws {
        try await withOriginal { _, baseline, session, documentID in
            let (window, view) = try attachNativeEditor(to: session)
            defer { window.close() }
            markText(in: view)
            try #require(view.hasMarkedText() && !session.tabs.isComposing)
            #expect(!session.canCompareOriginal)
            session.requestOriginalComparison()
            try #require(session.comparisonRequestID == nil)

            view.unmarkText()
            session.requestOriginalComparison()
            let id = try #require(session.comparisonRequestID)
            markText(in: view)
            await session.readOriginalComparison(id) {
                Issue.record("A deferred picker must not run while the editor is composing.")
                return baseline
            }
            #expect(!session.isBusy)
            #expect(session.comparisonReport == nil)
            #expect(session.tabs.selectedID == documentID)
            #expect(view.hasMarkedText())
        }
    }

    enum NativeCompositionStart: CaseIterable {
        case whileReading, whileComparing
    }

    @Test(arguments: NativeCompositionStart.allCases)
    func nativeCompositionKeepsTheDraftAndRequiresAnotherComparison(_ start: NativeCompositionStart) async throws {
        try await withOriginal { url, _, session, documentID in
            let (window, view) = try attachNativeEditor(to: session)
            defer { window.close() }
            session.applyCommittedSource("手元の確定原稿", to: documentID)
            let drafts = session.tabs.recoveryDrafts
            let external = Data("外部の変更\r\n".utf8)
            try external.write(to: url)
            session.requestOriginalComparison()
            let id = try #require(session.comparisonRequestID)

            var ranges: [NSRange] = []
            var compared = false
            @MainActor func beginComposition() {
                markText(in: view)
                #expect(view.hasMarkedText() && !session.tabs.isComposing)
                ranges = [view.selectedRange(), view.markedRange()]
            }
            await session.readOriginalComparison(id, using: {
                let disk = try await SelectedTextFile.read(from: url)
                if start == .whileReading { beginComposition() }
                return disk
            }, compare: { baseline, disk, draft in
                compared = true
                if start == .whileComparing { beginComposition() }
                return OriginalFileComparison(baseline: baseline, disk: disk, draftSource: draft)
            })
            #expect(compared == (start == .whileComparing))
            try #require(session.comparisonReport == nil)
            #expect(!session.isBusy)
            #expect(session.fileNotice?.contains("変換") == true)
            #expect(session.tabs.selectedID == documentID)
            #expect(session.tabs.recoveryDrafts == drafts)
            #expect(window.firstResponder === view)
            #expect([view.selectedRange(), view.markedRange()] == ranges)
            #expect(try Data(contentsOf: url) == external)

            view.unmarkText()
            let report = try await captureComparison(in: session, from: url)
            #expect(report.id != id)
            #expect(report.comparison.disk.originalBytes == external)
        }
    }

    @Test func nativeCompositionPreventsOpeningTheCapturedDiskVersionWithoutConsumingIt() async throws {
        try await withOriginal { url, _, session, _ in
            let (window, view) = try attachNativeEditor(to: session)
            defer { window.close() }
            try Data("外部の変更\r\n".utf8).write(to: url)
            let report = try await captureComparison(in: session, from: url)
            try #require(report.comparison.diskStatus == .modified)
            markText(in: view)
            try #require(view.hasMarkedText() && !session.tabs.isComposing)

            expectOpenRejected(in: session, requestedID: report.id, retainedReportID: report.id)
            #expect(view.hasMarkedText())
            view.unmarkText()
            try #require(session.openComparedDisk(report.id) != nil)
            #expect(session.tabs.selectedTab?.isReadOnly == true)
            #expect(session.comparisonReport == nil)
        }
    }

    private func attachNativeEditor(to session: WorkspaceSession) throws -> (NSWindow, NSTextView) {
        _ = NSApplication.shared
        let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 300, height: 200),
                              styleMask: [.titled], backing: .buffered, defer: true)
        window.isReleasedWhenClosed = false
        let view = NSTextView(frame: NSRect(x: 0, y: 0, width: 300, height: 200))
        window.contentView = view
        try #require(window.makeFirstResponder(view))
        session.window = window
        return (window, view)
    }

    private func markText(in view: NSTextView) {
        view.setMarkedText("候補", selectedRange: NSRange(location: 2, length: 0),
                           replacementRange: NSRange(location: NSNotFound, length: 0))
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

    enum ChangeDuringComparison: CaseIterable {
        case cancelRequest, cancelTask, edit, compose
    }

    @Test(arguments: ChangeDuringComparison.allCases)
    func revalidatesBeforePublishingAComputedComparison(_ change: ChangeDuringComparison) async throws {
        try await withOriginal { _, baseline, session, documentID in
            session.requestOriginalComparison()
            let id = try #require(session.comparisonRequestID)
            let began = AsyncStream<Void>.makeStream()
            let release = AsyncStream<Void>.makeStream()
            defer { began.continuation.finish(); release.continuation.finish() }
            let operation = Task {
                await session.readOriginalComparison(id, using: { baseline }, compare: { opened, disk, draft in
                    began.continuation.finish()
                    for await _ in release.stream {}
                    return OriginalFileComparison(baseline: opened, disk: disk, draftSource: draft)
                })
                began.continuation.finish()
            }
            for await _ in began.stream {}
            #expect(session.isBusy)
            #expect(!session.isFinishingCancelledComparison)
            switch change {
            case .cancelRequest:
                session.cancelOriginalComparison(id)
                #expect(session.isBusy)
                #expect(session.isFinishingCancelledComparison)
                #expect(!session.canEditSource)
                session.requestOriginalComparison()
                #expect(session.comparisonRequestID == nil)
            case .cancelTask: operation.cancel()
            case .edit: session.applyCommittedSource("比較中に確定した文", to: documentID)
            case .compose: session.tabs.setComposing(true, in: documentID)
            }
            release.continuation.finish()
            await operation.value

            #expect(session.comparisonReport == nil)
            #expect(session.comparisonRequestID == nil)
            #expect(!session.isBusy)
            #expect(!session.isFinishingCancelledComparison)
            #expect((session.fileNotice != nil) == (change == .edit || change == .compose))
            if change == .compose { #expect(session.tabs.isComposing) }
            if change == .edit { #expect(session.tabs.selectedTab?.document.source == "比較中に確定した文") }
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

    @Test func opensCapturedDiskOnceAsSeparateReadOnlyTabEvenAfterAnotherDiskEdit() async throws {
        try await withOriginal { url, baseline, session, documentID in
            session.applyCommittedSource("手元の編集\n", to: documentID)
            let capturedSource = "外部変更\r\n次の行\r最後の行\n"
            let capturedBytes = Data([0xFE, 0xFF]) + (try #require(capturedSource.data(using: .utf16BigEndian)))
            try capturedBytes.write(to: url, options: []) // Keep the file identity; only change its bytes.
            while session.tabs.tabs.count < 7 {
                let added = session.tabs.newTab()
                try #require(added != nil)
            }
            let selectedDraft = session.tabs.select(documentID)
            try #require(selectedDraft)
            let oldTabs = session.tabs.tabs
            let oldDraft = try #require(session.tabs.selectedTab)
            let recoveryBefore = session.tabs.recoveryDrafts
            let report = try await captureComparison(in: session, from: url)
            try #require(report.comparison.diskStatus == .modified)
            #expect(report.comparison.disk.identity == baseline.identity)
            #expect(report.comparison.disk.originalBytes == capturedBytes)

            let latestBytes = Data("比較後の外部変更\n".utf8)
            try latestBytes.write(to: url, options: [])
            #expect(session.canOpenComparedDisk(report.id))
            #expect(session.comparisonReport?.id == report.id)
            let openedID = try #require(session.openComparedDisk(report.id))

            #expect(session.comparisonReport == nil)
            #expect(session.isBusy == false)
            #expect(session.tabs.selectedID == openedID)
            #expect(session.tabs.tabs.count == 8)
            #expect(session.tabs.tabs.filter { $0.id != openedID }.map(\.id) == oldTabs.map(\.id))
            let opened = try #require(session.tabs.selectedTab)
            let openedSnapshot = try #require(opened.selectedFile)
            #expect(opened.isReadOnly)
            #expect(WorkspaceSession.title(for: opened) == "比較時：\(baseline.name)")
            #expect(opened.copyOrigin == nil)
            #expect(opened.document.source == capturedSource)
            #expect(openedSnapshot.originalBytes == capturedBytes)
            #expect(openedSnapshot.format.encoding == .utf16BE)
            #expect(openedSnapshot.format.lineEndings == .mixed)
            #expect(openedSnapshot.version == report.comparison.disk.version)
            #expect(try Data(contentsOf: url) == latestBytes)

            for old in oldTabs {
                let kept = try #require(session.tabs.tabs.first { $0.id == old.id })
                #expect(kept.document.source == old.document.source)
                #expect(kept.document.revision == old.document.revision)
                #expect(kept.selectedFile?.version == old.selectedFile?.version)
                #expect(kept.selectedFile?.originalBytes == old.selectedFile?.originalBytes)
            }
            let draft = try #require(session.tabs.tabs.first { $0.id == oldDraft.id })
            let keptBaseline = try #require(draft.copyOrigin?.baseline)
            #expect(draft.isReadOnly == false)
            #expect(keptBaseline.version == baseline.version)
            #expect(keptBaseline.originalBytes == baseline.originalBytes)
            #expect(keptBaseline.format.encoding == .utf8BOM)
            #expect(session.tabs.recoveryDrafts == recoveryBefore)

            // Remove the read-only reference and return to the draft so neither capacity nor
            // selection would prevent a replay if the report had not really been consumed.
            let closedReference = session.tabs.requestCloseSelected()
            try #require(closedReference == .closed)
            let reselected = session.tabs.select(documentID)
            try #require(reselected)
            expectOpenRejected(in: session, requestedID: report.id, retainedReportID: nil)
        }
    }

    @Test(arguments: [OriginalFileComparison.DiskStatus.unchanged, .differentIdentity])
    func rejectsUnchangedAndUnrelatedDiskSnapshots(_ status: OriginalFileComparison.DiskStatus) async throws {
        try await withOriginal { url, _, session, _ in
            var comparisonURL = url
            if status == .differentIdentity {
                comparisonURL = url.deletingLastPathComponent().appending(path: "unrelated.md")
                try Data("別ファイルです\n".utf8).write(to: comparisonURL)
            }
            let report = try await captureComparison(in: session, from: comparisonURL)
            try #require(report.comparison.diskStatus == status)
            expectOpenRejected(in: session, requestedID: report.id, retainedReportID: report.id)
        }
    }

    enum OpenRejection: CaseIterable, Sendable {
        case staleID, editedRevision, otherSelection, composing, full
    }

    @Test(arguments: OpenRejection.allCases)
    func rejectsAnInapplicableModifiedReport(_ rejection: OpenRejection) async throws {
        try await withOriginal { url, _, session, documentID in
            let secondDraft: UUID?
            if rejection == .otherSelection {
                let readOnlyTab = session.tabs.tabs.first(where: \.isReadOnly)
                let original = try #require(readOnlyTab)
                let selectedOriginal = session.tabs.select(original.id)
                try #require(selectedOriginal)
                let copy = session.tabs.makeEditableCopyOfSelection()
                let created: UUID = try #require(copy)
                secondDraft = created
                let reselected = session.tabs.select(documentID)
                try #require(reselected)
            } else {
                secondDraft = nil
            }
            try Data("同じファイルの変更版\n".utf8).write(to: url, options: [])
            var priorReportID: UUID? = nil
            if rejection == .staleID {
                let previous = try await captureComparison(in: session, from: url)
                priorReportID = previous.id
                session.dismissOriginalComparison(previous.id)
            }
            let report = try await captureComparison(in: session, from: url)
            try #require(report.comparison.diskStatus == .modified)

            switch rejection {
            case .staleID:
                try #require(priorReportID != report.id)
            case .editedRevision:
                // The exact same text at a later revision must not revalidate the report.
                session.applyCommittedSource("比較の後に編集", to: documentID)
                session.applyCommittedSource(report.comparison.draftSource, to: documentID)
            case .otherSelection:
                // An independent copy can share the baseline, text, and revision, but not the document ID.
                let otherID = try #require(secondDraft)
                let selectedOther = session.tabs.select(otherID)
                try #require(selectedOther)
            case .composing:
                session.tabs.setComposing(true, in: documentID)
                try #require(session.tabs.isComposing)
            case .full:
                while session.tabs.tabs.count < 8 {
                    let added = session.tabs.newTab()
                    try #require(added != nil)
                }
                let reselected = session.tabs.select(documentID)
                try #require(reselected)
            }
            let requestedID: UUID
            if rejection == .staleID {
                requestedID = try #require(priorReportID)
            } else {
                requestedID = report.id
            }
            expectOpenRejected(in: session, requestedID: requestedID, retainedReportID: report.id)
        }
    }

    private func captureComparison(in session: WorkspaceSession, from url: URL) async throws -> WorkspaceSession.ComparisonReport {
        session.requestOriginalComparison()
        let id = try #require(session.comparisonRequestID)
        await session.readOriginalComparison(id) { try await SelectedTextFile.read(from: url) }
        let report = try #require(session.comparisonReport)
        try #require(report.id == id)
        return report
    }

    private func expectOpenRejected(in session: WorkspaceSession, requestedID: UUID, retainedReportID: UUID?) {
        let tabIDs = session.tabs.tabs.map(\.id)
        let selectedID = session.tabs.selectedID
        let recoveryBefore = session.tabs.recoveryDrafts
        #expect(session.canOpenComparedDisk(requestedID) == false)
        #expect(session.comparisonReport?.id == retainedReportID)
        #expect(session.openComparedDisk(requestedID) == nil)
        #expect(session.comparisonReport?.id == retainedReportID)
        #expect(session.tabs.tabs.map(\.id) == tabIDs)
        #expect(session.tabs.selectedID == selectedID)
        #expect(session.tabs.recoveryDrafts == recoveryBefore)
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
