import AppKit
import Testing
@testable import HazakuraNextEditor

@MainActor
struct TextKitEditorTests {
    @Test
    func opensMarkdownInAnEditableTextKit2View() throws {
        let markdown = "# 見出し 👩‍💻\r\n- \"quoted\" -- `e\u{0301}`\n\t本文  \n"
        let scrollView = TextKitEditor.makeScrollView(initialText: markdown, coordinator: nil)
        let textView = try #require(scrollView.documentView as? NSTextView)

        #expect(textView.textLayoutManager != nil)
        #expect(textView.string.utf8.elementsEqual(markdown.utf8))
        #expect(textView.isEditable)
        #expect(textView.allowsUndo)
        #expect(textView.isRichText == false)
        #expect(textView.importsGraphics == false)
        #expect(textView.isAutomaticQuoteSubstitutionEnabled == false)
        #expect(textView.isAutomaticDashSubstitutionEnabled == false)
        #expect(textView.isAutomaticTextReplacementEnabled == false)
        #expect(textView.isAutomaticSpellingCorrectionEnabled == false)
        #expect(textView.isAutomaticLinkDetectionEnabled == false)
        #expect(textView.isAutomaticDataDetectionEnabled == false)
        #expect(textView.smartInsertDeleteEnabled == false)
    }

    @Test
    func pastesOnlyPlainTextAndDoesNotAcceptFileDrops() throws {
        let scrollView = TextKitEditor.makeScrollView(initialText: "", coordinator: nil)
        let textView = try #require(scrollView.documentView as? NSTextView)
        let pasteboard = NSPasteboard.withUniqueName()
        defer { pasteboard.releaseGlobally() }
        pasteboard.declareTypes([.fileURL], owner: nil)
        pasteboard.setString("file:///synthetic/example.md", forType: .fileURL)
        #expect(textView.readSelection(from: pasteboard, type: .fileURL) == false)
        #expect(textView.readSelection(from: pasteboard) == false)
        #expect(textView.string.isEmpty)
        #expect(textView.acceptableDragTypes.isEmpty)

        pasteboard.declareTypes([.string], owner: nil)
        pasteboard.setString("# 原文", forType: .string)
        #expect(textView.readSelection(from: pasteboard))
        #expect(textView.string == "# 原文")
    }

    @Test
    func nativeEditReportsLiteralMarkdownWithoutRecreatingTheBackend() throws {
        let markdown = "# 日本語 👩‍💻\n"
        var reported: [String] = []
        let coordinator = TextKitEditor.Coordinator { reported.append($0) }
        let scrollView = TextKitEditor.makeScrollView(initialText: markdown, coordinator: coordinator)
        let textView = try #require(scrollView.documentView as? NSTextView)
        let textLayoutManager = try #require(textView.textLayoutManager)
        #expect(reported.isEmpty, "Seeding the editor must not notify the caller.")

        let insertion = "- \"literal\" -- `code`\n"
        textView.insertText(insertion, replacementRange: NSRange(location: markdown.utf16.count, length: 0))

        #expect(textView.string == markdown + insertion)
        #expect(reported == [markdown + insertion])
        #expect(textView.textLayoutManager === textLayoutManager)
    }

    @Test
    func nativeUndoAndRedoReportTheRestoredBuffer() throws {
        var reported: [String] = []
        let coordinator = TextKitEditor.Coordinator { reported.append($0) }
        let scrollView = TextKitEditor.makeScrollView(initialText: "# 原稿", coordinator: coordinator)
        let textView = try #require(scrollView.documentView as? NSTextView)
        let textLayoutManager = try #require(textView.textLayoutManager)
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 360, height: 240),
            styleMask: [.titled],
            backing: .buffered,
            defer: true
        )
        // AppKit owns the undo manager through the responder chain. Never show the window.
        window.contentView = scrollView
        let undoManager = try #require(textView.undoManager)
        #expect(undoManager.canUndo == false, "Seeding must not register an undo operation.")

        textView.insertText("本文\n", replacementRange: NSRange(location: 0, length: 0))
        undoManager.undo()
        #expect(textView.string == "# 原稿")
        #expect(reported.last == "# 原稿")

        undoManager.redo()
        #expect(textView.string == "本文\n# 原稿")
        #expect(reported.last == "本文\n# 原稿")
        #expect(textView.textLayoutManager === textLayoutManager)
    }

    @Test
    func acceptsMarkedTextAndReportsTheCommittedResult() throws {
        var reported: [String] = []
        let coordinator = TextKitEditor.Coordinator { reported.append($0) }
        let scrollView = TextKitEditor.makeScrollView(initialText: "", coordinator: coordinator)
        let textView = try #require(scrollView.documentView as? NSTextView)
        let textLayoutManager = try #require(textView.textLayoutManager)
        let implicitRange = NSRange(location: NSNotFound, length: 0)

        // Exercise the native text-input protocol without simulating a device or an input source.
        textView.setMarkedText("かな", selectedRange: NSRange(location: 2, length: 0), replacementRange: implicitRange)
        #expect(textView.hasMarkedText())
        textView.insertText("仮名", replacementRange: implicitRange)

        #expect(textView.hasMarkedText() == false)
        #expect(textView.string == "仮名")
        #expect(reported.last == "仮名")
        #expect(textView.textLayoutManager === textLayoutManager)
    }
}
