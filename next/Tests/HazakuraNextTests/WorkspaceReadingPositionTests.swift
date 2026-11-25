import Foundation
@testable import HazakuraNext
import HazakuraNextCore
import Observation
import Synchronization
import Testing

@MainActor
struct WorkspaceReadingPositionTests {
    private let source = "# 最初\n\n本文\n\n## 続き"

    @Test func liveTabsWithIdenticalTextAndRevisionKeepSeparatePositions() throws {
        let session = WorkspaceSession(source: "")
        let firstID = try #require(session.tabs.selectedID)
        session.applyCommittedSource(source, to: firstID)
        let first = try openPreview(in: session)
        #expect(first.readingBlockIndex == nil)
        session.rememberMarkdownReadingPosition(1, previewID: first.id)
        session.dismissMarkdownPreview(first.id)

        session.newTab()
        let secondID = try #require(session.tabs.selectedID)
        session.applyCommittedSource(source, to: secondID)
        let second = try openPreview(in: session)
        #expect(second.revision == first.revision)
        #expect(second.readingBlockIndex == nil)
        session.rememberMarkdownReadingPosition(2, previewID: second.id)
        session.dismissMarkdownPreview(second.id)

        let selectedFirst = session.tabs.select(firstID)
        try #require(selectedFirst)
        let reopenedFirst = try openPreview(in: session)
        #expect(reopenedFirst.readingBlockIndex == 1)
        session.dismissMarkdownPreview(reopenedFirst.id)
        let selectedSecond = session.tabs.select(secondID)
        try #require(selectedSecond)
        let reopenedSecond = try openPreview(in: session)
        #expect(reopenedSecond.readingBlockIndex == 2)
    }

    @Test func callbacksFromDismissedSheetCannotOverwritePosition() throws {
        let session = WorkspaceSession(source: source)
        let closed = try openPreview(in: session)
        session.rememberMarkdownReadingPosition(1, previewID: closed.id)
        session.dismissMarkdownPreview(closed.id)
        session.rememberMarkdownReadingPosition(2, previewID: closed.id)

        let active = try openPreview(in: session)
        #expect(active.readingBlockIndex == 1)
        session.rememberMarkdownReadingPosition(0, previewID: closed.id)
        session.dismissMarkdownPreview(active.id)
        let reopened = try openPreview(in: session)
        #expect(reopened.readingBlockIndex == 1)
    }

    @Test func aLiveSheetCannotRecordWhileAnotherTabIsSelectedOrWhileComposing() throws {
        let session = WorkspaceSession(source: source)
        let firstID = try #require(session.tabs.selectedID)
        session.newTab()
        let secondID = try #require(session.tabs.selectedID)
        let selectedFirst = session.tabs.select(firstID)
        try #require(selectedFirst)
        let preview = try openPreview(in: session)
        session.rememberMarkdownReadingPosition(1, previewID: preview.id)

        // These model native state changes arriving while the sheet is still open.
        session.tabs.setComposing(true, in: firstID)
        session.rememberMarkdownReadingPosition(0, previewID: preview.id)
        session.tabs.setComposing(false, in: firstID)
        let selectedSecond = session.tabs.select(secondID)
        try #require(selectedSecond)
        session.rememberMarkdownReadingPosition(2, previewID: preview.id)
        session.dismissMarkdownPreview(preview.id)
        let second = try openPreview(in: session)
        #expect(second.readingBlockIndex == nil)
        session.dismissMarkdownPreview(second.id)
        session.tabs.select(firstID)
        let first = try openPreview(in: session)
        #expect(first.readingBlockIndex == 1)
    }

    @Test(arguments: [false, true])
    func changedRevisionRejectsLateWritesAndDoesNotRestorePosition(undoToIdenticalText: Bool) throws {
        let session = WorkspaceSession(source: source)
        let id = try #require(session.tabs.selectedID)
        let preview = try openPreview(in: session)
        session.rememberMarkdownReadingPosition(1, previewID: preview.id)
        session.applyCommittedSource(source + "\n\n追記", to: id)
        if undoToIdenticalText { session.applyCommittedSource(source, to: id) }

        session.rememberMarkdownReadingPosition(2, previewID: preview.id)
        session.dismissMarkdownPreview(preview.id)
        let reopened = try openPreview(in: session)
        #expect(reopened.revision > preview.revision)
        #expect((reopened.source == preview.source) == undoToIdenticalText)
        #expect(reopened.readingBlockIndex == nil)
    }

