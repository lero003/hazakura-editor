import AppKit
import HazakuraNextCore
import HazakuraNextEditor

/// Synthetic-only prototype for a native sheet's begin/approve/end lifecycle. No UI caller yet.
@MainActor
final class AssistReviewHandoff {
    enum HandoffError: Error, Equatable { case editorUnavailable, inactive }

    private enum Decision { case pending, approved, cancelled }

    private enum Phase {
        case preparing(AssistProposalFlow.Request)
        case ready(UUID)
        case showing(UUID, Decision)
        case finished
    }

    private let flow: AssistProposalFlow
    private let documentID: UUID
    private let revision: UInt64
    private weak var session: WorkspaceSession?
    private weak var window: NSWindow?
    private weak var editor: NSTextView?
    private weak var reviewSheet: NSWindow?
    private var phase: Phase

    private init(flow: AssistProposalFlow, request: AssistProposalFlow.Request, session: WorkspaceSession,
                 window: NSWindow, editor: NSTextView, documentID: UUID, revision: UInt64) {
        self.flow = flow
        self.session = session
        self.window = window
        self.editor = editor
        self.documentID = documentID
        self.revision = revision
        phase = .preparing(request)
    }

    static func begin(in session: WorkspaceSession) throws -> AssistReviewHandoff {
        guard session.recovery == nil, !session.recoveryUnavailable,
              let window = session.window, window.isKeyWindow, window.attachedSheet == nil,
              !session.isBusy, session.canEditSource, !session.tabs.isComposing,
              let tab = session.tabs.selectedTab, !tab.isReadOnly,
              let snapshot = TextKitEditor.captureReviewedSelection(in: window, documentID: tab.id),
              session.window === window, window.isKeyWindow, !session.isBusy,
              session.tabs.selectedID == tab.id, session.tabs.selectedTab?.document.revision == tab.document.revision else {
            throw HandoffError.editorUnavailable
        }
        let flow = AssistProposalFlow()
        let request = try flow.begin(tabs: session.tabs, editorSource: snapshot.source, selection: snapshot.range)
        return AssistReviewHandoff(flow: flow, request: request, session: session, window: window,
                                   editor: snapshot.editor, documentID: tab.id, revision: tab.document.revision)
    }

    /// The caller owns the Task and calls cancel on abandonment. A late result cannot publish after cancel.
    func prepare(candidate: String) async throws -> AssistProposalFlow.Review {
        guard case .preparing(let request) = phase else { throw HandoffError.inactive }
        return try await request.prepareReview(candidate: candidate)
    }

    func present(_ review: AssistProposalFlow.Review) throws {
        guard case .preparing = phase else { throw HandoffError.inactive }
        guard let session, let window, let editor, isCurrent(session, in: window, editor: editor),
              let source = TextKitEditor.captureReviewedEdit(in: window, documentID: documentID),
              isCurrent(session, in: window, editor: editor) else {
            cancel()
            throw HandoffError.editorUnavailable
        }
        do {
            try flow.present(review, tabs: session.tabs, editorSource: source)
        } catch AssistProposalFlow.FlowError.inactive {
            // A result from another request must not replace or clear this one.
            throw AssistProposalFlow.FlowError.inactive
        } catch {
            cancel()
            throw error
        }
        phase = .ready(review.id)
    }

    /// Bind after AppKit attaches the exact sheet. No document authorization is granted by presentation.
    func bindSheet(_ sheet: NSWindow, reviewID: UUID) -> Bool {
        guard case .ready(let activeID) = phase, activeID == reviewID,
              let window, session?.window === window, window.attachedSheet === sheet else { return false }
        reviewSheet = sheet
        phase = .showing(reviewID, .pending)
        return true
    }

    /// Call only from the explicit button, before asking AppKit to end this sheet with .OK.
    func approve(reviewID: UUID, in sheet: NSWindow) -> Bool {
        guard case .showing(let activeID, .pending) = phase, activeID == reviewID,
              let window, session?.window === window, reviewSheet === sheet,
              window.attachedSheet === sheet else { return false }
        phase = .showing(reviewID, .approved)
        return true
    }

    /// Call from the native sheet response. Any matching callback consumes the handoff;
    /// if key/focus restoration is not confirmed, do not queue an edit for later.
    func sheetDidEnd(reviewID: UUID, sheet: NSWindow, response: NSApplication.ModalResponse) throws -> AssistNativeReview.Receipt? {
        guard case .showing(let activeID, let decision) = phase, activeID == reviewID,
              reviewSheet === sheet else { return nil }
        // Ignore signals while this sheet is still attached; closing it must supply the actual response.
        guard window?.attachedSheet !== sheet, sheet.sheetParent == nil else { return nil }
        phase = .finished
        reviewSheet = nil
        defer { flow.discardReview(id: reviewID) }
        guard case .approved = decision, response == .OK else { return nil }
        guard let session, let window, let editor, isCurrent(session, in: window, editor: editor) else {
            throw HandoffError.editorUnavailable
        }
        return try AssistNativeReview.approve(reviewID: reviewID, flow: flow, session: session, origin: .syntheticFixture,
                                              expectedEditor: editor)
    }

    func cancel() {
        switch phase {
        case .preparing(let request): flow.discard(requestID: request.id)
        case .ready(let id): flow.discardReview(id: id)
        case .showing(let id, _):
            flow.discardReview(id: id)
            if let sheet = reviewSheet, window?.attachedSheet === sheet || sheet.sheetParent != nil {
                // The approved text is gone; keep only the identity until that sheet ends.
                phase = .showing(id, .cancelled)
                return
            }
        case .finished: break
        }
        phase = .finished
        reviewSheet = nil
    }

    private func isCurrent(_ session: WorkspaceSession, in window: NSWindow, editor: NSTextView) -> Bool {
        session.window === window && window.isKeyWindow && window.attachedSheet == nil &&
            window.firstResponder === editor && editor.window === window &&
            !session.isBusy && session.canEditSource && !session.tabs.isComposing &&
            session.tabs.selectedID == documentID && session.tabs.selectedTab?.document.revision == revision
    }
}
