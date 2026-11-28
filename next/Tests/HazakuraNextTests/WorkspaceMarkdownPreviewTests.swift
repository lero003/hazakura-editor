import AppKit
import Darwin
@testable import HazakuraNext
import HazakuraNextCore
import Testing

@MainActor
struct WorkspaceMarkdownPreviewTests {
    @Test func previewCapturesOnlyTheSelectedCommittedSourceAndDoesNotModifyIt() throws {
        let session = WorkspaceSession(source: "# サンプル")
        session.newTab()
        let id = try #require(session.tabs.selectedID)
        let committed = "# 原稿\r\nか\u{3099} **確定済み**"
        session.applyCommittedSource(committed, to: id)
        let before = session.tabs.recoveryDrafts

        session.requestMarkdownPreview()
        let preview = try #require(session.markdownPreview)
        #expect(preview.title == "原稿 2")
        #expect(preview.source.utf8.elementsEqual(committed.utf8))
        #expect(session.isBusy)
        #expect(!session.canEditSource)
        session.requestSaveCopy()
        session.requestOpen()
        session.newTab()
        session.requestMarkdownPreview()
        #expect(session.saveCopyRequest == nil)
        #expect(session.openRequest == nil)
        #expect(session.tabs.tabs.count == 2)
        #expect(session.tabs.selectedID == id)
        #expect(session.tabs.recoveryDrafts == before)
        #expect(session.markdownPreview?.id == preview.id)

        session.dismissMarkdownPreview(preview.id)
        #expect(session.markdownPreview == nil)
        #expect(!session.isBusy)
        #expect(session.canEditSource)
        #expect(session.tabs.recoveryDrafts == before)
    }

    @Test func previewWaitsForCompositionAndAStaleDismissDoesNotCloseAReopenedPreview() throws {
        let session = WorkspaceSession(source: "初稿")
        let id = try #require(session.tabs.selectedID)
        session.tabs.setComposing(true, in: id)
        session.requestMarkdownPreview()
        #expect(session.markdownPreview == nil)
        session.tabs.setComposing(false, in: id)
        session.requestMarkdownPreview()
        let first = try #require(session.markdownPreview)
        // A late commit from AppKit must be preserved, not used to rewrite the open sheet.
        session.applyCommittedSource("新稿", to: id)
        #expect(session.markdownPreview?.source == "初稿")
        session.dismissMarkdownPreview(first.id)
        session.requestMarkdownPreview()
        let second = try #require(session.markdownPreview)
        session.dismissMarkdownPreview(first.id)
        #expect(session.markdownPreview?.id == second.id)
        #expect(second.source == "新稿")
        #expect(session.tabs.selectedTab?.document.source == "新稿")
    }

    @Test(arguments: [false, true])
    func nativeCompositionBlocksOpeningAReadingSheet(isBook: Bool) throws {
        let session = WorkspaceSession(source: "# 初稿")
        session.newTab()
        let id = try #require(session.tabs.selectedID)
        session.applyCommittedSource("確定済みの原稿", to: id)
        let drafts = session.tabs.recoveryDrafts
        let (window, editor) = try attachNativeEditor(to: session)
        defer { window.close() }
        markText(in: editor)
        try #require(editor.hasMarkedText() && !session.tabs.isComposing)
        let ranges = [editor.selectedRange(), editor.markedRange()]
        if isBook {
            #expect(!session.canPreviewBook)
            session.requestBookPreview()
            #expect(session.bookPreviewRequest == nil)
        } else {
            #expect(!session.canPreviewMarkdown)
            session.requestMarkdownPreview()
            #expect(session.markdownPreview == nil)
        }
        #expect(!session.isBusy)
        #expect(session.tabs.selectedID == id)
        #expect(session.tabs.recoveryDrafts == drafts)
        #expect(window.firstResponder === editor)
        #expect([editor.selectedRange(), editor.markedRange()] == ranges)
    }

