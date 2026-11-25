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
    private let deletionRetryNotice = "本文の変換を確定またはキャンセルしてから、もう一度復旧記録の削除を確認してください。"

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
                        Text(verbatim: DraftRecoveryPresentation.label(for: draft)).lineLimit(1).tag(draft.id)
                    }
                }
                ScrollView {
                    if let draft = selectedDraft {
                        Text(verbatim: DraftRecoveryPresentation.excerpt(for: draft))
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
            } catch WorkspaceSession.RecoveryCandidateDeletionError.uncommittedInput {
                notice = deletionRetryNotice
            } catch {
                await reload()
                notice = "復旧記録を削除できませんでした。記録が変更されたか、保存領域にアクセスできません。"
            }
        }
        .alert("この復旧記録を削除しますか？", isPresented: showsRemoval, presenting: pendingRemoval) { draft in
            Button("削除", role: .destructive) {
                guard session.recoveryDeletionInputIsCommitted else {
                    notice = deletionRetryNotice
                    return
                }
                request = draft
            }
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
}

/// Derives display text only; recovery always receives the original draft.
enum DraftRecoveryPresentation {
    static func excerpt(for draft: RecoveryDraft) -> String {
        draft.source.isEmpty ? "（空の原稿）" : boundedText(draft.source, scalarLimit: 1_200)
    }

    static func label(for draft: RecoveryDraft) -> String {
        let line = boundedText(draft.source, scalarLimit: 120, firstLineOnly: true)
            .trimmingCharacters(in: .whitespaces)
        let title = line.isEmpty ? "原稿" : line
        return "\(title) · \(draft.id.uuidString.prefix(8))"
    }

    private static func boundedText(_ source: String, scalarLimit: Int, firstLineOnly: Bool = false) -> String {
        // One extended grapheme can contain most of a draft. Limit scalars before
        // asking for character boundaries, and inspect only the bounded string.
        let scalars = source.unicodeScalars
        let prefix = scalars.prefix(scalarLimit)
        var text = String(prefix)
        if firstLineOnly, let newline = text.firstIndex(where: \.isNewline) {
            return String(text[..<newline])
        }
        guard prefix.endIndex != scalars.endIndex else { return text }
        if firstLineOnly, Character(scalars[prefix.endIndex]).isNewline { return text }

        // The final character may be incomplete at this cut. Removing it also
        // reserves one scalar for the ellipsis without breaking earlier characters.
        text.removeLast()
        text.append("…")
        return text
    }
}
