import AppKit
@testable import HazakuraNext
import HazakuraNextCore
@testable import HazakuraNextEditor
import Testing

@MainActor
struct AssistNativeReviewTests {
    @Test func aReviewedReplacementChangesOnlyThePinnedRangeAndCanBeUndoneOnce() async throws {
        let fixture = try Fixture(source: "冒頭\r\n古い本文\r\n末尾 👩‍💻")
        defer { fixture.window.contentView = nil }
        let range = NSRange(location: "冒頭\r\n".utf16.count, length: "古い本文".utf16.count)
        let after = "新しい本文"
        let expected = "冒頭\r\n新しい本文\r\n末尾 👩‍💻"
        let before = fixture.editor.string
        let layout = try #require(fixture.editor.textLayoutManager)
        let undoManager = try #require(fixture.editor.undoManager)
        fixture.editor.setSelectedRange(range)
        let request = try fixture.flow.begin(tabs: fixture.session.tabs, editorSource: before,
                                             selection: fixture.editor.selectedRange())
        let review = try await request.prepareReview(candidate: after)
        try fixture.flow.present(review, tabs: fixture.session.tabs, editorSource: fixture.editor.string)
        #expect(fixture.editor.string.utf8.elementsEqual(before.utf8))
        #expect(fixture.session.tabs.recoveryDrafts.isEmpty)
        // Moving the caret does not retarget the review; the original selection is pinned.
        fixture.editor.setSelectedRange(NSRange(location: 0, length: 0))

        let receipt = try AssistNativeReview.approve(reviewID: review.id, flow: fixture.flow, session: fixture.session,
                                                     origin: .syntheticFixture)
        #expect(receipt.reviewID == review.id)
        #expect(receipt.origin == .syntheticFixture)
        #expect(receipt.documentID == fixture.documentID)
        #expect(receipt.selection == range)
        #expect(receipt.before == "古い本文")
        #expect(receipt.after == after)
        #expect(receipt.appliedRevision == 1)
        #expect(fixture.editor.string.utf8.elementsEqual(expected.utf8))
        #expect(fixture.session.tabs.selectedTab?.document.source.utf8.elementsEqual(expected.utf8) == true)
        #expect(fixture.session.tabs.recoveryDraft(for: fixture.documentID)?.source == expected)
        #expect(fixture.editor.textLayoutManager === layout)
        #expect(fixture.editor.undoManager === undoManager)
        #expect(throws: AssistProposalFlow.FlowError.inactive) {
            _ = try AssistNativeReview.approve(reviewID: review.id, flow: fixture.flow, session: fixture.session,
                                               origin: .syntheticFixture)
        }

