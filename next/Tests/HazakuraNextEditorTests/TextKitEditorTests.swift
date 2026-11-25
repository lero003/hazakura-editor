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
    func focusLayoutCentersTheTextColumnAndAdaptsToANarrowReadOnlyViewport() throws {
        let source = "# 原文 👩‍💻\r\nか\u{3099}\n"
        let scrollView = TextKitEditor.makeScrollView(
            initialText: source, isReadOnly: true, isFocusLayout: true, coordinator: nil
        )
        let textView = try #require(scrollView.documentView as? NSTextView)
        let container = try #require(textView.textContainer)
        // Exercise a scroller that takes up horizontal space, not just an overlaid scroller.
        scrollView.scrollerStyle = .legacy
        scrollView.autohidesScrollers = false

        for width: CGFloat in [1500, 950, 320, 80] {
            resizeEditor(scrollView, width: width)
            let viewport = scrollView.contentView.bounds.width
            let leftGutter = textView.textContainerOrigin.x + container.lineFragmentPadding
            let textWidth = container.size.width - 2 * container.lineFragmentPadding
            let rightGutter = viewport - leftGutter - textWidth

            #expect(abs(leftGutter - rightGutter) <= 1)
            if width == 1500 {
                #expect(viewport - textWidth >= 200, "A very wide viewport should still narrow the column.")
            } else if width == 950 {
                #expect(viewport < width)
                #expect(abs(textWidth - 720) <= 1)
            } else {
                #expect(textWidth >= viewport * 0.75)
            }
            #expect(textView.textContainerInset.height > 12)
        }

        #expect(textView.isSelectable)
        #expect(textView.isEditable == false)
        #expect(textView.undoManager == nil)
        let selection = NSRange(location: 0, length: 2)
        textView.setSelectedRange(selection)
        textView.insertText("別", replacementRange: selection)
        #expect(textView.selectedRange() == selection)
        #expect(textView.string.utf8.elementsEqual(source.utf8))
    }

    @Test
    func focusLayoutTogglePreservesSourceSelectionUndoAndTheNativeEditor() throws {
        let source = "# 原稿 👩‍💻\r\n- `e\u{0301}`\r" + String(repeating: "本文\n", count: 120)
        let insertion = "冒頭\n"
        var reported: [[UInt8]] = []
        let coordinator = TextKitEditor.Coordinator { reported.append(Array($0.utf8)) }
        let scrollView = TextKitEditor.makeScrollView(initialText: source, coordinator: coordinator)
        let window = makeWindow(containing: scrollView)
        defer { window.contentView = nil }
        resizeEditor(scrollView, width: 1300)
        let textView = try #require(scrollView.documentView as? NSTextView)
        let layoutManager = try #require(textView.textLayoutManager)
        let storage = try #require(textView.textContentStorage?.textStorage)
        let undoManager = try #require(textView.undoManager)
        let normalInset = textView.textContainerInset
        let font = textView.font
        #expect(normalInset == NSSize(width: 12, height: 12))

        textView.insertText(insertion, replacementRange: NSRange(location: 0, length: 0))
        let selection = NSRange(location: 0, length: 2)
        textView.setSelectedRange(selection)
        let styledSource = NSAttributedString(attributedString: storage)
        textView.scrollRangeToVisible(NSRange(location: source.utf16.count, length: 0))
        let scrollOrigin = scrollView.contentView.bounds.origin
        try #require(scrollOrigin.y > 0)

        TextKitEditor.setFocusLayout(true, in: scrollView)
        #expect(textView.textContainerInset.width > normalInset.width)
        #expect(textView.textContainerInset.height > normalInset.height)
        #expect(scrollView.documentView === textView)
        #expect(textView.textLayoutManager === layoutManager)
        #expect(textView.textContentStorage?.textStorage === storage)
        #expect(textView.undoManager === undoManager)
        #expect(textView.font == font)
        #expect(storage.isEqual(to: styledSource))
        #expect(textView.selectedRange() == selection)
        #expect(window.firstResponder === textView)
        #expect(scrollView.contentView.bounds.origin == scrollOrigin)
        #expect(textView.string.utf8.elementsEqual((insertion + source).utf8))
        #expect(reported == [Array((insertion + source).utf8)])

        undoManager.undo()
        #expect(textView.string.utf8.elementsEqual(source.utf8))
        try #require(undoManager.canRedo)
        let undoneSelection = textView.selectedRange()
        window.makeFirstResponder(nil)
        TextKitEditor.setFocusLayout(false, in: scrollView)
        #expect(textView.textContainerInset == normalInset)
        #expect(textView.selectedRange() == undoneSelection)
        #expect(window.firstResponder === window)
        #expect(undoManager.canUndo == false)
        #expect(undoManager.canRedo)
        undoManager.redo()
        #expect(textView.string.utf8.elementsEqual((insertion + source).utf8))
        #expect(reported == [Array((insertion + source).utf8), Array(source.utf8), Array((insertion + source).utf8)])
        #expect(textView.textLayoutManager === layoutManager)
    }

    @Test(arguments: [true, false])
    func focusLayoutWaitsForMarkedTextToCommitOrCancel(commits: Bool) throws {
        var events: [EditorEvent] = []
        let coordinator = TextKitEditor.Coordinator(onCompositionChange: { events.append(.composing($0)) }) {
            events.append(.source($0))
        }
        let scrollView = TextKitEditor.makeScrollView(initialText: "# ", isFocusLayout: true, coordinator: coordinator)
        let window = makeWindow(containing: scrollView)
        defer { window.contentView = nil }
        resizeEditor(scrollView, width: 1500)
        let textView = try #require(scrollView.documentView as? NSTextView)
        let layoutManager = try #require(textView.textLayoutManager)
        let container = try #require(textView.textContainer)
        let originalInset = textView.textContainerInset
        try #require(originalInset.width > 12)
        textView.setSelectedRange(NSRange(location: 2, length: 0))
        setMarkedText("かな", in: textView)
        try #require(textView.hasMarkedText())
        let markedRange = textView.markedRange()
        let markedSelection = textView.selectedRange()

        resizeEditor(scrollView, width: 450)
        #expect(textView.textContainerInset == originalInset, "Resize must not change insets during composition.")
        #expect(container.size.width - 2 * container.lineFragmentPadding >= 120,
                "The retained wide-window inset must still leave usable text width.")
        TextKitEditor.setFocusLayout(false, in: scrollView)
        #expect(textView.textContainerInset == originalInset, "A mode toggle must not change insets during composition.")
        TextKitEditor.setFocusLayout(commits, in: scrollView)
        resizeEditor(scrollView, width: 940)
        #expect(textView.textContainerInset == originalInset)
        #expect(textView.markedRange() == markedRange)
        #expect(textView.selectedRange() == markedSelection)
        #expect(textView.string == "# かな")
        #expect(events == [.composing(true)])

        if commits {
            textView.insertText("仮名", replacementRange: implicitRange)
            #expect(events == [.composing(true), .source("# 仮名"), .composing(false)])
            let actualTextWidth = container.size.width - 2 * container.lineFragmentPadding
            #expect(abs(actualTextWidth - 720) <= 1)
        } else {
            setMarkedText("", in: textView)
            textView.unmarkText()
            #expect(textView.string.utf8.elementsEqual("# ".utf8))
            #expect(events == [.composing(true), .composing(false)])
            #expect(textView.textContainerInset == NSSize(width: 12, height: 12))
        }
        #expect(textView.hasMarkedText() == false)
        #expect(textView.textLayoutManager === layoutManager)
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
        let window = makeWindow(containing: scrollView)
        defer { window.contentView = nil }
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
        let window = makeWindow(containing: scrollView)
        defer { window.contentView = nil }
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
        var events: [EditorEvent] = []
        let coordinator = TextKitEditor.Coordinator(onCompositionChange: { events.append(.composing($0)) }) {
            events.append(.source($0))
        }
        let scrollView = TextKitEditor.makeScrollView(initialText: "# ", coordinator: coordinator)
        let window = makeWindow(containing: scrollView)
        defer { window.contentView = nil }
        let textView = try #require(scrollView.documentView as? NSTextView)
        let textLayoutManager = try #require(textView.textLayoutManager)
        textView.setSelectedRange(NSRange(location: 2, length: 0))

        // Exercise native AppKit input methods, not a real keyboard/input source.
        setMarkedText("かな", in: textView)
        #expect(textView.hasMarkedText())
        #expect(textView.string == "# かな")
        #expect(events == [.composing(true)])
        setMarkedText("かなもの", in: textView)
        #expect(textView.hasMarkedText())
        #expect(textView.string == "# かなもの")
        #expect(events == [.composing(true)])

        textView.insertText("金物", replacementRange: implicitRange)
        #expect(textView.hasMarkedText() == false)
        #expect(textView.string == "# 金物")
        let committedEvents: [EditorEvent] = [.composing(true), .source("# 金物"), .composing(false)]
        #expect(events == committedEvents)
        #expect(textView.textLayoutManager === textLayoutManager)

        let undoManager = try #require(textView.undoManager)
        undoManager.undo()
        undoManager.redo()
        #expect(events == committedEvents + [.source("# "), .source("# 金物")])
    }

    @Test
    func unmarkCommitsTheExistingCharactersWithoutInsertingAgain() throws {
        var events: [EditorEvent] = []
        let coordinator = TextKitEditor.Coordinator(onCompositionChange: { events.append(.composing($0)) }) {
            events.append(.source($0))
        }
        let scrollView = TextKitEditor.makeScrollView(initialText: "", coordinator: coordinator)
        let window = makeWindow(containing: scrollView)
        defer { window.contentView = nil }
        let textView = try #require(scrollView.documentView as? NSTextView)

        setMarkedText("候補", in: textView)
        #expect(textView.hasMarkedText())
        #expect(events == [.composing(true)])
        // AppKit can reprocess the same characters during unmark. Isolate the native
        // input hook so that publication cannot depend on any storage notification.
        let storage = try #require(textView.textContentStorage?.textStorage)
        NotificationCenter.default.removeObserver(
            coordinator, name: NSTextStorage.didProcessEditingNotification, object: storage
        )
        textView.unmarkText()

        #expect(textView.hasMarkedText() == false)
        #expect(textView.string == "候補")
        #expect(events == [.composing(true), .source("候補"), .composing(false)])
        textView.unmarkText()
        #expect(events == [.composing(true), .source("候補"), .composing(false)])
    }

    @Test
    func cancellingToOriginalBytesEndsCompositionWithoutPublishingSource() throws {
        var events: [EditorEvent] = []
        let coordinator = TextKitEditor.Coordinator(onCompositionChange: { events.append(.composing($0)) }) {
            events.append(.source($0))
        }
        let scrollView = TextKitEditor.makeScrollView(initialText: "# ", coordinator: coordinator)
        let window = makeWindow(containing: scrollView)
        defer { window.contentView = nil }
        let textView = try #require(scrollView.documentView as? NSTextView)
        textView.setSelectedRange(NSRange(location: 2, length: 0))

        setMarkedText("仮", in: textView)
        #expect(textView.hasMarkedText())
        #expect(textView.string == "# 仮")
        // Model a cancellation that clears the marked insertion, not a real Escape key event.
        setMarkedText("", in: textView)
        textView.unmarkText()

        #expect(textView.hasMarkedText() == false)
        #expect(textView.string == "# ")
        #expect(events == [.composing(true), .composing(false)])
    }

    @Test
    func commitReportsCanonicallyEquivalentSourceWithDifferentBytes() throws {
        let initialText = "が"
        let replacement = "か\u{3099}"
        var reported: [[UInt8]] = []
        let coordinator = TextKitEditor.Coordinator { reported.append(Array($0.utf8)) }
        let scrollView = TextKitEditor.makeScrollView(initialText: initialText, coordinator: coordinator)
        let window = makeWindow(containing: scrollView)
        defer { window.contentView = nil }
        let textView = try #require(scrollView.documentView as? NSTextView)

        textView.setSelectedRange(NSRange(location: 0, length: initialText.utf16.count))
        setMarkedText(replacement, in: textView)
        textView.unmarkText()

        #expect(reported == [Array(replacement.utf8)])
    }

    @Test
    func noEventsOutsideWindowOrAfterDismantling() throws {
        var events: [EditorEvent] = []
        let coordinator = TextKitEditor.Coordinator(onCompositionChange: { events.append(.composing($0)) }) {
            events.append(.source($0))
        }
        let scrollView = TextKitEditor.makeScrollView(initialText: "", coordinator: coordinator)
        let textView = try #require(scrollView.documentView as? NSTextView)

        setMarkedText("仮", in: textView)
        textView.unmarkText()
        #expect(events.isEmpty)

        let window = makeWindow(containing: scrollView)
        defer { window.contentView = nil }
        textView.insertText("確定", replacementRange: NSRange(location: 0, length: textView.string.utf16.count))
        #expect(events == [.source("確定")])
        window.contentView = nil
        #expect(textView.window == nil)
        setMarkedText("別", in: textView)
        textView.insertText("外", replacementRange: implicitRange)
        #expect(events == [.source("確定")])

        window.contentView = scrollView
        TextKitEditor.dismantleNSView(scrollView, coordinator: coordinator)
        setMarkedText("仮", in: textView)
        textView.unmarkText()
        #expect(events == [.source("確定")])
    }

    @Test
    func switchingEditorsPreservesSelectionAndKeepsSeparateNativeUndoHistories() throws {
        var firstReported: [String] = []
        let firstCoordinator = TextKitEditor.Coordinator { firstReported.append($0) }
        let firstScroll = TextKitEditor.makeScrollView(initialText: "一", coordinator: firstCoordinator)
        let first = try #require(firstScroll.documentView as? NSTextView)
        var secondReported: [String] = []
        let secondCoordinator = TextKitEditor.Coordinator { secondReported.append($0) }
        let secondScroll = TextKitEditor.makeScrollView(initialText: "二", isActive: false, coordinator: secondCoordinator)
        let second = try #require(secondScroll.documentView as? NSTextView)
        let container = NSView()
        container.addSubview(firstScroll)
        container.addSubview(secondScroll)
        let window = makeWindow(containing: container)
        defer { window.contentView = nil }
        let firstUndo = try #require(first.undoManager)
        let secondUndo = try #require(second.undoManager)
        #expect(firstUndo !== secondUndo)
        #expect(window.firstResponder === first)
        #expect(second.isEditable == false)
        #expect(second.acceptsFirstResponder == false)

        first.insertText("稿", replacementRange: NSRange(location: 1, length: 0))
        let selection = NSRange(location: 0, length: 1)
        first.setSelectedRange(selection)
        #expect(secondUndo.canUndo == false)

        TextKitEditor.setActive(false, in: firstScroll)
        TextKitEditor.setActive(true, in: secondScroll)
        #expect(first.isEditable == false)
        #expect(first.acceptsFirstResponder == false)
        #expect(window.firstResponder === second)
        second.insertText("章", replacementRange: NSRange(location: 1, length: 0))
        secondUndo.undo()
        #expect(secondReported == ["二章", "二"])
        #expect(firstReported == ["一稿"])

        TextKitEditor.setActive(true, in: firstScroll)
        TextKitEditor.setActive(false, in: secondScroll)
        #expect(window.firstResponder === first)
        #expect(first.selectedRange() == selection)
        firstUndo.undo()
        firstUndo.redo()
        #expect(firstReported == ["一稿", "一", "一稿"])
        #expect(secondReported == ["二章", "二"])
    }

    @Test
    func readOnlyTextRetainsSelectionAndRejectsEdits() throws {
        let source = "# か\u{3099}\r\n原文\r末尾"
        var reported: [String] = []
        let coordinator = TextKitEditor.Coordinator { reported.append($0) }
        let scrollView = TextKitEditor.makeScrollView(initialText: source, isReadOnly: true, coordinator: coordinator)
        let window = makeWindow(containing: scrollView)
        defer { window.contentView = nil }
        let textView = try #require(scrollView.documentView as? NSTextView)
        let selection = NSRange(location: 0, length: 2)
        #expect(window.firstResponder === textView)
        #expect(textView.isSelectable)
        #expect(textView.isEditable == false)
        #expect(textView.undoManager == nil)
        textView.setSelectedRange(selection)

        textView.insertText("別の文字", replacementRange: selection)
        setMarkedText("候補", in: textView)
        textView.unmarkText()
        let pasteboard = NSPasteboard.withUniqueName()
        defer { pasteboard.releaseGlobally() }
        pasteboard.setString("貼り付け", forType: .string)
        #expect(textView.readSelection(from: pasteboard, type: .string) == false)
        #expect(textView.selectedRange() == selection)
        #expect(textView.string.utf8.elementsEqual(source.utf8))
        #expect(reported.isEmpty)
    }

    @Test
    func editPolicyBlocksNewNativeMutationsWithoutUpdatingTheView() throws {
        let policy = EditPolicy()
        var events: [EditorEvent] = []
        let editor = TextKitEditor(initialText: "原稿", canEdit: { policy.permitsEdits }, onCompositionChange: {
            events.append(.composing($0))
        }) { events.append(.source($0)) }
        let coordinator = editor.makeCoordinator()
        let scrollView = TextKitEditor.makeScrollView(initialText: "原稿", coordinator: coordinator)
        let window = makeWindow(containing: scrollView)
        defer { window.contentView = nil }
        let textView = try #require(scrollView.documentView as? NSTextView)
        let pasteboard = NSPasteboard.withUniqueName()
        defer { pasteboard.releaseGlobally() }
        pasteboard.setString("貼り付け", forType: .string)
        let selection = NSRange(location: 0, length: 1)
        textView.setSelectedRange(selection)

        policy.permitsEdits = false
        #expect(textView.isEditable, "The representable has not received an update.")
        textView.insertText("別", replacementRange: selection)
        setMarkedText("候補", in: textView)
        #expect(textView.readSelection(from: pasteboard) == false)
        #expect(textView.shouldChangeText(in: selection, replacementString: "別") == false)
        textView.delete(nil)
        textView.deleteBackward(nil)
        textView.insertNewline(nil)
        #expect(textView.selectedRange() == selection)
        #expect(textView.hasMarkedText() == false)
        #expect(textView.string == "原稿")
        #expect(events.isEmpty)

        policy.permitsEdits = true
        textView.delete(nil)
        #expect(textView.string == "稿")
        #expect(events == [.source("稿")])
    }

    @Test
    func editPolicyPausesAnExistingNativeUndoHistoryWithoutClearingIt() throws {
        let policy = EditPolicy()
        var reported: [String] = []
        let coordinator = TextKitEditor.Coordinator(canEdit: { policy.permitsEdits }) { reported.append($0) }
        let scrollView = TextKitEditor.makeScrollView(initialText: "原稿", coordinator: coordinator)
        let window = makeWindow(containing: scrollView)
        defer { window.contentView = nil }
        let textView = try #require(scrollView.documentView as? NSTextView)
        let undoManager = try #require(textView.undoManager)
        textView.insertText("新", replacementRange: NSRange(location: 0, length: 0))
        try #require(undoManager.canUndo)

        policy.permitsEdits = false
        #expect(undoManager.canUndo == false)
        undoManager.undo() // Even a manager already obtained by the responder chain must check again.
        #expect(textView.string == "新原稿")
        #expect(reported == ["新原稿"])

        policy.permitsEdits = true
        undoManager.undo()
        #expect(textView.string == "原稿")
        try #require(undoManager.canRedo)
        policy.permitsEdits = false
        undoManager.redo()
        #expect(textView.string == "原稿")
        #expect(reported == ["新原稿", "原稿"])

        policy.permitsEdits = true
        undoManager.redo()
        #expect(textView.string == "新原稿")
        #expect(reported == ["新原稿", "原稿", "新原稿"])
    }

    @Test
    func editPolicyDoesNotDiscardMarkedTextOrHideACompletedEdit() throws {
        let policy = EditPolicy()
        var events: [EditorEvent] = []
        let coordinator = TextKitEditor.Coordinator(canEdit: { policy.permitsEdits }, onCompositionChange: {
            events.append(.composing($0))
        }) { events.append(.source($0)) }
        let scrollView = TextKitEditor.makeScrollView(initialText: "", coordinator: coordinator)
        let window = makeWindow(containing: scrollView)
        defer { window.contentView = nil }
        let textView = try #require(scrollView.documentView as? NSTextView)
        setMarkedText("候補", in: textView)
        try #require(textView.hasMarkedText())

        // The app normally waits for composition to end before blocking edits.
        // If AppKit still unmarks existing text, the committed source must not be lost.
        policy.permitsEdits = false
        setMarkedText("別候補", in: textView)
        textView.insertText("別", replacementRange: implicitRange)
        #expect(textView.hasMarkedText())
        #expect(events == [.composing(true)])
        textView.unmarkText()
        #expect(textView.hasMarkedText() == false)
        #expect(textView.string == "候補")
        #expect(events == [.composing(true), .source("候補"), .composing(false)])
    }

    @Test
    func revealUsesTheCurrentBufferWithoutEditingOrRegisteringUndo() async throws {
        let original = "# 👩‍💻\r\n" + String(repeating: "本文\n", count: 120)
        let insertion = "新\n"
        let edited = insertion + original
        let nearEnd = NSRange(location: edited.utf16.count - 3, length: 2)
        var request: NSRange? = nearEnd
        var received: [String] = []
        var reported: [String] = []
        let editor = TextKitEditor(initialText: original, revealSourceSelection: { source in
            guard let range = request else { return nil }
            request = nil
            received.append(source)
            return range
        }) { reported.append($0) }
        let coordinator = editor.makeCoordinator()
        let scrollView = TextKitEditor.makeScrollView(initialText: original, coordinator: coordinator)
        let window = makeRevealWindow(containing: scrollView)
        defer { window.contentView = nil }
        let textView = try #require(scrollView.documentView as? NSTextView)
        let textLayoutManager = try #require(textView.textLayoutManager)
        let undoManager = try #require(textView.undoManager)

        textView.insertText(insertion, replacementRange: NSRange(location: 0, length: 0))
        // A reveal must not claim first responder, even if the editor is the selected tab.
        window.makeFirstResponder(nil)
        let previousScrollOffset = scrollView.contentView.bounds.minY
        window.reportsKey = true
        postWindowAvailability(NSWindow.didBecomeKeyNotification, for: window)
        #expect(received.isEmpty, "AppKit transitions must finish before consuming a reveal.")
        await drainRevealChecks()

        #expect(received.map { Array($0.utf8) } == [Array(edited.utf8)])
        #expect(textView.selectedRange() == nearEnd)
        #expect(scrollView.contentView.bounds.minY > previousScrollOffset)
        #expect(textView.string.utf8.elementsEqual(edited.utf8))
        #expect(reported == [edited])
        #expect(window.firstResponder === window)
        undoManager.undo()
        #expect(textView.string == original)
        #expect(undoManager.canRedo)

        // Revealing the end of the original must neither add undo nor clear redo.
        request = NSRange(location: original.utf16.count, length: 0)
        coordinator.scheduleSourceReveal()
        await drainRevealChecks()
        #expect(textView.selectedRange() == NSRange(location: original.utf16.count, length: 0))
        #expect(undoManager.canUndo == false)
        #expect(undoManager.canRedo)
        #expect(reported == [edited, original])
        #expect(textView.textLayoutManager === textLayoutManager)
    }

    @Test(arguments: [true, false])
    func revealWaitsForBothSheetEndAndKeyWindow(sheetEndsFirst: Bool) async throws {
        var attempts = 0
        let coordinator = TextKitEditor.Coordinator(revealSourceSelection: { _ in
            attempts += 1
            return NSRange(location: 2, length: 0)
        }) { _ in Issue.record("A reveal must not report an edit.") }
        let scrollView = TextKitEditor.makeScrollView(initialText: "原稿", isReadOnly: true, coordinator: coordinator)
        let window = makeRevealWindow(containing: scrollView)
        defer { window.contentView = nil }
        let unrelatedWindow = makeRevealWindow(containing: NSView())
        window.simulatedSheet = unrelatedWindow
        let textView = try #require(scrollView.documentView as? NSTextView)
        let selection = NSRange(location: 0, length: 1)
        textView.setSelectedRange(selection)

        if sheetEndsFirst {
            window.simulatedSheet = nil
            postWindowAvailability(NSWindow.didEndSheetNotification, for: window)
        } else {
            window.reportsKey = true
            postWindowAvailability(NSWindow.didBecomeKeyNotification, for: window)
        }
        await drainRevealChecks()
        #expect(attempts == 0)
        #expect(textView.selectedRange() == selection)

        window.simulatedSheet = nil
        window.reportsKey = true
        let finalEvent = sheetEndsFirst ? NSWindow.didBecomeKeyNotification : NSWindow.didEndSheetNotification
        postWindowAvailability(finalEvent, for: unrelatedWindow)
        await drainRevealChecks()
        #expect(attempts == 0, "An unrelated window must not trigger a reveal.")
        #expect(textView.selectedRange() == selection)

        postWindowAvailability(finalEvent, for: window)
        await drainRevealChecks()
        #expect(attempts == 1)
        #expect(textView.selectedRange() == NSRange(location: 2, length: 0))
        #expect(textView.isEditable == false)
    }

    @Test
    func inactiveLockedAndComposingEditorsDoNotConsumeRevealRequests() async throws {
        let policy = EditPolicy()
        var received: [String] = []
        let coordinator = TextKitEditor.Coordinator(canEdit: { policy.permitsEdits }, revealSourceSelection: { source in
            received.append(source)
            return NSRange(location: 0, length: 0)
        }) { _ in }
        let scrollView = TextKitEditor.makeScrollView(initialText: "原稿", isActive: false, coordinator: coordinator)
        let window = makeRevealWindow(containing: scrollView)
        defer { window.contentView = nil }
        window.reportsKey = true
        let textView = try #require(scrollView.documentView as? NSTextView)
        let selection = NSRange(location: 1, length: 0)
        textView.setSelectedRange(selection)

        coordinator.scheduleSourceReveal()
        await drainRevealChecks()
        #expect(received.isEmpty)
        #expect(textView.selectedRange() == selection)

        TextKitEditor.setActive(true, in: scrollView)
        policy.permitsEdits = false
        coordinator.scheduleSourceReveal()
        await drainRevealChecks()
        #expect(received.isEmpty)
        #expect(textView.selectedRange() == selection)

        policy.permitsEdits = true
        setMarkedText("候補", in: textView)
        try #require(textView.hasMarkedText())
        let markedSelection = textView.selectedRange()
        coordinator.scheduleSourceReveal()
        await drainRevealChecks()
        #expect(received.isEmpty)
        #expect(textView.hasMarkedText())
        #expect(textView.selectedRange() == markedSelection)

        textView.unmarkText()
        await drainRevealChecks()
        #expect(received == ["原候補稿"])
        #expect(textView.selectedRange() == NSRange(location: 0, length: 0))
    }

    @Test(arguments: [NSRange(location: -1, length: 0), NSRange(location: Int.max, length: 1),
                      NSRange(location: 2, length: 0), NSRange(location: 3, length: 0),
                      NSRange(location: 7, length: 0), NSRange(location: 9, length: 0),
                      NSRange(location: 12, length: 0), NSRange(location: 1, length: 2),
                      NSRange(location: 1, length: Int.max), NSRange(location: 1, length: -1)])
    func invalidOrNonBoundaryUTF16RangesDoNotChangeSelection(range: NSRange) async throws {
        // Offsets include a surrogate half, a ZWJ sequence, a combining mark and CRLF.
        let source = "a👩‍💻e\u{0301}\r\nz"
        var asked = false
        let coordinator = TextKitEditor.Coordinator(revealSourceSelection: { _ in
            asked = true
            return range
        }) { _ in Issue.record("A reveal must not report an edit.") }
        let scrollView = TextKitEditor.makeScrollView(initialText: source, coordinator: coordinator)
        let window = makeRevealWindow(containing: scrollView)
        defer { window.contentView = nil }
        let textView = try #require(scrollView.documentView as? NSTextView)
        let selection = NSRange(location: 0, length: 1)
        textView.setSelectedRange(selection)
        window.reportsKey = true
        postWindowAvailability(NSWindow.didBecomeKeyNotification, for: window)
        await drainRevealChecks()

        #expect(asked)
        #expect(textView.selectedRange() == selection)
        #expect(textView.string.utf8.elementsEqual(source.utf8))
    }

    @Test
    func dismantlingDropsAQueuedRevealAndStopsWindowObservation() async {
        let coordinator = TextKitEditor.Coordinator(revealSourceSelection: { _ in
            Issue.record("A dismantled editor must not consume a request.")
            return NSRange(location: 0, length: 0)
        }) { _ in }
        let scrollView = TextKitEditor.makeScrollView(initialText: "原稿", coordinator: coordinator)
        let window = makeRevealWindow(containing: scrollView)
        defer { window.contentView = nil }
        window.reportsKey = true
        postWindowAvailability(NSWindow.didBecomeKeyNotification, for: window)
        TextKitEditor.dismantleNSView(scrollView, coordinator: coordinator)
        postWindowAvailability(NSWindow.didEndSheetNotification, for: window)
        await drainRevealChecks()
    }

    @MainActor
    private final class HeadlessRevealWindow: NSWindow {
        var reportsKey = false
        var simulatedSheet: NSWindow?
        override var isKeyWindow: Bool { reportsKey }
        override var attachedSheet: NSWindow? { simulatedSheet }
    }

    private func makeRevealWindow(containing view: NSView) -> HeadlessRevealWindow {
        let frame = NSRect(x: 0, y: 0, width: 360, height: 240)
        let window = HeadlessRevealWindow(contentRect: frame, styleMask: [.titled], backing: .buffered, defer: true)
        view.frame = frame
        window.contentView = view
        return window
    }

    private func postWindowAvailability(_ name: Notification.Name, for window: NSWindow) {
        NotificationCenter.default.post(name: name, object: window)
    }

    private func drainRevealChecks() async {
        await withCheckedContinuation { continuation in
            DispatchQueue.main.async { continuation.resume() }
        }
    }

    @MainActor
    private final class EditPolicy {
        var permitsEdits = true
    }

    private enum EditorEvent: Equatable {
        case composing(Bool)
        case source(String)
    }

    private var implicitRange: NSRange { NSRange(location: NSNotFound, length: 0) }

    private func setMarkedText(_ text: String, in textView: NSTextView) {
        textView.setMarkedText(text, selectedRange: NSRange(location: text.utf16.count, length: 0), replacementRange: implicitRange)
    }

    private func resizeEditor(_ scrollView: NSScrollView, width: CGFloat) {
        scrollView.setFrameSize(NSSize(width: width, height: 240))
        scrollView.layoutSubtreeIfNeeded()
    }

    private func makeWindow(containing view: NSView) -> NSWindow {
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 360, height: 240),
            styleMask: [.titled],
            backing: .buffered,
            defer: true
        )
        // Attach the editor to a responder chain without ever displaying the window.
        window.contentView = view
        return window
    }
}
