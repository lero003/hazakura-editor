import AppKit
import Darwin
@testable import HazakuraNext
import HazakuraNextCore
import Testing

@MainActor
struct WorkspaceTabNavigationTests {
    @Test func cyclesInBothDirectionsWithoutChangingDraftsEvenInZenMode() throws {
        let session = WorkspaceSession(source: "# 原稿")
        let first = try #require(session.tabs.selectedID)
        session.applyCommittedSource("か\u{3099}\r\n🌸", to: first)
        session.newTab()
        let second = try #require(session.tabs.selectedID)
        session.applyCommittedSource("# 二番目\n", to: second)
        session.newTab()
        let third = try #require(session.tabs.selectedID)
        let ids = [first, second, third]
        let drafts = session.tabs.recoveryDrafts
        let revisions = session.tabs.tabs.map(\.document.revision)
        let sources = session.tabs.tabs.map { Data($0.document.source.utf8) }
        session.toggleZenMode()
        try #require(session.isZenMode)

        for id in ids {
            #expect(session.canCycleTabs)
            session.cycleTab(.next)
            #expect(session.tabs.selectedID == id)
        }
        for id in [second, first, third] {
            session.cycleTab(.previous)
            #expect(session.tabs.selectedID == id)
        }
        #expect(session.isZenMode)
        #expect(session.tabs.tabs.map(\.id) == ids)
        #expect(session.tabs.tabs.map(\.document.revision) == revisions)
        #expect(session.tabs.tabs.map { Data($0.document.source.utf8) } == sources)
        #expect(session.tabs.recoveryDrafts == drafts)

        try #require(session.tabs.requestCloseSelected() == .closed)
        session.cycleTab(.next)
        #expect(session.tabs.selectedID == first)
        session.cycleTab(.previous)
        #expect(session.tabs.selectedID == second)
    }

    @Test func zeroOrOneTabCannotCycle() throws {
        let session = WorkspaceSession(source: "原稿")
        let first = try #require(session.tabs.selectedID)
        #expect(!session.canCycleTabs)
        session.cycleTab(.next)
        #expect(session.tabs.selectedID == first)
        try #require(session.tabs.requestCloseSelected() == .closed)
        #expect(!session.canCycleTabs)
        session.cycleTab(.previous)
        #expect(session.tabs.selectedID == nil)
    }

    @Test func modelCompositionAndExclusiveOperationsBlockTabSelectionAndClose() throws {
        let session = WorkspaceSession(source: "一番目")
        let first = try #require(session.tabs.selectedID)
        session.newTab()
        let second = try #require(session.tabs.selectedID)
        try #require(first != second)
        session.tabs.setComposing(true, in: second)
        expectBlocked(session, current: second, target: first)
        #expect(session.tabs.isComposing)
        session.tabs.setComposing(false, in: second)
        session.requestMarkdownPreview()
        let preview = try #require(session.markdownPreview)
        expectBlocked(session, current: second, target: first)
        session.dismissMarkdownPreview(preview.id)
        #expect(session.canCycleTabs)
        session.selectTab(first)
        #expect(session.tabs.selectedID == first)
    }

