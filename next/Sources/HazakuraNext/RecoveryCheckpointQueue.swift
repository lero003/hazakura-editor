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
        case candidateChanged
    }

    struct Backend: Sendable {
        let checkpoint: @Sendable (RecoveryDraft) async throws -> Void
        let candidates: @Sendable () async throws -> [RecoveryDraft]
        let discardConfirmed: @Sendable ([RecoveryDraft]) async throws -> Void
        let discardExact: (@Sendable (RecoveryDraft) async throws -> Bool)?

        init(
            checkpoint: @escaping @Sendable (RecoveryDraft) async throws -> Void,
            candidates: @escaping @Sendable () async throws -> [RecoveryDraft],
            discardConfirmed: @escaping @Sendable ([RecoveryDraft]) async throws -> Void,
            discardExact: (@Sendable (RecoveryDraft) async throws -> Bool)? = nil
        ) {
            self.checkpoint = checkpoint
            self.candidates = candidates
            self.discardConfirmed = discardConfirmed
            self.discardExact = discardExact
        }
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
                    discardConfirmed: { try await store.discardConfirmed($0) },
                    discardExact: { try await store.discard($0) })
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
        try await withPausedCheckpoints(backend) {
            let consentChanged = pending.contains { queued in
                drafts.contains { confirmed in
                    queued.id == confirmed.id && queued.revision >= confirmed.revision && queued != confirmed
                }
            }
            guard !consentChanged else { throw QueueError.newerQueuedDraft }
            try await backend.discardConfirmed(drafts)

            // Do not check cancellation after a committed deletion: the stale writes must be dropped
            // even if the caller was cancelled. Newer edits and unrelated IDs can still write.
            pending.removeAll { queued in
                drafts.contains { confirmed in
                    queued.id == confirmed.id && (queued.revision < confirmed.revision || queued == confirmed)
                }
            }
            for draft in drafts { checkpointedRevisions[draft.id] = nil }
            if pending.isEmpty { failure = nil }
        }
    }

    /// Unlike a live tab's discard ticket, a candidate grants consent for only one stored snapshot.
    /// Revalidate the caller's state after draining writes, before handing deletion to the store.
    func discardCandidate(_ draft: RecoveryDraft, revalidate: () throws -> Void = {}) async throws {
        let backend = try requireBackend()
        guard let discardExact = backend.discardExact else { throw QueueError.storeUnavailable }
        try await withPausedCheckpoints(backend) {
            try revalidate()
            // Candidates are not live. A queued write for this ID is not covered by list consent.
            guard !pending.contains(where: { $0.id == draft.id }) else { throw QueueError.candidateChanged }
            guard try await discardExact(draft) else { throw QueueError.candidateChanged }
            checkpointedRevisions[draft.id] = nil
        }
    }

    private func withPausedCheckpoints(_ backend: Backend, perform cleanup: () async throws -> Void) async throws {
        guard !isCleaningUp else { throw QueueError.cleanupInProgress }
        try Task.checkCancellation()
        // Reserve before suspension. Edits can still queue without starting another write.
        isCleaningUp = true
        defer {
            isCleaningUp = false
            startWorkerIfNeeded(backend)
        }
        await worker?.value
        try Task.checkCancellation()
        try await cleanup()
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
