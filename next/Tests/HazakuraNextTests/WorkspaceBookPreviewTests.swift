import Foundation
@testable import HazakuraNext
import HazakuraNextCore
import Testing

@MainActor
struct WorkspaceBookPreviewTests {
    @Test func confirmationCapturesOnlyChosenTabsInTabOrderAndDoesNotChangeTheWorkspace() throws {
        let session = WorkspaceSession(source: "# 最初")
        let first = try #require(session.tabs.selectedID)
        session.newTab()
        let excluded = try #require(session.tabs.selectedID)
        session.applyCommittedSource("含めない原稿", to: excluded)
        session.newTab()
        let last = try #require(session.tabs.selectedID)
        session.requestBookPreview()
        let request = try #require(session.bookPreviewRequest)
        #expect(request.choices.map(\.id) == [first, excluded, last])
        #expect(session.isBusy)
        #expect(session.canEditSource == false)
        session.requestMarkdownPreview()
        session.requestSaveCopy()
        #expect(session.markdownPreview == nil && session.saveCopyRequest == nil)

        // A native commit delivered before confirmation must not be mistaken for marked text.
        let committed = "# 確定 か\u{3099}\r\n"
        session.applyCommittedSource(committed, to: last)
        let drafts = session.tabs.recoveryDrafts
        let sources = try #require(session.confirmBookPreview(request.id, selected: [last, first]))
        #expect(sources.map(\.id) == [first, last])
        #expect(sources.map(\.title) == ["原稿 1", "原稿 3"])
        #expect(sources[1].text.utf8.elementsEqual(committed.utf8))
        #expect(session.confirmBookPreview(request.id, selected: [first, last]) == nil)
        #expect(session.tabs.recoveryDrafts == drafts)
        #expect(session.tabs.selectedID == last)
        session.applyCommittedSource("確定後の変更", to: last)
        #expect(sources[1].text.utf8.elementsEqual(committed.utf8))
        session.dismissBookPreview(request.id)
        #expect(session.canEditSource)
    }

    @Test func searchUsesOnlyTheConfirmedBookEvenAfterTheWorkspaceChanges() async throws {
        let session = WorkspaceSession(source: "# 風見鶏")
        let first = try #require(session.tabs.selectedID)
        session.newTab()
        let excluded = try #require(session.tabs.selectedID)
        session.applyCommittedSource("風見鶏を含む未選択の原稿", to: excluded)
        session.newTab()
        let last = try #require(session.tabs.selectedID)
        session.applyCommittedSource("初めに\n\n風見鶏", to: last)
        session.requestBookPreview()
        let requestID = try #require(session.bookPreviewRequest?.id)
        let sources = try #require(session.confirmBookPreview(requestID, selected: [last, first]))
        session.applyCommittedSource("確定後に別の本文へ変更", to: last)
        let drafts = session.tabs.recoveryDrafts

        let sections = try await MarkdownBookPreview.render(sources)
        let result = MarkdownReaderSearch.searchBook("風見鶏", in: sections)
        #expect(result == .matches([.init(sectionID: first, blockIndex: 0), .init(sectionID: last, blockIndex: 1)]))
        #expect(MarkdownReaderSearch.searchBook("確定後", in: sections) == .matches([]))
        #expect(session.tabs.selectedID == last)
        #expect(session.tabs.recoveryDrafts == drafts)
    }

    @Test func needsMultipleTabsAndRejectsStaleRequestsInvalidSelectionAndComposition() throws {
        let session = WorkspaceSession(source: "最初")
        let first = try #require(session.tabs.selectedID)
        session.requestBookPreview()
        #expect(session.bookPreviewRequest == nil)
        session.newTab()
        let second = try #require(session.tabs.selectedID)
        session.tabs.setComposing(true, in: second)
        session.requestBookPreview()
        #expect(session.bookPreviewRequest == nil)
        session.tabs.setComposing(false, in: second)
        session.requestBookPreview()
        let stale = try #require(session.bookPreviewRequest?.id)
        session.dismissBookPreview(stale)
        session.requestBookPreview()
        let current = try #require(session.bookPreviewRequest?.id)
        session.dismissBookPreview(stale)
        #expect(session.bookPreviewRequest?.id == current)
        #expect(session.confirmBookPreview(stale, selected: [first, second]) == nil)
        #expect(session.confirmBookPreview(current, selected: [first]) == nil)
        #expect(session.confirmBookPreview(current, selected: [first, UUID()]) == nil)
        session.tabs.setComposing(true, in: second)
        #expect(session.confirmBookPreview(current, selected: [first, second]) == nil)
        session.tabs.setComposing(false, in: second)
        #expect(session.confirmBookPreview(current, selected: [first, second]) != nil)
    }

    @Test func aLateDiscardConfirmationCannotRunDuringBookSelection() throws {
        let session = WorkspaceSession(source: "最初")
        session.newTab()
        let active = try #require(session.tabs.selectedID)
        session.applyCommittedSource("未保存の原稿", to: active)
        let drafts = session.tabs.recoveryDrafts
        session.prepareTabClose()
        let request = try #require(session.pendingDiscard?.id)
        session.resolveTabDiscard(request, discard: false)
        session.requestBookPreview()
        try #require(session.bookPreviewRequest != nil)
        session.prepareTabClose()
        #expect(session.pendingDiscard == nil)
        #expect(session.resolveTabDiscard(request, discard: true) == nil)
        #expect(session.tabs.recoveryDrafts == drafts)
        #expect(session.tabs.selectedID == active)
    }

    @Test func aClosedCandidateCannotBeSilentlyDroppedFromTheBook() throws {
        let session = WorkspaceSession(source: "最初")
        let first = try #require(session.tabs.selectedID)
        session.newTab()
        let second = try #require(session.tabs.selectedID)
        session.newTab()
        let third = try #require(session.tabs.selectedID)
        session.requestBookPreview()
        let id = try #require(session.bookPreviewRequest?.id)
        let closed = session.tabs.requestCloseSelected()
        try #require(closed == .closed)
        #expect(session.confirmBookPreview(id, selected: [first, second, third]) == nil)
        #expect(session.confirmBookPreview(id, selected: [first, second]) != nil)
    }
}