    @Test func endingASheetRequestMakesTheTabBarAvailableWithoutBypassingNativeGuards() throws {
        let session = WorkspaceSession(source: "一番目")
        let first = try #require(session.tabs.selectedID)
        session.newTab()
        let second = try #require(session.tabs.selectedID)
        let frame = NSRect(x: 0, y: 0, width: 300, height: 200)
        let window = SheetStateWindow(contentRect: frame, styleMask: [.titled], backing: .buffered, defer: true)
        let sheet = NSWindow(contentRect: frame, styleMask: [.titled], backing: .buffered, defer: true)
        window.isReleasedWhenClosed = false
        sheet.isReleasedWhenClosed = false
        defer { window.close(); sheet.close() }
        session.window = window
        let editor = try installTextView(in: window)

        session.requestMarkdownPreview()
        let preview = try #require(session.markdownPreview)
        #expect(!session.canOfferTabBarActions)
        // SwiftUI can update between the model releasing its request and AppKit ending the sheet.
        window.simulatedSheet = sheet
        session.dismissMarkdownPreview(preview.id)
        try #require(!session.isBusy && window.attachedSheet === sheet)
        #expect(session.canOfferTabBarActions)
        expectBlocked(session, current: second, target: first)
        session.newTab()
        session.requestOpen()
        session.requestSaveCopy()
        session.requestMarkdownPreview()
        #expect(session.tabs.tabs.map(\.id) == [first, second])
        #expect(session.openRequest == nil && session.saveCopyRequest == nil && session.markdownPreview == nil)

        window.simulatedSheet = nil
        markText(in: editor)
        try #require(editor.hasMarkedText() && !session.tabs.isComposing)
        #expect(session.canOfferTabBarActions)
        expectBlocked(session, current: second, target: first)
        session.tabs.setComposing(true, in: second)
        #expect(!session.canOfferTabBarActions)
        editor.unmarkText()
        session.tabs.setComposing(false, in: second)
        #expect(session.canOfferTabBarActions)
        #expect(session.tabs.selectedID == second)
        session.selectTab(first)
        #expect(session.tabs.selectedID == first)
        session.requestMarkdownPreview()
        #expect(session.markdownPreview?.documentID == first)
    }

    private final class SheetStateWindow: NSWindow {
        var simulatedSheet: NSWindow?
        override var attachedSheet: NSWindow? { simulatedSheet }
    }

