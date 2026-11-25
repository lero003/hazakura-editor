import HazakuraNextCore
import SwiftUI

struct DraftRecoveryView: View {
    let session: WorkspaceSession
    @Environment(\.dismiss) private var dismiss
    @State private var candidates: [RecoveryDraft] = []
    @State private var selectedID: UUID?
    @State private var pendingRemoval: RecoveryDraft?
    @State private var request: RecoveryDraft?
    @State private var isLoading = true
    @State private var notice: String?

    private var selectedDraft: RecoveryDraft? { candidates.first { $0.id == selectedID } }
    private var busy: Bool { isLoading || request != nil }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("原稿の復元").font(.title2)
            Text("退避された原稿を別の未保存タブに開きます。元のファイルや復旧記録は変更しません。")
                .foregroundStyle(.secondary)
            if let notice { Text(verbatim: notice).foregroundStyle(.secondary) }
            if isLoading {
                ProgressView("復旧記録を確認しています…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if candidates.isEmpty {
                ContentUnavailableView("表示できる復旧記録はありません", systemImage: "doc.text")
            } else {
                List(selection: $selectedID) {
                    ForEach(candidates, id: \.id) { draft in
                        Text(verbatim: Self.label(for: draft)).lineLimit(1).tag(draft.id)
                    }
                }
                ScrollView {
                    if let draft = selectedDraft {
                        Text(verbatim: draft.source.isEmpty ? "（空の原稿）" : String(draft.source.prefix(1_200)))
                            .font(.system(.body, design: .monospaced))
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                .frame(height: 120)
            }
            HStack {
                Button("記録を削除…") { pendingRemoval = selectedDraft }
                    .disabled(selectedDraft == nil || busy)
                Spacer()
                Button("閉じる") { dismiss() }
                    .keyboardShortcut(.cancelAction)
                    .disabled(request != nil)
                Button("別のタブに開く") {
                    guard let selectedDraft else { return }
                    if session.restore(selectedDraft) { dismiss() }
                    else { notice = "復元できませんでした。タブの数と変換状態を確認してください。" }
                }
                .disabled(selectedDraft == nil || busy || !session.canRestoreRecoveryDraft)
            }
        }
        .padding(20)
        .frame(width: 520, height: 440)
        .interactiveDismissDisabled(request != nil)
        .task { await reload() }
        .task(id: request?.id) {
            guard let draft = request else { return }
            defer { request = nil }
            do {
                try await session.forgetRecoveryCandidate(draft)
                if selectedID == draft.id { selectedID = nil }
                await reload()
            } catch {
                await reload()
                notice = "復旧記録を削除できませんでした。記録が変更されたか、保存領域にアクセスできません。"
            }
        }
        .alert("この復旧記録を削除しますか？", isPresented: showsRemoval, presenting: pendingRemoval) { draft in
            Button("削除", role: .destructive) { request = draft }
            Button("キャンセル", role: .cancel) {}
        } message: { _ in
            Text("削除すると、この記録からは復元できなくなります。原本は変更されません。")
        }
    }

    private var showsRemoval: Binding<Bool> {
        Binding(get: { pendingRemoval != nil }, set: { if !$0 { pendingRemoval = nil } })
    }

    private func reload() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let loaded = try await session.recoveryCandidates()
            guard !Task.isCancelled else { return }
            candidates = loaded
            if let selectedID, !loaded.contains(where: { $0.id == selectedID }) { self.selectedID = nil }
            notice = nil
        } catch {
            guard !Task.isCancelled else { return }
            notice = "復旧記録を読み込めませんでした。既存の記録には書き込んでいません。"
            candidates = []
        }
    }

    private static func label(for draft: RecoveryDraft) -> String {
        let line = draft.source.prefix(120).prefix { !$0.isNewline }.trimmingCharacters(in: .whitespaces)
        let title = line.isEmpty ? "原稿" : line
        return "\(title) · \(draft.id.uuidString.prefix(8))"
    }
}
