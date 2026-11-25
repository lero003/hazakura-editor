import Foundation
import HazakuraNextCore
import SwiftUI

/// This ticket carries no workspace or editor content. The entire review input is an embedded fixture.
struct AssistReviewSample: Identifiable {
    let id = UUID()

    @MainActor
    static func prepare() async throws -> AssistProposalFlow.Review {
        let prefix = "この行は選択範囲外\n"
        let before = "表記: が \r\n余白:\t残す\n不可視: A\u{200B}B\r末尾\n"
        let after = "表記: か\u{3099}\n余白: 残す\n不可視: AB\r末尾"
        let source = prefix + before + "この行も選択範囲外"
        let tabs = ScratchTabs(source: source)
        let flow = AssistProposalFlow()
        let request = try flow.begin(tabs: tabs, editorSource: source,
                                     selection: NSRange(location: prefix.utf16.count, length: before.utf16.count))
        // Prepare only. Nothing publishes or consumes an approval in this sample.
        return try await request.prepareReview(candidate: after)
    }
}

struct AssistReviewSampleView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var review: AssistProposalFlow.Review?
    @State private var failed = false
    @State private var showScalarCodes = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("提案差分の表示サンプル")
                .font(.headline)
                .accessibilityAddTraits(.isHeader)
            Text("内蔵の合成テキストだけを表示します。編集中の原稿は使わず、AIによる生成や文書への反映は行いません。")
                .foregroundStyle(.secondary)
            if let review {
                reviewBody(review)
            } else if failed {
                ContentUnavailableView("サンプルを表示できません", systemImage: "exclamationmark.triangle")
            } else {
                ProgressView("サンプルの差分を準備中…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            HStack {
                Spacer()
                Button("閉じる") { dismiss() }
                    .keyboardShortcut(.cancelAction)
            }
        }
        .padding(20)
        .frame(minWidth: 520, idealWidth: 640, minHeight: 380, idealHeight: 480)
        .task {
            do {
                let prepared = try await AssistReviewSample.prepare()
                try Task.checkCancellation()
                review = prepared
            } catch is CancellationError {
                // Leaving the sheet cancels preparation, with no session state to commit.
            } catch {
                guard !Task.isCancelled else { return }
                failed = true
            }
        }
    }

    private func reviewBody(_ review: AssistProposalFlow.Review) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("選択範囲だけの差分（変更前 \(review.before.utf8.count) バイト・変更後 \(review.after.utf8.count) バイト）")
                .font(.subheadline.weight(.medium))
            Text("行番号は選択範囲内です。この例では、末尾の改行を削除すると、選択範囲の最後の行が直後の行とつながります。")
                .font(.callout)
            Text(#"半角空白は \s、タブは \t、バックスラッシュは \\ で表示します。見えにくい文字は \u{…} で示します。"#)
                .font(.callout)
            Toggle("本文のUnicodeスカラーをコードで表示", isOn: $showScalarCodes)
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    ForEach(review.rows) { row in
                        AssistReviewSampleRow(row: row, showScalarCodes: showScalarCodes)
                    }
                }
                .padding(.horizontal, 10)
            }
            .background(.background, in: .rect(cornerRadius: 8))
            .accessibilityLabel("選択範囲の行差分")
        }
    }
}

private struct AssistReviewSampleRow: View {
    let row: LineDiff.Row
    let showScalarCodes: Bool

    private var kind: String {
        switch row.kind {
        case .removed: "削除"
        case .added: "追加"
        case .unchanged: "変更なし"
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(verbatim: kind).fontWeight(.semibold)
                if let line = row.beforeLine { Text("変更前 \(line)行目") }
                if let line = row.afterLine { Text("変更後 \(line)行目") }
                Spacer()
                Text("行末：\(AssistReviewPresentation.ending(row.ending))")
            }
            .font(.caption)
            .accessibilityElement(children: .combine)
            if row.text.isEmpty {
                Text("（空行）").foregroundStyle(.secondary)
            } else {
                Text(verbatim: AssistReviewPresentation.literal(row.text))
                    .font(.system(.callout, design: .monospaced))
                    .fixedSize(horizontal: false, vertical: true)
                    .textSelection(.enabled)
                if showScalarCodes {
                    let codes = AssistReviewPresentation.scalarCodes(row.text)
                    Text(verbatim: codes)
                        .font(.system(.caption, design: .monospaced))
                        .fixedSize(horizontal: false, vertical: true)
                        .textSelection(.enabled)
                        .accessibilityLabel("本文のUnicodeコード：\(codes)")
                }
            }
            Divider()
        }
        .padding(.vertical, 6)
    }
}
