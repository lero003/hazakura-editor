import Foundation
@testable import HazakuraNextCore
import Testing

@MainActor
struct AssistProposalFlowTests {
    @Test func reviewedSelectionIsDeliveredOnlyOnExplicitApproval() async throws {
        let source = "冒頭\r\n旧い本文\r\n末尾 👩‍💻"
        let tabs = ScratchTabs(source: source)
        let range = NSRange(location: "冒頭\r\n".utf16.count, length: "旧い本文".utf16.count)
        let flow = AssistProposalFlow()
        let request = try flow.begin(tabs: tabs, editorSource: source, selection: range)
        #expect(request.selectedSource == "旧い本文")
        #expect(flow.review == nil)

        let reviewed = try await request.prepareReview(candidate: "新しい本文")
        #expect(flow.review == nil)
        #expect(throws: AssistProposalFlow.FlowError.inactive) {
            try flow.approve(reviewID: reviewed.id, tabs: tabs, editorSource: source) { _ in
                Issue.record("An unpublished proposal must not have an effect.")
            }
        }
        try flow.present(reviewed, tabs: tabs, editorSource: source)
        #expect(flow.review?.id == reviewed.id)
        #expect(reviewed.before == "旧い本文")
        #expect(reviewed.after == "新しい本文")
        #expect(reviewed.rows.map(\.kind) == [.removed, .added])
        #expect(tabs.selectedTab?.document.source == source)

