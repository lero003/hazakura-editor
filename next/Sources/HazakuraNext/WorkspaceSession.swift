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

    private struct ComparisonRequest: Identifiable {
        let id = UUID()
        let documentID: UUID
        let revision: UInt64
        let baseline: SelectedTextFile
        let draftSource: String
    }

    struct ComparisonReport: Identifiable {
        let id: UUID
        let comparison: OriginalFileComparison
    }

    struct MarkdownPreviewSnapshot: Identifiable {
        let id = UUID()
        let title: String
        let source: String
    }

    @ObservationIgnored weak var window: NSWindow?
    var tabs: ScratchTabs
    var pendingDiscard: ScratchTabs.DiscardTicket?
    var openRequest: UUID?
    private(set) var saveCopyRequest: SaveCopyRequest?
    private var comparisonRequest: ComparisonRequest?
    private var readingComparisonID: UUID?
    private(set) var comparisonReport: ComparisonReport?
    private(set) var markdownPreview: MarkdownPreviewSnapshot?
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

    var comparisonRequestID: UUID? { comparisonRequest?.id }
    var isBusy: Bool {
        pendingDiscard != nil || openRequest != nil || saveCopyRequest != nil ||
            comparisonRequest != nil || readingComparisonID != nil || comparisonReport != nil ||
            markdownPreview != nil || showsRecovery || isDiscarding
    }
    var canAddTab: Bool { !isBusy && tabs.canCreateTab }
    var canEditSource: Bool {
        !isDiscarding && saveCopyRequest == nil && comparisonRequest == nil && readingComparisonID == nil &&
            comparisonReport == nil && markdownPreview == nil
    }
    var canPreviewMarkdown: Bool { !isBusy && !tabs.isComposing && tabs.selectedTab != nil }

    static func title(for tab: ScratchTabs.Tab) -> String {
        tab.selectedFile?.name ?? tab.copyOrigin.map { "\($0.name) のコピー" } ?? "原稿 \(tab.number)"
    }

    func requestMarkdownPreview() {
        guard canPreviewMarkdown, let selected = tabs.selectedTab else { return }
        // Keep the native editor mounted. The sheet is a copy of the selected committed revision.
        markdownPreview = MarkdownPreviewSnapshot(title: Self.title(for: selected), source: selected.document.source)
    }

    func dismissMarkdownPreview(_ id: UUID) {
        guard markdownPreview?.id == id else { return }
        markdownPreview = nil
    }
    var canCompareOriginal: Bool { !isBusy && !tabs.isComposing && tabs.selectedTab?.copyOrigin != nil }

    func requestOriginalComparison() {
        guard canCompareOriginal, let selected = tabs.selectedTab, let origin = selected.copyOrigin else { return }
        fileNotice = nil
        exitNotice = nil
        comparisonRequest = ComparisonRequest(documentID: selected.id, revision: selected.document.revision,
                                              baseline: origin.baseline, draftSource: selected.document.source)
    }

    func cancelOriginalComparison(_ id: UUID) {
        guard comparisonRequest?.id == id else { return }
        comparisonRequest = nil
    }

    func dismissOriginalComparison(_ id: UUID) {
        guard comparisonReport?.id == id else { return }
        comparisonReport = nil
    }

    /// The caller handles one explicit picker selection and releases its scope before returning the snapshot.
    func readOriginalComparison(_ id: UUID, using readSelected: @MainActor () async throws -> SelectedTextFile?) async {
        guard let request = comparisonRequest, request.id == id, readingComparisonID == nil else { return }
        readingComparisonID = id
        defer {
            readingComparisonID = nil
            cancelOriginalComparison(id)
        }
        guard !Task.isCancelled else { return }
        do {
            guard let disk = try await readSelected(), !Task.isCancelled, comparisonRequest?.id == id else { return }
            guard !tabs.isComposing, let selected = tabs.selectedTab,
                  selected.id == request.documentID, selected.document.revision == request.revision else {
                fileNotice = "手元の原稿が変わったため、比較をやり直してください。"
                return
            }
            comparisonReport = ComparisonReport(id: id, comparison: OriginalFileComparison(
                baseline: request.baseline, disk: disk, draftSource: request.draftSource
            ))
        } catch is CancellationError {
            // Cancelling the picker or the read must not publish a comparison.
        } catch {
            guard !Task.isCancelled, comparisonRequest?.id == id else { return }
            fileNotice = "比較先を読み取れませんでした。\(Self.readFailure(error))"
        }
    }

    static func readFailure(_ error: Error) -> String {
        switch error as? SelectedTextFile.ReadError {
        case .tooLarge: "2 MiB以下のテキストを選んでください。"
        case .invalidUTF8: "この検証版で開ける文字コードはUTF-8のみです。"
        case .nonTextControls: "テキストとして扱えない制御文字が含まれています。"
        case .changedWhileReading: "読み込み中にファイルが更新されました。もう一度選んでください。"
        case .notRegularFile, .invalidLocation: "通常のテキストファイルを選んでください。"
        case .accessDenied, nil: "ファイルを読み取れません。リンク先ではなくファイルそのものを選び、アクセス権も確認してください。"
        }
    }
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
              comparisonRequest == nil, readingComparisonID == nil, comparisonReport == nil, markdownPreview == nil,
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