    @Test func nativeCompositionDoesNotQueueAHeadingReveal() throws {
        let source = "# 見出し\r\n"
        let session = WorkspaceSession(source: source)
        let (window, editor) = try attachNativeEditor(to: session)
        defer { window.close() }
        session.requestMarkdownPreview()
        let preview = try #require(session.markdownPreview)
        markText(in: editor)
        try #require(editor.hasMarkedText() && !session.tabs.isComposing)
        #expect(!session.requestMarkdownReveal(preview.id, offset: 0))
        #expect(session.markdownPreview?.id == preview.id)
        #expect(editor.hasMarkedText())

        editor.unmarkText()
        try #require(session.requestMarkdownReveal(preview.id, offset: 0))
        session.dismissMarkdownPreview(preview.id)
        #expect(session.takeSourceReveal(preview.id, documentID: preview.documentID, editorSource: source) == NSRange(location: 0, length: 0))
        #expect(session.tabs.selectedTab?.document.source == source)
        #expect(session.tabs.recoveryDrafts.isEmpty)
    }

    @Test func nativeCompositionDoesNotConsumeBookConfirmation() throws {
        let session = WorkspaceSession(source: "# 最初")
        let first = try #require(session.tabs.selectedID)
        session.newTab()
        let second = try #require(session.tabs.selectedID)
        let source = "# 確定済み か\u{3099}\r\n"
        session.applyCommittedSource(source, to: second)
        let drafts = session.tabs.recoveryDrafts
        let (window, editor) = try attachNativeEditor(to: session)
        defer { window.close() }
        session.requestBookPreview()
        let request = try #require(session.bookPreviewRequest)
        markText(in: editor)
        try #require(editor.hasMarkedText() && !session.tabs.isComposing)
        #expect(session.confirmBookPreview(request.id, selected: [second, first]) == nil)
        #expect(session.bookPreviewRequest?.id == request.id)
        #expect(session.tabs.selectedID == second)
        #expect(session.tabs.recoveryDrafts == drafts)
        #expect(editor.hasMarkedText())

        editor.unmarkText()
        let sources = try #require(session.confirmBookPreview(request.id, selected: [second, first]))
        #expect(sources.map(\.id) == [first, second])
        #expect(sources[1].text.utf8.elementsEqual(source.utf8))
    }

    private func attachNativeEditor(to session: WorkspaceSession) throws -> (NSWindow, NSTextView) {
        _ = NSApplication.shared
        let frame = NSRect(x: 0, y: 0, width: 300, height: 200)
        let window = NSWindow(contentRect: frame, styleMask: [.titled], backing: .buffered, defer: true)
        window.isReleasedWhenClosed = false
        let editor = NSTextView(frame: frame)
        window.contentView = editor
        try #require(window.makeFirstResponder(editor))
        session.window = window
        return (window, editor)
    }

    private func markText(in editor: NSTextView) {
        editor.setMarkedText("候補", selectedRange: NSRange(location: 2, length: 0),
                             replacementRange: NSRange(location: NSNotFound, length: 0))
    }

    @Test func previewOfAReadOnlyFileUsesItsCapturedTextAfterDiskChanges() async throws {
        let root = FileManager.default.temporaryDirectory.withUnsafeFileSystemRepresentation { path in
            path.flatMap { Darwin.realpath($0, nil) }
        }
        let canonical = try #require(root)
        defer { free(canonical) }
        let folder = URL(fileURLWithPath: String(cString: canonical), isDirectory: true)
            .appending(path: "hazakura-preview-\(UUID())", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: false)
        defer { try? FileManager.default.removeItem(at: folder) }
        let url = folder.appending(path: "原稿.md")
        let source = "# 開いた時点\r\n\r\n本文"
        try Data(("\u{FEFF}" + source).utf8).write(to: url)
        let snapshot = try await SelectedTextFile.read(from: url)
        let changed = Data("# ディスクで変更".utf8)
        try changed.write(to: url)

        let session = WorkspaceSession(source: "初稿")
        let opened = session.tabs.openReadOnly(snapshot)
        let id = try #require(opened)
        session.requestMarkdownPreview()
        let preview = try #require(session.markdownPreview)
        #expect(preview.title == "原稿.md")
        #expect(preview.source.utf8.elementsEqual(source.utf8))
        let output = try await MarkdownPreview.render(preview.source)
        guard case .rendered(let blocks) = output else {
            Issue.record("The selected committed source should render.")
            return
        }
        #expect(blocks.map(\.kind) == [.heading(level: 1), .paragraph])
        #expect(blocks.flatMap(\.runs).map(\.text) == ["開いた時点", "本文"])
        #expect(session.tabs.selectedID == id)
        #expect(session.tabs.selectedTab?.isReadOnly == true)
        #expect(session.tabs.recoveryDrafts.isEmpty)
        let onDisk = try Data(contentsOf: url)
        #expect(onDisk == changed)
    }

