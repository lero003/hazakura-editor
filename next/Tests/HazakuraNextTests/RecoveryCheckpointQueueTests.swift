import Foundation
import HazakuraNextCore
import Testing
@testable import HazakuraNext

@MainActor
@Suite(.timeLimit(.minutes(1)))
struct RecoveryCheckpointQueueTests {
    @Test func coalescesByRecoveryIDWithoutPuttingAnUpdatedIDAtTheBack() async throws {
        let gate = Gate()
        defer { gate.release() }
        let store = ControlledStore(firstCheckpointGate: gate)
        let queue = makeQueue(store)
        var calls = store.calls.makeAsyncIterator()
        let first = draft(1)
        let next = draft(2, id: first.id)
        let latest = draft(3, id: first.id)
        let other = draft(1)
        let otherLatest = draft(2, id: other.id)

        queue.enqueue(first)
        try #require(await calls.next() == .checkpoint(first))
        queue.enqueue(next)
        queue.enqueue(other)
        queue.enqueue(latest)
        queue.enqueue(next) // An older snapshot cannot replace the pending latest one.
        queue.enqueue(otherLatest)
        gate.release()
        await queue.waitForCurrentWorker()

        #expect(await store.history == [.checkpoint(first), .checkpoint(latest), .checkpoint(otherLatest)])
        #expect(await store.overlappingMutations == false)
        #expect(queue.failure == nil)
    }

    @Test(arguments: [true, false])
    func cleanupWaitsThenSuppressesConfirmedOrOlderWritesOnlyOnSuccess(succeeds: Bool) async throws {
        let writeGate = Gate()
        let cleanupGate = Gate()
        defer { writeGate.release(); cleanupGate.release() }
        let store = ControlledStore(firstCheckpointGate: writeGate, cleanupGate: cleanupGate,
                                    failsCleanup: !succeeds)
        let queue = makeQueue(store)
        var calls = store.calls.makeAsyncIterator()
        let first = draft(1)
        let confirmed = draft(2, id: first.id)
        let older = draft(1)
        let confirmedAfterOlder = draft(2, id: older.id)
        let editedDuringCleanup = draft(1)
        let edit = draft(2, id: editedDuringCleanup.id)
        let latestEdit = draft(3, id: editedDuringCleanup.id)
        let unrelated = draft(1)
        let batch = [confirmed, confirmedAfterOlder, editedDuringCleanup]

        queue.enqueue(first)
        try #require(await calls.next() == .checkpoint(first))
        queue.enqueue(confirmed)
        queue.enqueue(older)
        queue.enqueue(editedDuringCleanup)

        // Begin the cleanup synchronously on MainActor, before releasing the write gate.
        let cleanup = Task.immediate { @MainActor in try await queue.discardConfirmed(batch) }
        #expect(await store.history == [.checkpoint(first)])
        writeGate.release()
        try #require(await calls.next() == .discard(batch))
        #expect(await store.overlappingMutations == false)
        queue.enqueue(confirmed)
        queue.enqueue(edit)
        queue.enqueue(unrelated)
        queue.enqueue(latestEdit)
        #expect(await store.history == [.checkpoint(first), .discard(batch)])
        cleanupGate.release()

        if succeeds {
            try await cleanup.value
        } else {
            await #expect(throws: TestError.io) { try await cleanup.value }
        }
        await queue.waitForCurrentWorker()
        let retained = succeeds ? [] : [Call.checkpoint(confirmed), .checkpoint(older)]
        #expect(await store.history == [.checkpoint(first), .discard(batch)] + retained + [
            .checkpoint(latestEdit), .checkpoint(unrelated),
        ])
        let candidates = try await queue.candidates()
        #expect(candidates.contains(latestEdit))
        #expect(candidates.contains(unrelated))
        #expect(candidates.contains(confirmed) == !succeeds)
        #expect(candidates.contains(older) == !succeeds)
        #expect(queue.hasCheckpointed(first) == false)
        #expect(queue.hasCheckpointed(confirmed) == !succeeds)
        #expect(queue.hasCheckpointed(latestEdit))
        #expect(queue.hasCheckpointed(unrelated))
        #expect(await store.overlappingMutations == false)
    }

    @Test func cleanupBeforeWorkerStartsDiscardsWithoutWritingConfirmedSnapshot() async throws {
        let store = ControlledStore()
        let queue = makeQueue(store)
        let confirmed = draft(1)

        queue.enqueue(confirmed)
        try await queue.discardConfirmed([confirmed])
        await queue.waitForCurrentWorker()

        #expect(await store.history == [.discard([confirmed])])
        let candidates = try await queue.candidates()
        #expect(candidates.isEmpty)
    }

    @Test func queuedNewerEditAbortsCleanupBeforeAnyPersistentDeletion() async throws {
        let gate = Gate()
        defer { gate.release() }
        let store = ControlledStore(firstCheckpointGate: gate)
        let queue = makeQueue(store)
        var calls = store.calls.makeAsyncIterator()
        let first = draft(1)
        let newer = draft(2, id: first.id)
        queue.enqueue(first)
        try #require(await calls.next() == .checkpoint(first))
        let cleanup = Task.immediate { @MainActor in try await queue.discardConfirmed([first]) }
        queue.enqueue(newer)
        gate.release()
        var rejected = false
        do { try await cleanup.value } catch { rejected = true }
        #expect(rejected)
        await queue.waitForCurrentWorker()
        #expect(await store.history == [.checkpoint(first), .checkpoint(newer)])
    }

    @Test func failedVersionDoesNotBlockNewerDraftOrOtherIDs() async throws {
        let gate = Gate()
        defer { gate.release() }
        let store = ControlledStore(firstCheckpointGate: gate, failsFirstCheckpoint: true)
        let queue = makeQueue(store)
        var calls = store.calls.makeAsyncIterator()
        let first = draft(1)
        let latest = draft(2, id: first.id)
        let healthy = draft(1)
        let other = draft(1)

        queue.enqueue(first)
        try #require(await calls.next() == .checkpoint(first))
        queue.enqueue(latest)
        queue.enqueue(healthy)
        gate.release()
        await queue.waitForCurrentWorker()
        #expect(await store.history == [.checkpoint(first), .checkpoint(latest), .checkpoint(healthy)])
        let candidatesAfterFailure = try await queue.candidates()
        #expect(candidatesAfterFailure.contains(latest))
        #expect(candidatesAfterFailure.contains(healthy))
        #expect(queue.failure == nil)

        queue.enqueue(other)
        await queue.waitForCurrentWorker()
        #expect(await store.history == [.checkpoint(first), .checkpoint(latest), .checkpoint(healthy), .checkpoint(other)])
        #expect(queue.failure == nil)
    }

    @Test func cancellingCleanupWhileAwaitingAWriteKeepsPendingWorkAndUnblocksQueue() async throws {
        let gate = Gate()
        defer { gate.release() }
        let store = ControlledStore(firstCheckpointGate: gate)
        let queue = makeQueue(store)
        var calls = store.calls.makeAsyncIterator()
        let first = draft(1)
        let confirmed = draft(2, id: first.id)
        queue.enqueue(first)
        try #require(await calls.next() == .checkpoint(first))
        queue.enqueue(confirmed)
        let cleanup = Task.immediate { @MainActor in try await queue.discardConfirmed([confirmed]) }

        await #expect(throws: RecoveryCheckpointQueue.QueueError.cleanupInProgress) {
            try await queue.discardConfirmed([confirmed])
        }
        cleanup.cancel()
        gate.release()
        await #expect(throws: CancellationError.self) { try await cleanup.value }
        await queue.waitForCurrentWorker()
        #expect(await store.history == [.checkpoint(first), .checkpoint(confirmed)])
    }

    @Test func unavailableStoreWarnsOnEnqueueAndDoesNotSilentlyConfirmCleanup() async {
        let queue = RecoveryCheckpointQueue(store: nil)
        let confirmed = draft(1)
        queue.enqueue(confirmed)
        #expect(queue.failure != nil)
        await #expect(throws: RecoveryCheckpointQueue.QueueError.storeUnavailable) {
            _ = try await queue.candidates()
        }
        await #expect(throws: RecoveryCheckpointQueue.QueueError.storeUnavailable) {
            try await queue.discardConfirmed([confirmed])
        }
    }

    private func makeQueue(_ store: ControlledStore) -> RecoveryCheckpointQueue {
        RecoveryCheckpointQueue(backend: .init(checkpoint: store.checkpoint,
                                               candidates: { await store.candidates() },
                                               discardConfirmed: store.discardConfirmed))
    }

    private func draft(_ revision: UInt64, id: UUID = UUID()) -> RecoveryDraft {
        RecoveryDraft(id: id, revision: revision, source: "原稿\(revision)")
    }
}

