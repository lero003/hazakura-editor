import HazakuraNextCore
import SwiftUI

/// Reads an explicit subset of already-open tabs. Nothing in this sheet requests file access.
struct BookPreviewView: View {
    let session: WorkspaceSession
    let request: WorkspaceSession.BookPreviewRequest
    @State private var selected: Set<UUID> = []
    @State private var phase = Phase.choosing
    @State private var exportRejected = false

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
            if exportRejected {
                Text("原稿の状態が変わったため書き出せません。画面を開き直してください。")
                    .font(.callout)
            }
            HStack {
                if case .ready = phase {
                    Button("選んだ原稿をEPUBに…") {
                        exportRejected = !session.prepareBookEPUB(request.id)
                    }
                    .disabled(session.tabs.isComposing)
                    .accessibilityHint("この画面を閉じます。続けて書き出し先を選んでください。")
                }
                Spacer()
                Button("閉じる") { session.dismissBookPreview(request.id) }
                    .keyboardShortcut(.cancelAction)
            }
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
            BookReadingPane(sections: sections, readerIsCurrent: { session.bookPreviewRequest?.id == request.id })
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
    let readerIsCurrent: () -> Bool
    @State private var viewport = Viewport(sectionIndex: 0)
    @State private var position = ScrollPosition(idType: Int.self)
    @State private var showsSearch = false
    @State private var searchQuery = ""
    @State private var searchRequest: MarkdownReaderSearch.Request?
    @State private var searchResult: MarkdownReaderSearch.BookResult?
    @State private var searchSelection = 0
    @FocusState private var searchFieldFocused: Bool

    private struct Viewport: Identifiable {
        let id = UUID()
        let sectionIndex: Int
    }

    var body: some View {
        let submitted = searchRequest
        let sectionIndex = viewport.sectionIndex
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
                Button {
                    showsSearch.toggle()
                    if !showsSearch {
                        searchFieldFocused = false
                        searchQuery = ""
                        clearSearchResult()
                    }
                } label: {
                    Label(showsSearch ? "検索を閉じる" : "本文を検索", systemImage: "magnifyingglass")
                }
            }
            if showsSearch { searchControls }
            Text(verbatim: section.title)
                .font(.headline)
                .accessibilityAddTraits(.isHeader)
            sectionBody(section, in: viewport)
                .id(viewport.id)
        }
        .task(id: submitted?.id) {
            guard let submitted, submitted.isActive(searchRequest, readerIsCurrent: readerIsCurrent) else { return }
            guard let result = try? await MarkdownReaderSearch.searchBook(submitted.query, in: sections),
                  submitted.isActive(searchRequest, readerIsCurrent: readerIsCurrent) else { return }
            searchResult = result
            if case .matches(let matches) = result, let first = matches.first { jump(to: first) }
        }
    }

    private var searchControls: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 8) {
                TextField("選んだ原稿の本文を検索", text: Binding(get: { searchQuery }, set: { query in
                    guard !searchQuery.utf8.elementsEqual(query.utf8) else { return }
                    searchQuery = query
                    clearSearchResult()
                }))
                .focused($searchFieldFocused)
                .onAppear { searchFieldFocused = true }
                Button("検索", action: submitSearch)
                    .disabled(searchRequest != nil && searchResult == nil)
            }
            switch searchResult {
            case .emptyQuery:
                Text("検索する語句を入力してください。")
            case .queryTooLong:
                Text("検索語句が長すぎます（UTF-8で\(MarkdownReaderSearch.queryByteLimit)バイトまで）。")
            case .matches(let matches) where matches.isEmpty:
                Text("一致する箇所はありません。")
            case .matches(let matches):
                HStack(spacing: 8) {
                    Button("前の一致へ", systemImage: "chevron.up") { moveMatch(by: -1) }
                        .labelStyle(.iconOnly)
                        .disabled(searchSelection == 0)
                    Button("次の一致へ", systemImage: "chevron.down") { moveMatch(by: 1) }
                        .labelStyle(.iconOnly)
                        .disabled(searchSelection + 1 >= matches.count)
                    Text("一致した箇所：\(searchSelection + 1) / \(matches.count)")
                        .monospacedDigit()
                    Button("現在の一致へ移動") {
                        if let activeMatch { jump(to: activeMatch) }
                    }
                }
            case nil:
                if searchRequest != nil { ProgressView("検索中…") }
            }
        }
        .font(.callout)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("選んだ原稿の本文検索")
    }

    private func sectionBody(_ section: MarkdownBookPreview.Section, in displayedViewport: Viewport) -> some View {
        let highlighted = activeMatch.flatMap { $0.sectionID == section.id ? $0.blockIndex : nil }
        return ScrollView {
            LazyVStack(alignment: .leading, spacing: 12) {
                if section.blocks.isEmpty {
                    Text("表示する本文がありません。")
                } else {
                    ForEach(section.blocks.indices, id: \.self) { index in
                        MarkdownPreviewBlockView(block: section.blocks[index])
                            .accessibilityAddTraits(index == highlighted ? [.isSelected] : [])
                            .overlay {
                                if index == highlighted {
                                    RoundedRectangle(cornerRadius: 5)
                                        .strokeBorder(Color.accentColor, lineWidth: 2)
                                        .padding(-4)
                                        .allowsHitTesting(false)
                                        .accessibilityHidden(true)
                                }
                            }
                    }
                }
            }
            .scrollTargetLayout()
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .scrollPosition(Binding(get: { position }, set: { next in
            // The displaced scroll view must not overwrite a position in the new section.
            if viewport.id == displayedViewport.id { position = next }
        }), anchor: .top)
        .accessibilityLabel("原稿の本文")
    }

    private var activeMatch: MarkdownReaderSearch.BookMatch? {
        guard case .matches(let matches) = searchResult, matches.indices.contains(searchSelection) else { return nil }
        return matches[searchSelection]
    }

    private func submitSearch() {
        guard showsSearch else { return }
        clearSearchResult()
        searchRequest = MarkdownReaderSearch.Request(query: searchQuery)
    }

    private func clearSearchResult() {
        searchRequest = nil
        searchResult = nil
        searchSelection = 0
    }

    private func moveMatch(by delta: Int) {
        guard case .matches(let matches) = searchResult else { return }
        let next = searchSelection + delta
        guard matches.indices.contains(next) else { return }
        searchSelection = next
        jump(to: matches[next])
    }

    private func jump(to match: MarkdownReaderSearch.BookMatch) {
        guard let index = sections.firstIndex(where: { $0.id == match.sectionID }),
              sections[index].blocks.indices.contains(match.blockIndex) else { return }
        if viewport.sectionIndex == index {
            position.scrollTo(id: match.blockIndex, anchor: .top)
        } else {
            viewport = Viewport(sectionIndex: index)
            position = ScrollPosition(id: match.blockIndex, anchor: .top)
        }
    }

    private func move(by delta: Int) {
        let next = viewport.sectionIndex + delta
        guard sections.indices.contains(next) else { return }
        viewport = Viewport(sectionIndex: next)
        position = ScrollPosition(idType: Int.self)
    }
}