    @Test func previewCannotInterruptAnotherModalActionOrOpenWithNoTab() {
        let session = WorkspaceSession(source: "原稿")
        session.requestSaveCopy()
        session.requestMarkdownPreview()
        #expect(session.markdownPreview == nil)
        if let id = session.saveCopyRequest?.id { session.cancelSaveCopy(id) }
        let closed = session.tabs.requestCloseSelected()
        #expect(closed == .closed)
        session.requestMarkdownPreview()
        #expect(session.markdownPreview == nil)
    }

    @Test func headingRevealIsConsumedOnceAfterDismissalByTheSameUnchangedEditor() async throws {
        let source = "導入 🌸\r\n\r\n# 見出し\r\n"
        let session = WorkspaceSession(source: source)
        let id = try #require(session.tabs.selectedID)
        session.requestMarkdownPreview()
        let preview = try #require(session.markdownPreview)
        guard case .rendered(let blocks) = try await MarkdownPreview.render(preview.source) else {
            Issue.record("Expected a rendered heading.")
            return
        }
        let location = try #require(blocks.last?.headingLocation)
        let expectedOffset = "導入 🌸\r\n\r\n".utf16.count
        #expect(location.utf16Offset == expectedOffset)
        #expect(session.requestMarkdownReveal(preview.id, offset: location.utf16Offset))
        #expect(!session.requestMarkdownReveal(preview.id, offset: 0))
        #expect(session.readySourceRevealID == nil)
        #expect(session.takeSourceReveal(preview.id, documentID: id, editorSource: source) == nil)
        session.dismissMarkdownPreview(preview.id)
        #expect(session.readySourceRevealID == preview.id)
        #expect(session.takeSourceReveal(preview.id, documentID: UUID(), editorSource: source) == nil)
        #expect(session.readySourceRevealID == preview.id)
        #expect(session.takeSourceReveal(preview.id, documentID: id, editorSource: source) == NSRange(location: expectedOffset, length: 0))
        #expect(session.takeSourceReveal(preview.id, documentID: id, editorSource: source) == nil)
        #expect(session.tabs.selectedTab?.document.revision == 0)
        #expect(session.tabs.recoveryDrafts.isEmpty)
    }

    @Test func aPositionInsideACharacterDoesNotReserveAHeadingReveal() async throws {
        let prefix = "🌸か\u{3099}\r\n\r\n"
        let source = prefix + "# 見出し"
        let session = WorkspaceSession(source: source)
        let id = try #require(session.tabs.selectedID)
        session.requestMarkdownPreview()
        let preview = try #require(session.markdownPreview)
        let drafts = session.tabs.recoveryDrafts

        // Bisect the surrogate pair, the combining character, and the first CRLF respectively.
        for offset in [1, 3, 5] {
            #expect(!session.requestMarkdownReveal(preview.id, offset: offset), "UTF-16 offset: \(offset)")
            #expect(session.markdownPreview?.id == preview.id)
        }
        guard case .rendered(let blocks) = try await MarkdownPreview.render(preview.source) else {
            Issue.record("Expected a rendered heading.")
            return
        }
        let location = try #require(blocks.last?.headingLocation)
        try #require(session.requestMarkdownReveal(preview.id, offset: location.utf16Offset))
        session.dismissMarkdownPreview(preview.id)
        #expect(session.takeSourceReveal(preview.id, documentID: id, editorSource: source) == NSRange(location: prefix.utf16.count, length: 0))
        #expect(session.tabs.recoveryDrafts == drafts)
        #expect(session.tabs.selectedTab?.document.revision == preview.revision)
    }