/// A one-shot, cancellation-aware gate. Finishing before the waiter arrives also opens it.
private struct Gate: Sendable {
    private let pair = AsyncStream<Void>.makeStream()

    func wait() async {
        var iterator = pair.stream.makeAsyncIterator()
        _ = await iterator.next()
    }

    func release() { pair.continuation.finish() }
}

private enum TestError: Error, Sendable { case io }

private enum Call: Equatable, Sendable {
    case checkpoint(RecoveryDraft)
    case discard([RecoveryDraft])
}

private actor ControlledStore {
    nonisolated let calls: AsyncStream<Call>
    private let continuation: AsyncStream<Call>.Continuation
    private let firstCheckpointGate: Gate?
    private let cleanupGate: Gate?
    private let failsFirstCheckpoint: Bool
    private let failsCleanup: Bool
    private var stored: [UUID: RecoveryDraft] = [:]
    private var activeMutations = 0
    private var firstCheckpoint = true
    private(set) var history: [Call] = []
    private(set) var overlappingMutations = false

    init(firstCheckpointGate: Gate? = nil, cleanupGate: Gate? = nil,
         failsFirstCheckpoint: Bool = false, failsCleanup: Bool = false) {
        (calls, continuation) = AsyncStream<Call>.makeStream()
        self.firstCheckpointGate = firstCheckpointGate
        self.cleanupGate = cleanupGate
        self.failsFirstCheckpoint = failsFirstCheckpoint
        self.failsCleanup = failsCleanup
    }

    func checkpoint(_ draft: RecoveryDraft) async throws {
        begin(.checkpoint(draft))
        defer { activeMutations -= 1 }
        if firstCheckpoint {
            firstCheckpoint = false
            await firstCheckpointGate?.wait()
            if failsFirstCheckpoint { throw TestError.io }
        }
        stored[draft.id] = draft
    }

    func candidates() -> [RecoveryDraft] { Array(stored.values) }

    func discardConfirmed(_ drafts: [RecoveryDraft]) async throws {
        begin(.discard(drafts))
        defer { activeMutations -= 1 }
        await cleanupGate?.wait()
        if failsCleanup { throw TestError.io }
        for draft in drafts {
            if let existing = stored[draft.id], existing.revision < draft.revision || existing == draft {
                stored[draft.id] = nil
            }
        }
    }

    private func begin(_ call: Call) {
        activeMutations += 1
        overlappingMutations = overlappingMutations || activeMutations > 1
        history.append(call)
        continuation.yield(call)
    }
}
