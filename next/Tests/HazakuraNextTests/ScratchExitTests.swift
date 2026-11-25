import AppKit
@testable import HazakuraNext
import HazakuraNextCore
import Testing

@MainActor
struct ScratchExitTests {
    @Test func cleanWindowAndQuitDoNotAskForDiscard() {
        let probe = ExitProbe()
        let delegate = probe.makeDelegate()
        let window = delegate.prepareWindow()
        #expect(delegate.windowShouldClose(window))
        #expect(delegate.applicationShouldTerminate(NSApplication.shared) == .terminateNow)
        #expect(probe.prompts.isEmpty)
        window.close()
        #expect(delegate.session == nil)
    }

    @Test func windowCloseKeepsEditedSessionUntilExplicitDiscard() throws {
        let probe = ExitProbe()
        let delegate = probe.makeDelegate()
        let window = delegate.prepareWindow()
        let session = try #require(delegate.session)
        let id = try #require(session.tabs.selectedID)
        session.tabs.applyCommittedSource("編集済み", to: id)

        window.performClose(nil)
        #expect(probe.prompts.map(\.ticket.destination) == [.window])
        #expect(delegate.applicationShouldTerminate(NSApplication.shared) == .terminateCancel)
        let first = try #require(probe.prompts.first)
        first.finish(false)
        #expect(delegate.session === session)
        #expect(session.tabs.selectedTab?.document.source == "編集済み")

        #expect(delegate.windowShouldClose(window) == false)
        let second = try #require(probe.prompts.last)
        first.finish(true) // Stale callback must not consent to the second attempt.
        #expect(delegate.session === session)
        second.finish(true)
        #expect(delegate.session == nil)
        #expect(probe.replies.isEmpty)
    }

    @Test func quitReplyRejectsChangedDraftAndIgnoresDuplicateCompletion() throws {
        let probe = ExitProbe()
        let delegate = probe.makeDelegate()
        let window = delegate.prepareWindow()
        defer { window.close() }
        let session = try #require(delegate.session)
        let id = try #require(session.tabs.selectedID)
        session.tabs.applyCommittedSource("編集済み", to: id)
        #expect(delegate.applicationShouldTerminate(NSApplication.shared) == .terminateLater)
        #expect(delegate.applicationShouldTerminate(NSApplication.shared) == .terminateLater)
        #expect(delegate.windowShouldClose(window) == false)
        #expect(probe.prompts.map(\.ticket.destination) == [.application])
        let stale = try #require(probe.prompts.first)
        session.tabs.applyCommittedSource("新しい変更", to: id)
        stale.finish(true)
        stale.finish(false)
        #expect(probe.replies == [false])
        #expect(session.tabs.selectedTab?.document.source == "新しい変更")

        #expect(delegate.applicationShouldTerminate(NSApplication.shared) == .terminateLater)
        let fresh = try #require(probe.prompts.last)
        fresh.finish(true)
        fresh.finish(true)
        #expect(probe.replies == [false, true])
    }

    @Test func windowMenuActionsDoNotOperateOnAnOffscreenSession() throws {
        let probe = ExitProbe()
        let delegate = probe.makeDelegate()
        let window = delegate.prepareWindow()
        defer { window.close() }
        let session = try #require(delegate.session)
        #expect(window.isVisible == false)
        for selector in ["newTab:", "openFile:", "exportHTML:", "exportPDF:", "exportEPUB:", "toggleLMode:", "toggleZenMode:"] {
            let action = NSSelectorFromString(selector)
            try #require(delegate.responds(to: action))
            let item = NSMenuItem(title: "Command", action: action, keyEquivalent: "")
            #expect(delegate.validateMenuItem(item) == false)
            _ = delegate.perform(action, with: nil)
        }
        #expect(session.tabs.tabs.count == 1)
        #expect(session.openRequest == nil)
        #expect(session.exportRequest == nil)
        #expect(session.isLMode == false)

        session.toggleLMode()
        let toggle = NSSelectorFromString("toggleLMode:")
        let item = NSMenuItem(title: "えるモード", action: toggle, keyEquivalent: "")
        #expect(delegate.validateMenuItem(item) == false)
        #expect(item.state == .on)
        _ = delegate.perform(toggle, with: nil)
        #expect(session.isLMode)
        #expect(session.isZenMode == false)

        session.toggleZenMode()
        let zenToggle = NSSelectorFromString("toggleZenMode:")
        let zenItem = NSMenuItem(title: "集中表示", action: zenToggle, keyEquivalent: "")
        #expect(delegate.validateMenuItem(zenItem) == false)
        #expect(zenItem.state == .on)
        _ = delegate.perform(zenToggle, with: nil)
        #expect(session.isZenMode)
    }

    @Test func pendingPDFExportBlocksNativeWindowAndQuitWithoutDiscarding() throws {
        let probe = ExitProbe()
        let delegate = probe.makeDelegate()
        let window = delegate.prepareWindow()
        defer { window.close() }
        let session = try #require(delegate.session)
        session.requestExport(.pdf)
        let request = try #require(session.exportRequest)

        #expect(delegate.windowShouldClose(window) == false)
        #expect(delegate.applicationShouldTerminate(NSApplication.shared) == .terminateCancel)
        #expect(probe.prompts.isEmpty)
        #expect(probe.replies.isEmpty)

        session.cancelExport(request.id)
        #expect(delegate.windowShouldClose(window))
        #expect(delegate.applicationShouldTerminate(NSApplication.shared) == .terminateNow)
    }

    @Test func composingOrOpeningBlocksCloseAndQuitWithoutPresentingDiscard() throws {
        let probe = ExitProbe()
        let delegate = probe.makeDelegate()
        let window = delegate.prepareWindow()
        defer { window.close() }
        let session = try #require(delegate.session)
        let id = try #require(session.tabs.selectedID)
        session.tabs.setComposing(true, in: id)
        #expect(delegate.windowShouldClose(window) == false)
        #expect(delegate.applicationShouldTerminate(NSApplication.shared) == .terminateCancel)
        session.tabs.setComposing(false, in: id)
        session.requestOpen()
        #expect(delegate.windowShouldClose(window) == false)
        #expect(delegate.applicationShouldTerminate(NSApplication.shared) == .terminateCancel)
        #expect(probe.prompts.isEmpty)
        #expect(probe.replies.isEmpty)
    }
}

@MainActor
private final class ExitProbe {
    typealias Prompt = (ticket: WindowExitGate.Ticket, finish: @MainActor (Bool) -> Void)
    var prompts: [Prompt] = []
    var replies: [Bool] = []

    func makeDelegate() -> ScratchApplicationDelegate {
        ScratchApplicationDelegate(source: "# 原稿", presentExit: { [weak self] _, ticket, finish in
            self?.prompts.append((ticket, finish))
        }, replyToQuit: { [weak self] _, allow in
            self?.replies.append(allow)
        })
    }
}
