import AppKit
import HazakuraNextCore
import HazakuraNextEditor
import SwiftUI
import UniformTypeIdentifiers

struct ScratchWorkspaceView: View {
    let session: WorkspaceSession
    @State private var openPanel: NSOpenPanel?
    @State private var savePanel: NSSavePanel?

    private enum SavePurpose { case copy, bookEPUB, export(WorkspaceSession.ExportFormat) }

    var body: some View {
        let openID = session.openRequest
        let folderID = session.folderCatalogRequest
        let folderReportID = session.folderCatalogReport?.id
        let folderOpening = session.folderEntryOpening
        let folderOpeningID = folderOpening?.hasStarted == true ? folderOpening?.id : nil
        let saveID = session.saveCopyRequest?.id
        let exportID = session.exportPickerID
        let compareID = session.comparisonRequestID
        let reportID = session.comparisonReport?.id
        let previewID = session.markdownPreview?.id
        let bookID = session.bookPreviewRequest?.id
        let assistSampleID = session.assistReviewSample?.id
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(banner)
                    if let folderID {
                        Button("中止") {
                            guard session.folderCatalogRequest == folderID else { return }
                            session.cancelFolderCatalog(folderID)
                            openPanel?.cancel(nil)
                        }
                    } else if let folderOpening {
                        if !folderOpening.hasStarted {
                            Button("同じフォルダを選び直す…") {
                                guard let window = session.window, window.isVisible, window.isKeyWindow,
                                      window.attachedSheet == nil else { return }
                                session.startOpeningFolderEntry(folderOpening.id)
                            }
                            .disabled(!session.tabs.canCreateTab)
                        }
                        Button("中止") {
                            guard session.folderEntryOpening?.id == folderOpening.id else { return }
                            session.cancelFolderEntry(folderOpening.id)
                            openPanel?.cancel(nil)
                        }
                    } else if let request = session.exportRequest, request.waitsForDestination {
                        bookExportDestinationActions(request.id)
                    }
                }
                if session.recoveryUnavailable {
                    Label("復旧用の保存先を利用できません。この起動中の原稿は退避されません。", systemImage: "exclamationmark.triangle")
                } else if let failure = session.recovery?.failure {
                    Label(failure, systemImage: "exclamationmark.triangle")
                }
            }
            .font(.callout)
            .foregroundStyle(.secondary)
            .padding(12)
            if session.isZenMode {
                focusedTabBar
            } else {
                tabBar
            }
            Divider()
            editors
        }
        .frame(minWidth: 450, minHeight: 300)
        .task(id: openID) {
            if let openID { await openSelectedFile(openID) }
        }
        .task(id: folderID) {
            if let folderID {
                await session.readFolderCatalog(folderID) { try await pickFolderCatalog(folderID) }
            }
        }
        .task(id: folderOpeningID) {
            if let folderOpeningID {
                await session.readPreparedFolderEntry(folderOpeningID) { try await pickFolderForEntry($0) }
            }
        }
        .task(id: saveID) {
            if let saveID {
                defer { session.cancelSaveCopy(saveID) }
                guard session.saveCopyRequest?.id == saveID else { return }
                await withSelectedDestination(for: .copy) { destination in
                    await session.writeRequestedCopy(saveID, to: destination)
                }
            }
        }
        .task(id: exportID) {
            if let exportID {
                defer { session.cancelExport(exportID) }
                guard let request = session.exportDestinationRequest(exportID) else { return }
                let purpose: SavePurpose = request.bookCount == nil ? .export(request.format) : .bookEPUB
                await withSelectedDestination(for: purpose) { destination in
                    await session.writeRequestedExport(exportID, to: destination)
                }
            }
        }
        .task(id: compareID) {
            if let compareID {
                await session.readOriginalComparison(compareID) {
                    try await readThroughOpenPanel(comparing: true) { session.comparisonRequestID == compareID }
                }
            }
        }
        .onDisappear {
            let open = openPanel
            let save = savePanel
            session.openRequest = nil
            session.clearFolderCatalog()
            if let id = session.comparisonRequestID { session.cancelOriginalComparison(id) }
            if let id = session.comparisonReport?.id { session.dismissOriginalComparison(id) }
            if let id = session.markdownPreview?.id { session.dismissMarkdownPreview(id) }
            if let id = session.bookPreviewRequest?.id { session.dismissBookPreview(id) }
            if let id = session.assistReviewSample?.id { session.dismissAssistReviewSample(id) }
            if let id = session.exportRequest?.id { session.cancelExport(id) }
            openPanel = nil
            savePanel = nil
            open?.cancel(nil)
            save?.cancel(nil)
        }
        .sheet(item: Binding(get: { session.folderCatalogReport }, set: { report in
            if report == nil, let folderReportID { session.dismissFolderCatalogReport(folderReportID) }
        })) { report in
            FolderCatalogView(catalog: report.catalog, canChoose: session.tabs.canCreateTab) { entryID in
                session.prepareFolderEntry(reportID: report.id, entryID: entryID)
            }
        }
        .sheet(item: Binding(get: { session.comparisonReport }, set: { report in
            if report == nil, let reportID { session.dismissOriginalComparison(reportID) }
        })) { report in
            OriginalFileComparisonView(session: session, report: report)
        }
        .sheet(item: Binding(get: { session.markdownPreview }, set: { preview in
            if preview == nil, let previewID { session.dismissMarkdownPreview(previewID) }
        })) { preview in
            MarkdownPreviewView(
                title: preview.title, source: preview.source, readingBlockIndex: preview.readingBlockIndex,
                rememberReadingBlock: { session.rememberMarkdownReadingPosition($0, previewID: preview.id) }
            ) { location in
                session.requestMarkdownReveal(preview.id, offset: location.utf16Offset)
            }
        }
        .sheet(item: Binding(get: { session.bookPreviewRequest }, set: { book in
            if book == nil, let bookID { session.dismissBookPreview(bookID) }
        })) { request in
            BookPreviewView(session: session, request: request)
        }
        .sheet(item: Binding(get: { session.assistReviewSample }, set: { sample in
            if sample == nil, let assistSampleID { session.dismissAssistReviewSample(assistSampleID) }
        })) { _ in
            AssistReviewSampleView()
        }
        .sheet(isPresented: Binding(get: { session.showsRecovery }, set: { session.showsRecovery = $0 })) {
            DraftRecoveryView(session: session)
        }
        .alert("この検証用原稿を破棄しますか？", isPresented: showsDiscard, presenting: session.pendingDiscard) { ticket in
            Button("破棄", role: .destructive) { session.startTabDiscard(ticket) }
            Button("キャンセル", role: .cancel) {}
        } message: { _ in
            if session.recovery == nil {
                Text("このタブの未保存原稿が削除されます。")
            } else {
                Text("このタブの未保存原稿と、その復旧記録が削除されます。")
            }
        }
    }

    private var banner: String {
        if session.tabs.isComposing { return "タブ操作や終了の前に、変換を確定またはキャンセルしてください。" }
        if session.openRequest != nil { return "ファイルを開いています…" }
        if session.folderCatalogRequest != nil { return "フォルダの直下を確認しています…" }
        if let opening = session.folderEntryOpening {
            return opening.hasStarted ? "選んだ原稿を確認しています…" : "「\(opening.entry.name)」を開くには、一覧を取得したフォルダを選び直してください。"
        }
        if session.saveCopyRequest != nil { return "新しいファイルにコピーを保存しています…" }
        if let request = session.exportRequest {
            if request.waitsForDestination, let count = request.bookCount {
                return "選んだ\(count)件の原稿を1冊のEPUBにまとめます。"
            }
            return "新しいファイルに\(request.format.name)を書き出しています…"
        }
        if session.comparisonRequestID != nil { return "比較するファイルを選び直してください。" }
        if let notice = session.exitNotice { return notice }
        if session.isDiscarding { return "復旧記録を確認しています…" }
        if let notice = session.fileNotice { return notice }
        if let tab = session.tabs.selectedTab, tab.isReadOnly {
            return tab.isComparisonSnapshot
                ? "読み取り専用 — 比較時のディスク版です。比較後の変更は反映されません。"
                : "読み取り専用 — 開いた時点の原文です。編集用コピーは別のタブに作れます。"
        }
        return "原稿は新しいファイルにコピーを保存できます。元のファイルには書き込みません。"
    }

    private func bookExportDestinationActions(_ id: UUID) -> some View {
        HStack {
            Button("書き出し先を選ぶ…") {
                guard let window = session.window, window.isVisible, window.isKeyWindow,
                      window.attachedSheet == nil else { return }
                session.startPickingBookExport(id)
            }
            .disabled(session.tabs.isComposing)
            Button("中止") { session.cancelExport(id) }
        }
    }

    private var showsDiscard: Binding<Bool> {
        Binding(get: { session.pendingDiscard != nil }, set: { if !$0 { session.pendingDiscard = nil } })
    }

    private func openSelectedFile(_ request: UUID) async {
        guard session.openRequest == request, !Task.isCancelled else { return }
        defer { if session.openRequest == request { session.openRequest = nil } }
        do {
            let file = try await readThroughOpenPanel(comparing: false) { session.openRequest == request }
            guard let file, !Task.isCancelled, session.openRequest == request else { return }
            // Do not take focus away from a composition that began after the picker closed.
            if session.tabs.openReadOnly(file) == nil {
                session.reportOpenFailure("変換の確定後に、もう一度ファイルを選んでください。", request: request)
            }
        } catch {
            guard !Task.isCancelled, session.openRequest == request else { return }
            session.reportOpenFailure(WorkspaceSession.readFailure(error), request: request)
        }
    }

    private func readThroughOpenPanel(comparing: Bool, isCurrent: () -> Bool) async throws -> SelectedTextFile? {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.plainText] + [UTType(filenameExtension: "md")].compactMap { $0 }
        panel.canChooseFiles = true
        panel.canChooseDirectories = false
        panel.allowsMultipleSelection = false
        panel.resolvesAliases = false
        if comparing {
            panel.title = "比較する原本を選ぶ"
            panel.message = "開いた時点と比べるファイルを選び直してください。ファイルは読み取るだけです。"
            panel.prompt = "比較"
        }
        return try await withChosenOpenURL(panel, isCurrent: isCurrent) { url in
            try await SelectedTextFile.read(from: url)
        }
    }

    private func pickFolderCatalog(_ id: UUID) async throws -> SelectedFolderCatalog? {
        let panel = folderPanel()
        panel.title = "一覧を確認するフォルダを選ぶ"
        panel.message = "フォルダ直下のMarkdown・テキストの候補名だけを確認します。本文は開きません。"
        panel.prompt = "一覧を確認"
        return try await withChosenOpenURL(panel, isCurrent: {
            session.folderCatalogRequest == id && !session.tabs.isComposing
        }) { url in
            try await SelectedFolderCatalog.read(from: url)
        }
    }

    private func pickFolderForEntry(_ opening: WorkspaceSession.FolderEntryOpening) async throws -> SelectedTextFile? {
        let panel = folderPanel()
        panel.title = "一覧を取得したフォルダを選び直す"
        panel.message = "選んだ「\(opening.entry.name)」だけを読み取り専用で開きます。先ほどと同じフォルダを選んでください。"
        panel.prompt = "原稿を開く"
        return try await withChosenOpenURL(panel, isCurrent: {
            session.folderEntryOpening?.id == opening.id && session.tabs.canCreateTab && session.window?.isVisible == true
        }) { folder in
            try await opening.catalog.readEntry(opening.entry.id, from: folder)
        }
    }

    private func folderPanel() -> NSOpenPanel {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = false
        panel.resolvesAliases = false
        panel.canCreateDirectories = false
        panel.treatsFilePackagesAsDirectories = false
        panel.canDownloadUbiquitousContents = false
        panel.canResolveUbiquitousConflicts = false
        // Changing package treatment can update both selection flags in recent macOS versions.
        panel.canChooseFiles = false
        panel.canChooseDirectories = true
        return panel
    }

    private func withChosenOpenURL<Result>(
        _ panel: NSOpenPanel, isCurrent: () -> Bool, read: (URL) async throws -> Result
    ) async throws -> Result? {
        guard !Task.isCancelled, isCurrent(), openPanel == nil, let window = session.window,
              window.isKeyWindow, window.attachedSheet == nil else { return nil }
        openPanel = panel
        let answer = await panel.beginSheetModal(for: window)
        if openPanel === panel { openPanel = nil }
        guard answer == .OK, let url = panel.url else { return nil }
        // Release the panel's temporary access even if the request became stale or was cancelled.
        defer { url.stopAccessingSecurityScopedResource() }
        guard isCurrent(), session.window === window else { return nil }
        try Task.checkCancellation()
        let result = try await read(url)
        guard session.window === window, isCurrent() else { return nil }
        try Task.checkCancellation()
        return result
    }

    private func withSelectedDestination(for purpose: SavePurpose, write: @MainActor (URL) async -> Void) async {
        guard !Task.isCancelled, savePanel == nil,
              let window = session.window, window.isVisible, window.isKeyWindow, window.attachedSheet == nil else { return }
        let panel = NSSavePanel()
        switch purpose {
        case .copy:
            panel.title = "原稿のコピーを保存"
            panel.message = "既存のファイルは置き換えません。新しいファイル名を選んでください。"
            panel.prompt = "コピーを保存"
            panel.nameFieldStringValue = "原稿-コピー.md"
            panel.allowedContentTypes = [.plainText] + [UTType(filenameExtension: "md")].compactMap { $0 }
        case .export(.html):
            panel.title = "HTMLを書き出す"
            panel.message = "確定済みの原稿からHTMLを作ります。既存のファイルは置き換えません。"
            panel.prompt = "書き出す"
            panel.nameFieldStringValue = "原稿.html"
            panel.allowedContentTypes = [.html]
        case .export(.pdf):
            panel.title = "PDFを書き出す"
            panel.message = "確定済みの原稿からPDFを作ります。既存のファイルは置き換えません。"
            panel.prompt = "書き出す"
            panel.nameFieldStringValue = "原稿.pdf"
            panel.allowedContentTypes = [.pdf]
        case .export(.epub), .bookEPUB:
            guard let epub = UTType(filenameExtension: "epub") else { return }
            let isBook = if case .bookEPUB = purpose { true } else { false }
            panel.title = isBook ? "選んだ原稿を1冊のEPUBに書き出す" : "EPUBを書き出す"
            panel.message = isBook
                ? "選んだ原稿を読んだ順にまとめます。既存のファイルは置き換えません。"
                : "確定済みの原稿から章と目次付きのEPUBを作ります。既存のファイルは置き換えません。"
            panel.prompt = "書き出す"
            panel.nameFieldStringValue = isBook ? "選んだ原稿.epub" : "原稿.epub"
            panel.allowedContentTypes = [epub]
        }
        panel.canCreateDirectories = false
        savePanel = panel
        let answer = await panel.beginSheetModal(for: window)
        if savePanel === panel { savePanel = nil }
        guard answer == .OK, let destination = panel.url else { return }
        // The panel grants this choice only for the current write. Do not store a bookmark or path.
        defer { destination.stopAccessingSecurityScopedResource() }
        guard !Task.isCancelled, session.window === window, window.isVisible else { return }
        await write(destination)
    }

    private var tabBar: some View {
        HStack(spacing: 8) {
            ScrollView(.horizontal) {
                HStack(spacing: 6) {
                    ForEach(session.tabs.tabs) { tab in
                        tabButton(for: tab)
                    }
                }
            }
            if session.recovery != nil {
                Button {
                    session.requestRecovery()
                } label: {
                    Label("原稿を復元", systemImage: "clock.arrow.circlepath")
                        .labelStyle(.iconOnly)
                }
                .help("退避された原稿を確認する")
                .disabled(session.tabs.isComposing)
            }

            Button {
                session.requestOpen()
            } label: {
                Label("ファイルを開く", systemImage: "folder")
                    .labelStyle(.iconOnly)
            }
            .help("テキストを読み取り専用で開く（⌘O）")
            .disabled(!session.tabs.canCreateTab)

            if session.tabs.selectedTab?.isReadOnly == true {
                Button {
                    session.makeEditableCopy()
                } label: {
                    Label("編集用コピーを開く", systemImage: "doc.on.doc").labelStyle(.iconOnly)
                }
                .help("元のファイルを変更せず、別のタブで編集する")
                .disabled(!session.canMakeEditableCopy)
            } else {
                Button {
                    session.requestSaveCopy()
                } label: {
                    Label("コピーを保存", systemImage: "square.and.arrow.down").labelStyle(.iconOnly)
                }
                .help("原稿を新しいファイルに保存（⌘⇧S）")
                .disabled(!session.canSaveCopy)
                if session.tabs.selectedTab?.copyOrigin != nil {
                    Button {
                        session.requestOriginalComparison()
                    } label: {
                        Label("原本の版を比較", systemImage: "arrow.left.arrow.right").labelStyle(.iconOnly)
                    }
                    .help("ファイルを選び直し、開いた時点・ディスク・編集中の原稿を比較する")
                    .disabled(!session.canCompareOriginal)
                }
            }

            Button {
                session.requestMarkdownPreview()
            } label: {
                Label("Markdownプレビュー", systemImage: "doc.richtext").labelStyle(.iconOnly)
            }
            .help("選択中の原稿を読み取り専用でプレビューする")
            .disabled(!session.canPreviewMarkdown)

            Button {
                session.newTab()
            } label: {
                Label("新規タブ", systemImage: "plus")
                    .labelStyle(.iconOnly)
            }
            .help("新規タブ（⌘T、最大\(ScratchTabs.limit)件）")
            .disabled(!session.tabs.canCreateTab)

            Button {
                guard !session.isBusy else { return }
                if case let .confirm(ticket) = session.tabs.requestCloseSelected() {
                    session.pendingDiscard = ticket
                }
            } label: {
                Label("選択中のタブを閉じる", systemImage: "xmark")
                    .labelStyle(.iconOnly)
            }
            .help("選択中のタブを閉じる")
            .disabled(session.tabs.selectedID == nil || session.tabs.isComposing)
        }
        .padding(.horizontal, 12)
        .padding(.bottom, 8)
        .disabled(session.isBusy)
    }

    private func tabButton(for tab: ScratchTabs.Tab) -> some View {
        let isSelected = session.tabs.selectedID == tab.id
        let title = WorkspaceSession.title(for: tab)
        return Button {
            if !session.isBusy { session.tabs.select(tab.id) }
        } label: {
            HStack(spacing: 4) {
                if tab.isReadOnly { Image(systemName: "lock").accessibilityHidden(true) }
                Text(verbatim: title).lineLimit(1)
            }
            .frame(maxWidth: 180)
        }
        .buttonStyle(.bordered)
        .tint(isSelected ? Color.accentColor : nil)
        .accessibilityAddTraits(isSelected ? [.isSelected] : [])
        .accessibilityValue(tab.isReadOnly ? "読み取り専用" : "")
        .disabled(isSelected || session.tabs.isComposing)
    }

    private var focusedTabBar: some View {
        HStack(spacing: 8) {
            if let tab = session.tabs.selectedTab {
                let title = WorkspaceSession.title(for: tab)
                Label {
                    Text(verbatim: title)
                        .lineLimit(1)
                } icon: {
                    Image(systemName: tab.isReadOnly ? "lock" : "doc.text")
                        .accessibilityHidden(true)
                }
                .help(title)
                .accessibilityValue(tab.isReadOnly ? "読み取り専用" : "")
            } else {
                Text("タブがありません")
            }
            Spacer(minLength: 8)
            Button("集中表示を終了") {
                guard session.isZenMode else { return }
                session.toggleZenMode()
            }
            .disabled(!session.canToggleZenMode)
            .layoutPriority(1)
        }
        .font(.callout)
        .padding(.horizontal, 12)
        .padding(.bottom, 6)
    }

    private var editors: some View {
        // Do not conditionally rebuild the editor when it loses selection. AppKit retains
        // the document's cursor, scroll geometry and undo manager while it is inactive.
        let revealID = session.readyMarkdownRevealID
        let isLMode = session.isLMode
        return ZStack {
            ForEach(session.tabs.tabs) { tab in
                let id = tab.id
                let isSelected = session.tabs.selectedID == id
                TextKitEditor(
                    initialText: tab.document.source,
                    documentID: id,
                    isActive: isSelected,
                    isReadOnly: tab.isReadOnly,
                    isFocusLayout: isLMode,
                    canEdit: { session.canEditSource },
                    onCompositionChange: { session.tabs.setComposing($0, in: id) },
                    revealSourceLocation: { editorSource in
                        guard let revealID else { return nil }
                        return session.takeMarkdownReveal(revealID, documentID: id, editorSource: editorSource)
                    }
                ) { source in
                    session.applyCommittedSource(source, to: id)
                }
                .opacity(isSelected ? 1 : 0)
                .allowsHitTesting(isSelected)
                .accessibilityHidden(!isSelected)
                .zIndex(isSelected ? 1 : 0)
            }
            if session.tabs.tabs.isEmpty {
                ContentUnavailableView("タブがありません", systemImage: "doc.text", description: Text("新規タブを開いて編集を試せます。"))
            }
        }
    }
}
