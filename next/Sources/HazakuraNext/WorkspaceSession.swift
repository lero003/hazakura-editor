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

    fileprivate struct BookExportInput {
        let sources: [MarkdownBookPreview.Source]
        let revisions: [UUID: UInt64]
    }

    struct ExportRequest: Identifiable {
        fileprivate enum Phase { case waitingForDestination, picking, rendering, cancelled, writing }
        fileprivate enum Input {
            case document(id: UUID, revision: UInt64, source: String)
            case book(BookExportInput)
        }

        let id = UUID()
        let format: ExportFormat
        fileprivate let input: Input
        fileprivate var phase: Phase = .picking

        var waitsForDestination: Bool { phase == .waitingForDestination }
        var bookCount: Int? {
            if case .book(let snapshot) = input { return snapshot.sources.count }
            return nil
        }
    }

    struct ExportOperations {
        var renderHTML: @Sendable (String) async throws -> String = MarkdownHTMLExport.render
        var writeHTML: @Sendable (String, URL) async throws -> Void = SelectedTextCopyWriter.writeHTML
        var renderPDF: @MainActor (String) async throws -> Data = MarkdownPDFExport.render
        var writePDF: @Sendable (Data, URL) async throws -> Void = SelectedTextCopyWriter.writePDF
        var renderEPUB: @Sendable (String) async throws -> Data = MarkdownEPUBExport.render
        var writeEPUB: @Sendable (Data, URL) async throws -> Void = SelectedTextCopyWriter.writeEPUB
        var renderBookEPUB: @Sendable ([MarkdownBookPreview.Source]) async throws -> Data = MarkdownEPUBExport.renderBook
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
        fileprivate let documentID: UUID
        fileprivate let revision: UInt64
        let comparison: OriginalFileComparison
    }

    struct FolderCatalogReport: Identifiable {
        let id: UUID
        let catalog: SelectedFolderCatalog
    }

    struct FolderEntryOpening: Identifiable {
        let id = UUID()
        let catalog: SelectedFolderCatalog
        let entry: SelectedFolderCatalog.Entry
        fileprivate(set) var hasStarted = false
    }

    struct BookPreviewRequest: Identifiable {
        struct Choice: Identifiable {
            let id: UUID
            let number: Int
            let title: String
        }
        let id = UUID()
        let choices: [Choice]
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

    struct SourceNavigationRequest: Identifiable {
        let id = UUID()
        fileprivate let documentID: UUID
        fileprivate let revision: UInt64
        let title: String
    }

    struct SourceSearchReport: Identifiable {
        let id: UUID
        let results: SourceSearch.Results
    }

    private struct SourceReveal {
        let id: UUID
        let documentID: UUID
        let revision: UInt64
        let source: String
        let range: NSRange
        let changedNotice: String
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
            for id in copyWrittenRevisions.keys where !tabs.tabs.contains(where: { $0.id == id }) {
                copyWrittenRevisions[id] = nil
            }
            // Includes tabs opened/closed through picker, recovery, and other non-tab-button paths.
            if let request = lineJumpRequest, !matchesSourceNavigation(request) {
                dismissLineJump(request.id)
            }
            if let request = sourceSearchRequest, !matchesSourceNavigation(request) {
                dismissSourceSearch(request.id)
            }
            guard let reveal = sourceReveal else { return }
            if tabs.selectedID != reveal.documentID || tabs.isComposing {
                sourceReveal = nil
            }
        }
    }
    struct TabDiscardRequest {
        let id = UUID()
        fileprivate let ticket: ScratchTabs.DiscardTicket
    }

    private(set) var pendingDiscard: TabDiscardRequest?
    private(set) var openRequest: UUID?
    private(set) var folderCatalogRequest: UUID?
    private var activeFolderReadID: UUID?
    private(set) var folderCatalogReport: FolderCatalogReport?
    private(set) var folderEntryOpening: FolderEntryOpening?
    private(set) var saveCopyRequest: SaveCopyRequest?
    // A live-tab record of successful writes, not a saved-document baseline or a URL.
    private var copyWrittenRevisions: [UUID: UInt64] = [:]
    private(set) var exportRequest: ExportRequest?
    private var comparisonRequest: ComparisonRequest?
    private var readingComparisonID: UUID?
    private(set) var comparisonReport: ComparisonReport?
    private(set) var markdownPreview: MarkdownPreviewSnapshot?
    private(set) var bookPreviewRequest: BookPreviewRequest?
    private var confirmedBookInput: BookExportInput?
    private(set) var assistReviewSample: AssistReviewSample?
    // Window-local presentation, independent of the selected document and its recovery state.
    private(set) var isLMode = false
    private(set) var isZenMode = false
    // Scrolling updates only this live-tab state, not the editor or the open sheet.
    @ObservationIgnored private var markdownReadingPositions: [UUID: (revision: UInt64, blockIndex: Int)] = [:]
    private var sourceReveal: SourceReveal?
    private(set) var lineJumpRequest: SourceNavigationRequest?
    private(set) var sourceSearchRequest: SourceNavigationRequest?
    @ObservationIgnored private var sourceSearchRunID: UUID?
    @ObservationIgnored private var sourceSearchReport: SourceSearchReport?
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
        folderCatalogRequest != nil || activeFolderReadID != nil || folderCatalogReport != nil || folderEntryOpening != nil
    }
    var isBusy: Bool { pendingDiscard != nil || hasExclusiveOperation }
    private var hasExclusiveOperation: Bool { comparisonReport != nil || hasOperationBesidesComparisonReport }
    private var hasOperationBesidesComparisonReport: Bool {
        openRequest != nil || hasFolderCatalogOperation || saveCopyRequest != nil || exportRequest != nil ||
            comparisonRequest != nil || readingComparisonID != nil || markdownPreview != nil || bookPreviewRequest != nil ||
            assistReviewSample != nil || lineJumpRequest != nil || sourceSearchRequest != nil || showsRecovery || isDiscarding
    }
    var canAddTab: Bool { canChangeTab && tabs.canCreateTab }

    enum TabDirection: Int { case previous = -1, next = 1 }

    // Consult the native editor as well as the model, even before its IME callback reaches us.
    var hasNativeMarkedText: Bool {
        (window?.firstResponder as? NSTextView)?.hasMarkedText() == true
    }

    // SwiftUI uses observable state only; AppKit may detach its sheet after the request ends.
    var canOfferTabBarActions: Bool { !isBusy && !tabs.isComposing }

    var canChangeTab: Bool {
        canOfferTabBarActions && !hasNativeMarkedText && window?.attachedSheet == nil
    }

    var canCycleTabs: Bool { tabs.tabs.count > 1 && tabs.selectedID != nil && canChangeTab }
    var canRequestTabClose: Bool { tabs.selectedID != nil && canChangeTab }

    func requestTabClose() {
        guard let window, window.isVisible, window.isKeyWindow, let id = prepareTabClose() else { return }
        presentTabDiscard(id, in: window)
    }

    /// Closes a clean tab or reserves the confirmation before any UI is presented.
    @discardableResult
    func prepareTabClose() -> UUID? {
        guard canRequestTabClose, case let .confirm(ticket) = tabs.requestCloseSelected() else { return nil }
        let request = TabDiscardRequest(ticket: ticket)
        pendingDiscard = request
        return request.id
    }

    func invalidateTabDiscard() { pendingDiscard = nil }

    private func presentTabDiscard(_ id: UUID, in window: NSWindow) {
        let alert = NSAlert()
        alert.alertStyle = .warning
        alert.messageText = "この検証用原稿を破棄しますか？"
        alert.informativeText = recovery == nil
            ? "このタブの未保存原稿が削除されます。"
            : "このタブの未保存原稿と、その復旧記録が削除されます。"
        let cancel = alert.addButton(withTitle: "キャンセル")
        cancel.keyEquivalent = "\u{1B}"
        let discard = alert.addButton(withTitle: "破棄")
        discard.keyEquivalent = ""
        discard.hasDestructiveAction = true
        alert.beginSheetModal(for: window) { [weak self, weak window] result in
            guard let self else { return }
            let approved = result == .alertSecondButtonReturn && window != nil && window === self.window
            self.resolveTabDiscard(id, discard: approved)
        }
    }

    func selectTab(_ id: UUID) {
        guard canChangeTab else { return }
        tabs.select(id)
    }

    func cycleTab(_ direction: TabDirection) {
        guard canCycleTabs, let index = tabs.tabs.firstIndex(where: { $0.id == tabs.selectedID }) else { return }
        let count = tabs.tabs.count
        tabs.select(tabs.tabs[(index + direction.rawValue + count) % count].id)
    }

    var canEditSource: Bool {
        !isDiscarding && !hasFolderCatalogOperation && saveCopyRequest == nil && exportRequest == nil && comparisonRequest == nil &&
            readingComparisonID == nil && comparisonReport == nil && markdownPreview == nil && bookPreviewRequest == nil &&
            assistReviewSample == nil && lineJumpRequest == nil && sourceSearchRequest == nil
    }
    private var canStartPresentationAction: Bool {
        !isBusy && window?.attachedSheet == nil && !tabs.isComposing && !hasNativeMarkedText
    }
    var canPreviewMarkdown: Bool { canStartPresentationAction && tabs.selectedTab != nil }
    var canOpenAssistReviewSample: Bool { canStartPresentationAction }
    var canExport: Bool {
        !isBusy && !tabs.isComposing && !hasNativeMarkedText && window?.attachedSheet == nil && tabs.selectedTab != nil
    }

    func requestAssistReviewSample() {
        guard canOpenAssistReviewSample else { return }
        assistReviewSample = AssistReviewSample()
    }

    func dismissAssistReviewSample(_ id: UUID) {
        guard assistReviewSample?.id == id else { return }
        assistReviewSample = nil
    }
    var canToggleLMode: Bool { canStartPresentationAction && tabs.selectedID != nil }

    func toggleLMode() {
        guard canToggleLMode else { return }
        isLMode.toggle()
    }

    var canToggleZenMode: Bool {
        canStartPresentationAction && (isZenMode || tabs.selectedID != nil)
    }

    func toggleZenMode() {
        guard canToggleZenMode else { return }
        isZenMode.toggle()
    }

    enum Appearance: Int, CaseIterable {
        case system, light, dark

        var title: String {
            switch self {
            case .system: "システム設定に従う"
            case .light: "ライト"
            case .dark: "ダーク"
            }
        }
    }

    // The explicit window override is the only state. Effective appearance may be inherited.
    var appearance: Appearance {
        switch window?.appearance?.name {
        case .aqua: .light
        case .darkAqua: .dark
        default: .system
        }
    }

    var canSetAppearance: Bool { window != nil && canStartPresentationAction }

    func setAppearance(_ choice: Appearance) {
        guard let window, canSetAppearance else { return }
        switch choice {
        case .system:
            window.appearance = nil
        case .light, .dark:
            let name: NSAppearance.Name = choice == .light ? .aqua : .darkAqua
            if let appearance = NSAppearance(named: name) { window.appearance = appearance }
        }
    }

    static func title(for tab: ScratchTabs.Tab) -> String {
        if let file = tab.selectedFile {
            return tab.isComparisonSnapshot ? "比較時：\(file.name)" : file.name
        }
        return tab.copyOrigin.map { "\($0.name) のコピー" } ?? "原稿 \(tab.number)"
    }

    var canPreviewBook: Bool { canStartPresentationAction && tabs.tabs.count >= 2 }

    func requestBookPreview() {
        guard canPreviewBook else { return }
        sourceReveal = nil
        confirmedBookInput = nil
        bookPreviewRequest = BookPreviewRequest(choices: tabs.tabs.map { tab in
            .init(id: tab.id, number: tab.number, title: Self.title(for: tab))
        })
    }

    func confirmBookPreview(_ id: UUID, selected: Set<UUID>) -> [MarkdownBookPreview.Source]? {
        guard let request = bookPreviewRequest, request.id == id, confirmedBookInput == nil,
              !tabs.isComposing, !hasNativeMarkedText, selected.count >= 2,
              selected.isSubset(of: Set(request.choices.map(\.id))) else { return nil }
        let chosen = tabs.tabs.filter { selected.contains($0.id) }
        guard chosen.count == selected.count else { return nil }
        let sources = chosen.map { tab in
            MarkdownBookPreview.Source(id: tab.id, title: Self.title(for: tab), text: tab.document.source)
        }
        confirmedBookInput = BookExportInput(sources: sources, revisions: Dictionary(uniqueKeysWithValues:
            chosen.map { ($0.id, $0.document.revision) }
        ))
        return sources
    }

    func dismissBookPreview(_ id: UUID) {
        guard bookPreviewRequest?.id == id else { return }
        bookPreviewRequest = nil
        confirmedBookInput = nil
    }

    /// Reserve the confirmed book; selecting a new destination is a separate action on the parent window.
    func prepareBookEPUB(_ id: UUID) -> Bool {
        guard bookPreviewRequest?.id == id, exportRequest == nil, let book = confirmedBookInput,
              !tabs.isComposing, !hasNativeMarkedText, bookVersionsMatch(book) else { return false }
        fileNotice = nil
        exitNotice = nil
        exportRequest = ExportRequest(format: .epub, input: .book(book), phase: .waitingForDestination)
        dismissBookPreview(id)
        return true
    }

    private func bookVersionsMatch(_ book: BookExportInput) -> Bool {
        book.revisions.allSatisfy { id, revision in
            tabs.tabs.contains { $0.id == id && $0.document.revision == revision }
        }
    }

    func requestMarkdownPreview() {
        guard canPreviewMarkdown, let selected = tabs.selectedTab else { return }
        sourceReveal = nil
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

    var readySourceRevealID: UUID? {
        markdownPreview == nil && lineJumpRequest == nil && sourceSearchRequest == nil ? sourceReveal?.id : nil
    }

    func requestMarkdownReveal(_ previewID: UUID, offset: Int) -> Bool {
        guard let preview = markdownPreview, preview.id == previewID, sourceReveal == nil,
              !tabs.isComposing, !hasNativeMarkedText, let selected = tabs.selectedTab, selected.id == preview.documentID,
              selected.document.revision == preview.revision, offset >= 0, offset < preview.source.utf16.count else { return false }
        sourceReveal = SourceReveal(id: previewID, documentID: preview.documentID, revision: preview.revision,
                                    source: preview.source, range: NSRange(location: offset, length: 0),
                                    changedNotice: "原稿が変わったため、見出しに移動していません。")
        return true
    }

    private var canOpenSourceNavigation: Bool {
        guard canStartPresentationAction, let tab = tabs.selectedTab else { return false }
        return tab.document.source.utf8.count <= 2 * 1024 * 1024
    }

    var canRequestLineJump: Bool { canOpenSourceNavigation }

    func requestLineJump() {
        guard canRequestLineJump, let tab = tabs.selectedTab else { return }
        sourceReveal = nil
        lineJumpRequest = SourceNavigationRequest(documentID: tab.id, revision: tab.document.revision, title: Self.title(for: tab))
    }

    func dismissLineJump(_ id: UUID) {
        guard lineJumpRequest?.id == id else { return }
        lineJumpRequest = nil
    }

    func confirmLineJump(_ id: UUID, line: Int) -> Bool {
        guard let request = lineJumpRequest, request.id == id, matchesSourceNavigation(request), !hasNativeMarkedText,
              let tab = tabs.selectedTab,
              let offset = SourceLineLookup.utf16Offset(of: line, in: tab.document.source) else { return false }
        sourceReveal = SourceReveal(id: id, documentID: tab.id, revision: request.revision,
                                    source: tab.document.source, range: NSRange(location: offset, length: 0),
                                    changedNotice: "原稿が変わったため、指定の行に移動していません。")
        lineJumpRequest = nil
        return true
    }

    var canRequestSourceSearch: Bool { canOpenSourceNavigation }

    func requestSourceSearch() {
        guard canRequestSourceSearch, let tab = tabs.selectedTab else { return }
        sourceReveal = nil
        sourceSearchRequest = SourceNavigationRequest(documentID: tab.id, revision: tab.document.revision,
                                                     title: Self.title(for: tab))
    }

    private func matchesSourceNavigation(_ request: SourceNavigationRequest) -> Bool {
        !tabs.isComposing && tabs.selectedID == request.documentID &&
            tabs.selectedTab?.document.revision == request.revision
    }

    func dismissSourceSearch(_ id: UUID) {
        guard sourceSearchRequest?.id == id else { return }
        resetSourceSearch(id)
        sourceSearchRequest = nil
    }

    func resetSourceSearch(_ id: UUID) {
        guard sourceSearchRequest?.id == id else { return }
        sourceSearchRunID = nil
        sourceSearchReport = nil
    }

    func searchSource(
        _ id: UUID, query: String,
        scan: @MainActor (String, String) async -> SourceSearch.Results? = WorkspaceSession.scanSource
    ) async -> SourceSearchReport? {
        guard !Task.isCancelled, let request = sourceSearchRequest, request.id == id,
              matchesSourceNavigation(request), let source = tabs.selectedTab?.document.source else { return nil }
        let runID = UUID()
        sourceSearchRunID = runID
        sourceSearchReport = nil
        let results = await scan(source, query)
        guard !Task.isCancelled, sourceSearchRunID == runID,
              sourceSearchRequest?.id == id, matchesSourceNavigation(request), let results else { return nil }
        let report = SourceSearchReport(id: runID, results: results)
        sourceSearchReport = report
        return report
    }

    @concurrent private nonisolated static func scanSource(_ source: String, for query: String) async -> SourceSearch.Results? {
        SourceSearch.search(query, in: source)
    }

    func selectSourceSearchMatch(_ id: UUID, reportID: UUID, matchID: Int) -> Bool {
        guard let request = sourceSearchRequest, request.id == id, matchesSourceNavigation(request), !hasNativeMarkedText,
              let tab = tabs.selectedTab, let report = sourceSearchReport, report.id == reportID,
              let match = report.results.matches.first(where: { $0.id == matchID }) else { return false }
        sourceReveal = SourceReveal(id: id, documentID: request.documentID, revision: request.revision,
                                    source: tab.document.source, range: match.range,
                                    changedNotice: "原稿が変わったため、検索結果に移動していません。")
        dismissSourceSearch(id)
        return true
    }

    func cancelSourceNavigation() {
        lineJumpRequest = nil
        if let id = sourceSearchRequest?.id { dismissSourceSearch(id) }
        sourceReveal = nil
    }

    /// Called by the active AppKit editor only after the sheet and native input gates allow navigation.
    func takeSourceReveal(_ id: UUID, documentID: UUID, editorSource: String) -> NSRange? {
        guard readySourceRevealID == id, let reveal = sourceReveal,
               documentID == reveal.documentID, let selected = tabs.selectedTab,
               selected.id == documentID else { return nil }
        sourceReveal = nil
        guard !isBusy, !tabs.isComposing else { return nil }
        guard selected.document.revision == reveal.revision,
               editorSource.utf8.elementsEqual(reveal.source.utf8) else {
            fileNotice = reveal.changedNotice
            return nil
        }
        return reveal.range
    }

    var canCompareOriginal: Bool {
        !isBusy && !tabs.isComposing && !hasNativeMarkedText && window?.attachedSheet == nil &&
            tabs.selectedTab?.copyOrigin != nil
    }

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

    func canOpenComparedDisk(_ id: UUID) -> Bool {
        guard let report = comparisonReport, report.id == id,
              report.comparison.diskStatus == .modified, pendingDiscard == nil,
              !hasOperationBesidesComparisonReport, tabs.canCreateTab, !hasNativeMarkedText,
              let tab = tabs.selectedTab else { return false }
        return tab.id == report.documentID && tab.document.revision == report.revision
    }

    /// Consumes the current comparison only when the captured disk version opens. No I/O or draft update.
    @discardableResult
    func openComparedDisk(_ id: UUID) -> UUID? {
        guard !Task.isCancelled, canOpenComparedDisk(id), let disk = comparisonReport?.comparison.disk,
              let opened = tabs.openComparisonSnapshot(disk) else { return nil }
        comparisonReport = nil
        fileNotice = "比較時に読み取ったディスク版を別タブに開きました。編集用コピーは変更していません。"
        return opened
    }

    /// The caller handles one explicit picker selection and releases its scope before returning the snapshot.
    func readOriginalComparison(_ id: UUID, using readSelected: @MainActor () async throws -> SelectedTextFile?) async {
        guard let request = comparisonRequest, request.id == id, readingComparisonID == nil else { return }
        readingComparisonID = id
        defer {
            readingComparisonID = nil
            cancelOriginalComparison(id)
        }
        guard !Task.isCancelled, validateComparisonSource(request) else { return }
        do {
            guard let disk = try await readSelected(), !Task.isCancelled, comparisonRequest?.id == id,
                  validateComparisonSource(request) else { return }
            comparisonReport = ComparisonReport(
                id: id, documentID: request.documentID, revision: request.revision,
                comparison: OriginalFileComparison(baseline: request.baseline, disk: disk, draftSource: request.draftSource)
            )
        } catch is CancellationError {
            // Cancelling the picker or the read must not publish a comparison.
        } catch {
            guard !Task.isCancelled, comparisonRequest?.id == id else { return }
            fileNotice = "比較先を読み取れませんでした。\(Self.readFailure(error))"
        }
    }

    private func validateComparisonSource(_ request: ComparisonRequest) -> Bool {
        guard !tabs.isComposing, !hasNativeMarkedText else {
            fileNotice = "変換を確定またはキャンセルしてから、もう一度原本を比較してください。"
            return false
        }
        guard let selected = tabs.selectedTab, selected.id == request.documentID,
              selected.document.revision == request.revision else {
            fileNotice = "手元の原稿が変わったため、比較をやり直してください。"
            return false
        }
        return true
    }

    var folderInputIsCommitted: Bool { !tabs.isComposing && !hasNativeMarkedText }
    var canOpenFolderEntry: Bool { folderInputIsCommitted && tabs.canCreateTab }
    var canRequestFolderCatalog: Bool { !isBusy && folderInputIsCommitted && window?.attachedSheet == nil }

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
        folderEntryOpening = nil
    }

    /// Stage exactly one row. A second action on the parent window starts a fresh folder selection.
    @discardableResult
    func prepareFolderEntry(reportID: UUID, entryID: Data) -> Bool {
        guard let report = folderCatalogReport, report.id == reportID,
              folderEntryOpening == nil, activeFolderReadID == nil, canOpenFolderEntry,
              let entry = report.catalog.entries.first(where: { $0.id == entryID }) else { return false }
        folderEntryOpening = FolderEntryOpening(catalog: report.catalog, entry: entry)
        folderCatalogReport = nil
        return true
    }

    func startOpeningFolderEntry(_ id: UUID) {
        guard folderEntryOpening?.id == id, folderEntryOpening?.hasStarted == false,
              activeFolderReadID == nil, canOpenFolderEntry else { return }
        folderEntryOpening?.hasStarted = true
    }

    func cancelFolderEntry(_ id: UUID) {
        guard folderEntryOpening?.id == id else { return }
        folderEntryOpening = nil
    }

    /// `read` receives only the reserved entry. It releases the fresh picker access before returning.
    func readPreparedFolderEntry(
        _ id: UUID, using read: @MainActor (FolderEntryOpening) async throws -> SelectedTextFile?
    ) async {
        guard let opening = folderEntryOpening, opening.id == id, opening.hasStarted,
              activeFolderReadID == nil else { return }
        activeFolderReadID = id
        defer {
            activeFolderReadID = nil
            cancelFolderEntry(id)
        }
        guard !Task.isCancelled, canOpenFolderEntry else { return }
        do {
            guard let file = try await read(opening), !Task.isCancelled, folderEntryOpening?.id == id,
                  canOpenFolderEntry else { return }
            _ = tabs.openReadOnly(file)
        } catch is CancellationError {
            // A cancelled picker/read never creates a tab or a failure notice.
        } catch {
            guard !Task.isCancelled, folderEntryOpening?.id == id else { return }
            let reason: String
            if error is SelectedFolderCatalog.ScanError {
                reason = "同じフォルダと原稿を確認できませんでした。フォルダの原稿一覧を取り直してください。"
            } else {
                reason = Self.readFailure(error)
            }
            fileNotice = "一覧から原稿を開けませんでした。\(reason)"
        }
    }

    /// The picker callback releases its selected URL before returning the metadata snapshot.
    func readFolderCatalog(_ id: UUID, using read: @MainActor () async throws -> SelectedFolderCatalog?) async {
        guard folderCatalogRequest == id, activeFolderReadID == nil else { return }
        activeFolderReadID = id
        defer {
            activeFolderReadID = nil
            cancelFolderCatalog(id)
        }
        guard !Task.isCancelled, folderInputIsCommitted else { return }
        do {
            guard let snapshot = try await read(), !Task.isCancelled, folderCatalogRequest == id,
                  folderInputIsCommitted else { return }
            folderCatalogReport = FolderCatalogReport(id: id, catalog: snapshot)
        } catch is CancellationError {
            // Cancellation has no result or failure notice.
        } catch {
            guard !Task.isCancelled, folderCatalogRequest == id else { return }
            let reason: String = switch error as? SelectedFolderCatalog.ScanError {
            case .tooManyEntries: "直下に\(SelectedFolderCatalog.entryLimit)件以下の項目があるフォルダを選んでください。"
            case .changedWhileScanning, .selectionChanged, .entryNotListed: "一覧の取得中にフォルダが変わりました。選び直してください。"
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
    var canSaveCopy: Bool {
        !isBusy && !tabs.isComposing && !hasNativeMarkedText && window?.attachedSheet == nil &&
            tabs.selectedTab?.isReadOnly == false
    }

    func makeEditableCopy() {
        guard canMakeEditableCopy, let id = tabs.makeEditableCopyOfSelection() else { return }
        if let draft = tabs.recoveryDraft(for: id) { recovery?.enqueue(draft) }
        fileNotice = nil
    }

    enum CopySaveStatus {
        case currentRevision, earlierRevision
    }

    var selectedCopySaveStatus: CopySaveStatus? {
        guard saveCopyRequest == nil, !tabs.isComposing, !hasNativeMarkedText, !isDiscarding,
              let tab = tabs.selectedTab, let written = copyWrittenRevisions[tab.id] else { return nil }
        return tab.document.revision == written ? .currentRevision : .earlierRevision
    }

    func requestSaveCopy() {
        guard canSaveCopy, let selected = tabs.selectedTab else { return }
        exitNotice = nil
        fileNotice = nil
        saveCopyRequest = SaveCopyRequest(documentID: selected.id, revision: selected.document.revision,
                                          source: selected.document.source,
                                          encoding: selected.copyOrigin?.format.encoding ?? .utf8)
    }

    func prepareSaveCopyDestination(_ requestID: UUID) -> Bool {
        guard let request = saveCopyRequest, request.id == requestID, !isWritingCopy, !Task.isCancelled else { return false }
        return validateSaveCopySource(request)
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
        guard !Task.isCancelled, validateSaveCopySource(request) else { return }
        isWritingCopy = true
        do {
            try await writer(request.source, request.encoding, destination)
            // A successful return means the new file was published. Record the actual
            // written revision, not the current selection or revision after suspension.
            if tabs.tabs.contains(where: { $0.id == request.documentID }) {
                copyWrittenRevisions[request.documentID] = request.revision
            }
        } catch is CancellationError {
            // The writer only reports cancellation before publishing the new file.
        } catch {
            fileNotice = "コピーを保存できませんでした。\(Self.copyWriteFailure(error))"
        }
    }

    private func validateSaveCopySource(_ request: SaveCopyRequest) -> Bool {
        guard !tabs.isComposing, !hasNativeMarkedText else {
            fileNotice = "変換を確定またはキャンセルしてから、もう一度コピーを保存してください。"
            return false
        }
        guard let selected = tabs.selectedTab, selected.id == request.documentID,
              selected.document.revision == request.revision else {
            fileNotice = "原稿が変わったため、コピーを保存していません。もう一度お試しください。"
            return false
        }
        return true
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
        exportRequest = ExportRequest(format: format, input: .document(
            id: selected.id, revision: selected.document.revision, source: selected.document.source
        ))
    }

    var exportPickerID: UUID? {
        guard let request = exportRequest, !request.waitsForDestination else { return nil }
        return request.id
    }

    func startPickingBookExport(_ id: UUID) {
        guard let request = exportRequest, request.id == id, request.waitsForDestination else { return }
        guard validateExportSource(request) else {
            cancelExport(id)
            return
        }
        exportRequest?.phase = .picking
    }

    func exportDestinationRequest(_ id: UUID) -> ExportRequest? {
        guard let request = exportRequest, request.id == id, request.phase == .picking,
              !Task.isCancelled, validateExportSource(request) else { return nil }
        return request
    }

    func cancelExport(_ id: UUID) {
        guard let request = exportRequest, request.id == id else { return }
        switch request.phase {
        case .waitingForDestination, .picking: exportRequest = nil
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

        switch request.input {
        case .book(let book):
            await renderAndWriteExport(request, to: destination, render: {
                try await operations.renderBookEPUB(book.sources)
            }, write: operations.writeEPUB)
        case .document(_, _, let source):
            switch request.format {
            case .html:
                await renderAndWriteExport(request, to: destination, render: {
                    try await operations.renderHTML(source)
                }, write: operations.writeHTML)
            case .pdf:
                await renderAndWriteExport(request, to: destination, render: {
                    try await operations.renderPDF(source)
                }, write: operations.writePDF)
            case .epub:
                await renderAndWriteExport(request, to: destination, render: {
                    try await operations.renderEPUB(source)
                }, write: operations.writeEPUB)
            }
        }
    }

    private func renderAndWriteExport<Payload: Sendable>(
        _ request: ExportRequest, to destination: URL,
        render: @MainActor () async throws -> Payload,
        write: @MainActor (Payload, URL) async throws -> Void
    ) async {
        let name = request.format.name
        let owner = window
        let payload: Payload
        do {
            payload = try await render()
        } catch is CancellationError {
            return
        } catch {
            guard canFinishRendering(request, owner: owner) else { return }
            fileNotice = "\(name)を書き出せませんでした。\(Self.exportRenderFailure(error, format: request.format))"
            return
        }
        // Recheck authorization after rendering; a late native callback can still commit text.
        guard canFinishRendering(request, owner: owner) else { return }
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

    private func canFinishRendering(_ request: ExportRequest, owner: NSWindow?) -> Bool {
        guard !Task.isCancelled, window === owner, owner?.isVisible != false,
              exportRequest?.id == request.id, exportRequest?.phase == .rendering else { return false }
        return validateExportSource(request)
    }

    private func validateExportSource(_ request: ExportRequest) -> Bool {
        guard !tabs.isComposing, !hasNativeMarkedText else {
            fileNotice = "原稿の変換を確定またはキャンセルしてから、もう一度\(request.format.name)を書き出してください。"
            return false
        }
        switch request.input {
        case .document(let id, let revision, _):
            if let selected = tabs.selectedTab, selected.id == id, selected.document.revision == revision { return true }
        case .book(let book):
            if bookVersionsMatch(book) { return true }
        }
        fileNotice = "原稿の状態が変わったため、\(request.format.name)を書き出していません。もう一度お試しください。"
        return false
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
            switch error as? MarkdownBookPreview.Failure {
            case .invalidSelection: return "対象の原稿を選び直してください。"
            case .tooLarge: return "選んだ原稿の合計が上限（256 KiB）を超えています。"
            case .unavailable(_, .inputTooLarge): return "原稿1件あたりの上限（128 KiB）を超えています。"
            case .unavailable(_, .tooManyBlocks), .unavailable(_, .tooComplex):
                return "原稿の構造が変換処理の上限を超えています。"
            case .unavailable(_, .parseFailed), nil: break
            }
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

    enum RecoveryStatus {
        case unconfirmed, checkpointed
    }

    var selectedRecoveryStatus: RecoveryStatus? {
        guard let recovery, !recoveryUnavailable, !tabs.isComposing, !hasNativeMarkedText, !isDiscarding,
              let id = tabs.selectedID, let draft = tabs.recoveryDraft(for: id) else { return nil }
        return recovery.hasCheckpointed(draft) ? .checkpointed : .unconfirmed
    }

    var canRequestRecovery: Bool {
        recovery != nil && !isBusy && !tabs.isComposing && !hasNativeMarkedText && window?.attachedSheet == nil
    }

    func requestRecovery() {
        guard canRequestRecovery else { return }
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
        try await recovery.discardCandidate(draft)
    }

    var canRestoreRecoveryDraft: Bool {
        showsRecovery && !isDiscarding && openRequest == nil && pendingDiscard == nil &&
            tabs.canCreateTab && !hasNativeMarkedText
    }

    func restore(_ draft: RecoveryDraft) -> Bool {
        guard canRestoreRecoveryDraft, !tabs.recoveryDrafts.contains(where: { $0.id == draft.id }),
              tabs.restoreDraft(draft) != nil else { return false }
        if let restored = tabs.recoveryDrafts.last { recovery?.enqueue(restored) }
        return true
    }

    @discardableResult
    func resolveTabDiscard(_ id: UUID, discard: Bool) -> Task<Void, Never>? {
        guard let request = pendingDiscard, request.id == id else { return nil }
        // Consume only the current request, including cancellation or a now-invalid approval.
        defer { pendingDiscard = nil }
        guard discard else { return nil }
        let ticket = request.ticket
        guard !hasExclusiveOperation, !hasNativeMarkedText,
              let draft = tabs.draftForDiscard(ticket) else {
            exitNotice = "原稿の状態が変わったため、閉じませんでした。操作をやり直してください。"
            return nil
        }
        // Reserve synchronously, before releasing the confirmation.
        isDiscarding = true
        return Task {
            defer { isDiscarding = false }
            _ = await finishDiscard([draft]) { !self.hasNativeMarkedText && self.tabs.discard(ticket) }
        }
    }

    func reserveExitDiscard() -> [RecoveryDraft]? {
        guard !isBusy, !tabs.isComposing, !hasNativeMarkedText else { return nil }
        isDiscarding = true
        return tabs.recoveryDrafts
    }

    /// Keep editing reserved until the delegate synchronously dispatches its native decision.
    func finishExitDiscard(_ confirmed: [RecoveryDraft], reply: (Bool) -> Void) async {
        defer { isDiscarding = false }
        let ready = await finishDiscard(confirmed) {
            !self.tabs.isComposing && !self.hasNativeMarkedText && self.tabs.recoveryDrafts == confirmed
        }
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

    func cancelOpen(_ request: UUID) {
        if openRequest == request { openRequest = nil }
    }

    func openSelectedFile(_ request: UUID, read: () async throws -> SelectedTextFile?) async {
        guard openRequest == request else { return }
        defer { cancelOpen(request) }
        let retryMessage = "変換を確定またはキャンセルしてから、もう一度ファイルを開いてください。"
        guard !Task.isCancelled else { return }
        guard !tabs.isComposing, !hasNativeMarkedText else {
            fileNotice = retryMessage
            return
        }
        do {
            guard let file = try await read(), !Task.isCancelled, openRequest == request else { return }
            // The editor may have regained focus and started composing during the read.
            if hasNativeMarkedText || tabs.openReadOnly(file) == nil {
                fileNotice = retryMessage
            }
        } catch is CancellationError {
            return
        } catch {
            guard !Task.isCancelled, openRequest == request else { return }
            fileNotice = "開けませんでした。\(Self.readFailure(error))"
        }
    }

    func newTab() {
        guard canAddTab else { return }
        tabs.newTab()
    }
}
