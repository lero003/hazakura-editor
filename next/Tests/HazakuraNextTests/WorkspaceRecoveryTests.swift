import AppKit
import Darwin
@testable import HazakuraNext
import HazakuraNextCore
import Foundation
import Testing

@MainActor
@Suite(.timeLimit(.minutes(1)))
struct WorkspaceRecoveryTests {
    @Test func quitCannotReplaceApprovedWindowCloseBeforeCleanupStarts() async throws {
        let backend = RecoveryFixture(suspendCleanup: true)
        let probe = RecoveryExitProbe()
        let delegate = probe.makeDelegate(recovery: backend.makeQueue())
        let window = delegate.prepareWindow()
        let session = try #require(delegate.session)
        let id = try #require(session.tabs.selectedID)
        session.applyCommittedSource("編集済み", to: id)
        #expect(!delegate.windowShouldClose(window))
        let approval = try #require(probe.completions.first)
        approval(true)
        let cleanup = try #require(delegate.exitCleanupTask)
        #expect(delegate.applicationShouldTerminate(.shared) == .terminateCancel)
        #expect(probe.completions.count == 1)
        await backend.waitForCleanup()
        await backend.finishCleanup(success: true)
        await cleanup.value
        #expect(delegate.session == nil)
        #expect(probe.replies.isEmpty)
    }

    @Test func quitRepliesOnceOnlyAfterApprovedCleanup() async throws {
        let backend = RecoveryFixture(suspendCleanup: true)
        let probe = RecoveryExitProbe()
        let delegate = probe.makeDelegate(recovery: backend.makeQueue())
        let window = delegate.prepareWindow()
        defer { window.close() }
        let session = try #require(delegate.session)
        let id = try #require(session.tabs.selectedID)
        session.applyCommittedSource("編集済み", to: id)
        #expect(delegate.applicationShouldTerminate(.shared) == .terminateLater)
        let approval = try #require(probe.completions.first)
        approval(true)
        let cleanup = try #require(delegate.exitCleanupTask)
        await backend.waitForCleanup()
        approval(true)
        #expect(delegate.applicationShouldTerminate(.shared) == .terminateLater)
        #expect(!delegate.windowShouldClose(window))
        #expect(probe.replies.isEmpty)
        await backend.finishCleanup(success: true)
        await cleanup.value
        #expect(probe.replies == [true])
        approval(true)
        #expect(probe.replies == [true])
    }

    @Test func startupWithoutRecoveryStillAllowsExplicitScratchDiscard() async throws {
        let session = WorkspaceSession(source: "原稿", recoveryUnavailable: true)
        let id = try #require(session.tabs.selectedID)
        #expect(session.recoveryUnavailable)
        session.applyCommittedSource("編集済み", to: id)
        session.requestRecovery()
        #expect(!session.showsRecovery)
        let decision = session.tabs.requestCloseSelected()
        guard case .confirm(let ticket) = decision else { Issue.record("Expected explicit consent"); return }
        let started = session.startTabDiscard(ticket)
        let task = try #require(started)
        await task.value
        #expect(session.tabs.tabs.isEmpty)
    }

    @Test func explicitRestoreOpensAnIndependentCopyAndLeavesTheCandidateIntact() async throws {
        let prior = RecoveryDraft(id: UUID(), revision: 7, source: "# か\u{3099}\r\n")
        let backend = RecoveryFixture(drafts: [prior])
        let queue = backend.makeQueue()
        let session = WorkspaceSession(source: "サンプル", recovery: queue)
        let originalTab = try #require(session.tabs.selectedID)
        #expect(!session.restore(prior))
        #expect(session.tabs.tabs.count == 1)

        session.requestRecovery()
        #expect(session.showsRecovery)
        let candidates = try await session.recoveryCandidates()
        let candidate = try #require(candidates.first)
        #expect(session.restore(candidate))
        #expect(session.tabs.selectedID != originalTab)
        #expect(session.tabs.selectedTab?.document.source.utf8.elementsEqual(prior.source.utf8) == true)
        #expect(session.tabs.tabs.first?.document.source == "サンプル")
        await queue.waitForCurrentWorker()
        #expect(try await session.recoveryCandidates() == [prior])
        let duplicated = await backend.records()
        #expect(duplicated.count == 2)
        #expect(duplicated.contains(prior))
    }

