import AppKit
import Foundation
@testable import HazakuraNext
import HazakuraNextCore
import Testing

@MainActor
struct AssistReviewSampleTests {
    @Test func readOnlyReviewUsesTheFixtureInsteadOfTheCurrentDocument() async throws {
        let source = "この編集中の原稿は検証に使わない"
        let session = WorkspaceSession(source: source)
        let documentID = try #require(session.tabs.selectedID)
        session.requestAssistReviewSample()
        let ticket = try #require(session.assistReviewSample)
        let review = try await AssistReviewSample.prepare()

        #expect(session.assistReviewSample?.id == ticket.id)
        #expect(review.before.utf8.elementsEqual("表記: が \r\n余白:\t残す\n不可視: A\u{200B}B\r末尾\n".utf8))
        #expect(review.after.utf8.elementsEqual("表記: か\u{3099}\n余白: 残す\n不可視: AB\r末尾".utf8))
        let endings = review.rows.filter { $0.kind != .unchanged }.map(\.ending)
        for ending: LineDiff.Row.Ending in [.lf, .cr, .crlf, .none] {
            #expect(endings.contains(ending))
        }
        let beforeRows = review.rows.filter { $0.beforeLine != nil }
        let afterRows = review.rows.filter { $0.afterLine != nil }
        #expect(reconstruct(beforeRows).utf8.elementsEqual(review.before.utf8))
        #expect(reconstruct(afterRows).utf8.elementsEqual(review.after.utf8))
        #expect(session.tabs.selectedID == documentID)
        #expect(session.tabs.selectedTab?.document.source == source)
        #expect(session.tabs.selectedTab?.document.revision == 0)
        #expect(session.tabs.recoveryDrafts.isEmpty)
    }

    private func reconstruct(_ rows: [LineDiff.Row]) -> String {
        rows.map { row in
            let suffix: String = switch row.ending {
            case .none: ""
            case .lf: "\n"
            case .cr: "\r"
            case .crlf: "\r\n"
            }
            return row.text + suffix
        }.joined()
    }

    @Test func sampleDoesNotOpenDuringCompositionOrAnotherModalOperation() throws {
        let session = WorkspaceSession(source: "合成原稿")
        let documentID = try #require(session.tabs.selectedID)
        session.tabs.setComposing(true, in: documentID)
        session.requestAssistReviewSample()
        #expect(session.assistReviewSample == nil)

        session.tabs.setComposing(false, in: documentID)
        session.requestMarkdownPreview()
        let previewID = try #require(session.markdownPreview?.id)
        session.requestAssistReviewSample()
        #expect(session.assistReviewSample == nil)
        session.dismissMarkdownPreview(previewID)

        session.requestAssistReviewSample()
        #expect(session.assistReviewSample != nil)
        #expect(session.isBusy)
        #expect(!session.canEditSource)
        session.requestMarkdownPreview()
        #expect(session.markdownPreview == nil)
    }

    @Test func sampleDoesNotInterruptNativeCompositionBeforeTheModelIsNotified() throws {
        let session = WorkspaceSession(source: "")
        let documentID = try #require(session.tabs.selectedID)
        let source = "か\u{3099}\r\n確定済みの原稿"
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
        editor.setMarkedText("候補", selectedRange: NSRange(location: 2, length: 0),
                             replacementRange: NSRange(location: NSNotFound, length: 0))
        try #require(editor.hasMarkedText() && !session.tabs.isComposing)
        let selectedRange = editor.selectedRange()
        let markedRange = editor.markedRange()

        #expect(!session.canOpenAssistReviewSample)
        session.requestAssistReviewSample()
        #expect(session.assistReviewSample == nil)
        #expect(session.canEditSource)
        #expect(window.firstResponder === editor)
        #expect(editor.selectedRange() == selectedRange && editor.markedRange() == markedRange)
        #expect(session.tabs.recoveryDrafts == drafts)

        editor.unmarkText()
        editor.string = source
        #expect(session.canOpenAssistReviewSample)
        #expect(session.assistReviewSample == nil)
        session.requestAssistReviewSample()
        let sample = try #require(session.assistReviewSample)
        session.dismissAssistReviewSample(sample.id)
        #expect(session.tabs.selectedID == documentID)
        #expect(session.tabs.selectedTab?.document.source.utf8.elementsEqual(source.utf8) == true)
        #expect(session.tabs.recoveryDrafts == drafts)
    }

    @Test func sampleWaitsUntilThePreviousNativeSheetHasDetached() throws {
        let session = WorkspaceSession(source: "合成原稿")
        let frame = NSRect(x: 0, y: 0, width: 300, height: 200)
        let window = SheetStateWindow(contentRect: frame, styleMask: [.titled], backing: .buffered, defer: true)
        let sheet = NSWindow(contentRect: frame, styleMask: [.titled], backing: .buffered, defer: true)
        window.isReleasedWhenClosed = false
        sheet.isReleasedWhenClosed = false
        defer { window.close(); sheet.close() }
        session.window = window
        session.requestMarkdownPreview()
        let preview = try #require(session.markdownPreview)
        window.simulatedSheet = sheet
        session.dismissMarkdownPreview(preview.id)
        try #require(!session.isBusy && window.attachedSheet === sheet)

        #expect(!session.canOpenAssistReviewSample)
        session.requestAssistReviewSample()
        #expect(session.assistReviewSample == nil)
        window.simulatedSheet = nil
        #expect(session.canOpenAssistReviewSample)
        #expect(session.assistReviewSample == nil)
        session.requestAssistReviewSample()
        #expect(session.assistReviewSample != nil)
    }

    private final class SheetStateWindow: NSWindow {
        var simulatedSheet: NSWindow?
        override var attachedSheet: NSWindow? { simulatedSheet }
    }

    @Test func theOldSheetCannotDismissAReopenedSample() throws {
        let session = WorkspaceSession(source: "合成原稿")
        session.requestAssistReviewSample()
        let first = try #require(session.assistReviewSample?.id)
        session.requestAssistReviewSample()
        #expect(session.assistReviewSample?.id == first)
        session.dismissAssistReviewSample(first)
        #expect(!session.isBusy)

        session.requestAssistReviewSample()
        let second = try #require(session.assistReviewSample?.id)
        #expect(second != first)
        session.dismissAssistReviewSample(first)
        #expect(session.assistReviewSample?.id == second)
        session.dismissAssistReviewSample(second)
        #expect(session.assistReviewSample == nil)
        #expect(session.canEditSource)
    }
}
