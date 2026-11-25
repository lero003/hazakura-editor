import AppKit
import HazakuraNextCore
import HazakuraNextEditor
import SwiftUI
import UniformTypeIdentifiers

struct ScratchWorkspaceView: View {
    let session: WorkspaceSession
    @State private var openPanel: NSOpenPanel?
    @State private var openFailure: String?

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
        .task(id: session.openRequest) {
            if let request = session.openRequest { await openSelectedFile(request) }
        }
        .onDisappear {
            let panel = openPanel
            session.openRequest = nil
            openPanel = nil
            panel?.cancel(nil)
        }
        .alert("この検証用原稿を破棄しますか？", isPresented: showsDiscard, presenting: session.pendingDiscard) { ticket in
            Button("破棄", role: .destructive) { session.tabs.discard(ticket) }
            Button("キャンセル", role: .cancel) {}
        } message: { _ in
            Text("このタブを閉じると、編集内容は元に戻せません。")
        }
    }

    private var banner: String {
        if session.tabs.isComposing { return "タブ操作や終了の前に、変換を確定またはキャンセルしてください。" }
        if session.openRequest != nil { return "ファイルを開いています…" }
        if let notice = session.exitNotice { return notice }
        if let openFailure { return "開けませんでした。\(openFailure)" }
        if session.tabs.selectedTab?.isReadOnly == true {
            return "読み取り専用 — 開いた時点の原文です。ファイルには書き込みません。"
        }
        return "検証用です。保存・復旧はありません。"
    }

    private var showsDiscard: Binding<Bool> {
        Binding(get: { session.pendingDiscard != nil }, set: { if !$0 { session.pendingDiscard = nil } })
    }

    private func openSelectedFile(_ request: UUID) async {
        guard session.openRequest == request, !Task.isCancelled else { return }
        openFailure = nil
        defer {
            if session.openRequest == request {
                openPanel = nil
                session.openRequest = nil
            }
        }
        guard let window = session.window, window.isKeyWindow, window.attachedSheet == nil else { return }
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.plainText] + [UTType(filenameExtension: "md")].compactMap { $0 }
        panel.canChooseFiles = true
        panel.canChooseDirectories = false
        panel.allowsMultipleSelection = false
        panel.resolvesAliases = false
        openPanel = panel

        let answer = await panel.beginSheetModal(for: window)
        if session.openRequest == request { openPanel = nil }
        guard answer == .OK, let url = panel.url else { return }
        // macOS starts access for the URL returned by the Open panel; do not retain it for later I/O.
        defer { url.stopAccessingSecurityScopedResource() }
        guard !Task.isCancelled, session.openRequest == request else { return }

        do {
            let file = try await SelectedTextFile.read(from: url)
            guard !Task.isCancelled, session.openRequest == request else { return }
            // Do not take focus away from a composition that began after the picker closed.
            if session.tabs.openReadOnly(file) == nil {
                openFailure = "変換の確定後に、もう一度ファイルを選んでください。"
            }
        } catch {
            guard !Task.isCancelled, session.openRequest == request else { return }
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
                    ForEach(session.tabs.tabs) { tab in
                        tabButton(for: tab)
                    }
                }
            }
            Button {
                session.requestOpen()
            } label: {
                Label("ファイルを開く", systemImage: "folder")
                    .labelStyle(.iconOnly)
            }
            .help("テキストを読み取り専用で開く（⌘O）")
            .disabled(!session.tabs.canCreateTab)

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
        let title = tab.selectedFile?.name ?? "原稿 \(tab.number)"
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
                TextKitEditor(initialText: tab.document.source, isActive: isSelected, isReadOnly: tab.isReadOnly, onCompositionChange: { composing in
                    session.tabs.setComposing(composing, in: id)
                }) { source in
                    session.tabs.applyCommittedSource(source, to: id)
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