    enum CandidateAtConfirmation: CaseIterable {
        case same, older, newer, differentBytes, missing
    }

    @Test(arguments: CandidateAtConfirmation.allCases)
    func candidateDeletionRequiresTheExactReviewedSnapshot(_ state: CandidateAtConfirmation) async throws {
        let root = FileManager.default.temporaryDirectory.withUnsafeFileSystemRepresentation { path in
            path.flatMap { Darwin.realpath($0, nil) }
        }
        let canonical = try #require(root)
        defer { free(canonical) }
        let folder = URL(fileURLWithPath: String(cString: canonical), isDirectory: true)
            .appending(path: "hazakura-candidate-test-\(UUID())", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: false)
        defer { try? FileManager.default.removeItem(at: folder) }
        let store = DraftRecoveryStore(directory: folder.appending(path: "recovery", directoryHint: .isDirectory))
        let candidate = RecoveryDraft(id: UUID(), revision: 2, source: "が\r\n")
        let other = RecoveryDraft(id: UUID(), revision: 1, source: "別の記録")
        try await store.checkpoint(candidate)
        try await store.checkpoint(other)
        let session = WorkspaceSession(source: "開いている原稿", recovery: RecoveryCheckpointQueue(store: store))
        session.requestRecovery()
        let listed = try await session.recoveryCandidates()
        let reviewed = try #require(listed.first { $0.id == candidate.id })
        let replacement: RecoveryDraft? = switch state {
        case .same: reviewed
        case .older: RecoveryDraft(id: reviewed.id, revision: 1, source: reviewed.source)
        case .newer: RecoveryDraft(id: reviewed.id, revision: 3, source: reviewed.source)
        case .differentBytes: RecoveryDraft(id: reviewed.id, revision: 2, source: "か\u{3099}\r\n")
        case .missing: nil
        }
        if state != .same {
            try #require(try await store.discard(reviewed))
            if let replacement { try await store.checkpoint(replacement) }
        }

        if state == .same {
            try await session.forgetRecoveryCandidate(reviewed)
            #expect(try await store.drafts() == [other])
        } else {
            await #expect(throws: RecoveryCheckpointQueue.QueueError.candidateChanged) {
                try await session.forgetRecoveryCandidate(reviewed)
            }
            #expect(try await store.drafts() == [other] + (replacement.map { [$0] } ?? []))
        }
        #expect(session.tabs.selectedTab?.document.source == "開いている原稿")
    }

    @Test(arguments: [true, false])
    func tabDiscardWaitsForCleanupAndOnlyClosesOnSuccess(cleanupSucceeds: Bool) async throws {
        let backend = RecoveryFixture(suspendCleanup: true)
        let queue = backend.makeQueue()
        let session = WorkspaceSession(source: "原稿", recovery: queue)
        let id = try #require(session.tabs.selectedID)
        session.applyCommittedSource("変更済み", to: id)
        await queue.waitForCurrentWorker()
        #expect(await backend.records().count == 1)
        #expect(session.canRequestTabClose)
        session.requestTabClose()
        try #require(session.pendingDiscard != nil)
        #expect(!session.canRequestTabClose)
        #expect(session.tabs.selectedID == id)
        // The alert binding clears the request on cancellation without starting cleanup.
        session.pendingDiscard = nil
        #expect(session.tabs.selectedID == id)
        #expect(await backend.records().count == 1)
        session.requestTabClose()
        let ticket = try #require(session.pendingDiscard)
        let started = session.startTabDiscard(ticket)
        let task = try #require(started)
        #expect(session.isBusy)
        #expect(session.startTabDiscard(ticket) == nil)
        await backend.waitForCleanup()
        #expect(session.tabs.selectedTab?.document.source == "変更済み")
        await backend.finishCleanup(success: cleanupSucceeds)
        await task.value
        #expect(!session.isBusy)
        #expect(session.tabs.tabs.isEmpty == cleanupSucceeds)
        #expect((session.exitNotice == nil) == cleanupSucceeds)
        #expect(await backend.records().isEmpty == cleanupSucceeds)
    }

    @Test func staleExitDoesNotCloseAndRestagesUnchangedDraftsAfterCleanup() async throws {
        let backend = RecoveryFixture(suspendCleanup: true)
        let queue = backend.makeQueue()
        let session = WorkspaceSession(source: "原稿", recovery: queue)
        let firstID = try #require(session.tabs.selectedID)
        session.applyCommittedSource("先の原稿", to: firstID)
        session.newTab()
        let secondID = try #require(session.tabs.selectedID)
        session.applyCommittedSource("別の原稿", to: secondID)
        await queue.waitForCurrentWorker()
        let reserved = session.reserveExitDiscard()
        let confirmed = try #require(reserved)
        var accepted: Bool?
        let cleanup = Task {
            await session.finishExitDiscard(confirmed) { ready in
                #expect(session.isDiscarding)
                accepted = ready
            }
        }
        await backend.waitForCleanup()
        // Simulate a native callback arriving while the authorization is being processed.
        session.applyCommittedSource("さらに変更", to: firstID)
        await backend.finishCleanup(success: true)
        await cleanup.value
        #expect(accepted == false)
        #expect(session.tabs.tabs.map(\.document.source) == ["さらに変更", "別の原稿"])
        await queue.waitForCurrentWorker()
        let recovered = await backend.records()
        #expect(Set(recovered.map(\.source)) == ["さらに変更", "別の原稿"])
        #expect(session.exitNotice != nil)
    }
}

