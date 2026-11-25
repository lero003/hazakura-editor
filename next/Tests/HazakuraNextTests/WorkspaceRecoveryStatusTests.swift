import Darwin
import Foundation
@testable import HazakuraNext
import HazakuraNextCore
import Observation
import Synchronization
import Testing

@MainActor
@Suite(.timeLimit(.minutes(1)))
struct WorkspaceRecoveryStatusTests {
    @Test func staleCheckpointCannotConfirmTheCurrentRevision() async throws {
        let firstWrite = RecoveryStatusGate()
        let latestWrite = RecoveryStatusGate()
        let backend = RecoveryStatusBackend(writeGates: [1: firstWrite, 2: latestWrite])
        defer { backend.finish() }
        let queue = backend.makeQueue()
        let session = WorkspaceSession(source: "初稿", recovery: queue)
        let id = try #require(session.tabs.selectedID)
        var calls = backend.calls.makeAsyncIterator()

        session.applyCommittedSource("最初の編集", to: id)
        let first = try #require(session.tabs.recoveryDraft(for: id))
        #expect(session.selectedRecoveryStatus == .unconfirmed)
        try #require(await calls.next() == .checkpoint(first))
        #expect(session.selectedRecoveryStatus == .unconfirmed)

        session.applyCommittedSource("次の編集", to: id)
        let latest = try #require(session.tabs.recoveryDraft(for: id))
        try #require(latest.id == first.id)
        try #require(latest.revision > first.revision)
        #expect(session.selectedRecoveryStatus == .unconfirmed)

        firstWrite.release()
        // The serial worker can only start this call after the first checkpoint returned.
        try #require(await calls.next() == .checkpoint(latest))
        #expect(session.selectedRecoveryStatus == .unconfirmed)

        let invalidated = Mutex(false)
        withObservationTracking {
            _ = session.selectedRecoveryStatus
        } onChange: {
            invalidated.withLock { $0 = true }
        }
        latestWrite.release()
        await queue.waitForCurrentWorker()

        #expect(invalidated.withLock { $0 }, "The checkpoint result must invalidate observers without another edit.")
        #expect(session.selectedRecoveryStatus == .checkpointed)
    }

    @Test func aFailedLatestCheckpointRemainsUnconfirmedDespiteAnEarlierSuccess() async throws {
        let failedWrite = RecoveryStatusGate()
        let backend = RecoveryStatusBackend(writeGates: [2: failedWrite], failingWrite: 2)
        defer { backend.finish() }
        let queue = backend.makeQueue()
        let session = WorkspaceSession(source: "初稿", recovery: queue)
        let id = try #require(session.tabs.selectedID)
        var calls = backend.calls.makeAsyncIterator()

        session.applyCommittedSource("退避できた編集", to: id)
        let first = try #require(session.tabs.recoveryDraft(for: id))
        await queue.waitForCurrentWorker()
        #expect(session.selectedRecoveryStatus == .checkpointed)
        try #require(await calls.next() == .checkpoint(first))

        session.applyCommittedSource("退避できなかった編集", to: id)
        let latest = try #require(session.tabs.recoveryDraft(for: id))
        #expect(session.selectedRecoveryStatus == .unconfirmed)
        try #require(await calls.next() == .checkpoint(latest))
        failedWrite.release()
        await queue.waitForCurrentWorker()

        #expect(queue.failure != nil)
        #expect(session.selectedRecoveryStatus == .unconfirmed)
    }

    @Test func tabsWithIdenticalTextAndRevisionConfirmIndependently() async throws {
        let secondWrite = RecoveryStatusGate()
        let backend = RecoveryStatusBackend(writeGates: [2: secondWrite])
        defer { backend.finish() }
        let queue = backend.makeQueue()
        let session = WorkspaceSession(source: "", recovery: queue)
        let firstID = try #require(session.tabs.selectedID)
        let source = "同じ本文"
        var calls = backend.calls.makeAsyncIterator()

        session.applyCommittedSource(source, to: firstID)
        let first = try #require(session.tabs.recoveryDraft(for: firstID))
        await queue.waitForCurrentWorker()
        #expect(session.selectedRecoveryStatus == .checkpointed)
        try #require(await calls.next() == .checkpoint(first))

        session.newTab()
        let secondID = try #require(session.tabs.selectedID)
        #expect(session.selectedRecoveryStatus == nil)
        session.applyCommittedSource(source, to: secondID)
        let second = try #require(session.tabs.recoveryDraft(for: secondID))
        try #require(second.id != first.id)
        try #require(second.revision == first.revision)
        try #require(await calls.next() == .checkpoint(second))
        #expect(session.selectedRecoveryStatus == .unconfirmed)
        let selectedFirst = session.tabs.select(firstID)
        try #require(selectedFirst)
        #expect(session.selectedRecoveryStatus == .checkpointed)
        let selectedSecond = session.tabs.select(secondID)
        try #require(selectedSecond)
        #expect(session.selectedRecoveryStatus == .unconfirmed)

        let reselectedFirst = session.tabs.select(firstID)
        try #require(reselectedFirst)
        secondWrite.release()
        await queue.waitForCurrentWorker()
        #expect(session.tabs.selectedID == firstID)
        #expect(session.selectedRecoveryStatus == .checkpointed)
        let reselectedSecond = session.tabs.select(secondID)
        try #require(reselectedSecond)
        #expect(session.selectedRecoveryStatus == .checkpointed)
    }

