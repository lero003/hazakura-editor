import HazakuraNextCore
import SwiftUI

struct OriginalFileComparisonView: View {
    let comparison: OriginalFileComparison
    @Environment(\.dismiss) private var dismiss

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
            ComparisonVersionPreview(baseline: comparison.baseline, disk: comparison.disk, draftSource: comparison.draftSource)
            Divider()
            Button("閉じる") { dismiss() }
                .keyboardShortcut(.cancelAction)
                .frame(maxWidth: .infinity, alignment: .trailing)
        }
        .padding(20)
        .frame(width: 620, height: 500)
    }

    private var summary: some View {
        let baselineBOM = comparison.baseline.format.hasUTF8BOM
        let diskBOM = comparison.disk.format.hasUTF8BOM
        return VStack(alignment: .leading, spacing: 4) {
            Text(diskStatusLabel).fontWeight(.medium)
            if baselineBOM != diskBOM {
                let before = baselineBOM ? "あり" : "なし"
                let selected = diskBOM ? "あり" : "なし"
                Text("UTF-8 BOM が異なります（開いた時点：\(before)、今回選択：\(selected)）。")
            }
            Text("編集版は、開いた時点の BOM 設定で UTF-8 にした場合のバイト列で比較します。")
                .foregroundStyle(.secondary)
            Text("編集版との比較：原文 \(comparison.draftMatchesBaseline ? "一致" : "不一致") ／ ディスク版 \(comparison.draftMatchesDisk ? "一致" : "不一致")")
        }
        .font(.callout)
    }

    private var diskStatusLabel: LocalizedStringKey {
        switch comparison.diskStatus {
        case .unchanged: "今回選択したディスク版は、開いた時点の原本と一致します。"
        case .modified: "今回選択したディスク版は、開いた時点の原本から変わっています。"
        case .differentIdentity: "ファイルの識別情報が一致しません。原本が置き換わったのか、別のファイルを選択したのかは判別できません。"
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
        let bytes = source.utf8
        guard var end = bytes.index(bytes.startIndex, offsetBy: Self.byteLimit, limitedBy: bytes.endIndex),
              end != bytes.endIndex else {
            text = source
            isTruncated = false
            return
        }
        // If the next byte continues a scalar, omit that scalar rather than decoding a partial one.
        while (bytes[end] & 0b1100_0000) == 0b1000_0000 {
            bytes.formIndex(before: &end)
        }
        text = String(decoding: bytes[..<end], as: UTF8.self)
        isTruncated = true
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
