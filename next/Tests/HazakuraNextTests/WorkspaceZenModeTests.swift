import Foundation
@testable import HazakuraNext
import HazakuraNextCore
import Testing

@MainActor
struct WorkspaceZenModeTests {
    @Test func switchingZenModePreservesBothDraftsRecoveryAndPreview() async throws {
        let probe = ZenModeRecoveryProbe()
        let recovery = RecoveryCheckpointQueue(backend: .init(
            checkpoint: { await probe.recordCheckpoint($0) },
            candidates: { [] },
            discardConfirmed: { _ in Issue.record("Zen Mode must not discard recovery drafts.") }
        ))
        let session = WorkspaceSession(source: "", recovery: recovery)
        let firstID = try #require(session.tabs.selectedID)
        let firstSource = "# 別の原稿\r本文\n"
        session.applyCommittedSource(firstSource, to: firstID)
        session.newTab()
        let selectedID = try #require(session.tabs.selectedID)
        try #require(selectedID != firstID)
        let selectedSource = "# か\u{3099}\r\n\r\n本文 *強調* 👩‍💻"
        session.applyCommittedSource(selectedSource, to: selectedID)
        let ids = [firstID, selectedID]
        let revisions = session.tabs.tabs.map(\.document.revision)
        let sources = [Data(firstSource.utf8), Data(selectedSource.utf8)]
        let drafts = session.tabs.recoveryDrafts
        try #require(drafts.count == 2)
        await recovery.waitForCurrentWorker()
        let checkpoints = await probe.checkpoints
        try #require(checkpoints == drafts)

        session.requestMarkdownPreview()
        let baselinePreview = try #require(session.markdownPreview)
        session.rememberMarkdownReadingPosition(1, previewID: baselinePreview.id)
        session.dismissMarkdownPreview(baselinePreview.id)

        #expect(session.isZenMode == false)
        for expectedMode in [true, false] {
            #expect(session.canToggleZenMode)
            session.toggleZenMode()
            #expect(session.isZenMode == expectedMode)
            #expect(session.isLMode == false)
            #expect(session.tabs.selectedID == selectedID)
            #expect(session.tabs.tabs.map(\.id) == ids)
            #expect(session.tabs.tabs.map(\.document.revision) == revisions)
            #expect(session.tabs.tabs.map { Data($0.document.source.utf8) } == sources)
            #expect(session.tabs.recoveryDrafts == drafts)

            #expect(session.markdownPreview == nil)
            session.requestMarkdownPreview()
            let preview = try #require(session.markdownPreview)
            #expect(preview.documentID == baselinePreview.documentID)
            #expect(preview.revision == baselinePreview.revision)
            #expect(preview.title == baselinePreview.title)
            #expect(preview.source.utf8.elementsEqual(baselinePreview.source.utf8))
            #expect(preview.readingBlockIndex == 1)
            session.dismissMarkdownPreview(preview.id)

            await recovery.waitForCurrentWorker()
            #expect(await probe.checkpoints == checkpoints)
        }
    }

    @Test func zenModeIsWindowLocalAndIndependentOfLMode() throws {
        let session = WorkspaceSession(source: "# 原稿")
        let otherWindow = WorkspaceSession(source: "# 別ウィンドウ")
        let id = try #require(session.tabs.selectedID)

        session.toggleLMode()
        try #require(session.isLMode)
        #expect(session.isZenMode == false)
        session.toggleZenMode()
        #expect(session.isZenMode)
        #expect(session.isLMode)
        #expect(otherWindow.isZenMode == false)
        #expect(WorkspaceSession(source: "# 新しいウィンドウ").isZenMode == false)

        session.newTab()
        let nextID = try #require(session.tabs.selectedID)
        try #require(nextID != id)
        #expect(session.isZenMode)
        session.toggleLMode()
        #expect(session.isLMode == false)
        #expect(session.isZenMode)
        session.toggleLMode()
        #expect(session.isLMode)
        #expect(session.isZenMode)
        session.toggleZenMode()
        #expect(session.isZenMode == false)
        #expect(session.isLMode)
    }

    @Test func needsASelectedDocumentToEnterButNotToLeave() throws {
        let session = WorkspaceSession(source: "# 原稿")
        let firstClose = session.tabs.requestCloseSelected()
        try #require(firstClose == .closed)
        try #require(session.tabs.selectedTab == nil)
        #expect(session.canToggleZenMode == false)
        session.toggleZenMode()
        #expect(session.isZenMode == false)

        session.newTab()
        try #require(session.tabs.selectedTab != nil)
        session.toggleZenMode()
        try #require(session.isZenMode)
        let secondClose = session.tabs.requestCloseSelected()
        try #require(secondClose == .closed)
        try #require(session.tabs.selectedTab == nil)
        #expect(session.canToggleZenMode)
        session.toggleZenMode()
        #expect(session.isZenMode == false)
        #expect(session.canToggleZenMode == false)
        #expect(session.tabs.tabs.isEmpty)
    }

    @Test(arguments: [false, true])
    func compositionBlocksBothDirections(startsInZen: Bool) throws {
        let session = WorkspaceSession(source: "# 原稿")
        let id = try #require(session.tabs.selectedID)
        if startsInZen { session.toggleZenMode() }
        try #require(session.isZenMode == startsInZen)

        session.tabs.setComposing(true, in: id)
        try #require(session.tabs.isComposing)
        #expect(session.canToggleZenMode == false)
        session.toggleZenMode()
        #expect(session.isZenMode == startsInZen)
        #expect(session.tabs.isComposing)

        session.tabs.setComposing(false, in: id)
        #expect(session.isZenMode == startsInZen)
        #expect(session.canToggleZenMode)
        session.toggleZenMode()
        #expect(session.isZenMode != startsInZen)
    }

    enum ExclusiveOperation: CaseIterable, Sendable { case export, preview }

    @Test(arguments: ExclusiveOperation.allCases, [false, true])
    func exclusiveOperationsBlockBothDirections(_ operation: ExclusiveOperation, startsInZen: Bool) throws {
        let session = WorkspaceSession(source: "# 原稿")
        if startsInZen { session.toggleZenMode() }
        try #require(session.isZenMode == startsInZen)

        switch operation {
        case .export: session.requestExport(.epub)
        case .preview: session.requestMarkdownPreview()
        }
        let exportID = session.exportRequest?.id
        let previewID = session.markdownPreview?.id
        try #require(session.isBusy)
        #expect(session.canToggleZenMode == false)
        session.toggleZenMode()
        #expect(session.isZenMode == startsInZen)
        #expect(session.exportRequest?.id == exportID)
        #expect(session.markdownPreview?.id == previewID)

        switch operation {
        case .export: session.cancelExport(try #require(exportID))
        case .preview: session.dismissMarkdownPreview(try #require(previewID))
        }
        #expect(session.isZenMode == startsInZen)
        #expect(session.canToggleZenMode)
        session.toggleZenMode()
        #expect(session.isZenMode != startsInZen)
    }
}

private actor ZenModeRecoveryProbe {
    private(set) var checkpoints: [RecoveryDraft] = []

    func recordCheckpoint(_ draft: RecoveryDraft) {
        checkpoints.append(draft)
    }
}
