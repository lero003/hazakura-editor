import AppKit
import Foundation
import HazakuraNextCore
import Observation

/// Shared by the editor view, menu actions and AppKit's close/quit delegates.
@MainActor @Observable
final class WorkspaceSession {
    struct SaveCopyRequest: Identifiable {
        let id = UUID()
        let documentID: UUID
        let revision: UInt64
        let source: String
        let preservingUTF8BOM: Bool
    }

    @ObservationIgnored weak var window: NSWindow?
    var tabs: ScratchTabs
    var pendingDiscard: ScratchTabs.DiscardTicket?
    var openRequest: UUID?
    private(set) var saveCopyRequest: SaveCopyRequest?
    private(set) var fileNotice: String?
    private var isWritingCopy = false
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

    var isBusy: Bool { pendingDiscard != nil || openRequest != nil || saveCopyRequest != nil || showsRecovery || isDiscarding }
    var canAddTab: Bool { !isBusy && tabs.canCreateTab }
    var canEditSource: Bool { !isDiscarding && saveCopyRequest == nil }
    var canMakeEditableCopy: Bool { canAddTab && tabs.selectedTab?.isReadOnly == true }
    var canSaveCopy: Bool { !isBusy && !tabs.isComposing && tabs.selectedTab?.isReadOnly == false }

    func makeEditableCopy() {
        guard canMakeEditableCopy, let id = tabs.makeEditableCopyOfSelection() else { return }
        if let draft = tabs.recoveryDraft(for: id) { recovery?.enqueue(draft) }
        fileNotice = nil
    }

    func requestSaveCopy() {
        guard canSaveCopy, let selected = tabs.selectedTab else { return }
        exitNotice = nil
        fileNotice = nil
        saveCopyRequest = SaveCopyRequest(documentID: selected.id, revision: selected.document.revision,
                                          source: selected.document.source,
                                          preservingUTF8BOM: selected.copyOrigin?.format.hasUTF8BOM ?? false)
    }

    func cancelSaveCopy(_ requestID: UUID) {
        guard saveCopyRequest?.id == requestID, !isWritingCopy else { return }
        saveCopyRequest = nil
    }

    func writeRequestedCopy(
        _ requestID: UUID, to destination: URL,
        using writer: @Sendable (String, Bool, URL) async throws -> Void = SelectedTextCopyWriter.write
    ) async {
        guard let request = saveCopyRequest, request.id == requestID, !isWritingCopy else { return }
        defer { isWritingCopy = false; saveCopyRequest = nil }
        guard !Task.isCancelled else { return }
        guard !tabs.isComposing, let selected = tabs.selectedTab,
              selected.id == request.documentID, selected.document.revision == request.revision else {
            fileNotice = "原稿が変わったため、コピーを保存していません。もう一度お試しください。"
            return
        }
        isWritingCopy = true
        do {
            try await writer(request.source, request.preservingUTF8BOM, destination)
            fileNotice = "コピーを保存しました。編集中のタブと元のファイルはそのままです。"
        } catch is CancellationError {
            // The writer only reports cancellation before publishing the new file.
        } catch {
            fileNotice = "コピーを保存できませんでした。\(Self.copyWriteFailure(error))"
        }
    }

    private static func copyWriteFailure(_ error: Error) -> String {
        switch error as? SelectedTextCopyWriter.WriteError {
        case .alreadyExists: "同じ名前の項目が既にあります。別の名前を選んでください。"
        case .tooLarge: "UTF-8で2 MiB以下の原稿だけ保存できます。"
        case .invalidText: "テキストとして扱えない文字が含まれています。"
        case .invalidLocation: "ローカルの保存先を選んでください。"
        default: "リンクを含まず、自分だけが書き込めるローカルフォルダを選んでください。"
        }
    }

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
        guard !isDiscarding, openRequest == nil, saveCopyRequest == nil, !showsRecovery,
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
        exitNotice = nil
        fileNotice = nil
        openRequest = UUID()
    }

    func reportOpenFailure(_ reason: String, request: UUID) {
        guard openRequest == request else { return }
        fileNotice = "開けませんでした。\(reason)"
    }

    func newTab() {
        guard canAddTab else { return }
        tabs.newTab()
    }
}