        undoManager.undo()
        #expect(fixture.editor.string.utf8.elementsEqual(before.utf8))
        #expect(fixture.session.tabs.selectedTab?.document.source.utf8.elementsEqual(before.utf8) == true)
        #expect(undoManager.canUndo == false)
        undoManager.redo()
        #expect(fixture.editor.string.utf8.elementsEqual(expected.utf8))
        #expect(fixture.session.tabs.selectedTab?.document.revision == 3)
    }

    @Test func unchangedBytesInAnotherTabDoNotAuthorizeTheReviewedReplacement() async throws {
        let fixture = try Fixture(source: "原稿")
        defer { fixture.window.contentView = nil }
        let source = fixture.editor.string
        let selection = NSRange(location: 0, length: source.utf16.count)
        let request = try fixture.flow.begin(tabs: fixture.session.tabs, editorSource: source, selection: selection)
        let review = try await request.prepareReview(candidate: "提案")
        try fixture.flow.present(review, tabs: fixture.session.tabs, editorSource: source)

        fixture.session.newTab()
        let otherID = try #require(fixture.session.tabs.selectedID)
        fixture.session.applyCommittedSource(source, to: otherID)
        #expect(otherID != fixture.documentID)
        #expect(throws: AssistNativeReview.ApplyError.editorUnavailable) {
            _ = try AssistNativeReview.approve(reviewID: review.id, flow: fixture.flow, session: fixture.session,
                                               origin: .syntheticFixture)
        }
        #expect(fixture.editor.string.utf8.elementsEqual(source.utf8))
        #expect(fixture.session.tabs.tabs.first?.document.revision == 0)
    }

    @Test func aNonKeyWindowDoesNotApplyAReview() async throws {
        let fixture = try Fixture(source: "原稿")
        defer { fixture.window.contentView = nil }
        let source = fixture.editor.string
        let request = try fixture.flow.begin(tabs: fixture.session.tabs, editorSource: source,
                                             selection: NSRange(location: 0, length: source.utf16.count))
        let review = try await request.prepareReview(candidate: "提案")
        try fixture.flow.present(review, tabs: fixture.session.tabs, editorSource: source)
        fixture.window.reportsKey = false

        #expect(throws: AssistNativeReview.ApplyError.editorUnavailable) {
            _ = try AssistNativeReview.approve(reviewID: review.id, flow: fixture.flow, session: fixture.session,
                                               origin: .syntheticFixture)
        }
        #expect(fixture.editor.string.utf8.elementsEqual(source.utf8))
        #expect(fixture.session.tabs.recoveryDrafts.isEmpty)
        #expect(fixture.flow.review == nil)
        fixture.window.reportsKey = true
        #expect(throws: AssistProposalFlow.FlowError.inactive) {
            _ = try AssistNativeReview.approve(reviewID: review.id, flow: fixture.flow, session: fixture.session,
                                               origin: .syntheticFixture)
        }
    }

    @Test func openingAPickerAfterReviewDoesNotApplyTheCandidate() async throws {
        let fixture = try Fixture(source: "原稿")
        defer { fixture.window.contentView = nil }
        let source = fixture.editor.string
        let request = try fixture.flow.begin(tabs: fixture.session.tabs, editorSource: source,
                                             selection: NSRange(location: 0, length: source.utf16.count))
        let review = try await request.prepareReview(candidate: "提案")
        try fixture.flow.present(review, tabs: fixture.session.tabs, editorSource: source)
        fixture.session.requestOpen()
        #expect(fixture.session.isBusy)

        #expect(throws: AssistNativeReview.ApplyError.editorUnavailable) {
            _ = try AssistNativeReview.approve(reviewID: review.id, flow: fixture.flow, session: fixture.session,
                                               origin: .syntheticFixture)
        }
        #expect(fixture.flow.review == nil)
        #expect(fixture.editor.string.utf8.elementsEqual(source.utf8))
        #expect(fixture.editor.undoManager?.canUndo == false)
        #expect(fixture.session.tabs.recoveryDrafts.isEmpty)
    }

    @Test func declinesASyntheticEditWithACustomTextDelegateBeforeCallingIt() async throws {
        let fixture = try Fixture(source: "原稿")
        defer { fixture.window.contentView = nil }
        let source = fixture.editor.string
        let range = NSRange(location: 0, length: source.utf16.count)
        fixture.editor.setSelectedRange(range)
        let request = try fixture.flow.begin(tabs: fixture.session.tabs, editorSource: source,
                                             selection: fixture.editor.selectedRange())
        let review = try await request.prepareReview(candidate: "提案")
        try fixture.flow.present(review, tabs: fixture.session.tabs, editorSource: source)
        let delegate = EditProbeDelegate()
        fixture.editor.delegate = delegate
        defer { fixture.editor.delegate = nil }

        #expect(throws: AssistNativeReview.ApplyError.editorUnavailable) {
            _ = try AssistNativeReview.approve(reviewID: review.id, flow: fixture.flow, session: fixture.session,
                                               origin: .syntheticFixture)
        }
        #expect(delegate.calls == 0)
        #expect(fixture.session.tabs.selectedID == fixture.documentID)
        #expect(fixture.editor.string.utf8.elementsEqual(source.utf8))
        #expect(fixture.editor.undoManager?.canUndo == false)
        #expect(fixture.session.tabs.recoveryDrafts.isEmpty)
        #expect(fixture.flow.review == nil)
    }

    @Test func theSyntheticPathNeverEnqueuesPersistentRecovery() async throws {
        let recovery = RecoveryCheckpointQueue(backend: .init(
            checkpoint: { _ in Issue.record("A synthetic review must not make a recovery checkpoint.") },
            candidates: { [] }, discardConfirmed: { _ in }
        ))
        let fixture = try Fixture(source: "原稿", recovery: recovery)
        defer { fixture.window.contentView = nil }
        let source = fixture.editor.string
        let range = NSRange(location: 0, length: source.utf16.count)
        let request = try fixture.flow.begin(tabs: fixture.session.tabs, editorSource: source, selection: range)
        let review = try await request.prepareReview(candidate: "提案")
        try fixture.flow.present(review, tabs: fixture.session.tabs, editorSource: source)

        #expect(throws: AssistNativeReview.ApplyError.editorUnavailable) {
            _ = try AssistNativeReview.approve(reviewID: review.id, flow: fixture.flow, session: fixture.session,
                                               origin: .syntheticFixture)
        }
        #expect(fixture.editor.string == source)
        #expect(fixture.session.tabs.recoveryDrafts.isEmpty)
        #expect(fixture.flow.review == nil)
    }

    @Test func missingCommitCallbackDoesNotProduceAReceiptOrBypassTheNativeEditor() async throws {
        let fixture = try Fixture(source: "原稿", publishesCommits: false)
        defer { fixture.window.contentView = nil }
        let source = fixture.editor.string
        let selection = NSRange(location: 0, length: source.utf16.count)
        let request = try fixture.flow.begin(tabs: fixture.session.tabs, editorSource: source, selection: selection)
        let review = try await request.prepareReview(candidate: "提案")
        try fixture.flow.present(review, tabs: fixture.session.tabs, editorSource: source)

        #expect(throws: AssistNativeReview.ApplyError.commitNotConfirmed) {
            _ = try AssistNativeReview.approve(reviewID: review.id, flow: fixture.flow, session: fixture.session,
                                               origin: .syntheticFixture)
        }
        #expect(fixture.editor.string == "提案")
        #expect(fixture.session.tabs.selectedTab?.document.source == source)
        #expect(fixture.session.tabs.selectedTab?.document.revision == 0)
        #expect(fixture.flow.review == nil)
        let undo = try #require(fixture.editor.undoManager)
        undo.undo()
        #expect(fixture.editor.string == source)
        #expect(undo.canUndo == false)
    }

    @MainActor
    private final class EditProbeDelegate: NSObject, NSTextViewDelegate {
        private(set) var calls = 0

        func textView(_ textView: NSTextView, shouldChangeTextIn affectedCharRange: NSRange,
                      replacementString: String?) -> Bool {
            calls += 1
            return true
        }
    }

    @MainActor
    private struct Fixture {
        let session: WorkspaceSession
        let documentID: UUID
        let editor: NSTextView
        let window: OffscreenReviewWindow
        let flow = AssistProposalFlow()
        // The existing NSTextStorage observation is owned by the coordinator, not the test text view.
        private let coordinator: TextKitEditor.Coordinator

        init(source: String, publishesCommits: Bool = true, recovery: RecoveryCheckpointQueue? = nil) throws {
            let session = WorkspaceSession(source: source, recovery: recovery)
            let id = try #require(session.tabs.selectedID)
            let coordinator = TextKitEditor(initialText: source, documentID: id,
                                            canEdit: { session.canEditSource },
                                            onCompositionChange: { session.tabs.setComposing($0, in: id) }) { text in
                if publishesCommits { session.applyCommittedSource(text, to: id) }
            }.makeCoordinator()
            let scroll = TextKitEditor.makeScrollView(initialText: source, documentID: id, coordinator: coordinator)
            let editor = try #require(scroll.documentView as? NSTextView)
            let window = OffscreenReviewWindow(contentRect: NSRect(x: 0, y: 0, width: 480, height: 320),
                                               styleMask: [.titled], backing: .buffered, defer: true)
            window.contentView = scroll
            session.window = window
            try #require(window.firstResponder === editor)
            self.session = session
            self.documentID = id
            self.editor = editor
            self.window = window
            self.coordinator = coordinator
        }
    }

    private final class OffscreenReviewWindow: NSWindow {
        var reportsKey = true
        override var isKeyWindow: Bool { reportsKey }
    }
}
