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
