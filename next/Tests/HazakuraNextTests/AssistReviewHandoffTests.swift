import AppKit
@testable import HazakuraNext
import HazakuraNextCore
@testable import HazakuraNextEditor
import Testing

@MainActor
struct AssistReviewHandoffTests {
    @Test func explicitApprovalAppliesOnlyAfterTheSameSheetEnds() async throws {
        let fixture = try Fixture()
        defer { fixture.window.contentView = nil }
        let (handoff, review, sheet) = try await fixture.openReview()
        #expect(review.before.utf8.elementsEqual("古い文".utf8))
        #expect(handoff.approve(reviewID: review.id, in: sheet))
        #expect(fixture.editor.string == Fixture.source)
        #expect(fixture.session.tabs.recoveryDrafts.isEmpty)

        #expect(fixture.window.firstResponder !== fixture.editor)
        fixture.endSimulatedSheet()
        try #require(fixture.window.firstResponder === fixture.editor)
        fixture.editor.setSelectedRange(NSRange(location: 0, length: 0))
        let undo = try #require(fixture.editor.undoManager)
        let applied = try handoff.sheetDidEnd(reviewID: review.id, sheet: sheet, response: .OK)
        let receipt = try #require(applied)
        #expect(receipt.reviewID == review.id)
        #expect(receipt.selection == Fixture.selection)
        #expect(receipt.documentID == fixture.documentID)
        #expect(fixture.editor.string.utf8.elementsEqual("前\r\n新しい文\n後ろ".utf8))
        #expect(fixture.session.tabs.selectedTab?.document.revision == 1)
        #expect(fixture.session.tabs.selectedTab?.document.source.utf8.elementsEqual(fixture.editor.string.utf8) == true)
        #expect(fixture.editor.undoManager === undo)
        #expect(try handoff.sheetDidEnd(reviewID: review.id, sheet: sheet, response: .OK) == nil)
        undo.undo()
        #expect(fixture.editor.string.utf8.elementsEqual(Fixture.source.utf8))
        #expect(!undo.canUndo)
    }

    @Test(arguments: [false, true])
    func positiveDismissalIsNotConsentAndCancellationOverridesConsent(approved: Bool) async throws {
        let fixture = try Fixture()
        defer { fixture.window.contentView = nil }
        let (handoff, review, sheet) = try await fixture.openReview()
        if approved { #expect(handoff.approve(reviewID: review.id, in: sheet)) }
        fixture.endSimulatedSheet()
        let response: NSApplication.ModalResponse = approved ? .cancel : .OK
        #expect(try handoff.sheetDidEnd(reviewID: review.id, sheet: sheet, response: response) == nil)
        #expect(try handoff.sheetDidEnd(reviewID: review.id, sheet: sheet, response: .OK) == nil)
        #expect(!handoff.approve(reviewID: review.id, in: sheet))
        fixture.expectUnchanged()
    }

    @Test func aDifferentSheetOrReviewCannotAuthorizeOrConsumeThePendingDecision() async throws {
        let fixture = try Fixture()
        defer { fixture.window.contentView = nil }
        let (handoff, review, sheet) = try await fixture.openReview()
        let wrongSheet = fixture.makeSheet()
        let wrongID = UUID()
        #expect(!handoff.approve(reviewID: wrongID, in: sheet))
        #expect(!handoff.approve(reviewID: review.id, in: wrongSheet))
        #expect(handoff.approve(reviewID: review.id, in: sheet))
        #expect(!handoff.approve(reviewID: review.id, in: sheet))
        #expect(try handoff.sheetDidEnd(reviewID: review.id, sheet: wrongSheet, response: .OK) == nil)
        #expect(try handoff.sheetDidEnd(reviewID: wrongID, sheet: sheet, response: .OK) == nil)
        fixture.expectUnchanged()
        fixture.endSimulatedSheet()
        #expect(try handoff.sheetDidEnd(reviewID: review.id, sheet: sheet, response: .OK) != nil)
    }

    @Test func earlyResponsesCannotConsumeOrApplyAnAttachedReview() async throws {
        let fixture = try Fixture()
        defer { fixture.window.contentView = nil }
        let (handoff, review, sheet) = try await fixture.openReview()
        #expect(handoff.approve(reviewID: review.id, in: sheet))
        #expect(try handoff.sheetDidEnd(reviewID: review.id, sheet: sheet, response: .OK) == nil)
        #expect(try handoff.sheetDidEnd(reviewID: review.id, sheet: sheet, response: .cancel) == nil)
        fixture.expectUnchanged()
        fixture.endSimulatedSheet()
        #expect(try handoff.sheetDidEnd(reviewID: review.id, sheet: sheet, response: .OK) != nil)
    }

    @Test func explicitCancellationWhileAttachedRevokesTheApproval() async throws {
        let fixture = try Fixture()
        defer { fixture.window.contentView = nil }
        let (handoff, review, sheet) = try await fixture.openReview()
        #expect(handoff.approve(reviewID: review.id, in: sheet))
        handoff.cancel()
        #expect(!handoff.approve(reviewID: review.id, in: sheet))
        fixture.endSimulatedSheet()
        #expect(try handoff.sheetDidEnd(reviewID: review.id, sheet: sheet, response: .OK) == nil)
        fixture.expectUnchanged()
    }

    @Test(arguments: ["noKey", "noFocus", "busy", "composition", "otherWindow", "staleVersion", "sameIDNewEditor"])
    func approvalFailsClosedWhenTheEditorIsNotIntactAtDismissal(change: String) async throws {
        let fixture = try Fixture()
        defer { fixture.window.contentView = nil }
        let (handoff, review, sheet) = try await fixture.openReview()
        #expect(handoff.approve(reviewID: review.id, in: sheet))
        fixture.endSimulatedSheet()
        let otherWindow = DismissalWindow(contentRect: .zero, styleMask: [.titled], backing: .buffered, defer: true)
        switch change {
        case "noKey": fixture.window.reportsKey = false
        case "noFocus": try #require(fixture.window.makeFirstResponder(nil))
        case "busy": fixture.session.requestOpen()
        case "composition": fixture.session.tabs.setComposing(true, in: fixture.documentID)
        case "otherWindow": fixture.session.window = otherWindow
        case "staleVersion":
            fixture.session.applyCommittedSource("異なる版", to: fixture.documentID)
            fixture.session.applyCommittedSource(Fixture.source, to: fixture.documentID)
        default:
            let replacement = TextKitEditor.makeScrollView(initialText: Fixture.source, documentID: fixture.documentID,
                                                           coordinator: nil)
            let replacementEditor = try #require(replacement.documentView as? NSTextView)
            fixture.window.contentView = replacement
            try #require(fixture.window.makeFirstResponder(replacementEditor))
            #expect(TextKitEditor.captureReviewedEdit(in: fixture.window, documentID: fixture.documentID) == Fixture.source)
        }
        #expect(throws: AssistReviewHandoff.HandoffError.editorUnavailable) {
            _ = try handoff.sheetDidEnd(reviewID: review.id, sheet: sheet, response: .OK)
        }
        #expect(fixture.editor.string.utf8.elementsEqual(Fixture.source.utf8))
        #expect(try handoff.sheetDidEnd(reviewID: review.id, sheet: sheet, response: .OK) == nil)
    }