@MainActor
private final class RecoveryExitProbe {
    var completions: [@MainActor (Bool) -> Void] = []
    var replies: [Bool] = []

    func makeDelegate(recovery: RecoveryCheckpointQueue) -> ScratchApplicationDelegate {
        ScratchApplicationDelegate(source: "原稿", recovery: recovery, presentExit: { _, _, finish in
            self.completions.append(finish)
        }, replyToQuit: { _, allow in
            self.replies.append(allow)
        })
    }
}

private actor RecoveryFixture {
    enum Failure: Error { case cleanup }

    private var drafts: [UUID: RecoveryDraft]
    private let suspendCleanup: Bool
    private var continuation: CheckedContinuation<Bool, Never>?
    private var ready: CheckedContinuation<Void, Never>?

    init(drafts: [RecoveryDraft] = [], suspendCleanup: Bool = false) {
        self.drafts = Dictionary(uniqueKeysWithValues: drafts.map { ($0.id, $0) })
        self.suspendCleanup = suspendCleanup
    }

    @MainActor func makeQueue() -> RecoveryCheckpointQueue {
        RecoveryCheckpointQueue(backend: .init(
            checkpoint: { await self.checkpoint($0) },
            candidates: { await self.records() },
            discardConfirmed: { try await self.discard($0) }
        ))
    }

    func records() -> [RecoveryDraft] { Array(drafts.values) }

    private func checkpoint(_ draft: RecoveryDraft) { drafts[draft.id] = draft }

    private func discard(_ confirmed: [RecoveryDraft]) async throws {
        if suspendCleanup {
            let success = await withCheckedContinuation { continuation in
                self.continuation = continuation
                ready?.resume()
                ready = nil
            }
            guard success else { throw Failure.cleanup }
        }
        for draft in confirmed { drafts[draft.id] = nil }
    }

    func waitForCleanup() async {
        if continuation != nil { return }
        await withCheckedContinuation { ready = $0 }
    }

    func finishCleanup(success: Bool) {
        continuation?.resume(returning: success)
        continuation = nil
    }
}
