import HazakuraNextCore
import SwiftUI

struct MarkdownPreviewView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var phase = Phase.loading
    @State private var revealRejected = false

    private let title: String
    private let source: String
    private let reveal: (MarkdownPreview.HeadingLocation) -> Bool

    private enum Phase {
        case loading
        case finished(MarkdownPreview.Result)
        case cancelled
        case failed
    }

    init(title: String, source: String, reveal: @escaping (MarkdownPreview.HeadingLocation) -> Bool) {
        self.title = title
        self.source = source
        self.reveal = reveal
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            header
            Divider()
            if revealRejected {
                Label("原稿の状態が変わったため移動できません。プレビューを開き直してください。", systemImage: "info.circle")
                    .font(.callout)
            }
            content
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            Divider()
            Button("閉じる") {
                if case .loading = phase { phase = .cancelled }
                dismiss()
            }
            .keyboardShortcut(.cancelAction)
            .accessibilityLabel("Markdownプレビューを閉じる")
            .frame(maxWidth: .infinity, alignment: .trailing)
        }
        .padding(20)
        .frame(width: 620, height: 500)
        // A fresh sheet owns one immutable snapshot and its render task.
        .task(priority: .userInitiated) { await render() }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text("Markdownプレビュー")
                .font(.title2)
                .accessibilityAddTraits(.isHeader)
            Text("対象：\(Text(verbatim: title))")
                .font(.callout.weight(.medium))
                .lineLimit(1)
                .truncationMode(.middle)
            Text("開いた時点の確定済みの原稿を読み取り専用で表示します。見出し、強調、引用、リスト、コードなどに対応しています。")
            Text("リンクは文字として表示し、開きません。画像や参照先のファイルは読み込まず、HTMLは実行しません。未対応の箇所は注記または文字で表示します。")
        }
        .font(.callout)
    }

    @ViewBuilder
    private var content: some View {
        switch phase {
        case .loading:
            VStack(alignment: .leading, spacing: 6) {
                ProgressView("プレビューを作成しています…")
                Text("「閉じる」または Esc キーで中止できます。")
                    .foregroundStyle(.secondary)
            }
            .padding(12)
        case .cancelled:
            notice("プレビューの作成を中止しました。")
        case .failed, .finished(.unavailable(.parseFailed)):
            notice("Markdownを読み取れなかったため、プレビューを表示できません。原文は元の画面で確認できます。")
        case .finished(.unavailable(.inputTooLarge)):
            notice("原稿の大きさが上限を超えたため、プレビューを表示できません。原文は元の画面で確認できます。")
        case .finished(.unavailable(.tooManyBlocks)):
            notice("表示する項目数が上限を超えたため、プレビューを表示できません。原文は元の画面で確認できます。")
        case .finished(.unavailable(.tooComplex)):
            notice("文書の構造が複雑すぎるため、プレビューを表示できません。原文は元の画面で確認できます。")
        case .finished(.rendered(let blocks)):
            if blocks.isEmpty {
                notice("表示する本文がありません。")
            } else {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 12) {
                        // Positions are stable within this immutable render result, including repeated blocks.
                        ForEach(blocks.enumerated(), id: \.offset) { entry in
                            VStack(alignment: .leading, spacing: 6) {
                                MarkdownPreviewBlockView(block: entry.element)
                                if let location = entry.element.headingLocation {
                                    Button("原文の\(location.line)行目へ") {
                                        if reveal(location) { dismiss() }
                                        else { revealRejected = true }
                                    }
                                    .font(.callout)
                                    .accessibilityHint("プレビューを閉じて、この見出しの原文を表示します。")
                                }
                            }
                        }
                    }
                    .padding(12)
                }
                .background(.background, in: .rect(cornerRadius: 8))
                .clipShape(.rect(cornerRadius: 8))
                .accessibilityElement(children: .contain)
                .accessibilityLabel("プレビュー本文")
            }
        }
    }

    private func notice(_ message: LocalizedStringKey) -> some View {
        Text(message)
            .font(.callout)
            .padding(12)
    }

    private func render() async {
        guard !Task.isCancelled, case .loading = phase else { return }
        let outcome: Phase
        do {
            outcome = .finished(try await MarkdownPreview.render(source))
        } catch is CancellationError {
            outcome = .cancelled
        } catch {
            outcome = .failed
        }
        // Dismissing the sheet cancels the task; also suppress publication during dismissal.
        guard !Task.isCancelled, case .loading = phase else { return }
        phase = outcome
    }
}

