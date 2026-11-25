import HazakuraNextCore
import SwiftUI

struct OriginalFileComparisonView: View {
    let session: WorkspaceSession
    let report: WorkspaceSession.ComparisonReport
    private var comparison: OriginalFileComparison { report.comparison }
    @Environment(\.dismiss) private var dismiss
    @State private var mode: Mode = .versions

    private enum Mode: Hashable { case versions, difference }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text("原本との比較")
                    .font(.title2)
                    .accessibilityAddTraits(.isHeader)
                Text("読み取り専用です。この比較では、原本の上書き権限は付与されません。")
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
            summary
            Divider()
            Picker("比較の表示方法", selection: $mode) {
                Text("版ごとに読む").tag(Mode.versions)
                Text("行の差分を見る").tag(Mode.difference)
            }
            .pickerStyle(.segmented)
            .labelsHidden()
            Group {
                switch mode {
                case .versions:
                    ComparisonVersionPreview(baseline: comparison.baseline, disk: comparison.disk, draftSource: comparison.draftSource)
                case .difference:
                    ComparisonLineDiffPane(comparison: comparison)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            Divider()
            HStack {
                if comparison.diskStatus == .modified {
                    Button("比較時のディスク版を別タブで開く") {
                        session.openComparedDisk(report.id)
                    }
                    .disabled(!session.canOpenComparedDisk(report.id))
                    .accessibilityHint("読み取り専用のタブです。編集用コピーは変更しません。")
                }
                Spacer()
                Button("閉じる") { dismiss() }
                    .keyboardShortcut(.cancelAction)
            }
        }
        .padding(20)
        .frame(width: 620, height: 500)
    }

    private var summary: some View {
        let before = comparison.baseline.format.encoding
        let selected = comparison.disk.format.encoding
        return VStack(alignment: .leading, spacing: 4) {
            Text(diskStatusLabel).fontWeight(.medium)
            if before != selected {
                Text("文字コードまたはBOMが異なります（開いた時点：\(encodingLabel(before))、今回選択：\(encodingLabel(selected))）。")
            }
            Text("編集版は、開いた時点の文字コードとBOMで保存した場合のバイト列で比較します。")
                .foregroundStyle(.secondary)
            Text("編集版との比較：原文 \(comparison.draftMatchesBaseline ? "一致" : "不一致") ／ ディスク版 \(comparison.draftMatchesDisk ? "一致" : "不一致")")
        }
        .font(.callout)
    }

    private func encodingLabel(_ encoding: SelectedTextFile.Encoding) -> String {
        switch encoding {
        case .utf8: "UTF-8（BOMなし）"
        case .utf8BOM: "UTF-8（BOM付き）"
        case .utf16LE: "UTF-16 LE（BOM付き）"
        case .utf16BE: "UTF-16 BE（BOM付き）"
        }
    }

    private var diskStatusLabel: LocalizedStringKey {
        switch comparison.diskStatus {
        case .unchanged: "今回選択したディスク版は、開いた時点の原本と一致します。"
        case .modified: "今回選択したディスク版は、開いた時点の原本から変わっています。"
        case .differentIdentity: "ファイルの識別情報が一致しません。原本が置き換わったのか、別のファイルを選択したのかは判別できません。"
        }
    }
}

enum ComparisonLineDiffPair: Hashable, CaseIterable {
    case baselineToDisk, baselineToDraft, diskToDraft

    var title: LocalizedStringKey {
        switch self {
        case .baselineToDisk: "開いた時点 → ディスク版"
        case .baselineToDraft: "開いた時点 → 編集版"
        case .diskToDraft: "ディスク版 → 編集版"
        }
    }

    func sources(in comparison: OriginalFileComparison) -> (before: String, after: String) {
        switch self {
        case .baselineToDisk: (comparison.baseline.source, comparison.disk.source)
        case .baselineToDraft: (comparison.baseline.source, comparison.draftSource)
        case .diskToDraft: (comparison.disk.source, comparison.draftSource)
        }
    }
}

