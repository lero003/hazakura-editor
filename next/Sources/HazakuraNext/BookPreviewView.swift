import HazakuraNextCore
import SwiftUI

/// Reads an explicit subset of already-open tabs. Nothing in this sheet requests file access.
struct BookPreviewView: View {
    let session: WorkspaceSession
    let request: WorkspaceSession.BookPreviewRequest
    @State private var selected: Set<UUID> = []
    @State private var phase = Phase.choosing

    private enum Phase {
        case choosing, selectionChanged
        case loading([MarkdownBookPreview.Source])
        case ready([MarkdownBookPreview.Section])
        case failed(String)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("開いている原稿を続けて読む")
                .font(.title2)
                .accessibilityAddTraits(.isHeader)
            content
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            Divider()
            Button("閉じる") { session.dismissBookPreview(request.id) }
                .keyboardShortcut(.cancelAction)
                .frame(maxWidth: .infinity, alignment: .trailing)
        }
        .padding(20)
        .frame(width: 620, height: 520)
    }

    @ViewBuilder
    private var content: some View {
        switch phase {
        case .choosing, .selectionChanged:
            VStack(alignment: .leading, spacing: 8) {
                Text("2件以上選んでください。選んだ原稿の確定済みの本文をタブ順に読みます。ファイルは再読込みしません。")
                    .font(.callout)
                List(request.choices) { choice in
                    Toggle(isOn: Binding(get: { selected.contains(choice.id) }, set: { included in
                        if included { selected.insert(choice.id) }
                        else { selected.remove(choice.id) }
                    })) {
                        Text("タブ \(choice.number)：\(Text(verbatim: choice.title))")
                    }
                    .toggleStyle(.checkbox)
                }
                if case .selectionChanged = phase {
                    Label("選んだ原稿を確認できませんでした。開いているタブと変換状態を確認してください。", systemImage: "info.circle")
                        .font(.callout)
                }
                Button("選んだ原稿を読む") {
                    switch phase {
                    case .choosing, .selectionChanged: break
                    default: return
                    }
                    guard let sources = session.confirmBookPreview(request.id, selected: selected) else {
                        phase = .selectionChanged
                        return
                    }
                    phase = .loading(sources)
                }
                .disabled(selected.count < 2 || session.tabs.isComposing)
            }
        case .loading(let sources):
            ProgressView("読書用の表示を作成しています…")
                .task(priority: .userInitiated) { await render(sources) }
        case .ready(let sections):
            BookReadingPane(sections: sections)
        case .failed(let reason):
            VStack(alignment: .leading, spacing: 8) {
                Label {
                    Text(verbatim: reason)
                } icon: {
                    Image(systemName: "info.circle")
                }
                Text("選び直すには、この画面を閉じて「表示」メニューから開き直してください。")
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private func render(_ sources: [MarkdownBookPreview.Source]) async {
        guard !Task.isCancelled, session.bookPreviewRequest?.id == request.id else { return }
        let result: Phase
        do {
            result = .ready(try await MarkdownBookPreview.render(sources))
        } catch is CancellationError {
            return
        } catch let failure as MarkdownBookPreview.Failure {
            switch failure {
            case .invalidSelection:
                result = .failed("2件以上の原稿を選び直してください。")
            case .tooLarge:
                result = .failed("選んだ原稿の合計が256 KiBを超えています。対象を減らしてください。")
            case .unavailable(let id, let reason):
                let tabLabel = request.choices.first { $0.id == id }.map { "タブ \($0.number)" } ?? "選んだ原稿"
                let detail = switch reason {
                case .inputTooLarge: "本文が1件あたりの上限（128 KiB）を超えています。"
                case .tooManyBlocks, .tooComplex: "本文の構造が表示の上限を超えています。"
                case .parseFailed: "Markdownを読み取れませんでした。"
                }
                result = .failed("\(tabLabel)を表示できません。\(detail) 元の原稿は変わりません。")
            }
        } catch {
            result = .failed("読書用の表示を作成できませんでした。元の原稿は変わりません。")
        }
        guard !Task.isCancelled, session.bookPreviewRequest?.id == request.id, case .loading = phase else { return }
        phase = result
    }
}

private struct BookReadingPane: View {
    let sections: [MarkdownBookPreview.Section]
    @State private var sectionIndex = 0

    var body: some View {
        let section = sections[sectionIndex]
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Button("前の原稿") { move(by: -1) }
                    .disabled(sectionIndex == 0)
                Text("\(sectionIndex + 1) / \(sections.count)")
                    .monospacedDigit()
                    .accessibilityLabel("\(sections.count)件中\(sectionIndex + 1)件目")
                Button("次の原稿") { move(by: 1) }
                    .disabled(sectionIndex + 1 == sections.count)
                Spacer()
            }
            Text(verbatim: section.title)
                .font(.headline)
                .accessibilityAddTraits(.isHeader)
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 12) {
                    if section.blocks.isEmpty {
                        Text("表示する本文がありません。")
                    } else {
                        ForEach(section.blocks.indices, id: \.self) { index in
                            MarkdownPreviewBlockView(block: section.blocks[index])
                        }
                    }
                }
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .id(section.id)
            .accessibilityLabel("原稿の本文")
        }
    }

    private func move(by delta: Int) {
        let next = sectionIndex + delta
        guard sections.indices.contains(next) else { return }
        sectionIndex = next
    }
}
