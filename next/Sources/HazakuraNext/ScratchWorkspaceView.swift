import AppKit
import HazakuraNextCore
import HazakuraNextEditor
import SwiftUI
import UniformTypeIdentifiers

struct ScratchWorkspaceView: View {
    @State private var workspace: ScratchTabs
    @State private var pendingDiscard: ScratchTabs.DiscardTicket?
    @State private var openRequest: UUID?
    @State private var openPanel: NSOpenPanel?
    @State private var openFailure: String?

    init(source: String) {
        _workspace = State(initialValue: ScratchTabs(source: source))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(banner)
                .font(.callout)
                .foregroundStyle(.secondary)
                .padding(12)
            tabBar
            Divider()
            editors
        }
        .frame(minWidth: 450, minHeight: 300)
        .task(id: openRequest) {
            if let request = openRequest { await openSelectedFile(request) }
        }
        .onDisappear {
            let panel = openPanel
            openRequest = nil
            openPanel = nil
            panel?.cancel(nil)
        }
        .alert("この検証用原稿を破棄しますか？", isPresented: showsDiscard, presenting: pendingDiscard) { ticket in
            Button("破棄", role: .destructive) { workspace.discard(ticket) }
            Button("キャンセル", role: .cancel) {}
        } message: { _ in
            Text("このタブを閉じると、編集内容は元に戻せません。")
        }
    }

    private var banner: String {
        if workspace.isComposing { return "タブを操作するには、先に変換を確定またはキャンセルしてください。" }
        if openRequest != nil { return "ファイルを開いています…" }
        if let openFailure { return "開けませんでした。\(openFailure)" }
        if workspace.selectedTab?.isReadOnly == true {
            return "読み取り専用 — 開いた時点の原文です。ファイルには書き込みません。"
        }
        return "検証用です。保存・復旧はありません。ウィンドウを閉じると入力内容は失われます。"
    }

    private var showsDiscard: Binding<Bool> {
        Binding(get: { pendingDiscard != nil }, set: { if !$0 { pendingDiscard = nil } })
    }

    private func openSelectedFile(_ request: UUID) async {
        guard openRequest == request, !Task.isCancelled else { return }
        defer {
            if openRequest == request {
                openPanel = nil
                openRequest = nil
            }
        }
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.plainText] + [UTType(filenameExtension: "md")].compactMap { $0 }
        panel.canChooseFiles = true
        panel.canChooseDirectories = false
        panel.allowsMultipleSelection = false
        panel.resolvesAliases = false
        openPanel = panel

        let answer: NSApplication.ModalResponse
        if let window = NSApp.keyWindow {
            answer = await panel.beginSheetModal(for: window)
        } else {
            answer = await panel.begin()
        }
        if openRequest == request { openPanel = nil }
        guard answer == .OK, let url = panel.url else { return }
        // macOS starts access for the URL returned by the Open panel; do not retain it for later I/O.
        defer { url.stopAccessingSecurityScopedResource() }
        guard !Task.isCancelled, openRequest == request else { return }

        do {
            let file = try await SelectedTextFile.read(from: url)
            guard !Task.isCancelled, openRequest == request else { return }
            // Do not take focus away from a composition that began after the picker closed.
            if workspace.openReadOnly(file) == nil {
                openFailure = "変換の確定後に、もう一度ファイルを選んでください。"
            }
        } catch {
            guard !Task.isCancelled, openRequest == request else { return }
            openFailure = Self.readFailure(error)
        }
    }

    private static func readFailure(_ error: Error) -> String {
        switch error as? SelectedTextFile.ReadError {
        case .tooLarge: "2 MiB以下のテキストを選んでください。"
        case .invalidUTF8: "この検証版で開ける文字コードはUTF-8のみです。"
        case .nonTextControls: "テキストとして扱えない制御文字が含まれています。"
        case .changedWhileReading: "読み込み中にファイルが更新されました。もう一度選んでください。"
        case .notRegularFile, .invalidLocation: "通常のテキストファイルを選んでください。"
        case .accessDenied, nil: "ファイルを読み取れません。リンク先ではなくファイルそのものを選び、アクセス権も確認してください。"
        }
    }

    private var tabBar: some View {
        HStack(spacing: 8) {
            ScrollView(.horizontal) {
                HStack(spacing: 6) {
                    ForEach(workspace.tabs) { tab in
                        tabButton(for: tab)
                    }
                }
            }
            Button {
                guard openRequest == nil, pendingDiscard == nil, workspace.canCreateTab else { return }
                openFailure = nil
                openRequest = UUID()
            } label: {
                Label("ファイルを開く", systemImage: "folder")
                    .labelStyle(.iconOnly)
            }
            .keyboardShortcut("o", modifiers: .command)
            .help("テキストを読み取り専用で開く（⌘O）")
            .disabled(!workspace.canCreateTab)

            Button {
                workspace.newTab()
            } label: {
                Label("新規タブ", systemImage: "plus")
                    .labelStyle(.iconOnly)
            }
            .keyboardShortcut("t", modifiers: .command)
            .help("新規タブ（⌘T、最大\(ScratchTabs.limit)件）")
            .disabled(!workspace.canCreateTab)

            Button {
                if case let .confirm(ticket) = workspace.requestCloseSelected() {
                    pendingDiscard = ticket
                }
            } label: {
                Label("選択中のタブを閉じる", systemImage: "xmark")
                    .labelStyle(.iconOnly)
            }
            .help("選択中のタブを閉じる")
            .disabled(workspace.selectedID == nil || workspace.isComposing)
        }
        .padding(.horizontal, 12)
        .padding(.bottom, 8)
        .disabled(pendingDiscard != nil || openRequest != nil)
    }

    private func tabButton(for tab: ScratchTabs.Tab) -> some View {
        let isSelected = workspace.selectedID == tab.id
        let title = tab.selectedFile?.name ?? "原稿 \(tab.number)"
        return Button { workspace.select(tab.id) } label: {
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
        .disabled(isSelected || workspace.isComposing)
    }

    private var editors: some View {
        // Do not conditionally rebuild the editor when it loses selection. AppKit retains
        // the document's cursor, scroll geometry and undo manager while it is inactive.
        ZStack {
            ForEach(workspace.tabs) { tab in
                let id = tab.id
                let isSelected = workspace.selectedID == id
                TextKitEditor(initialText: tab.document.source, isActive: isSelected, isReadOnly: tab.isReadOnly, onCompositionChange: { composing in
                    workspace.setComposing(composing, in: id)
                }) { source in
                    workspace.applyCommittedSource(source, to: id)
                }
                .opacity(isSelected ? 1 : 0)
                .allowsHitTesting(isSelected)
                .accessibilityHidden(!isSelected)
                .zIndex(isSelected ? 1 : 0)
            }
            if workspace.tabs.isEmpty {
                ContentUnavailableView("タブがありません", systemImage: "doc.text", description: Text("新規タブを開いて編集を試せます。"))
            }
        }
    }
}
