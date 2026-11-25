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
        let encoding: SelectedTextFile.Encoding
    }

    enum ExportFormat: String, Sendable {
        case html, pdf, epub

        var name: String { rawValue.uppercased() }
    }

    struct ExportRequest: Identifiable {
        fileprivate enum Phase { case picking, rendering, cancelled, writing }

        let id = UUID()
        let format: ExportFormat
        fileprivate let documentID: UUID
        fileprivate let revision: UInt64
        fileprivate let source: String
        fileprivate var phase: Phase = .picking
    }

    struct ExportOperations {
        var renderHTML: @Sendable (String) async throws -> String = MarkdownHTMLExport.render
        var writeHTML: @Sendable (String, URL) async throws -> Void = SelectedTextCopyWriter.writeHTML
        var renderPDF: @MainActor (String) async throws -> Data = MarkdownPDFExport.render
        var writePDF: @Sendable (Data, URL) async throws -> Void = SelectedTextCopyWriter.writePDF
        var renderEPUB: @Sendable (String) async throws -> Data = MarkdownEPUBExport.render
        var writeEPUB: @Sendable (Data, URL) async throws -> Void = SelectedTextCopyWriter.writeEPUB
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

    struct FolderCatalogReport: Identifiable {
        let id: UUID
        let catalog: SelectedFolderCatalog
    }

    struct MarkdownPreviewSnapshot: Identifiable {
        let id = UUID()
        let documentID: UUID
        let revision: UInt64
        let title: String
        let source: String
        /// Zero-based index in this exact rendered revision, captured only when opening the sheet.
        let readingBlockIndex: Int?
    }

    private struct MarkdownSourceReveal {
        let preview: MarkdownPreviewSnapshot
        let offset: Int
    }

    @ObservationIgnored weak var window: NSWindow?
    var tabs: ScratchTabs {
        didSet {
            // Covers all tab mutation paths, including native commits and confirmed discard.
            for (id, position) in markdownReadingPositions {
                if !tabs.tabs.contains(where: { $0.id == id && $0.document.revision == position.revision }) {
                    markdownReadingPositions[id] = nil
                }
            }
            // Includes tabs opened/closed through picker, recovery, and other non-tab-button paths.
            guard let reveal = markdownSourceReveal else { return }
            if tabs.selectedID != reveal.preview.documentID || tabs.isComposing {
                markdownSourceReveal = nil
            }
        }
    }
    var pendingDiscard: ScratchTabs.DiscardTicket?
    var openRequest: UUID?
    private(set) var folderCatalogRequest: UUID?
    private var scanningFolderCatalogID: UUID?
    private(set) var folderCatalogReport: FolderCatalogReport?
    private(set) var saveCopyRequest: SaveCopyRequest?
    private(set) var exportRequest: ExportRequest?
    private var comparisonRequest: ComparisonRequest?
    private var readingComparisonID: UUID?
    private(set) var comparisonReport: ComparisonReport?
    private(set) var markdownPreview: MarkdownPreviewSnapshot?
    private(set) var assistReviewSample: AssistReviewSample?
    // A window-local layout choice, independent of the selected document and its recovery state.
    private(set) var isLMode = false
    // Scrolling updates only this live-tab state, not the editor or the open sheet.
    @ObservationIgnored private var markdownReadingPositions: [UUID: (revision: UInt64, blockIndex: Int)] = [:]
    private var markdownSourceReveal: MarkdownSourceReveal?
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
    private var hasFolderCatalogOperation: Bool {
        folderCatalogRequest != nil || scanningFolderCatalogID != nil || folderCatalogReport != nil
    }
    var isBusy: Bool {
        pendingDiscard != nil || openRequest != nil || hasFolderCatalogOperation || saveCopyRequest != nil || exportRequest != nil ||
            comparisonRequest != nil || readingComparisonID != nil || comparisonReport != nil ||
            markdownPreview != nil || assistReviewSample != nil || showsRecovery || isDiscarding
    }
    var canAddTab: Bool { !isBusy && tabs.canCreateTab }
    var canEditSource: Bool {
        !isDiscarding && !hasFolderCatalogOperation && saveCopyRequest == nil && exportRequest == nil && comparisonRequest == nil &&
            readingComparisonID == nil && comparisonReport == nil && markdownPreview == nil && assistReviewSample == nil
    }
    var canPreviewMarkdown: Bool { !isBusy && !tabs.isComposing && tabs.selectedTab != nil }
    var canOpenAssistReviewSample: Bool { !isBusy && !tabs.isComposing }
    var canExport: Bool { !isBusy && !tabs.isComposing && tabs.selectedTab != nil }

    func requestAssistReviewSample() {
        guard canOpenAssistReviewSample else { return }
        assistReviewSample = AssistReviewSample()
    }

    func dismissAssistReviewSample(_ id: UUID) {
        guard assistReviewSample?.id == id else { return }
        assistReviewSample = nil
    }
    var canToggleLMode: Bool { !isBusy && !tabs.isComposing && tabs.selectedID != nil }

    func toggleLMode() {
        guard canToggleLMode else { return }
        isLMode.toggle()
    }

    static func title(for tab: ScratchTabs.Tab) -> String {
        tab.selectedFile?.name ?? tab.copyOrigin.map { "\($0.name) のコピー" } ?? "原稿 \(tab.number)"
    }

    func requestMarkdownPreview() {
        guard canPreviewMarkdown, let selected = tabs.selectedTab else { return }
        markdownSourceReveal = nil
        let revision = selected.document.revision
        let position = markdownReadingPositions[selected.id]
        // Keep the native editor mounted. The sheet is a copy of the selected committed revision.
        markdownPreview = MarkdownPreviewSnapshot(documentID: selected.id, revision: revision,
                                                   title: Self.title(for: selected), source: selected.document.source,
                                                   readingBlockIndex: position?.revision == revision ? position?.blockIndex : nil)
    }

    func rememberMarkdownReadingPosition(_ blockIndex: Int, previewID: UUID) {
        // The renderer currently emits at most 2,000 blocks. The reader checks its actual block count.
        guard (0..<2_000).contains(blockIndex), let preview = markdownPreview, preview.id == previewID,
              !tabs.isComposing, let selected = tabs.selectedTab, selected.id == preview.documentID,
              selected.document.revision == preview.revision else { return }
        markdownReadingPositions[selected.id] = (revision: preview.revision, blockIndex: blockIndex)
    }

    func dismissMarkdownPreview(_ id: UUID) {
        guard markdownPreview?.id == id else { return }
        markdownPreview = nil
    }

    var readyMarkdownRevealID: UUID? { markdownPreview == nil ? markdownSourceReveal?.preview.id : nil }

    func requestMarkdownReveal(_ previewID: UUID, offset: Int) -> Bool {
        guard let preview = markdownPreview, preview.id == previewID, markdownSourceReveal == nil,
              !tabs.isComposing, let selected = tabs.selectedTab, selected.id == preview.documentID,
              selected.document.revision == preview.revision, offset >= 0, offset < preview.source.utf16.count else { return false }
        markdownSourceReveal = MarkdownSourceReveal(preview: preview, offset: offset)
        return true
    }

    /// Called by the active AppKit editor only after the sheet and native input gates allow navigation.
    func takeMarkdownReveal(_ previewID: UUID, documentID: UUID, editorSource: String) -> Int? {
        guard readyMarkdownRevealID == previewID, let reveal = markdownSourceReveal,
              documentID == reveal.preview.documentID, let selected = tabs.selectedTab,
              selected.id == documentID else { return nil }
        markdownSourceReveal = nil
        guard !isBusy, !tabs.isComposing else { return nil }
        guard selected.document.revision == reveal.preview.revision,
              editorSource.utf8.elementsEqual(reveal.preview.source.utf8) else {
            fileNotice = "原稿が変わったため、見出しに移動していません。"
            return nil
        }
        return reveal.offset
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

    var canRequestFolderCatalog: Bool { !isBusy && !tabs.isComposing }

    func requestFolderCatalog() {
        guard canRequestFolderCatalog else { return }
        fileNotice = nil
        exitNotice = nil
        folderCatalogRequest = UUID()
    }

    func cancelFolderCatalog(_ id: UUID) {
        guard folderCatalogRequest == id else { return }
        folderCatalogRequest = nil
    }

    func dismissFolderCatalogReport(_ id: UUID) {
        guard folderCatalogReport?.id == id else { return }
        folderCatalogReport = nil
    }

    func clearFolderCatalog() {
        folderCatalogRequest = nil
        folderCatalogReport = nil
    }

    /// The picker callback releases its selected URL before returning the metadata snapshot.
    func readFolderCatalog(_ id: UUID, using read: @MainActor () async throws -> SelectedFolderCatalog?) async {
        guard folderCatalogRequest == id, scanningFolderCatalogID == nil else { return }
        scanningFolderCatalogID = id
        defer {
            scanningFolderCatalogID = nil
            cancelFolderCatalog(id)
        }
        guard !Task.isCancelled, !tabs.isComposing else { return }
        do {
            guard let snapshot = try await read(), !Task.isCancelled, folderCatalogRequest == id,
                  !tabs.isComposing else { return }
            folderCatalogReport = FolderCatalogReport(id: id, catalog: snapshot)
        } catch is CancellationError {
            // Cancellation has no result or failure notice.
        } catch {
            guard !Task.isCancelled, folderCatalogRequest == id else { return }
            let reason: String = switch error as? SelectedFolderCatalog.ScanError {
            case .tooManyEntries: "直下に\(SelectedFolderCatalog.entryLimit)件以下の項目があるフォルダを選んでください。"
            case .changedWhileScanning: "一覧の取得中にフォルダが変わりました。選び直してください。"
            case .invalidLocation, .accessDenied, nil: "リンクを含まないローカルフォルダを選び、アクセス権を確認してください。"
            }
            fileNotice = "フォルダの一覧を取得できませんでした。\(reason)"
        }
    }

    static func readFailure(_ error: Error) -> String {
        switch error as? SelectedTextFile.ReadError {
        case .tooLarge: "2 MiB以下のテキストを選んでください。"
        case .invalidUTF8, .invalidUTF16: "文字コードが不正です。UTF-8またはBOM付きUTF-16のテキストを選んでください。"
        case .unsupportedEncoding: "対応する文字コードはUTF-8とBOM付きUTF-16です。"
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
                                          encoding: selected.copyOrigin?.format.encoding ?? .utf8)
    }

    func cancelSaveCopy(_ requestID: UUID) {
        guard saveCopyRequest?.id == requestID, !isWritingCopy else { return }
        saveCopyRequest = nil
    }

    func writeRequestedCopy(
        _ requestID: UUID, to destination: URL,
        using writer: @Sendable (String, SelectedTextFile.Encoding, URL) async throws -> Void = SelectedTextCopyWriter.write
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
            try await writer(request.source, request.encoding, destination)
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
        case .tooLarge: "保存時の文字コードで、BOMを含めて2 MiB以下の原稿だけ保存できます。"
        case .invalidText: "テキストとして扱えない文字が含まれています。"
        case .invalidLocation: "ローカルの保存先を選んでください。"
        default: "リンクを含まず、自分だけが書き込めるローカルフォルダを選んでください。"
        }
    }

    func requestExport(_ format: ExportFormat) {
        guard canExport, let selected = tabs.selectedTab else { return }
        exitNotice = nil
        fileNotice = nil
        exportRequest = ExportRequest(format: format, documentID: selected.id, revision: selected.document.revision,
                                      source: selected.document.source)
    }

    func cancelExport(_ id: UUID) {
        guard let request = exportRequest, request.id == id else { return }
        switch request.phase {
        case .picking: exportRequest = nil
        case .rendering: exportRequest?.phase = .cancelled
        case .cancelled, .writing: break
        }
    }

    func writeRequestedExport(_ id: UUID, to destination: URL) async {
        await writeRequestedExport(id, to: destination, using: .init())
    }

    /// One picker choice authorizes this format and destination only; keep it reserved until completion.
    func writeRequestedExport(_ id: UUID, to destination: URL, using operations: ExportOperations) async {
        guard let request = exportRequest, request.id == id, request.phase == .picking else { return }
        exportRequest?.phase = .rendering
        defer { exportRequest = nil }

        guard !Task.isCancelled, validateExportSource(request) else { return }
        let name = request.format.name
        guard destination.isFileURL else {
            fileNotice = "\(name)を書き出せませんでした。ローカルの保存先を選んでください。"
            return
        }
        let fileExtension = request.format.rawValue
        guard !destination.hasDirectoryPath, destination.pathExtension.lowercased() == fileExtension else {
            fileNotice = "\(name)を書き出せませんでした。拡張子が .\(fileExtension) の新しいファイル名を選んでください。"
            return
        }

        switch request.format {
        case .html:
            await renderAndWriteExport(request, to: destination, render: operations.renderHTML) { html, url in
                try await operations.writeHTML(html, url)
            }
        case .pdf:
            await renderAndWriteExport(request, to: destination, render: operations.renderPDF, write: operations.writePDF)
        case .epub:
            await renderAndWriteExport(request, to: destination, render: operations.renderEPUB, write: operations.writeEPUB)
        }
    }

    private func renderAndWriteExport<Payload: Sendable>(
        _ request: ExportRequest, to destination: URL,
        render: @MainActor (String) async throws -> Payload,
        write: @MainActor (Payload, URL) async throws -> Void
    ) async {
        let name = request.format.name
        let payload: Payload
        do {
            payload = try await render(request.source)
        } catch is CancellationError {
            return
        } catch {
            guard canFinishRendering(request) else { return }
            fileNotice = "\(name)を書き出せませんでした。\(Self.exportRenderFailure(error, format: request.format))"
            return
        }
        // Recheck authorization after rendering; a late native callback can still commit text.
        guard canFinishRendering(request) else { return }
        exportRequest?.phase = .writing
        do {
            try await write(payload, destination)
            // The writer may return after cancellation if it already published the file.
            fileNotice = "\(name)を書き出しました。原稿と元のファイルはそのままです。"
        } catch is CancellationError {
            // The writer only reports cancellation before publishing the new file.
        } catch {
            let reason: String
            switch error as? SelectedTextCopyWriter.WriteError {
            case .tooLarge: reason = "生成した\(name)が書き出しの上限を超えています。"
            case .invalidPDF, .invalidEPUB: reason = "有効な\(name)を生成できませんでした。"
            default: reason = Self.copyWriteFailure(error)
            }
            fileNotice = "\(name)を書き出せませんでした。\(reason)"
        }
    }

    private func canFinishRendering(_ request: ExportRequest) -> Bool {
        guard !Task.isCancelled, exportRequest?.id == request.id, exportRequest?.phase == .rendering else { return false }
        return validateExportSource(request)
    }

    private func validateExportSource(_ request: ExportRequest) -> Bool {
        guard !tabs.isComposing, let selected = tabs.selectedTab, selected.id == request.documentID,
              selected.document.revision == request.revision else {
            fileNotice = "原稿の状態が変わったため、\(request.format.name)を書き出していません。もう一度お試しください。"
            return false
        }
        return true
    }

    private static func exportRenderFailure(_ error: Error, format: ExportFormat) -> String {
        switch error as? MarkdownHTMLExport.ExportError {
        case .unavailable(.inputTooLarge): return "原稿が書き出しの上限（128 KiB）を超えています。"
        case .unavailable(.tooManyBlocks), .unavailable(.tooComplex): return "原稿の構造が変換処理の上限を超えています。"
        case .tooLarge:
            if format == .html { return "生成したHTMLが書き出しの上限を超えています。" }
            return "\(format.name)変換用の本文が書き出しの上限を超えています。"
        case .unavailable(.parseFailed), nil: break
        }
        if format == .pdf {
            switch error as? MarkdownPDFExportError {
            case .documentTooLarge: return "原稿の描画範囲が書き出しの上限を超えています。"
            case .pdfTooLarge: return "生成したPDFが書き出しの上限（16 MiB）を超えています。"
            case .timedOut: return "PDFへの変換に時間がかかりすぎました。"
            case .renderingFailed, nil: break
            }
        }
        if format == .epub {
            switch error as? MarkdownEPUBExport.ExportError {
            case .emptyDocument: return "書き出す本文がありません。"
            case .tooManyChapters: return "章の数が書き出しの上限（128章）を超えています。"
            default: break
            }
            if (error as? EPUBStoredArchive.ArchiveError) == .tooLarge {
                return "生成したEPUBが書き出しの上限（16 MiB）を超えています。"
            }
        }
        return "原稿を\(format.name)に変換できませんでした。"
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
        guard !isDiscarding, openRequest == nil, saveCopyRequest == nil, exportRequest == nil, !showsRecovery,
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