    @Test(arguments: [false, true])
    func editsWithNoRecoveryQueueHaveNoStatus(recoveryUnavailable: Bool) throws {
        let session = WorkspaceSession(source: "初稿", recoveryUnavailable: recoveryUnavailable)
        let id = try #require(session.tabs.selectedID)
        session.applyCommittedSource("編集済み", to: id)
        try #require(session.tabs.recoveryDraft(for: id) != nil)
        #expect(session.selectedRecoveryStatus == nil)
    }

    @Test func pristineReadOnlyAndComposingSelectionsHaveNoStatus() async throws {
        let backend = RecoveryStatusBackend()
        defer { backend.finish() }
        let queue = backend.makeQueue()
        let session = WorkspaceSession(source: "初稿", recovery: queue)
        let id = try #require(session.tabs.selectedID)
        #expect(session.selectedRecoveryStatus == nil)

        session.applyCommittedSource("編集済み", to: id)
        await queue.waitForCurrentWorker()
        #expect(session.selectedRecoveryStatus == .checkpointed)
        session.tabs.setComposing(true, in: id)
        #expect(session.selectedRecoveryStatus == nil)
        session.tabs.setComposing(false, in: id)
        #expect(session.selectedRecoveryStatus == .checkpointed)

        let root = FileManager.default.temporaryDirectory.withUnsafeFileSystemRepresentation { path in
            path.flatMap { Darwin.realpath($0, nil) }
        }
        let canonical = try #require(root)
        defer { free(canonical) }
        let folder = URL(fileURLWithPath: String(cString: canonical), isDirectory: true)
            .appending(path: "hazakura-recovery-status-\(UUID())", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: false)
        defer { try? FileManager.default.removeItem(at: folder) }
        let url = folder.appending(path: "原稿.md")
        try Data("読み取り専用".utf8).write(to: url)
        let file = try await SelectedTextFile.read(from: url)
        let opened = session.tabs.openReadOnly(file)
        try #require(opened != nil)
        #expect(session.selectedRecoveryStatus == nil)
    }

    @Test func confirmedDiscardHidesStatusWhileCleanupIsInProgress() async throws {
        let cleanup = RecoveryStatusGate()
        let backend = RecoveryStatusBackend(cleanupGate: cleanup)
        defer { backend.finish() }
        let queue = backend.makeQueue()
        let session = WorkspaceSession(source: "初稿", recovery: queue)
        let id = try #require(session.tabs.selectedID)
        var calls = backend.calls.makeAsyncIterator()

        session.applyCommittedSource("編集済み", to: id)
        let draft = try #require(session.tabs.recoveryDraft(for: id))
        await queue.waitForCurrentWorker()
        #expect(session.selectedRecoveryStatus == .checkpointed)
        try #require(await calls.next() == .checkpoint(draft))
        guard case .confirm(let ticket) = session.tabs.requestCloseSelected() else {
            Issue.record("Expected explicit discard confirmation.")
            return
        }

        let started = session.startTabDiscard(ticket)
        let task = try #require(started)
        #expect(session.selectedRecoveryStatus == nil)
        try #require(await calls.next() == .discard([draft]))
        #expect(session.tabs.selectedID == id)
        #expect(session.selectedRecoveryStatus == nil)
        cleanup.release()
        await task.value
        #expect(session.tabs.selectedID == nil)
        #expect(session.selectedRecoveryStatus == nil)
        #expect(!queue.hasCheckpointed(draft))
    }
}

/// Like the queue tests, finishing a gate releases present and future waiters.
private struct RecoveryStatusGate: Sendable {
    private let pair = AsyncStream<Void>.makeStream()

    func wait() async {
        var iterator = pair.stream.makeAsyncIterator()
        _ = await iterator.next()
    }

    func release() { pair.continuation.finish() }
}

private actor RecoveryStatusBackend {
    enum Call: Equatable, Sendable {
        case checkpoint(RecoveryDraft)
        case discard([RecoveryDraft])
    }

    private enum Failure: Error { case checkpoint }

    nonisolated let calls: AsyncStream<Call>
    private let continuation: AsyncStream<Call>.Continuation
    private let writeGates: [Int: RecoveryStatusGate]
    private let failingWrite: Int?
    private let cleanupGate: RecoveryStatusGate?
    private var writeCount = 0

    init(writeGates: [Int: RecoveryStatusGate] = [:], failingWrite: Int? = nil,
         cleanupGate: RecoveryStatusGate? = nil) {
        (calls, continuation) = AsyncStream<Call>.makeStream()
        self.writeGates = writeGates
        self.failingWrite = failingWrite
        self.cleanupGate = cleanupGate
    }

    @MainActor func makeQueue() -> RecoveryCheckpointQueue {
        RecoveryCheckpointQueue(backend: .init(
            checkpoint: checkpoint,
            candidates: {
                Issue.record("Recovery status must not read the persisted candidates.")
                return []
            },
            discardConfirmed: discardConfirmed
        ))
    }

    // Called from defer even when a required setup assertion throws with a write or cleanup suspended.
    nonisolated func finish() {
        for gate in writeGates.values { gate.release() }
        cleanupGate?.release()
        continuation.finish()
    }

    private func checkpoint(_ draft: RecoveryDraft) async throws {
        writeCount += 1
        let index = writeCount
        continuation.yield(.checkpoint(draft))
        await writeGates[index]?.wait()
        if index == failingWrite { throw Failure.checkpoint }
    }

    private func discardConfirmed(_ drafts: [RecoveryDraft]) async {
        continuation.yield(.discard(drafts))
        await cleanupGate?.wait()
    }
}
