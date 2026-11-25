import HazakuraNextCore
import HazakuraNextEditor
import SwiftUI

struct ScratchWorkspaceView: View {
    @State private var workspace: ScratchTabs
    @State private var pendingDiscard: ScratchTabs.DiscardTicket?

    init(source: String) {
        _workspace = State(initialValue: ScratchTabs(source: source))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(workspace.isComposing
                ? "タブを操作するには、先に変換を確定またはキャンセルしてください。"
                : "検証用です。保存・復旧はありません。ウィンドウを閉じると入力内容は失われます。")
                .font(.callout)
                .foregroundStyle(.secondary)
                .padding(12)
            tabBar
            Divider()
            editors
        }
        .frame(minWidth: 450, minHeight: 300)
        .alert("この検証用原稿を破棄しますか？", isPresented: showsDiscard, presenting: pendingDiscard) { ticket in
            Button("破棄", role: .destructive) { workspace.discard(ticket) }
            Button("キャンセル", role: .cancel) {}
        } message: { _ in
            Text("このタブを閉じると、編集内容は元に戻せません。")
        }
    }

    private var showsDiscard: Binding<Bool> {
        Binding(get: { pendingDiscard != nil }, set: { if !$0 { pendingDiscard = nil } })
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
        .disabled(pendingDiscard != nil)
    }

    private func tabButton(for tab: ScratchTabs.Tab) -> some View {
        let isSelected = workspace.selectedID == tab.id
        return Button("原稿 \(tab.number)") { workspace.select(tab.id) }
            .buttonStyle(.bordered)
            .tint(isSelected ? Color.accentColor : nil)
            .accessibilityAddTraits(isSelected ? [.isSelected] : [])
            .disabled(isSelected || workspace.isComposing)
    }

    private var editors: some View {
        // Do not conditionally rebuild the editor when it loses selection. AppKit retains
        // the document's cursor, scroll geometry and undo manager while it is inactive.
        ZStack {
            ForEach(workspace.tabs) { tab in
                let id = tab.id
                let isSelected = workspace.selectedID == id
                TextKitEditor(initialText: tab.document.source, isActive: isSelected, onCompositionChange: { composing in
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