        var calls = 0
        try flow.approve(reviewID: reviewed.id, tabs: tabs, editorSource: source) { edit in
            calls += 1
            #expect(edit.selection == range)
            #expect(edit.replacement == "新しい本文")
            #expect(edit.resultingSource.utf8.elementsEqual("冒頭\r\n新しい本文\r\n末尾 👩‍💻".utf8))
            #expect(edit.documentID == tabs.selectedID)
            #expect(edit.revision == 0)
        }
        #expect(calls == 1)
        #expect(flow.review == nil)
        #expect(throws: AssistProposalFlow.FlowError.inactive) {
            try flow.approve(reviewID: reviewed.id, tabs: tabs, editorSource: source) { _ in
                Issue.record("A second action must not have an effect.")
            }
        }
        #expect(tabs.recoveryDrafts.isEmpty)
    }

    @Test func cancelledResultCannotPublishOverAnotherRequest() async throws {
        let source = "本文"
        let tabs = ScratchTabs(source: source)
        let range = NSRange(location: 0, length: source.utf16.count)
        let flow = AssistProposalFlow()
        let old = try flow.begin(tabs: tabs, editorSource: source, selection: range)
        #expect(throws: AssistProposalFlow.FlowError.busy) {
            _ = try flow.begin(tabs: tabs, editorSource: source, selection: range)
        }
        flow.discard(requestID: old.id)
        let next = try flow.begin(tabs: tabs, editorSource: source, selection: range)
        let late = try await old.prepareReview(candidate: "古い提案")
        #expect(throws: AssistProposalFlow.FlowError.inactive) {
            try flow.present(late, tabs: tabs, editorSource: source)
        }
        flow.discard(requestID: old.id)
        let current = try await next.prepareReview(candidate: "現在の提案")
        try flow.present(current, tabs: tabs, editorSource: source)
        let competitor = try await next.prepareReview(candidate: "同じ要求の別候補")
        #expect(throws: AssistProposalFlow.FlowError.inactive) {
            try flow.present(competitor, tabs: tabs, editorSource: source)
        }
        #expect(throws: AssistProposalFlow.FlowError.inactive) {
            try flow.approve(reviewID: competitor.id, tabs: tabs, editorSource: source) { _ in
                Issue.record("A different candidate must not approve the displayed proposal.")
            }
        }
        #expect(flow.review?.id == current.id)
        flow.discard(requestID: next.id)
        #expect(flow.review == nil)
    }

    @Test func editedBackToTheSameBytesIsStillStaleBeforePresentation() async throws {
        let source = "原稿"
        var tabs = ScratchTabs(source: source)
        let documentID = try #require(tabs.selectedID)
        let flow = AssistProposalFlow()
        let range = NSRange(location: 0, length: source.utf16.count)
        let request = try flow.begin(tabs: tabs, editorSource: source, selection: range)
        let result = try await request.prepareReview(candidate: "提案")

        tabs.applyCommittedSource("編集中", to: documentID)
        tabs.applyCommittedSource(source, to: documentID)
        #expect(throws: AssistProposalFlow.FlowError.staleTarget) {
            try flow.present(result, tabs: tabs, editorSource: source)
        }
        #expect(flow.review == nil)
        let restarted = try flow.begin(tabs: tabs, editorSource: source, selection: range)
        #expect(restarted.id != request.id)
    }

    @Test(arguments: ["nativeBytes", "selectionChanged", "composition"])
    func rejectsAStaleReviewAtApproval(_ change: String) async throws {
        let source = "か\u{3099}原稿"
        var tabs = ScratchTabs(source: source)
        let documentID = try #require(tabs.selectedID)
        let selection = NSRange(location: 0, length: source.utf16.count)
        let flow = AssistProposalFlow()
        let request = try flow.begin(tabs: tabs, editorSource: source, selection: selection)
        let reviewed = try await request.prepareReview(candidate: "提案")
        try flow.present(reviewed, tabs: tabs, editorSource: source)
        var nativeSource = source
        switch change {
        case "nativeBytes": nativeSource = "が原稿"
        case "selectionChanged": tabs.newTab()
        default: tabs.setComposing(true, in: documentID)
        }
        #expect(throws: AssistProposalFlow.FlowError.staleTarget) {
            try flow.approve(reviewID: reviewed.id, tabs: tabs, editorSource: nativeSource) { _ in
                Issue.record("A stale review must not have an effect.")
            }
        }
        #expect(flow.review == nil)
    }

    @Test func refusesChangesThatCannotBeFullyShownInTheCurrentDiff() async throws {
        let prefix = String(repeating: "x", count: 1_024)
        let long = prefix + "a"
        let many = String(repeating: "a\n", count: 1_001)
        for (before, after) in [(long, prefix + "b"), (many, String(repeating: "b\n", count: 1_001))] {
            let flow = AssistProposalFlow()
            let tabs = ScratchTabs(source: before)
            let range = NSRange(location: 0, length: before.utf16.count)
            let request = try flow.begin(tabs: tabs, editorSource: before, selection: range)
            await #expect(throws: AssistProposalFlow.FlowError.unreviewable) {
                _ = try await request.prepareReview(candidate: after)
            }
            #expect(flow.review == nil)
        }
    }

    @Test func singleApprovalIsConsumedEvenIfTheNativeAdapterRefuses() async throws {
        enum Rejected: Error { case nativeBuffer }
        let source = "原稿"
        let tabs = ScratchTabs(source: source)
        let selection = NSRange(location: 0, length: source.utf16.count)
        let flow = AssistProposalFlow()
        let request = try flow.begin(tabs: tabs, editorSource: source, selection: selection)
        let review = try await request.prepareReview(candidate: "提案")
        try flow.present(review, tabs: tabs, editorSource: source)

        #expect(throws: Rejected.nativeBuffer) {
            try flow.approve(reviewID: review.id, tabs: tabs, editorSource: source) { _ in
                #expect(flow.review == nil)
                do {
                    _ = try flow.begin(tabs: tabs, editorSource: source, selection: selection)
                    Issue.record("The synchronous adapter must not start a second request.")
                } catch AssistProposalFlow.FlowError.busy {
                    // The window still owns the approval operation until the adapter returns.
                } catch {
                    Issue.record("Unexpected error: \(error)")
                }
                throw Rejected.nativeBuffer
            }
        }
        #expect(throws: AssistProposalFlow.FlowError.inactive) {
            try flow.approve(reviewID: review.id, tabs: tabs, editorSource: source) { _ in
                Issue.record("A rejected edit needs a new review.")
            }
        }
        let restarted = try flow.begin(tabs: tabs, editorSource: source, selection: selection)
        #expect(restarted.id != request.id)
    }

    @Test func cancellationBetweenPreparationAndPresentationInvalidatesOnlyThatRequest() async throws {
        let source = "原稿"
        let tabs = ScratchTabs(source: source)
        let selection = NSRange(location: 0, length: source.utf16.count)
        let flow = AssistProposalFlow()
        let request = try flow.begin(tabs: tabs, editorSource: source, selection: selection)
        let reviewed = try await request.prepareReview(candidate: "提案")
        let presentation = Task { @MainActor in
            try flow.present(reviewed, tabs: tabs, editorSource: source)
        }
        presentation.cancel()
        await #expect(throws: CancellationError.self) { try await presentation.value }
        #expect(flow.review == nil)
        let next = try flow.begin(tabs: tabs, editorSource: source, selection: selection)
        #expect(next.id != request.id)
    }

    @Test func cancelledTaskDoesNotBuildAReview() async throws {
        let source = "原稿"
        let flow = AssistProposalFlow()
        let request = try flow.begin(tabs: ScratchTabs(source: source), editorSource: source,
                                     selection: NSRange(location: 0, length: 2))
        await withThrowingTaskGroup(of: AssistProposalFlow.Review.self) { group in
            group.cancelAll()
            group.addTask { try await request.prepareReview(candidate: "提案") }
            await #expect(throws: CancellationError.self) { try await group.next() }
        }
        #expect(flow.review == nil)
    }
}
