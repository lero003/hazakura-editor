import HazakuraNextCore
import SwiftUI

struct LineDiffView: View {
    let result: LineDiff.Result

    var body: some View {
        switch result {
        case .identical:
            emptyState
        case .rows(let rows) where rows.isEmpty:
            emptyState
        case .exceedsBudget:
            notice("比較の上限を超えたため、行の差分を表示できません。")
        case .rows(let rows):
            ScrollView {
                LazyVStack(spacing: 0, pinnedViews: [.sectionHeaders]) {
                    Section {
                        ForEach(rows) { row in
                            DiffRow(row: row)
                        }
                    } header: {
                        columnHeaders
                    }
                }
            }
            .background(.background, in: .rect(cornerRadius: 8))
            .clipShape(.rect(cornerRadius: 8))
        }
    }

    private var emptyState: some View {
        notice("行の差分はありません。")
    }

    private func notice(_ message: LocalizedStringKey) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(message).fontWeight(.medium)
            Text("各版の本文を確認するには「版ごとに読む」に戻ってください。")
                .foregroundStyle(.secondary)
        }
        .font(.callout)
        .padding(12)
    }

    private var columnHeaders: some View {
        HStack(spacing: Columns.spacing) {
            Text("差").frame(width: Columns.marker)
            Text("比較元").frame(width: Columns.lineNumber, alignment: .trailing)
            Text("比較先").frame(width: Columns.lineNumber, alignment: .trailing)
            Text("本文").frame(maxWidth: .infinity, alignment: .leading)
            Text("改行").frame(width: Columns.ending, alignment: .trailing)
        }
        .font(.caption.weight(.medium))
        .foregroundStyle(.secondary)
        .padding(.horizontal, Columns.inset)
        .padding(.vertical, 6)
        .background(.background)
        .overlay(alignment: .bottom) { Divider() }
        .accessibilityHidden(true)
    }

    private enum Columns {
        static let marker: CGFloat = 18
        static let lineNumber: CGFloat = 52
        static let ending: CGFloat = 48
        static let spacing: CGFloat = 8
        static let inset: CGFloat = 10
    }

    private struct DiffRow: View {
        private static let byteLimit = 1_024
        let row: LineDiff.Row

        var body: some View {
            let preview = BoundedTextPreview(source: row.text, byteLimit: Self.byteLimit)
            HStack(alignment: .firstTextBaseline, spacing: Columns.spacing) {
                Text(verbatim: marker)
                    .font(.callout.monospaced().weight(.semibold))
                    .frame(width: Columns.marker)
                    .accessibilityLabel(Text(kindLabel))
                lineNumber(row.beforeLine, label: "比較元")
                lineNumber(row.afterLine, label: "比較先")
                VStack(alignment: .leading, spacing: 2) {
                    if preview.isTruncated {
                        Text(preview.text.isEmpty
                             ? "先頭の文字が表示上限を超えています。"
                             : "先頭のみ表示（最大 \(Self.byteLimit) バイト）")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    if !preview.isTruncated && preview.text.isEmpty {
                        Text("（空行）")
                            .font(.callout)
                            .foregroundStyle(.secondary)
                    } else if !preview.text.isEmpty {
                        Text(verbatim: preview.text)
                            .font(.system(.callout, design: .monospaced))
                            .fixedSize(horizontal: false, vertical: true)
                        if preview.text.unicodeScalars.contains(where: { $0.value == 0xFEFF }) {
                            Text("表示範囲の本文に不可視文字 U+FEFF があります。")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Text(endingLabel)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .frame(width: Columns.ending, alignment: .trailing)
                    .accessibilityLabel(Text("改行：\(Text(endingLabel))"))
            }
            .padding(.horizontal, Columns.inset)
            .padding(.vertical, 4)
            .background(rowBackground)
            .accessibilityElement(children: .combine)
        }

        private func lineNumber(_ number: Int?, label: LocalizedStringKey) -> some View {
            Text(verbatim: number.map { String($0) } ?? "—")
                .font(.caption.monospacedDigit())
                .foregroundStyle(.secondary)
                .frame(width: Columns.lineNumber, alignment: .trailing)
                .accessibilityLabel(number.map { Text("\(Text(label))：\($0) 行目") } ?? Text("\(Text(label))：該当行なし"))
        }

        private var marker: String {
            switch row.kind {
            case .unchanged: "·"
            case .removed: "−"
            case .added: "+"
            }
        }

        private var kindLabel: LocalizedStringKey {
            switch row.kind {
            case .unchanged: "変更なし"
            case .removed: "削除された行"
            case .added: "追加された行"
            }
        }

        private var rowBackground: Color {
            switch row.kind {
            case .unchanged: .clear
            case .removed: .red.opacity(0.10)
            case .added: .green.opacity(0.10)
            }
        }

        private var endingLabel: LocalizedStringKey {
            switch row.ending {
            case .none: "なし"
            case .lf: "LF"
            case .crlf: "CRLF"
            case .cr: "CR"
            }
        }
    }
}

struct BoundedTextPreview {
    let text: String
    let isTruncated: Bool

    init(source: String, byteLimit: Int) {
        let bytes = source.utf8
        guard var end = bytes.index(bytes.startIndex, offsetBy: max(0, byteLimit), limitedBy: bytes.endIndex),
              end != bytes.endIndex else {
            text = source
            isTruncated = false
            return
        }
        // Include the scalar at the cut for at most four bytes of lookahead.
        // If that scalar belongs to the preceding character, drop that character too.
        repeat {
            bytes.formIndex(after: &end)
        } while end != bytes.endIndex && (bytes[end] & 0b1100_0000) == 0b1000_0000
        var prefix = String(decoding: bytes[..<end], as: UTF8.self)
        prefix.removeLast()
        text = prefix
        isTruncated = true
    }
}
