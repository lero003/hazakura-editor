import AppKit
@testable import HazakuraNext
import HazakuraNextCore
import Testing

@MainActor
struct WorkspaceAppearanceTests {
    @Test func appearanceIsWindowLocalAndSystemClearsOnlyThatWindowsOverride() throws {
        let session = WorkspaceSession(source: "# 原稿")
        let otherSession = WorkspaceSession(source: "# 別の原稿")
        let window = makeWindow()
        let otherWindow = makeWindow()
        defer {
            window.close()
            otherWindow.close()
        }
        session.window = window
        otherSession.window = otherWindow

        #expect(session.appearance == .system)
        #expect(window.appearance == nil)
        #expect(otherSession.appearance == .system)
        #expect(otherWindow.appearance == nil)
        // Menu routing, not the session, requires a visible key window.
        try #require(window.isVisible == false)
        #expect(session.canSetAppearance)

        session.setAppearance(.dark)
        #expect(session.appearance == .dark)
        #expect(window.appearance?.name == .darkAqua)
        #expect(otherSession.appearance == .system)
        #expect(otherWindow.appearance == nil)

        otherSession.setAppearance(.light)
        #expect(otherSession.appearance == .light)
        #expect(otherWindow.appearance?.name == .aqua)
        #expect(session.appearance == .dark)
        #expect(window.appearance?.name == .darkAqua)

        session.setAppearance(.system)
        #expect(session.appearance == .system)
        #expect(window.appearance == nil)
        #expect(otherSession.appearance == .light)
        #expect(otherWindow.appearance?.name == .aqua)

        let freshWindow = makeWindow()
        defer { freshWindow.close() }
        let freshSession = WorkspaceSession(source: "# 新しい原稿")
        freshSession.window = freshWindow
        #expect(freshSession.appearance == .system)
        #expect(freshWindow.appearance == nil)
    }

    @Test func readsTheExplicitAppearanceAndDoesNotQueueAChoiceWithoutAWindow() throws {
        let session = WorkspaceSession(source: "# 原稿")
        #expect(session.appearance == .system)
        #expect(session.canSetAppearance == false)
        session.setAppearance(.dark)
        #expect(session.appearance == .system)

        let window = makeWindow()
        defer { window.close() }
        session.window = window
        #expect(session.appearance == .system)
        #expect(window.appearance == nil)

        window.appearance = NSAppearance(named: .aqua)
        #expect(session.appearance == .light)
        window.appearance = NSAppearance(named: .darkAqua)
        #expect(session.appearance == .dark)
        window.appearance = nil
        #expect(session.appearance == .system)

        let close = session.tabs.requestCloseSelected()
        try #require(close == .closed)
        try #require(session.tabs.selectedID == nil)
        #expect(session.canSetAppearance)
        session.setAppearance(.light)
        #expect(window.appearance?.name == .aqua)
    }

    enum Blocker: CaseIterable, Sendable { case composition, export, attachedSheet }