private struct ComparisonLineDiffPane: View {
    let comparison: OriginalFileComparison
    @State private var pair: ComparisonLineDiffPair = .baselineToDraft
    @State private var completed: (pair: ComparisonLineDiffPair, result: LineDiff.Result)?

    var body: some View {
        let requestedPair = pair
        VStack(alignment: .leading, spacing: 8) {
            Picker("差分を取る版", selection: $pair) {
                ForEach(ComparisonLineDiffPair.allCases, id: \.self) { option in
                    Text(option.title).tag(option)
                }
            }
            Text("本文と改行を行ごとに比較します。文字コードとBOMの違いは上の比較結果を参照してください。")
                .font(.caption)
                .foregroundStyle(.secondary)
            if let completed, completed.pair == requestedPair {
                LineDiffView(result: completed.result)
                    .id(requestedPair)
            } else {
                ProgressView("行の差分を計算しています…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .task(id: requestedPair) {
            guard !Task.isCancelled, pair == requestedPair, completed?.pair != requestedPair else { return }
            let sources = requestedPair.sources(in: comparison)
            do {
                let result = try await LineDiff.compare(before: sources.before, after: sources.after)
                guard !Task.isCancelled, pair == requestedPair else { return }
                completed = (requestedPair, result)
            } catch {
                // The core throws only for cancellation; an old selection publishes nothing.
            }
        }
    }
}

private struct ComparisonVersionPreview: View {
    let baseline: SelectedTextFile
    let disk: SelectedTextFile
    let draftSource: String
    @State private var version: Version = .baseline

    var body: some View {
        let file = selectedFile
        VStack(alignment: .leading, spacing: 12) {
            Picker("表示する版", selection: $version) {
                Text("開いた時点の原文").tag(Version.baseline)
                Text("今回選択したディスク版").tag(Version.disk)
                Text("比較時点の編集版").tag(Version.draft)
            }
            .pickerStyle(.segmented)
            .labelsHidden()

            if let file {
                HStack {
                    Text(verbatim: file.name)
                        .lineLimit(1)
                        .truncationMode(.middle)
                        .help(file.name)
                    Spacer()
                    Text("改行：\(Text(Self.lineEndingsLabel(file.format.lineEndings)))")
                }
                .font(.callout)
                .foregroundStyle(.secondary)
            }

            ComparisonSourcePreview(source: file?.source ?? draftSource)
                .id(version)
        }
    }

    private var selectedFile: SelectedTextFile? {
        switch version {
        case .baseline: baseline
        case .disk: disk
        case .draft: nil
        }
    }

    private static func lineEndingsLabel(_ lineEndings: SelectedTextFile.LineEndings) -> LocalizedStringKey {
        switch lineEndings {
        case .none: "なし"
        case .lf: "LF"
        case .crlf: "CRLF"
        case .cr: "CR"
        case .mixed: "混在"
        }
    }

    private enum Version: Hashable {
        case baseline, disk, draft
    }
}

private struct ComparisonSourcePreview: View {
    private static let byteLimit = 16 * 1024
    private let text: String
    private let isTruncated: Bool

    init(source: String) {
        let preview = BoundedTextPreview(source: source, byteLimit: Self.byteLimit)
        text = preview.text
        isTruncated = preview.isTruncated
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if isTruncated {
                Text("本文の先頭のみ表示しています（最大 \(Self.byteLimit / 1024) KiB）。比較結果は表示範囲に限りません。")
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
            ScrollView {
                Group {
                    if text.isEmpty {
                        Text("（本文なし）").foregroundStyle(.secondary)
                    } else {
                        Text(verbatim: text)
                            .font(.system(.body, design: .monospaced))
                            .textSelection(.enabled)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(10)
            }
            .background(.background, in: .rect(cornerRadius: 8))
            .overlay {
                RoundedRectangle(cornerRadius: 8)
                    .strokeBorder(.quaternary)
                    .allowsHitTesting(false)
                    .accessibilityHidden(true)
            }
        }
    }
}