    @Test(arguments: [-1, 2_000, Int.max])
    func invalidIndicesCannotOverwriteAValidPosition(invalid: Int) throws {
        let session = WorkspaceSession(source: source)
        let preview = try openPreview(in: session)
        session.rememberMarkdownReadingPosition(0, previewID: preview.id)
        session.rememberMarkdownReadingPosition(invalid, previewID: preview.id)
        session.dismissMarkdownPreview(preview.id)
        let reopened = try openPreview(in: session)
        #expect(reopened.readingBlockIndex == 0)
    }

    @Test func recordingDoesNotInvalidateObserversEditSourceOrCheckpoint() async throws {
        let queue = RecoveryCheckpointQueue(backend: .init(
            checkpoint: { _ in Issue.record("Reading must not checkpoint.") },
            candidates: { [] },
            discardConfirmed: { _ in Issue.record("Reading must not discard recovery.") }
        ))
        let session = WorkspaceSession(source: source, recovery: queue)
        let preview = try openPreview(in: session)
        let invalidated = Mutex(false)
        withObservationTracking {
            _ = session.markdownPreview
            _ = session.tabs
        } onChange: {
            invalidated.withLock { $0 = true }
        }

        session.rememberMarkdownReadingPosition(1, previewID: preview.id)
        session.rememberMarkdownReadingPosition(2, previewID: preview.id)
        #expect(invalidated.withLock { $0 } == false)
        #expect(session.markdownPreview?.id == preview.id)
        #expect(session.markdownPreview?.readingBlockIndex == nil)
        #expect(session.tabs.selectedTab?.document.source == source)
        #expect(session.tabs.selectedTab?.document.revision == 0)
        #expect(session.tabs.recoveryDrafts.isEmpty)
        await queue.waitForCurrentWorker()

        session.dismissMarkdownPreview(preview.id)
        let reopened = try openPreview(in: session)
        #expect(reopened.readingBlockIndex == 2)
        session.dismissMarkdownPreview(reopened.id)
        let close = session.tabs.requestCloseSelected()
        #expect(close == .closed)
    }

    @Test func aClosedTabRecreatedWithTheSameSourceAndRevisionStartsWithoutPosition() async throws {
        let session = WorkspaceSession(source: "")
        let firstID = try #require(session.tabs.selectedID)
        session.applyCommittedSource(source, to: firstID)
        let first = try openPreview(in: session)
        session.rememberMarkdownReadingPosition(2, previewID: first.id)
        session.dismissMarkdownPreview(first.id)
        let request = try #require(session.prepareTabClose())
        let discard = try #require(session.resolveTabDiscard(request, discard: true))
        await discard.value
        try #require(session.tabs.tabs.isEmpty)

        session.newTab()
        let secondID = try #require(session.tabs.selectedID)
        session.applyCommittedSource(source, to: secondID)
        let second = try openPreview(in: session)
        #expect(secondID != firstID)
        #expect(second.revision == first.revision)
        #expect(second.source == first.source)
        #expect(second.readingBlockIndex == nil)
    }

    @Test func repeatedRecoveryCreatesAnIndependentTabWithoutPosition() throws {
        let draft = RecoveryDraft(id: UUID(), revision: 7, source: source)
        let queue = RecoveryCheckpointQueue(backend: .init(
            checkpoint: { _ in }, candidates: { [draft] }, discardConfirmed: { _ in }
        ))
        let session = WorkspaceSession(source: "", recovery: queue)
        session.requestRecovery()
        let firstRestore = session.restore(draft)
        try #require(firstRestore)
        session.showsRecovery = false
        let before = session.tabs.recoveryDrafts
        let first = try openPreview(in: session)
        session.rememberMarkdownReadingPosition(2, previewID: first.id)
        session.dismissMarkdownPreview(first.id)
        #expect(session.tabs.recoveryDrafts == before)

        session.requestRecovery()
        let secondRestore = session.restore(draft)
        try #require(secondRestore)
        session.showsRecovery = false
        let second = try openPreview(in: session)
        #expect(second.documentID != first.documentID)
        #expect(second.revision == first.revision)
        #expect(second.readingBlockIndex == nil)
    }

    private func openPreview(in session: WorkspaceSession) throws -> WorkspaceSession.MarkdownPreviewSnapshot {
        session.requestMarkdownPreview()
        return try #require(session.markdownPreview)
    }
}
