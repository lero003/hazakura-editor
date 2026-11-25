import AppKit
import HazakuraNextCore
import HazakuraNextEditor

/// Testable connection between reviewed data and one native edit. Not connected to a menu or model.
@MainActor
enum AssistNativeReview {
    enum Origin: Equatable { case syntheticFixture }
    enum Confirmation: Equatable { case nativeCallback, reconciledFromEditor }
    enum ApplyError: Error, Equatable { case editorUnavailable, nativeRefused, commitNotConfirmed }

    /// Evidence of an observed edit, not a permission to replay it. The caller holds it in memory.
    struct Receipt {
        let reviewID: UUID
        let origin: Origin
        let documentID: UUID
        let appliedRevision: UInt64
        let confirmation: Confirmation
        let selection: NSRange
        let before: String
        let after: String
    }

    static func approve(reviewID: UUID, flow: AssistProposalFlow, session: WorkspaceSession, origin: Origin,
                        expectedEditor: NSTextView? = nil) throws -> Receipt {
        guard let review = flow.review, review.id == reviewID else { throw AssistProposalFlow.FlowError.inactive }
        defer { flow.discardReview(id: reviewID) }
        // The synthetic connection is only for a session without persistent recovery. A production
        // integration must define the review/dismissal lifecycle before using a real session.
        guard let window = session.window, let tab = session.tabs.selectedTab,
              let editor = window.firstResponder as? NSTextView,
              expectedEditor == nil || editor === expectedEditor else { throw ApplyError.editorUnavailable }

        func sameEditingContext() -> Bool {
            session.recovery == nil && !session.recoveryUnavailable && session.window === window &&
                window.isKeyWindow && window.attachedSheet == nil && window.firstResponder === editor &&
                editor.window === window && !session.isBusy && session.canEditSource && !session.tabs.isComposing &&
                session.tabs.selectedID == tab.id && session.tabs.selectedTab?.isReadOnly == false
        }

        func confirmedEditorSource() -> String? {
            guard sameEditingContext(), let text = TextKitEditor.captureReviewedEdit(in: window, documentID: tab.id),
                  sameEditingContext() else { return nil }
            return text
        }

        guard let source = confirmedEditorSource() else { throw ApplyError.editorUnavailable }
        var receipt: Receipt?
        try flow.approve(reviewID: reviewID, tabs: session.tabs, editorSource: source) { edit in
            guard TextKitEditor.applyReviewedEdit(in: window, documentID: edit.documentID, expectedSource: source,
                                                 selection: edit.selection, replacement: edit.replacement,
                                                 resultingSource: edit.resultingSource, stillCurrent: {
                sameEditingContext() && session.tabs.selectedTab?.document.revision == edit.revision
            }) else { throw ApplyError.nativeRefused }

            guard let native = confirmedEditorSource(), native.utf8.elementsEqual(edit.resultingSource.utf8),
                  let model = session.tabs.selectedTab?.document else { throw ApplyError.commitNotConfirmed }
            let confirmation: Confirmation
            if model.revision == edit.revision, model.source.utf8.elementsEqual(source.utf8) {
                // Only in the memory-only demo, reconcile an unchanged model with the verified
                // native buffer. Do not perform another replacement or Undo automatically.
                session.applyCommittedSource(native, to: edit.documentID)
                guard let checked = confirmedEditorSource(), checked.utf8.elementsEqual(native.utf8) else {
                    throw ApplyError.commitNotConfirmed
                }
                confirmation = .reconciledFromEditor
            } else {
                confirmation = .nativeCallback
            }

            guard let committed = session.tabs.selectedTab?.document,
                  committed.id == edit.documentID, committed.revision > edit.revision,
                  committed.revision - edit.revision == 1, committed.source.utf8.elementsEqual(native.utf8) else {
                throw ApplyError.commitNotConfirmed
            }
            receipt = Receipt(reviewID: review.id, origin: origin, documentID: committed.id,
                              appliedRevision: committed.revision, confirmation: confirmation,
                              selection: edit.selection, before: review.before, after: review.after)
        }
        guard let receipt else { throw ApplyError.commitNotConfirmed }
        return receipt
    }
}