    @Test func revealRejectsStalePreviewAndChangedRevisionEvenAfterReturningToTheSameText() throws {
        let source = "# 初稿"
        let session = WorkspaceSession(source: source)
        let id = try #require(session.tabs.selectedID)
        session.requestMarkdownPreview()
        let first = try #require(session.markdownPreview)
        session.dismissMarkdownPreview(first.id)
        session.requestMarkdownPreview()
        let active = try #require(session.markdownPreview)
        #expect(!session.requestMarkdownReveal(first.id, offset: 0))
        #expect(!session.requestMarkdownReveal(active.id, offset: -1))
        #expect(!session.requestMarkdownReveal(active.id, offset: source.utf16.count))
        #expect(session.requestMarkdownReveal(active.id, offset: 0))
        session.applyCommittedSource("# 新稿", to: id)
        session.applyCommittedSource(source, to: id)
        session.dismissMarkdownPreview(active.id)
        #expect(session.takeSourceReveal(active.id, documentID: id, editorSource: source) == nil)
        #expect(session.readySourceRevealID == nil)
        #expect(session.tabs.selectedTab?.document.revision == 2)
    }

    @Test func anEditorWithCanonicallyEquivalentButDifferentBytesCannotApplyTheOffset() throws {
        let source = "か\u{3099}\n\n# 見出し"
        let other = "が\n\n# 見出し"
        #expect(source == other)
        let session = WorkspaceSession(source: source)
        let id = try #require(session.tabs.selectedID)
        session.requestMarkdownPreview()
        let preview = try #require(session.markdownPreview)
        #expect(session.requestMarkdownReveal(preview.id, offset: "か\u{3099}\n\n".utf16.count))
        session.dismissMarkdownPreview(preview.id)
        #expect(session.takeSourceReveal(preview.id, documentID: id, editorSource: other) == nil)
        #expect(session.readySourceRevealID == nil)
    }

    @Test func changingTabsOrStartingCompositionDropsThePendingReveal() throws {
        let session = WorkspaceSession(source: "# 初稿")
        let id = try #require(session.tabs.selectedID)
        session.newTab()
        let other = try #require(session.tabs.selectedID)
        session.tabs.select(id)
        session.requestMarkdownPreview()
        let preview = try #require(session.markdownPreview)
        #expect(session.requestMarkdownReveal(preview.id, offset: 0))
        session.dismissMarkdownPreview(preview.id)
        session.tabs.select(other)
        session.tabs.select(id)
        #expect(session.readySourceRevealID == nil)
        session.requestMarkdownPreview()
        let next = try #require(session.markdownPreview)
        #expect(session.requestMarkdownReveal(next.id, offset: 0))
        session.dismissMarkdownPreview(next.id)
        session.tabs.setComposing(true, in: id)
        session.tabs.setComposing(false, in: id)
        #expect(session.readySourceRevealID == nil)
    }

    @Test func openingAndClosingAnotherTabInvalidatesThePendingRevealEvenWhenTheSelectionReturns() throws {
        let source = "# 初稿"
        let session = WorkspaceSession(source: source)
        let id = try #require(session.tabs.selectedID)
        session.requestMarkdownPreview()
        let preview = try #require(session.markdownPreview)
        #expect(session.requestMarkdownReveal(preview.id, offset: 0))
        session.dismissMarkdownPreview(preview.id)
        session.newTab()
        let closed = session.tabs.requestCloseSelected()
        #expect(closed == .closed)
        #expect(session.tabs.selectedID == id)
        #expect(session.takeSourceReveal(preview.id, documentID: id, editorSource: source) == nil)
    }

    @Test func previewReservesTheWindowUntilDismissed() throws {
        let delegate = ScratchApplicationDelegate(source: "原稿")
        let window = delegate.prepareWindow()
        defer { window.close() }
        let session = try #require(delegate.session)
        session.requestMarkdownPreview()
        let preview = try #require(session.markdownPreview)
        #expect(!delegate.windowShouldClose(window))
        #expect(delegate.applicationShouldTerminate(.shared) == .terminateCancel)
        session.dismissMarkdownPreview(preview.id)
        #expect(delegate.windowShouldClose(window))
        #expect(delegate.applicationShouldTerminate(.shared) == .terminateNow)
    }
}
