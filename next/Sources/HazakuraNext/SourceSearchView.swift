import HazakuraNextCore
import SwiftUI

struct SourceSearchView: View {
    let session: WorkspaceSession
    let request: WorkspaceSession.SourceNavigationRequest
    @State private var input = ""
    @State private var submission: Submission?
    @State private var report: WorkspaceSession.SourceSearchReport?
    @State private var failed = false
    @FocusState private var isSearchFieldFocused: Bool

    private struct Submission: Identifiable {
        let id = UUID()
        let query: String
    }

    var body: some View {
        let submitted = submission
        VStack(alignment: .leading, spacing: 12) {
            Text("原文を検索").font(.headline)
            Text(verbatim: request.title).lineLimit(1).foregroundStyle(.secondary)
            TextField("検索する文字列", text: Binding(get: { input }, set: { updateQuery($0) }))
                .focused($isSearchFieldFocused)
            Text("選択中の原稿だけを検索します。CR・LFを含まない文字列（最大512バイト）を入力してください。")
                .font(.callout)
                .foregroundStyle(.secondary)
            if let report {
                searchResults(report)
            } else if failed {
                Text("検索を完了できませんでした。")
            } else if submitted != nil {
                ProgressView("検索中…")
            }
            HStack {
                Spacer()
                Button("閉じる") { session.dismissSourceSearch(request.id) }
                    .keyboardShortcut(.cancelAction)
                Button("検索", action: submit).keyboardShortcut(.defaultAction)
                    .disabled(!SourceSearch.canSearch(input) || (submitted != nil && report == nil && !failed))
            }
        }
        .defaultFocus($isSearchFieldFocused, true)
        .padding(20)
        .frame(width: 420)
        .task(id: submitted?.id) {
            guard let submitted, submission?.id == submitted.id else { return }
            let result = await session.searchSource(request.id, query: submitted.query)
            guard !Task.isCancelled, submission?.id == submitted.id else { return }
            report = result
            failed = result == nil
        }
    }

    @ViewBuilder private func searchResults(_ report: WorkspaceSession.SourceSearchReport) -> some View {
        if report.results.matches.isEmpty {
            Text("一致する箇所はありません。")
        } else {
            Text(report.results.hasMore ? "先頭の64件を表示しています。" : "一致：\(report.results.matches.count)件")
            ScrollView {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(Array(report.results.matches.enumerated()), id: \.element.id) { index, match in
                        Button("\(index + 1)件目：\(match.line)行目へ移動") {
                            if !session.selectSourceSearchMatch(request.id, reportID: report.id, matchID: match.id) {
                                resetResults()
                                failed = true
                            }
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .frame(height: 180)
        }
    }

    private func updateQuery(_ text: String) {
        guard !input.utf8.elementsEqual(text.utf8) else { return }
        resetResults()
        input = text
    }

    private func resetResults() {
        session.resetSourceSearch(request.id)
        submission = nil
        report = nil
        failed = false
    }

    private func submit() {
        guard SourceSearch.canSearch(input) else { return }
        resetResults()
        submission = Submission(query: input)
    }
}
