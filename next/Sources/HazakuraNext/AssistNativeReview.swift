import AppKit
import HazakuraNextCore
import HazakuraNextEditor

/// Testable connection between reviewed data and one native edit. Not connected to a menu or model.
@MainActor
enum AssistNativeReview {
    enum Origin: Equatable { case syntheticFixture }
    enum ApplyError: Error, Equatable { case editorUnavailable, nativeRefused, commitNotConfirmed }

    /// Evidence of an observed edit, not a permission to replay it. The caller holds it in memory.
    struct Receipt {
        let reviewID: UUID
        let origin: Origin
        let documentID: UUID
        let appliedRevision: UInt64
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
        guard session.recovery == nil, !session.recoveryUnavailable,
              let window = session.window, window.isKeyWindow,
              !session.isBusy, session.canEditSource, !session.tabs.isComposing,
              let tab = session.tabs.selectedTab, !tab.isReadOnly,
              expectedEditor == nil || window.firstResponder === expectedEditor,
              let source = TextKitEditor.captureReviewedEdit(in: window, documentID: tab.id),
              expectedEditor == nil || window.firstResponder === expectedEditor else {
            throw ApplyError.editorUnavailable
        }

        var receipt: Receipt?
        try flow.approve(reviewID: reviewID, tabs: session.tabs, editorSource: source) { edit in
            guard TextKitEditor.applyReviewedEdit(in: window, documentID: edit.documentID, expectedSource: source,
                                                 selection: edit.selection, replacement: edit.replacement,
                                                 resultingSource: edit.resultingSource, stillCurrent: {
                session.window === window && window.isKeyWindow &&
                    (expectedEditor == nil || window.firstResponder === expectedEditor) &&
                    !session.isBusy && session.canEditSource &&
                    !session.tabs.isComposing && session.tabs.selectedID == edit.documentID &&
                    session.tabs.selectedTab?.document.revision == edit.revision
            }) else { throw ApplyError.nativeRefused }
            // Only the normal native committed-text callback can advance the session revision.
            // A missing/mismatched callback is not a reason to write the source a second time.
            guard let committed = session.tabs.selectedTab?.document,
                  committed.id == edit.documentID, committed.revision > edit.revision,
                  committed.revision - edit.revision == 1,
                  committed.source.utf8.elementsEqual(edit.resultingSource.utf8) else {
                throw ApplyError.commitNotConfirmed
            }
            receipt = Receipt(reviewID: review.id, origin: origin, documentID: committed.id,
                              appliedRevision: committed.revision, selection: edit.selection,
                              before: review.before, after: review.after)
        }
        guard let receipt else { throw ApplyError.commitNotConfirmed }
        return receipt
    }
}
