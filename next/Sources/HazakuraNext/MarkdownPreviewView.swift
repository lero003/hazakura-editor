import HazakuraNextCore
import SwiftUI

struct MarkdownPreviewView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var phase = Phase.loading
    @State private var revealRejected = false

    private let title: String
    private let source: String
    private let readingBlockIndex: Int?
    private let rememberReadingBlock: (Int) -> Void
    private let reveal: (MarkdownPreview.HeadingLocation) -> Bool

    private enum Phase {
        case loading
        case rendered(blocks: [MarkdownPreview.Block], outline: MarkdownPreviewOutline, chapters: MarkdownReaderChapters)
        case unavailable(MarkdownPreview.Limit)
        case cancelled
    }

    init(
        title: String, source: String, readingBlockIndex: Int?,
        rememberReadingBlock: @escaping (Int) -> Void,
        reveal: @escaping (MarkdownPreview.HeadingLocation) -> Bool
    ) {
        self.title = title
        self.source = source
        self.readingBlockIndex = readingBlockIndex
        self.rememberReadingBlock = rememberReadingBlock
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
        case .unavailable(.parseFailed):
            notice("Markdownを読み取れなかったため、プレビューを表示できません。原文は元の画面で確認できます。")
        case .unavailable(.inputTooLarge):
            notice("原稿の大きさが上限を超えたため、プレビューを表示できません。原文は元の画面で確認できます。")
        case .unavailable(.tooManyBlocks):
            notice("表示する項目数が上限を超えたため、プレビューを表示できません。原文は元の画面で確認できます。")
        case .unavailable(.tooComplex):
            notice("文書の構造が複雑すぎるため、プレビューを表示できません。原文は元の画面で確認できます。")
        case .rendered(let blocks, let outline, let chapters):
            if blocks.isEmpty {
                notice("表示する本文がありません。")
            } else {
                MarkdownPreviewReadingPane(
                    blocks: blocks, outline: outline, chapters: chapters, readingBlockIndex: readingBlockIndex,
                    rememberReadingBlock: rememberReadingBlock
                ) { location in
                    if reveal(location) { dismiss() }
                    else { revealRejected = true }
                }
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
            switch try await MarkdownPreview.render(source) {
            case .rendered(let blocks):
                guard !Task.isCancelled else { return }
                let outline = MarkdownPreviewOutline(blocks: blocks)
                outcome = .rendered(blocks: blocks, outline: outline,
                                    chapters: MarkdownReaderChapters(blocks: blocks, outline: outline))
            case .unavailable(let limit):
                outcome = .unavailable(limit)
            }
        } catch is CancellationError {
            outcome = .cancelled
        } catch {
            outcome = .unavailable(.parseFailed)
        }
        // Dismissing the sheet cancels the task; also suppress publication during dismissal.
        guard !Task.isCancelled, case .loading = phase else { return }
        phase = outcome
    }
}

private struct MarkdownPreviewReadingPane: View {
    let blocks: [MarkdownPreview.Block]
    let outline: MarkdownPreviewOutline
    let chapters: MarkdownReaderChapters
    let rememberReadingBlock: (Int) -> Void
    let reveal: (MarkdownPreview.HeadingLocation) -> Void
    @State private var showsOutline = false
    @State private var viewport = Viewport(chapterIndex: nil)
    @State private var readingBlock: Int
    @State private var position: ScrollPosition

    private struct Viewport: Identifiable {
        let id = UUID()
        let chapterIndex: Int?
    }

    init(
        blocks: [MarkdownPreview.Block], outline: MarkdownPreviewOutline, chapters: MarkdownReaderChapters,
        readingBlockIndex: Int?, rememberReadingBlock: @escaping (Int) -> Void,
        reveal: @escaping (MarkdownPreview.HeadingLocation) -> Void
    ) {
        self.blocks = blocks
        self.outline = outline
        self.chapters = chapters
        self.rememberReadingBlock = rememberReadingBlock
        self.reveal = reveal
        if let readingBlockIndex, blocks.indices.contains(readingBlockIndex) {
            _readingBlock = State(initialValue: readingBlockIndex)
            _position = State(initialValue: ScrollPosition(id: readingBlockIndex, anchor: .top))
        } else {
            _readingBlock = State(initialValue: blocks.startIndex)
            _position = State(initialValue: ScrollPosition(idType: Int.self))
        }
    }

    private var selectedChapterIndex: Int? { viewport.chapterIndex }

    private var userPositionedBlock: Int? {
        position.isPositionedByUser ? position.viewID(type: Int.self) : nil
    }

    private func blockRange(for viewport: Viewport) -> Range<Int> {
        viewport.chapterIndex.map { chapters.chapters[$0].range } ?? blocks.indices
    }

    private func showChapterReading(_ enabled: Bool) {
        // The scroll binding may have updated before its onChange callback runs.
        if let latest = userPositionedBlock, latest != readingBlock, blockRange(for: viewport).contains(latest) {
            recordReadingBlock(latest)
        }
        let target = enabled ? chapters.chapterIndex(containing: readingBlock) : nil
        changeViewport(to: target, startingAt: readingBlock)
    }

    private func jump(to blockIndex: Int) {
        guard blocks.indices.contains(blockIndex) else { return }
        let target = selectedChapterIndex == nil ? nil : chapters.chapterIndex(containing: blockIndex)
        changeViewport(to: target, startingAt: blockIndex)
        recordReadingBlock(blockIndex)
    }

