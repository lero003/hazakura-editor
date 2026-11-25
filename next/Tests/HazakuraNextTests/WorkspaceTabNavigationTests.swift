import AppKit
@testable import HazakuraNext
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

    @Test func modelCompositionAndExclusiveOperationsBlockBothSelectionPaths() throws {
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
        let view = NSTextView(frame: NSRect(x: 0, y: 0, width: 300, height: 200))
        window.contentView = view
        try #require(window.makeFirstResponder(view))
        view.setMarkedText("候補", selectedRange: NSRange(location: 2, length: 0),
                           replacementRange: NSRange(location: NSNotFound, length: 0))
        try #require(view.hasMarkedText())
        try #require(!session.tabs.isComposing)
        expectBlocked(session, current: second, target: first)
        #expect(view.hasMarkedText())
        #expect(window.firstResponder === view)
        view.unmarkText()
        #expect(session.canCycleTabs)
        session.cycleTab(.next)
        #expect(session.tabs.selectedID == first)
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

    private func expectBlocked(_ session: WorkspaceSession, current: UUID, target: UUID) {
        #expect(!session.canCycleTabs)
        session.cycleTab(.next)
        session.cycleTab(.previous)
        session.selectTab(target)
        #expect(session.tabs.selectedID == current)
    }

    @MainActor
    private final class ShortcutProbe: NSObject {
        private(set) var lastTitle: String?

        @objc func capture(_ item: NSMenuItem) { lastTitle = item.title }
    }
}