    @Test(arguments: Blocker.allCases)
    func blockedChangesLeaveTheExplicitOverrideAndDoNotReplay(_ blocker: Blocker) throws {
        let session = WorkspaceSession(source: "# 原稿")
        let window = makeWindow()
        defer { window.close() }
        session.window = window
        window.appearance = NSAppearance(named: .darkAqua)
        let id = try #require(session.tabs.selectedID)

        switch blocker {
        case .composition:
            session.tabs.setComposing(true, in: id)
            try #require(session.tabs.isComposing)
        case .export:
            session.requestExport(.epub)
            try #require(session.isBusy)
        case .attachedSheet:
            // Simulate only the native sheet state; neither window is ordered on screen.
            window.simulatedSheet = makeWindow()
            try #require(window.attachedSheet != nil)
            try #require(session.isBusy == false)
        }
        let exportID = session.exportRequest?.id
        #expect(session.canSetAppearance == false)
        session.setAppearance(.light)
        session.setAppearance(.system)
        #expect(session.appearance == .dark)
        #expect(window.appearance?.name == .darkAqua)
        #expect(session.exportRequest?.id == exportID)
        #expect(session.tabs.isComposing == (blocker == .composition))

        switch blocker {
        case .composition: session.tabs.setComposing(false, in: id)
        case .export: session.cancelExport(try #require(exportID))
        case .attachedSheet:
            window.simulatedSheet?.close()
            window.simulatedSheet = nil
        }
        #expect(session.canSetAppearance)
        #expect(window.appearance?.name == .darkAqua)
        session.setAppearance(.system)
        #expect(session.appearance == .system)
        #expect(window.appearance == nil)
    }

    enum LayoutBlocker: CaseIterable, Sendable { case nativeComposition, attachedSheet }

    @Test(arguments: LayoutBlocker.allCases, [false, true])
    func layoutTogglesRejectNativeBlockersAndWaitForAnExplicitRetry(_ blocker: LayoutBlocker, startsEnabled: Bool) throws {
        let session = WorkspaceSession(source: "# 原稿")
        let window = makeWindow()
        defer { window.close() }
        session.window = window
        let id = try #require(session.tabs.selectedID)
        session.applyCommittedSource("# 確定原稿\r\n", to: id)
        let drafts = session.tabs.recoveryDrafts
        if startsEnabled {
            session.toggleLMode()
            session.toggleZenMode()
        }
        try #require(session.isLMode == startsEnabled && session.isZenMode == startsEnabled)

        let editor = NSTextView(frame: window.contentLayoutRect)
        window.contentView = editor
        try #require(window.makeFirstResponder(editor))
        let sheet = blocker == .attachedSheet ? makeWindow() : nil
        defer { sheet?.close() }
        switch blocker {
        case .nativeComposition:
            editor.setMarkedText("候補", selectedRange: NSRange(location: 2, length: 0),
                                 replacementRange: NSRange(location: NSNotFound, length: 0))
            try #require(editor.hasMarkedText() && !session.tabs.isComposing)
        case .attachedSheet:
            window.simulatedSheet = sheet
            try #require(window.attachedSheet != nil && !session.isBusy)
        }
        let selection = editor.selectedRange()
        let marked = editor.markedRange()
        #expect(!session.canToggleLMode)
        #expect(!session.canToggleZenMode)
        session.toggleLMode()
        session.toggleZenMode()
        #expect(session.isLMode == startsEnabled)
        #expect(session.isZenMode == startsEnabled)
        #expect(window.firstResponder === editor)
        #expect(editor.selectedRange() == selection)
        #expect(editor.markedRange() == marked)

        if blocker == .nativeComposition { editor.unmarkText() }
        window.simulatedSheet = nil
        try #require(session.isLMode == startsEnabled && session.isZenMode == startsEnabled)
        #expect(session.canToggleLMode && session.canToggleZenMode)
        session.toggleLMode()
        session.toggleZenMode()
        #expect(session.isLMode == !startsEnabled && session.isZenMode == !startsEnabled)
        #expect(session.tabs.selectedID == id)
        #expect(session.tabs.recoveryDrafts == drafts)
    }

    @Test func changingAppearancePreservesDraftsRevisionsRecoveryAndOtherPresentationModes() async throws {
        let probe = AppearanceRecoveryProbe()
        let recovery = RecoveryCheckpointQueue(backend: .init(
            checkpoint: { await probe.recordCheckpoint($0) },
            candidates: {
                Issue.record("Changing appearance must not read recovery records.")
                return []
            },
            discardConfirmed: { _ in Issue.record("Changing appearance must not discard recovery records.") }
        ))
        let session = WorkspaceSession(source: "", recovery: recovery)
        let window = makeWindow()
        defer { window.close() }
        session.window = window
        let firstID = try #require(session.tabs.selectedID)
        let firstSource = "# 別の原稿\r本文\n"
        session.applyCommittedSource(firstSource, to: firstID)
        session.newTab()
        let selectedID = try #require(session.tabs.selectedID)
        try #require(selectedID != firstID)
        let selectedSource = "# か\u{3099}\r\n\r\n本文 *強調* 👩‍💻"
        session.applyCommittedSource(selectedSource, to: selectedID)
        session.toggleLMode()
        session.toggleZenMode()
        try #require(session.isLMode && session.isZenMode)
        let drafts = session.tabs.recoveryDrafts
        let revisions = session.tabs.tabs.map(\.document.revision)
        let sources = [Data(firstSource.utf8), Data(selectedSource.utf8)]
        try #require(drafts.count == 2)
        await recovery.waitForCurrentWorker()
        try #require(await probe.checkpoints == drafts)

        for mode in [WorkspaceSession.Appearance.dark, .light, .system] {
            session.setAppearance(mode)
            #expect(session.appearance == mode)
            #expect(session.isLMode)
            #expect(session.isZenMode)
            #expect(session.tabs.selectedID == selectedID)
            #expect(session.tabs.tabs.map(\.id) == [firstID, selectedID])
            #expect(session.tabs.tabs.map(\.document.revision) == revisions)
            #expect(session.tabs.tabs.map { Data($0.document.source.utf8) } == sources)
            #expect(session.tabs.recoveryDrafts == drafts)
            await recovery.waitForCurrentWorker()
            #expect(await probe.checkpoints == drafts)
        }
    }

    private func makeWindow() -> OffscreenWindow {
        let window = OffscreenWindow(contentRect: NSRect(x: 0, y: 0, width: 320, height: 240),
                                     styleMask: [.titled], backing: .buffered, defer: true)
        window.isReleasedWhenClosed = false
        return window
    }

    private final class OffscreenWindow: NSWindow {
        var simulatedSheet: NSWindow?
        override var attachedSheet: NSWindow? { simulatedSheet }
    }
}

private actor AppearanceRecoveryProbe {
    private(set) var checkpoints: [RecoveryDraft] = []

    func recordCheckpoint(_ draft: RecoveryDraft) {
        checkpoints.append(draft)
    }
}
