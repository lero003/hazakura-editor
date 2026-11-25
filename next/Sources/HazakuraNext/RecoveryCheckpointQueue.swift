import Foundation
import HazakuraNextCore
import Observation

/// The app is the single owner of checkpoints for its live recovery IDs. A closed ID is not reused.
@MainActor @Observable
final class RecoveryCheckpointQueue {
    enum QueueError: Error, Equatable {
        case storeUnavailable
        case cleanupInProgress
        case newerQueuedDraft
    }

    struct Backend: Sendable {
        let checkpoint: @Sendable (RecoveryDraft) async throws -> Void
        let candidates: @Sendable () async throws -> [RecoveryDraft]
        let discardConfirmed: @Sendable ([RecoveryDraft]) async throws -> Void
    }

    /// A checkpoint warning stays visible until the backlog is persisted or explicitly discarded.
    /// Errors from an explicit list or cleanup operation are thrown to its caller.
    private(set) var failure: String?
    // Only acknowledgements from this process, never another copy of the draft text.
    private var checkpointedRevisions: [UUID: UInt64] = [:]

    private static let unavailableMessage = "復旧用の保存先を利用できません。"
    private let backend: Backend?
    private let checkpointInterval: Duration
    // Keep only the latest snapshot per live ID, in first-pending order so edits cannot starve other IDs.
    @ObservationIgnored private var pending: [RecoveryDraft] = []
    @ObservationIgnored private var inFlight: RecoveryDraft?
    @ObservationIgnored private var worker: Task<Void, Never>?
    @ObservationIgnored private var isCleaningUp = false

    convenience init(store: DraftRecoveryStore?) {
        self.init(backend: store.map { store in
            Backend(checkpoint: { try await store.checkpoint($0) },
                    candidates: { try await store.drafts() },
                    discardConfirmed: { try await store.discardConfirmed($0) })
        }, checkpointInterval: .milliseconds(180))
    }

    init(backend: Backend?, checkpointInterval: Duration = .zero) {
        self.backend = backend
        self.checkpointInterval = checkpointInterval
    }

    func enqueue(_ draft: RecoveryDraft) {
        guard let backend else {
            failure = Self.unavailableMessage
            return
        }
        if let inFlight, inFlight.id == draft.id, inFlight.revision > draft.revision || inFlight == draft {
            return
        }
        if let index = pending.firstIndex(where: { $0.id == draft.id }) {
            if pending[index].revision <= draft.revision { pending[index] = draft }
        } else {
            pending.append(draft)
        }
        startWorkerIfNeeded(backend)
    }

    /// Lists persisted snapshots without waiting for an actively edited document to go idle.
    func candidates() async throws -> [RecoveryDraft] {
        try await requireBackend().candidates()
    }

    func discardConfirmed(_ drafts: [RecoveryDraft]) async throws {
        let backend = try requireBackend()
        guard !drafts.isEmpty else { return }
        guard !isCleaningUp else { throw QueueError.cleanupInProgress }
        try Task.checkCancellation()

        // Reserve the queue before the first suspension. Finish only the already started write,
        // and let edits replace pending snapshots without starting a new write during cleanup.
        isCleaningUp = true
        defer {
            isCleaningUp = false
            startWorkerIfNeeded(backend)
        }
        await worker?.value
        try Task.checkCancellation()
        let consentChanged = pending.contains { queued in
            drafts.contains { confirmed in
                queued.id == confirmed.id && queued.revision >= confirmed.revision && queued != confirmed
            }
        }
        guard !consentChanged else { throw QueueError.newerQueuedDraft }
        try await backend.discardConfirmed(drafts)

        // Do not check cancellation after a committed deletion: the stale writes must be dropped
        // even if the caller was cancelled. Newer edits and unrelated IDs can still write.
        // ScratchTabs gives each committed revision a single byte snapshot. Different bytes at
        // the same revision would violate that invariant; they are not covered by exact consent.
        pending.removeAll { queued in
            drafts.contains { confirmed in
                queued.id == confirmed.id && (queued.revision < confirmed.revision || queued == confirmed)
            }
        }
        for draft in drafts { checkpointedRevisions[draft.id] = nil }
        if pending.isEmpty { failure = nil }
    }

    /// The live-tab owner assigns a single byte snapshot to each (ID, revision) pair.
    func hasCheckpointed(_ draft: RecoveryDraft) -> Bool {
        checkpointedRevisions[draft.id] == draft.revision
    }

    /// This only joins the current worker for synchronization; it never retries failed work.
    func waitForCurrentWorker() async {
        await worker?.value
    }

    private func requireBackend() throws -> Backend {
        guard let backend else {
            failure = Self.unavailableMessage
            throw QueueError.storeUnavailable
        }
        return backend
    }

    private func startWorkerIfNeeded(_ backend: Backend) {
        guard worker == nil, !isCleaningUp, !pending.isEmpty else { return }
        // A synchronous editor callback hands off to this single app-owned asynchronous worker.
        worker = Task { await drain(backend) }
    }

    private func drain(_ backend: Backend) async {
        defer { worker = nil }
        // Do not retry a failed version in the same worker. A newer revision or another
        // draft can still make progress without waiting for another keystroke.
        var failedRevisions: [UUID: UInt64] = [:]
        let eligible: (RecoveryDraft) -> Bool = { failedRevisions[$0.id] != $0.revision }
        while !isCleaningUp, pending.contains(where: eligible) {
            // Coalesce before selecting a snapshot. Sustained typing still makes progress.
            if checkpointInterval > .zero {
                do { try await Task.sleep(for: checkpointInterval) } catch { return }
            }
            guard !isCleaningUp, let index = pending.firstIndex(where: eligible) else { break }
            let draft = pending.remove(at: index)
            inFlight = draft
            defer { inFlight = nil }
            do {
                try await backend.checkpoint(draft)
                if checkpointedRevisions[draft.id] != draft.revision {
                    checkpointedRevisions[draft.id] = draft.revision
                }
            } catch {
                failedRevisions[draft.id] = draft.revision
                // Let a newer pending snapshot win. Otherwise, retain the failed one.
                if !pending.contains(where: { $0.id == draft.id }) { pending.append(draft) }
                failure = "原稿を復旧用に保存できませんでした。"
            }
        }
        if pending.isEmpty { failure = nil }
    }
}
