import AppKit
import Foundation
import HazakuraNextCore
import Observation

/// Shared by the editor view, menu actions and AppKit's close/quit delegates.
@MainActor @Observable
final class WorkspaceSession {
    @ObservationIgnored weak var window: NSWindow?
    var tabs: ScratchTabs
    var pendingDiscard: ScratchTabs.DiscardTicket?
    var openRequest: UUID?
    var exitNotice: String?
    var showsRecovery = false
    private(set) var isDiscarding = false
    let recovery: RecoveryCheckpointQueue?
    let recoveryUnavailable: Bool

    init(source: String, recovery: RecoveryCheckpointQueue? = nil, recoveryUnavailable: Bool = false) {
        tabs = ScratchTabs(source: source)
        self.recovery = recovery
        self.recoveryUnavailable = recoveryUnavailable
    }

    var isBusy: Bool { pendingDiscard != nil || openRequest != nil || showsRecovery || isDiscarding }
    var canAddTab: Bool { !isBusy && tabs.canCreateTab }

    func applyCommittedSource(_ source: String, to id: UUID) {
        guard let draft = tabs.applyCommittedSource(source, to: id) else { return }
        if !isDiscarding { exitNotice = nil }
        recovery?.enqueue(draft)
    }

    func requestRecovery() {
        guard recovery != nil, !isBusy, !tabs.isComposing else { return }
        showsRecovery = true
    }

    func recoveryCandidates() async throws -> [RecoveryDraft] {
        let drafts = try await recovery?.candidates() ?? []
        let activeIDs = Set(tabs.recoveryDrafts.map(\.id))
        return drafts.filter { !activeIDs.contains($0.id) }
    }

    func forgetRecoveryCandidate(_ draft: RecoveryDraft) async throws {
        guard showsRecovery, !isDiscarding, !tabs.recoveryDrafts.contains(where: { $0.id == draft.id }),
              let recovery else { throw CancellationError() }
        try await recovery.discardConfirmed([draft])
    }

    func restore(_ draft: RecoveryDraft) -> Bool {
        guard showsRecovery, !isDiscarding, openRequest == nil, pendingDiscard == nil,
              !tabs.recoveryDrafts.contains(where: { $0.id == draft.id }), tabs.restoreDraft(draft) != nil else { return false }
        if let restored = tabs.recoveryDrafts.last { recovery?.enqueue(restored) }
        return true
    }

    @discardableResult
    func startTabDiscard(_ ticket: ScratchTabs.DiscardTicket) -> Task<Void, Never>? {
        guard !isDiscarding, openRequest == nil, !showsRecovery,
              let draft = tabs.draftForDiscard(ticket) else { return nil }
        // Reserve synchronously: dismissing SwiftUI's alert must not re-enable tab actions.
        isDiscarding = true
        pendingDiscard = nil
        return Task {
            defer { isDiscarding = false }
            _ = await finishDiscard([draft]) { self.tabs.discard(ticket) }
        }
    }

    func reserveExitDiscard() -> [RecoveryDraft]? {
        guard !isBusy, !tabs.isComposing else { return nil }
        isDiscarding = true
        return tabs.recoveryDrafts
    }

    /// Keep editing reserved until the delegate synchronously dispatches its native decision.
    func finishExitDiscard(_ confirmed: [RecoveryDraft], reply: (Bool) -> Void) async {
        defer { isDiscarding = false }
        let ready = await finishDiscard(confirmed) { !self.tabs.isComposing && self.tabs.recoveryDrafts == confirmed }
        reply(ready)
    }

    private func finishDiscard(_ confirmed: [RecoveryDraft], then accept: () -> Bool) async -> Bool {
        exitNotice = nil
        do {
            try await recovery?.discardConfirmed(confirmed)
        } catch {
            exitNotice = "復旧記録を整理できなかったため、原稿は閉じていません。もう一度お試しください。"
            return false
        }
        guard accept() else {
            // If the authorization no longer applies, re-stage any still-open drafts whose
            // older checkpoint may have just been removed. Never discard the new in-memory text.
            for draft in tabs.recoveryDrafts { recovery?.enqueue(draft) }
            exitNotice = "原稿の状態が変わったため、閉じませんでした。操作をやり直してください。"
            return false
        }
        return true
    }

    func requestOpen() {
        guard canAddTab else { return }
        openRequest = UUID()
    }

    func newTab() {
        guard canAddTab else { return }
        tabs.newTab()
    }
}
