import AppKit
@testable import HazakuraNext
import Testing

@MainActor
struct SourceNavigationNativeBoundaryTests {
    @Test func sourceNavigationWaitsForAnAttachedSheetToEnd() throws {
        let session = WorkspaceSession(source: "一行目\r\n桜の原稿")
        let frame = NSRect(x: 0, y: 0, width: 300, height: 200)
        let window = SheetStateWindow(contentRect: frame, styleMask: [.titled], backing: .buffered, defer: true)
        let sheet = NSWindow(contentRect: frame, styleMask: [.titled], backing: .buffered, defer: true)
        window.isReleasedWhenClosed = false
        sheet.isReleasedWhenClosed = false
        defer { window.close(); sheet.close() }
        session.window = window
        window.simulatedSheet = sheet
        try #require(!session.isBusy && window.attachedSheet === sheet)
        #expect(!session.canRequestLineJump && !session.canRequestSourceSearch)
        session.requestLineJump()
        #expect(session.lineJumpRequest == nil)
        if let id = session.lineJumpRequest?.id { session.dismissLineJump(id) }
        session.requestSourceSearch()
        #expect(session.sourceSearchRequest == nil)
        if let id = session.sourceSearchRequest?.id { session.dismissSourceSearch(id) }

        window.simulatedSheet = nil
        #expect(session.canRequestLineJump && session.canRequestSourceSearch)
        #expect(session.readySourceRevealID == nil)
    }

    enum Navigation: CaseIterable, Sendable { case lineJump, sourceSearch }

    @Test(arguments: Navigation.allCases)
    func sourceNavigationDoesNotQueueARevealWhileNativeTextIsMarked(_ navigation: Navigation) async throws {
        let prefix = "一行目 🌸\r\n"
        let source = prefix + "桜の原稿"
        let session = WorkspaceSession(source: "原稿")
        let documentID = try #require(session.tabs.selectedID)
        session.applyCommittedSource(source, to: documentID)
        let drafts = session.tabs.recoveryDrafts
        let frame = NSRect(x: 0, y: 0, width: 300, height: 200)
        let window = NSWindow(contentRect: frame, styleMask: [.titled], backing: .buffered, defer: true)
        window.isReleasedWhenClosed = false
        defer { window.close() }
        let editor = NSTextView(frame: frame)
        editor.string = source
        window.contentView = editor
        try #require(window.makeFirstResponder(editor))
        session.window = window

        let requestID: UUID
        let range: NSRange
        let confirm: () -> Bool
        switch navigation {
        case .lineJump:
            session.requestLineJump()
            let id = try #require(session.lineJumpRequest?.id)
            requestID = id
            range = NSRange(location: prefix.utf16.count, length: 0)
            confirm = { session.confirmLineJump(id, line: 2) }
        case .sourceSearch:
            session.requestSourceSearch()
            let id = try #require(session.sourceSearchRequest?.id)
            let report = try #require(await session.searchSource(id, query: "桜"))
            let match = try #require(report.results.matches.first)
            requestID = id
            range = match.range
            confirm = { session.selectSourceSearchMatch(id, reportID: report.id, matchID: match.id) }
        }

        editor.setMarkedText("候補", selectedRange: NSRange(location: 2, length: 0),
                             replacementRange: NSRange(location: NSNotFound, length: 0))
        try #require(editor.hasMarkedText() && !session.tabs.isComposing)
        let selection = editor.selectedRange()
        let marked = editor.markedRange()
        #expect(!confirm())
        #expect(session.readySourceRevealID == nil)
        #expect((session.lineJumpRequest?.id ?? session.sourceSearchRequest?.id) == requestID)
        #expect(window.firstResponder === editor)
        #expect(editor.selectedRange() == selection && editor.markedRange() == marked)
        #expect(session.tabs.recoveryDrafts == drafts)

        editor.unmarkText()
        editor.string = source // Simulate cancelling the candidate without changing the model.
        try #require(confirm())
        #expect(session.takeSourceReveal(requestID, documentID: documentID, editorSource: editor.string) == range)
        #expect(session.readySourceRevealID == nil)
        #expect(session.tabs.recoveryDrafts == drafts)
    }

    private final class SheetStateWindow: NSWindow {
        var simulatedSheet: NSWindow?
        override var attachedSheet: NSWindow? { simulatedSheet }
    }
}