    private func changeViewport(to chapterIndex: Int?, startingAt blockIndex: Int) {
        if selectedChapterIndex == chapterIndex {
            position.scrollTo(id: blockIndex, anchor: .top)
        } else {
            // The new viewport is initialized with an ID it can actually display.
            viewport = Viewport(chapterIndex: chapterIndex)
            position = ScrollPosition(id: blockIndex, anchor: .top)
        }
    }

    private func recordReadingBlock(_ blockIndex: Int) {
        readingBlock = blockIndex
        rememberReadingBlock(blockIndex)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 12) {
                if !outline.entries.isEmpty {
                    Button {
                        showsOutline.toggle()
                    } label: {
                        Label(showsOutline ? "目次を隠す" : "目次を表示", systemImage: "list.bullet.indent")
                    }
                }
                Spacer()
                Toggle("章ごとに読む", isOn: Binding(
                    get: { selectedChapterIndex != nil }, set: showChapterReading
                ))
                .help("見出しレベル1・2を区切りに、1章ずつ表示します。")
            }
            if let selectedChapterIndex {
                chapterNavigation(at: selectedChapterIndex)
            }
            HStack(alignment: .top, spacing: 10) {
                if showsOutline {
                    outlineList { entry in jump(to: entry.id) }
                        .frame(width: 195)
                    Divider()
                }
                previewBody(for: viewport)
                    .id(viewport.id)
            }
        }
    }

    private func chapterNavigation(at index: Int) -> some View {
        let chapter = chapters.chapters[index]
        return HStack(spacing: 8) {
            Button("前へ", systemImage: "chevron.left") { jumpToChapter(index - 1) }
                .labelStyle(.iconOnly)
                .accessibilityLabel("前の章へ")
                .disabled(index == chapters.chapters.startIndex)
            HStack(spacing: 8) {
                Text("\(index + 1) / \(chapters.chapters.count) 章").monospacedDigit()
                chapterTitle(chapter)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .accessibilityElement(children: .combine)
            Button("次へ", systemImage: "chevron.right") { jumpToChapter(index + 1) }
                .labelStyle(.iconOnly)
                .accessibilityLabel("次の章へ")
                .disabled(index + 1 == chapters.chapters.endIndex)
        }
    }

    private func chapterTitle(_ chapter: MarkdownReaderChapters.Chapter) -> Text {
        if let heading = chapter.heading {
            return heading.title.isEmpty ? Text("（見出しの本文なし）") : Text(verbatim: heading.title)
        }
        return chapters.chapters.count > 1 ? Text("冒頭") : Text("本文")
    }

    private func jumpToChapter(_ index: Int) {
        guard chapters.chapters.indices.contains(index) else { return }
        jump(to: chapters.chapters[index].range.lowerBound)
    }

    private func outlineList(_ jump: @escaping (MarkdownPreviewOutline.Entry) -> Void) -> some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 5) {
                ForEach(outline.entries.enumerated(), id: \.element.id) { item in
                    let entry = item.element
                    Button {
                        jump(entry)
                    } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            if entry.title.isEmpty { Text("（見出しの本文なし）") }
                            else { Text(verbatim: entry.title) }
                            Group {
                                if let line = entry.sourceLine {
                                    Text("原文 \(line) 行目")
                                } else {
                                    Text("見出し \(item.offset + 1)")
                                }
                            }
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        }
                        .lineLimit(2)
                        .padding(.leading, CGFloat(entry.level - 1) * 7)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .accessibilityLabel(outlineLabel(entry, number: item.offset + 1))
                    .accessibilityHint("プレビュー本文の見出しに移動します。")
                }
            }
            .padding(6)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("目次")
    }

    private func outlineLabel(_ entry: MarkdownPreviewOutline.Entry, number: Int) -> Text {
        let title = entry.title.isEmpty ? Text("見出しの本文なし") : Text(verbatim: entry.title)
        if let line = entry.sourceLine {
            return Text("見出し \(number)、レベル \(entry.level)、\(title)、原文 \(line) 行目")
        }
        return Text("見出し \(number)、レベル \(entry.level)、\(title)")
    }

    private func previewBody(for displayedViewport: Viewport) -> some View {
        let range = blockRange(for: displayedViewport)
        return ScrollView {
            LazyVStack(alignment: .leading, spacing: 12) {
                // Keep global block IDs even when only one chapter is visible.
                ForEach(range, id: \.self) { index in
                    let block = blocks[index]
                    VStack(alignment: .leading, spacing: 6) {
                        MarkdownPreviewBlockView(block: block)
                        if let location = block.headingLocation {
                            Button("原文の\(location.line)行目へ") { reveal(location) }
                                .font(.callout)
                                .accessibilityHint("プレビューを閉じて、この見出しの原文を表示します。")
                        }
                    }
                }
            }
            .scrollTargetLayout()
            .padding(12)
        }
        .scrollPosition(Binding(
            get: { position },
            set: { next in
                // Ignore feedback from a scroll view being replaced during a chapter change.
                if viewport.id == displayedViewport.id { position = next }
            }
        ), anchor: .top)
        .onChange(of: userPositionedBlock) { _, blockIndex in
            guard viewport.id == displayedViewport.id,
                  let blockIndex, blockIndex != readingBlock, range.contains(blockIndex) else { return }
            recordReadingBlock(blockIndex)
        }
        .frame(maxWidth: .infinity)
        .background(.background, in: .rect(cornerRadius: 8))
        .clipShape(.rect(cornerRadius: 8))
        .accessibilityElement(children: .contain)
        .accessibilityLabel("プレビュー本文")
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
