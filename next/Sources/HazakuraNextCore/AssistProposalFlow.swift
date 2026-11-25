import Foundation

/// One window-owned, in-memory review flow. No inference, editor writes, file access, or persistence.
/// The caller owns and cancels its preparation task, and discards the request on cancellation or failure.
@MainActor
package final class AssistProposalFlow {
    package enum FlowError: Error, Equatable {
        case busy, inactive, staleTarget, unreviewable
    }

    package struct Request: Sendable {
        package let id: UUID
        fileprivate let target: AssistProposalTarget

        package var selectedSource: String { target.selectedSource }

        /// Run this on the response to the fixed selection. The review is not published by this work.
        @concurrent
        package func prepareReview(candidate: String) async throws -> Review {
            try Task.checkCancellation()
            let resultingSource = try target.prepareReplacement(candidate)
            let diff = try await LineDiff.compare(before: selectedSource, after: candidate)
            try Task.checkCancellation()
            // The existing Diff view truncates per-line text beyond 1 KiB. Reject a review
            // that would hide any text rather than deriving approval from a shortened diff.
            guard case .rows(let rows) = diff,
                  rows.allSatisfy({ $0.text.utf8.prefix(1_025).count <= 1_024 }) else { throw FlowError.unreviewable }
            return Review(id: UUID(), requestID: id, target: target, after: candidate,
                          rows: rows, resultingSource: resultingSource)
        }
    }

    package struct Review: Sendable, Identifiable {
        package let id: UUID
        fileprivate let requestID: UUID
        fileprivate let target: AssistProposalTarget
        package let after: String
        package let rows: [LineDiff.Row]
        fileprivate let resultingSource: String

        package var before: String { target.selectedSource }
    }

    /// Data for a synchronous native edit, not a reusable approval credential.
    package struct ReviewedEdit {
        package let documentID: UUID
        package let revision: UInt64
        package let selection: NSRange
        package let replacement: String
        package let resultingSource: String
    }

    private enum Phase {
        case idle, preparing(Request), reviewing(Review), applying
    }

    private var phase: Phase = .idle

    package init() {}

    package var review: Review? {
        guard case .reviewing(let review) = phase else { return nil }
        return review
    }

    package func begin(tabs: ScratchTabs, editorSource: String, selection: NSRange) throws -> Request {
        guard case .idle = phase else { throw FlowError.busy }
        guard !tabs.isComposing, let tab = tabs.selectedTab, !tab.isReadOnly else { throw FlowError.staleTarget }
        let target = try AssistProposalTarget(document: tab.document, selection: selection)
        guard target.matches(document: tab.document, editorSource: editorSource) else { throw FlowError.staleTarget }
        let request = Request(id: UUID(), target: target)
        phase = .preparing(request)
        return request
    }

    package func present(_ review: Review, tabs: ScratchTabs, editorSource: String) throws {
        guard case .preparing(let request) = phase, request.id == review.requestID else { throw FlowError.inactive }
        if Task.isCancelled {
            phase = .idle
            throw CancellationError()
        }
        guard Self.matches(request.target, tabs: tabs, editorSource: editorSource) else {
            phase = .idle
            throw FlowError.staleTarget
        }
        phase = .reviewing(review)
    }

    package func discard(requestID: UUID) {
        switch phase {
        case .preparing(let request) where request.id == requestID: phase = .idle
        case .reviewing(let review) where review.requestID == requestID: phase = .idle
        default: break
        }
    }

    /// Call only from the explicit approval action. The caller must use fresh native state and
    /// perform the edit synchronously, without queuing it or applying it to the document model first.
    /// On success or failure, another attempt requires a new request and review.
    package func approve(
        reviewID: UUID, tabs: ScratchTabs, editorSource: String,
        perform: (ReviewedEdit) throws -> Void
    ) throws {
        guard case .reviewing(let review) = phase, review.id == reviewID else { throw FlowError.inactive }
        phase = .applying
        defer { phase = .idle }
        guard Self.matches(review.target, tabs: tabs, editorSource: editorSource) else { throw FlowError.staleTarget }
        try perform(ReviewedEdit(documentID: review.target.documentID, revision: review.target.revision,
                                 selection: review.target.range, replacement: review.after,
                                 resultingSource: review.resultingSource))
    }

    private static func matches(_ target: AssistProposalTarget, tabs: ScratchTabs, editorSource: String) -> Bool {
        guard !tabs.isComposing, let tab = tabs.selectedTab, !tab.isReadOnly else { return false }
        return target.matches(document: tab.document, editorSource: editorSource)
    }
}
