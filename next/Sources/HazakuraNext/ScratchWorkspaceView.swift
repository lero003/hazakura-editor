import AppKit
import HazakuraNextCore
import HazakuraNextEditor
import SwiftUI
import UniformTypeIdentifiers

struct ScratchWorkspaceView: View {
    let session: WorkspaceSession
    @State private var openPanel: NSOpenPanel?
    @State private var savePanel: NSSavePanel?

    var body: some View {
        let openID = session.openRequest
        let saveID = session.saveCopyRequest?.id
        let compareID = session.comparisonRequestID
        let reportID = session.comparisonReport?.id
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 4) {
                Text(banner)
                if session.recoveryUnavailable {
                    Label("復旧用の保存先を利用できません。この起動中の原稿は退避されません。", systemImage: "exclamationmark.triangle")
                } else if let failure = session.recovery?.failure {
                    Label(failure, systemImage: "exclamationmark.triangle")
                }
            }
            .font(.callout)
            .foregroundStyle(.secondary)
            .padding(12)
            tabBar
            Divider()
            editors
        }
        .frame(minWidth: 450, minHeight: 300)
        .task(id: openID) {
            if let openID { await openSelectedFile(openID) }
        }
        .task(id: saveID) {
            if let saveID { await saveSelectedCopy(saveID) }
        }
        .task(id: compareID) {
            if let compareID {
                await session.readOriginalComparison(compareID) {
                    try await readThroughOpenPanel(comparing: true) { session.comparisonRequestID == compareID }
                }
            }
        }
        .onDisappear {
            let panel = openPanel
            session.openRequest = nil
            if let id = session.comparisonRequestID { session.cancelOriginalComparison(id) }
            openPanel = nil
            panel?.cancel(nil)
            savePanel?.cancel(nil)
        }
        .sheet(item: Binding(get: { session.comparisonReport }, set: { report in
            if report == nil, let reportID { session.dismissOriginalComparison(reportID) }
        })) { report in
            OriginalFileComparisonView(comparison: report.comparison)
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
        if session.saveCopyRequest != nil { return "新しいファイルにコピーを保存しています…" }
        if session.comparisonRequestID != nil { return "比較するファイルを選び直してください。" }
        if let notice = session.exitNotice { return notice }
        if session.isDiscarding { return "復旧記録を確認しています…" }
        if let notice = session.fileNotice { return notice }
        if session.tabs.selectedTab?.isReadOnly == true {
            return "読み取り専用 — 開いた時点の原文です。編集用コピーは別のタブに作れます。"
        }
        return "原稿は新しいファイルにコピーを保存できます。元のファイルには書き込みません。"
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
        guard !Task.isCancelled, isCurrent(), let window = session.window, window.isKeyWindow,
              window.attachedSheet == nil else { return nil }
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
        openPanel = panel
        let answer = await panel.beginSheetModal(for: window)
        if openPanel === panel { openPanel = nil }
        guard answer == .OK, let url = panel.url else { return nil }
        // macOS starts access for the URL returned by the Open panel; do not retain it for later I/O.
        defer { url.stopAccessingSecurityScopedResource() }
        guard isCurrent() else { return nil }
        try Task.checkCancellation()
        return try await SelectedTextFile.read(from: url)
    }

    private func saveSelectedCopy(_ requestID: UUID) async {
        defer { session.cancelSaveCopy(requestID) }
        guard !Task.isCancelled, session.saveCopyRequest?.id == requestID,
              let window = session.window, window.isKeyWindow, window.attachedSheet == nil else { return }
        let panel = NSSavePanel()
        panel.title = "原稿のコピーを保存"
        panel.message = "既存のファイルは置き換えません。新しいファイル名を選んでください。"
        panel.prompt = "コピーを保存"
        panel.nameFieldStringValue = "原稿-コピー.md"
        panel.allowedContentTypes = [.plainText] + [UTType(filenameExtension: "md")].compactMap { $0 }
        panel.canCreateDirectories = false
        savePanel = panel
        let answer = await panel.beginSheetModal(for: window)
        savePanel = nil
        guard answer == .OK, let destination = panel.url else { return }
        // The panel grants this choice only for the current write. Do not store a bookmark or path.
        defer { destination.stopAccessingSecurityScopedResource() }
        guard !Task.isCancelled else { return }
        await session.writeRequestedCopy(requestID, to: destination)
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
                session.newTab()
            } label: {
                Label("新規タブ", systemImage: "plus")
                    .labelStyle(.iconOnly)
            }
            .help("新規タブ（⌘T、最大\(ScratchTabs.limit)件）")
            .disabled(!session.tabs.canCreateTab)

            Button {
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
        let title = tab.selectedFile?.name ?? tab.copyOrigin.map { "\($0.name) のコピー" } ?? "原稿 \(tab.number)"
        return Button { session.tabs.select(tab.id) } label: {
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

    private var editors: some View {
        // Do not conditionally rebuild the editor when it loses selection. AppKit retains
        // the document's cursor, scroll geometry and undo manager while it is inactive.
        ZStack {
            ForEach(session.tabs.tabs) { tab in
                let id = tab.id
                let isSelected = session.tabs.selectedID == id
                TextKitEditor(
                    initialText: tab.document.source,
                    isActive: isSelected,
                    isReadOnly: tab.isReadOnly,
                    canEdit: { session.canEditSource },
                    onCompositionChange: { session.tabs.setComposing($0, in: id) }
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