    @Test func nativeMarkedTextBlocksSelectionEvenBeforeModelNotification() throws {
        let session = WorkspaceSession(source: "一番目")
        let first = try #require(session.tabs.selectedID)
        session.newTab()
        let second = try #require(session.tabs.selectedID)
        let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 300, height: 200),
                              styleMask: [.titled], backing: .buffered, defer: true)
        window.isReleasedWhenClosed = false
        defer { window.close() }
        session.window = window
        let view = try installTextView(in: window)
        markText(in: view)
        try #require(view.hasMarkedText())
        try #require(!session.tabs.isComposing)
        expectBlocked(session, current: second, target: first)
        #expect(!session.canAddTab)
        session.newTab()
        #expect(session.tabs.tabs.map(\.id) == [first, second])
        session.requestOpen()
        #expect(session.openRequest == nil)
        #expect(view.hasMarkedText())
        #expect(window.firstResponder === view)
        view.unmarkText()
        #expect(session.canCycleTabs)
        session.cycleTab(.next)
        #expect(session.tabs.selectedID == first)
    }

    @Test func compositionBeforeTheOpenTaskDoesNotPresentAPicker() async throws {
        let delegate = ScratchApplicationDelegate(source: "原稿")
        let window = delegate.prepareWindow()
        defer { window.close() }
        let session = try #require(delegate.session)
        let id = try #require(session.tabs.selectedID)
        let view = try installTextView(in: window)
        session.requestOpen()
        let request = try #require(session.openRequest)
        markText(in: view)
        try #require(view.hasMarkedText() && !session.tabs.isComposing)

        await session.openSelectedFile(request) {
            Issue.record("The picker must not present during composition.")
            return nil
        }
        #expect(session.openRequest == nil)
        #expect(session.tabs.selectedID == id)
        #expect(view.hasMarkedText())
    }

    @Test func compositionWhenTheReadReturnsKeepsTheCurrentDraftUntilAnExplicitRetry() async throws {
        let delegate = ScratchApplicationDelegate(source: "原稿")
        let window = delegate.prepareWindow()
        defer { window.close() }
        let session = try #require(delegate.session)
        let id = try #require(session.tabs.selectedID)
        let view = try installTextView(in: window)
        session.applyCommittedSource("未保存の確定原稿", to: id)
        let drafts = session.tabs.recoveryDrafts
        let path = FileManager.default.temporaryDirectory.withUnsafeFileSystemRepresentation { path in
            path.flatMap { Darwin.realpath($0, nil) }
        }
        let canonical = try #require(path)
        defer { free(canonical) }
        let file = URL(fileURLWithPath: String(cString: canonical), isDirectory: true)
            .appending(path: "hazakura-open-\(UUID()).md")
        try Data("読み取り専用\r\n".utf8).write(to: file, options: .withoutOverwriting)
        defer { try? FileManager.default.removeItem(at: file) }
        session.requestOpen()
        let request = try #require(session.openRequest)

        var inputRanges: [NSRange] = []
        await session.openSelectedFile(request) {
            let snapshot = try await SelectedTextFile.read(from: file)
            markText(in: view)
            try #require(view.hasMarkedText() && !session.tabs.isComposing)
            inputRanges = [view.selectedRange(), view.markedRange()]
            return snapshot
        }
        #expect(session.openRequest == nil)
        #expect(session.tabs.tabs.map(\.id) == [id])
        #expect(session.tabs.selectedID == id)
        #expect(session.tabs.recoveryDrafts == drafts)
        #expect(view.hasMarkedText())
        #expect([view.selectedRange(), view.markedRange()] == inputRanges)
        #expect(window.firstResponder === view)
        #expect(session.fileNotice != nil)

        view.unmarkText()
        session.requestOpen()
        let retry = try #require(session.openRequest)
        await session.openSelectedFile(retry) { try await SelectedTextFile.read(from: file) }
        #expect(session.openRequest == nil)
        #expect(session.tabs.selectedID != id)
        #expect(session.tabs.selectedTab?.isReadOnly == true)
        #expect(session.tabs.selectedTab?.document.source == "読み取り専用\r\n")
        #expect(session.tabs.recoveryDrafts == drafts)
        #expect(session.fileNotice == nil)
    }

    private func installTextView(in window: NSWindow) throws -> NSTextView {
        let view = NSTextView(frame: NSRect(x: 0, y: 0, width: 300, height: 200))
        window.contentView = view
        try #require(window.makeFirstResponder(view))
        return view
    }

    private func markText(in view: NSTextView) {
        view.setMarkedText("候補", selectedRange: NSRange(location: 2, length: 0),
                           replacementRange: NSRange(location: NSNotFound, length: 0))
    }

    @Test func nativeMenuBindsBothCommandsButCannotSwitchAnOffscreenWindow() throws {
        let delegate = ScratchApplicationDelegate(source: "一番目")
        let window = delegate.prepareWindow()
        defer { window.close() }
        let session = try #require(delegate.session)
        session.newTab()
        let selected = try #require(session.tabs.selectedID)
        try #require(session.canCycleTabs)
        let bar = delegate.makeMainMenu()
        let views = try #require(bar.item(withTitle: "表示")?.submenu)
        let shortcuts: [(String, String, NSEvent.ModifierFlags)] = [
            ("前のタブ", "\u{19}", [.control, .shift]), ("次のタブ", "\t", .control),
        ]
        let probe = ShortcutProbe()
        views.autoenablesItems = false
        for (title, character, modifiers) in shortcuts {
            let item = try #require(views.item(withTitle: title))
            let action = try #require(item.action)
            #expect(item.target === delegate)
            #expect(item.keyEquivalent == character)
            #expect(item.keyEquivalentModifierMask == modifiers)
            #expect(!delegate.validateMenuItem(item))
            _ = delegate.perform(action, with: item)
            #expect(session.tabs.selectedID == selected)

            // Test key-equivalent matching separately from the window visibility gate.
            item.target = probe
            item.action = #selector(ShortcutProbe.capture(_:))
            item.isEnabled = true
            let event = try #require(NSEvent.keyEvent(with: .keyDown, location: .zero, modifierFlags: modifiers,
                timestamp: 0, windowNumber: 0, context: nil, characters: character,
                charactersIgnoringModifiers: character, isARepeat: false, keyCode: 48))
            #expect(views.performKeyEquivalent(with: event))
            #expect(probe.lastTitle == title)
        }
    }

    @Test func closingAnUneditedTabLeavesTheWindowAndOtherDraftAlone() throws {
        let delegate = ScratchApplicationDelegate(source: "一番目")
        let window = delegate.prepareWindow()
        defer { window.close() }
        let session = try #require(delegate.session)
        let first = try #require(session.tabs.selectedID)
        session.applyCommittedSource("変更済み原稿", to: first)
        let drafts = session.tabs.recoveryDrafts
        session.newTab()
        try #require(session.tabs.tabs.count == 2)
        session.toggleZenMode()
        #expect(session.canRequestTabClose)
        #expect(session.prepareTabClose() == nil)
        #expect(session.pendingDiscard == nil)
        #expect(session.tabs.tabs.map(\.id) == [first])
        #expect(session.tabs.selectedID == first)
        #expect(session.tabs.recoveryDrafts == drafts)
        #expect(delegate.window === window)
        #expect(session.isZenMode)
    }

    @Test func closeTabMenuIsDistinctFromCloseWindowAndCannotTargetAnOffscreenWindow() throws {
        let delegate = ScratchApplicationDelegate(source: "原稿")
        let window = delegate.prepareWindow()
        defer { window.close() }
        let session = try #require(delegate.session)
        let id = try #require(session.tabs.selectedID)
        let bar = delegate.makeMainMenu()
        let file = try #require(bar.item(withTitle: "ファイル")?.submenu)
        let closeTab = try #require(file.item(withTitle: "選択中のタブを閉じる"))
        let closeWindow = try #require(file.item(withTitle: "ウィンドウを閉じる"))
        #expect(closeWindow.action == #selector(NSWindow.performClose(_:)))
        #expect(closeWindow.keyEquivalent == "w")
        #expect(closeWindow.keyEquivalentModifierMask == .command)
        #expect(closeTab.keyEquivalent.isEmpty)
        #expect(closeTab.target === delegate)
        #expect(!delegate.validateMenuItem(closeTab))
        let action = try #require(closeTab.action)
        _ = delegate.perform(action, with: closeTab)
        #expect(session.tabs.selectedID == id)
        #expect(session.pendingDiscard == nil)
        session.requestTabClose()
        #expect(session.tabs.selectedID == id)
        #expect(session.prepareTabClose() == nil)
        #expect(session.tabs.tabs.isEmpty)
        #expect(!session.canRequestTabClose)
        #expect(delegate.window === window)
    }

    @Test func windowTeardownInvalidatesAnOutstandingTabConfirmation() throws {
        let delegate = ScratchApplicationDelegate(source: "原稿")
        let window = delegate.prepareWindow()
        let session = try #require(delegate.session)
        let id = try #require(session.tabs.selectedID)
        session.applyCommittedSource("変更済み原稿", to: id)
        session.requestTabClose()
        #expect(session.pendingDiscard == nil)
        let request = try #require(session.prepareTabClose())
        #expect(session.isBusy)

        window.close()
        #expect(delegate.session == nil)
        #expect(!session.isBusy)
        #expect(session.resolveTabDiscard(request, discard: true) == nil)
        #expect(session.tabs.selectedTab?.document.source == "変更済み原稿")
    }

    private func expectBlocked(_ session: WorkspaceSession, current: UUID, target: UUID) {
        let ids = session.tabs.tabs.map(\.id)
        #expect(!session.canCycleTabs)
        #expect(!session.canRequestTabClose)
        session.cycleTab(.next)
        session.cycleTab(.previous)
        session.selectTab(target)
        #expect(session.prepareTabClose() == nil)
        #expect(session.tabs.selectedID == current)
        #expect(session.tabs.tabs.map(\.id) == ids)
        #expect(session.pendingDiscard == nil)
    }

    @MainActor
    private final class ShortcutProbe: NSObject {
        private(set) var lastTitle: String?

        @objc func capture(_ item: NSMenuItem) { lastTitle = item.title }
    }
}
