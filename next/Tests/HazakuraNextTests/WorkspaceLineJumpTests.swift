import Foundation
@testable import HazakuraNext
import Testing

@MainActor
struct WorkspaceLineJumpTests {
    @Test func movesOnlyTheCurrentEditorOnceWithoutEditingTheDraft() throws {
        let session = WorkspaceSession(source: "")
        let documentID = try #require(session.tabs.selectedID)
        let source = "🌸\r\nか\u{3099}\r本文\n"
        session.applyCommittedSource(source, to: documentID)
        let recovery = session.tabs.recoveryDrafts
        let revision = session.tabs.selectedTab?.document.revision
        session.requestLineJump()
        let request = try #require(session.lineJumpRequest)
        #expect(session.isBusy)
        #expect(!session.canEditSource)
        #expect(!session.confirmLineJump(request.id, line: 5))
        #expect(session.lineJumpRequest?.id == request.id)
        #expect(session.readySourceRevealID == nil)
        #expect(session.confirmLineJump(request.id, line: 4))
        #expect(session.lineJumpRequest == nil)
        #expect(!session.isBusy)
        #expect(session.takeSourceReveal(request.id, documentID: UUID(), editorSource: source) == nil)
        #expect(session.takeSourceReveal(request.id, documentID: documentID, editorSource: source) == source.utf16.count)
        #expect(session.takeSourceReveal(request.id, documentID: documentID, editorSource: source) == nil)
        #expect(session.tabs.selectedTab?.document.revision == revision)
        #expect(session.tabs.recoveryDrafts == recovery)
    }

    @Test func rejectsStalePromptAndNativeBytesEvenIfCanonicallyEquivalent() throws {
        let source = "か\u{3099}\n本文"
        let session = WorkspaceSession(source: source)
        let documentID = try #require(session.tabs.selectedID)
        session.requestLineJump()
        let cancelled = try #require(session.lineJumpRequest)
        session.dismissLineJump(cancelled.id)
        #expect(session.readySourceRevealID == nil)
        session.requestLineJump()
        let active = try #require(session.lineJumpRequest)
        session.dismissLineJump(cancelled.id)
        #expect(!session.confirmLineJump(cancelled.id, line: 1))
        #expect(session.lineJumpRequest?.id == active.id)
        #expect(session.confirmLineJump(active.id, line: 2))
        #expect(session.takeSourceReveal(active.id, documentID: documentID, editorSource: "が\n本文") == nil)
        #expect(session.readySourceRevealID == nil)
        #expect(session.tabs.selectedTab?.document.revision == 0)
    }

    @Test func refusesCompositionAndRevisionChanges() throws {
        let session = WorkspaceSession(source: "初稿")
        let documentID = try #require(session.tabs.selectedID)
        session.tabs.setComposing(true, in: documentID)
        session.requestLineJump()
        #expect(session.lineJumpRequest == nil)
        session.tabs.setComposing(false, in: documentID)
        session.requestLineJump()
        let request = try #require(session.lineJumpRequest)
        session.applyCommittedSource("次稿", to: documentID)
        #expect(!session.confirmLineJump(request.id, line: 1))
        #expect(session.readySourceRevealID == nil)
        session.dismissLineJump(request.id)
        #expect(!session.isBusy)
    }

    @Test func aConfirmedJumpDoesNotSurviveAnEditAndUndoToTheSameBytes() throws {
        let source = "第一行\n第二行"
        let session = WorkspaceSession(source: source)
        let documentID = try #require(session.tabs.selectedID)
        session.requestLineJump()
        let request = try #require(session.lineJumpRequest)
        try #require(session.confirmLineJump(request.id, line: 2))
        session.applyCommittedSource(source + "。", to: documentID)
        session.applyCommittedSource(source, to: documentID)
        #expect(session.takeSourceReveal(request.id, documentID: documentID, editorSource: source) == nil)
        #expect(session.readySourceRevealID == nil)
        #expect(session.tabs.selectedTab?.document.revision == 2)
    }

    @Test func rejectsOverBudgetDraftWithoutReservingARequest() {
        let session = WorkspaceSession(source: String(repeating: "a", count: 2 * 1024 * 1024 + 1))
        #expect(!session.canRequestLineJump)
        session.requestLineJump()
        #expect(session.lineJumpRequest == nil)
    }
}