private struct MarkdownPreviewBlockView: View {
    let block: MarkdownPreview.Block

    var body: some View {
        if case .heading(let level) = block.kind {
            row
                .accessibilityHeading(accessibilityLevel(for: level))
                .accessibilityAddTraits(.isHeader)
        } else {
            row
        }
    }

    private var row: some View {
        let markers = containerMarkers
        return VStack(alignment: .leading, spacing: 4) {
            // Keep room for the body even for heavily nested items.
            if markers.count > 3 { markerText(markers) }
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                if !markers.isEmpty && markers.count <= 3 { markerText(markers) }
                content
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(.leading, CGFloat(min(block.containers.count, 4)) * 12)
        .accessibilityElement(children: .combine)
    }

    private typealias ContainerMarker = (symbol: String, label: String)

    private var containerMarkers: [ContainerMarker] {
        // Keep the model's outside-to-inside order and each newly opened list marker.
        block.containers.compactMap { container in
            switch container {
            case .quote:
                ("│", String(localized: "引用"))
            case .listItem(let marker?):
                (marker, marker == "•" ? String(localized: "箇条書きの項目") : String(localized: "リスト項目：\(marker)"))
            case .listItem(nil):
                nil
            }
        }
    }

    private func markerText(_ markers: [ContainerMarker]) -> some View {
        Text(verbatim: markers.map(\.symbol).joined(separator: " "))
            .monospacedDigit()
            .foregroundStyle(.secondary)
            .accessibilityLabel(Text(verbatim: markers.map(\.label).joined(separator: "、")))
    }

    @ViewBuilder
    private var content: some View {
        switch block.kind {
        case .heading, .paragraph:
            Text(styledText)
                .fixedSize(horizontal: false, vertical: true)
        case .codeBlock:
            let text = plainText
            Text(verbatim: text)
                .font(.body.monospaced())
                .fixedSize(horizontal: false, vertical: true)
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(.quaternary.opacity(0.4), in: .rect(cornerRadius: 6))
                .accessibilityLabel(Text("コードブロック：\(Text(verbatim: text))"))
        case .thematicBreak:
            Divider()
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("区切り線")
        case .unsupported(let kind):
            VStack(alignment: .leading, spacing: 4) {
                Text(unsupportedLabel(kind))
                    .font(.callout.weight(.medium))
                if !block.runs.isEmpty {
                    Text(verbatim: plainText)
                        .font(.callout.monospaced())
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding(10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.quaternary.opacity(0.4), in: .rect(cornerRadius: 6))
        }
    }

    private var plainText: String { block.runs.map(\.text).joined() }

    private func accessibilityLevel(for level: Int) -> AccessibilityHeadingLevel {
        switch level {
        case 1: .h1
        case 2: .h2
        case 3: .h3
        case 4: .h4
        case 5: .h5
        default: .h6
        }
    }

    private var baseFont: Font {
        switch block.kind {
        case .heading(1): .largeTitle.weight(.semibold)
        case .heading(2): .title.weight(.semibold)
        case .heading(3): .title2.weight(.semibold)
        case .heading(4): .title3.weight(.semibold)
        case .heading: .headline
        default: .body
        }
    }

    private var styledText: AttributedString {
        let baseFont = baseFont
        return block.runs.reduce(into: AttributedString()) { text, run in
            // Build from plain strings and allowlisted styles only, never parser attributes.
            var fragment = AttributedString(run.text)
            var font = baseFont
            if run.code { font = font.monospaced() }
            if run.strong { font = font.bold() }
            if run.emphasis { font = font.italic() }
            fragment.swiftUI.font = font
            if run.strikethrough { fragment.swiftUI.strikethroughStyle = .single }
            text.append(fragment)
        }
    }

    private func unsupportedLabel(_ kind: MarkdownPreview.Unsupported) -> LocalizedStringKey {
        switch kind {
        case .table: "表の整形には対応していません。"
        case .html: "HTMLの表示には対応していません。"
        case .other: "このMarkdown記法には対応していません。"
        }
    }
}