    @Test func cancelledPresentationReleasesThePendingReview() async throws {
        let fixture = try Fixture()
        defer { fixture.window.contentView = nil }
        let handoff = try AssistReviewHandoff.begin(in: fixture.session)
        let review = try await handoff.prepare(candidate: "新しい文")
        let presentation = Task { @MainActor in try handoff.present(review) }
        presentation.cancel()
        await #expect(throws: CancellationError.self) { try await presentation.value }
        await #expect(throws: AssistReviewHandoff.HandoffError.inactive) {
            _ = try await handoff.prepare(candidate: "別の案")
        }
        fixture.expectUnchanged()
    }

    @MainActor
    private struct Fixture {
        static let source = "前\r\n古い文\n後ろ"
        static let selection = NSRange(location: "前\r\n".utf16.count, length: "古い文".utf16.count)
        let session: WorkspaceSession
        let window: DismissalWindow
        let documentID: UUID
        let editor: NSTextView
        private let coordinator: TextKitEditor.Coordinator

        init() throws {
            let session = WorkspaceSession(source: Self.source)
            let id = try #require(session.tabs.selectedID)
            let coordinator = TextKitEditor(initialText: Self.source, documentID: id,
                                            canEdit: { session.canEditSource },
                                            onCompositionChange: { session.tabs.setComposing($0, in: id) }) { source in
                session.applyCommittedSource(source, to: id)
            }.makeCoordinator()
            let scroll = TextKitEditor.makeScrollView(initialText: Self.source, documentID: id, coordinator: coordinator)
            let editor = try #require(scroll.documentView as? NSTextView)
            let window = DismissalWindow(contentRect: NSRect(x: 0, y: 0, width: 480, height: 320),
                                         styleMask: [.titled], backing: .buffered, defer: true)
            window.contentView = scroll
            session.window = window
            try #require(window.makeFirstResponder(editor))
            editor.setSelectedRange(Self.selection)
            self.session = session
            self.window = window
            documentID = id
            self.editor = editor
            self.coordinator = coordinator
        }

        func makeSheet() -> NSWindow {
            NSWindow(contentRect: .zero, styleMask: [.titled], backing: .buffered, defer: true)
        }

        func openReview() async throws -> (AssistReviewHandoff, AssistProposalFlow.Review, NSWindow) {
            let handoff = try AssistReviewHandoff.begin(in: session)
            let review = try await handoff.prepare(candidate: "新しい文")
            try handoff.present(review)
            let sheet = makeSheet()
            window.simulatedSheet = sheet
            window.reportsKey = false
            try #require(window.makeFirstResponder(nil))
            try #require(handoff.bindSheet(sheet, reviewID: review.id))
            return (handoff, review, sheet)
        }

        func endSimulatedSheet() {
            window.simulatedSheet = nil
            window.reportsKey = true
            #expect(window.makeFirstResponder(editor))
        }

        func expectUnchanged() {
            #expect(editor.string.utf8.elementsEqual(Self.source.utf8))
            #expect(session.tabs.selectedTab?.document.revision == 0)
            #expect(session.tabs.recoveryDrafts.isEmpty)
            #expect(editor.undoManager?.canUndo == false)
        }
    }

    private final class DismissalWindow: NSWindow {
        var reportsKey = true
        var simulatedSheet: NSWindow?
        override var isKeyWindow: Bool { reportsKey }
        override var attachedSheet: NSWindow? { simulatedSheet }
    }
}
