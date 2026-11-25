import AppKit
import Testing
@testable import HazakuraNextEditor

@MainActor
struct ReviewedEditTests {
    @Test
    func capturesTheFocusedNativeSelectionWithExactSourceBytesAndEditorIdentity() throws {
        let documentID = UUID()
        let selected = "e\u{0301}👩‍💻\r\n"
        let source = "前" + selected + "後"
        let coordinator = TextKitEditor.Coordinator { _ in Issue.record("Capturing selection reported an edit.") }
        let (window, _, view) = try makeEditor(source: source, documentID: documentID, coordinator: coordinator)
        defer { window.contentView = nil }
        let undo = try #require(view.undoManager)
        let range = NSRange(location: 1, length: selected.utf16.count)
        view.setSelectedRange(range)

        let capture = try #require(TextKitEditor.captureReviewedSelection(in: window, documentID: documentID))
        #expect(capture.source.utf8.elementsEqual(source.utf8))
        #expect(capture.range == range)
        #expect(capture.editor === view)
        #expect(view.selectedRange() == range)
        #expect(window.firstResponder === view)
        #expect(undo.canUndo == false)
        #expect(undo.canRedo == false)

        let caret = NSRange(location: NSMaxRange(range), length: 0)
        view.setSelectedRange(caret)
        try #require(view.selectedRange() == caret)
        #expect(TextKitEditor.captureReviewedSelection(in: window, documentID: documentID) == nil)
        let capturedSource = try #require(TextKitEditor.captureReviewedEdit(in: window, documentID: documentID))
        #expect(capturedSource.utf8.elementsEqual(source.utf8))
    }

    @Test
    func refusesSelectionCaptureForTheWrongDocumentWithoutFocusAndInReadOnlyMode() throws {
        let documentID = UUID()
        let (window, scroll, view) = try makeEditor(source: "原稿", documentID: documentID, coordinator: nil)
        defer { window.contentView = nil }
        let range = NSRange(location: 0, length: 1)
        view.setSelectedRange(range)
        try #require(TextKitEditor.captureReviewedSelection(in: window, documentID: documentID) != nil)
        #expect(TextKitEditor.captureReviewedSelection(in: window, documentID: UUID()) == nil)

        try #require(window.makeFirstResponder(nil))
        try #require(window.firstResponder !== view)
        try #require(view.selectedRange() == range)
        #expect(TextKitEditor.captureReviewedSelection(in: window, documentID: documentID) == nil)

        try #require(window.makeFirstResponder(view))
        try #require(TextKitEditor.captureReviewedSelection(in: window, documentID: documentID) != nil)
        TextKitEditor.setActive(true, in: scroll, readOnly: true)
        try #require(window.firstResponder === view)
        try #require(view.selectedRange() == range)
        #expect(TextKitEditor.captureReviewedSelection(in: window, documentID: documentID) == nil)
    }

    @Test
    func refusesNativeSelectionInsideMarkedText() throws {
        let documentID = UUID()
        let (window, _, view) = try makeEditor(source: "原稿", documentID: documentID, coordinator: nil)
        defer { window.contentView = nil }
        view.setMarkedText("候補", selectedRange: NSRange(location: 0, length: 2),
                           replacementRange: NSRange(location: 0, length: 1))
        try #require(view.hasMarkedText())
        try #require(view.selectedRanges.map(\.rangeValue) == [NSRange(location: 0, length: 2)])
        try #require(window.firstResponder === view)
        #expect(TextKitEditor.captureReviewedSelection(in: window, documentID: documentID) == nil)
        #expect(view.hasMarkedText())
    }

    @Test(arguments: ["\"literal\" -- `code`\r\n", "", "é"])
    func replacementIsLiteralAndHasItsOwnUndoBetweenTyping(replacement: String) throws {
        let documentID = UUID()
        let selected = "e\u{0301}"
        let suffix = "👩‍💻\r\n後"
        let original = "前" + selected + suffix
        let beforeReview = "前入" + selected + suffix
        let afterReview = "前入" + replacement + suffix
        let afterTyping = "前入" + replacement + "続" + suffix
        var changes: [[UInt8]] = []
        let coordinator = TextKitEditor.Coordinator { changes.append(Array($0.utf8)) }
        let (window, _, view) = try makeEditor(source: original, documentID: documentID, coordinator: coordinator)
        defer { window.contentView = nil }
        let layout = try #require(view.textLayoutManager)
        let undo = try #require(view.undoManager)
        view.insertText("入", replacementRange: NSRange(location: 1, length: 0))
        let captured = try #require(TextKitEditor.captureReviewedEdit(in: window, documentID: documentID))
        #expect(captured.utf8.elementsEqual(beforeReview.utf8))
        let selection = NSRange(location: 2, length: selected.utf16.count)
        // The reviewed target is not necessarily the current native selection.
        try #require(TextKitEditor.applyReviewedEdit(
            in: window, documentID: documentID, expectedSource: beforeReview, selection: selection,
            replacement: replacement, resultingSource: afterReview
        ))
        #expect(view.string.utf8.elementsEqual(afterReview.utf8))
        #expect(changes == [bytes(beforeReview), bytes(afterReview)])

        view.insertText("続", replacementRange: NSRange(location: 2 + replacement.utf16.count, length: 0))
        #expect(view.string.utf8.elementsEqual(afterTyping.utf8))
        for expected in [afterReview, beforeReview, original] {
            try #require(undo.canUndo)
            undo.undo()
            #expect(view.string.utf8.elementsEqual(expected.utf8))
        }
        #expect(undo.canUndo == false)
        for expected in [beforeReview, afterReview, afterTyping] {
            try #require(undo.canRedo)
            undo.redo()
            #expect(view.string.utf8.elementsEqual(expected.utf8))
        }
        #expect(undo.canRedo == false)
        #expect(changes == [beforeReview, afterReview, afterTyping, afterReview, beforeReview, original,
                            beforeReview, afterReview, afterTyping].map(bytes))
        #expect(window.firstResponder === view)
        #expect(view.textLayoutManager === layout)
        #expect(view.undoManager === undo)
    }

    @Test
    func refusesADelegateAndRevalidatesTheLiveTargetBeforeNativeUndoRegistration() throws {
        let documentID = UUID()
        let (window, _, view) = try makeEditor(source: "原稿", documentID: documentID, coordinator: nil)
        defer { window.contentView = nil }
        let undo = try #require(view.undoManager)
        let interception = InputInterception { true }
        view.delegate = interception
        expectUnavailable(in: window, id: documentID)
        #expect(interception.calls == 0)
        view.delegate = nil

        var checks = 0
        let selection = NSRange(location: 0, length: 1)
        #expect(TextKitEditor.applyReviewedEdit(
            in: window, documentID: documentID, expectedSource: "原稿", selection: selection,
            replacement: "別", resultingSource: "別稿", stillCurrent: {
                checks += 1
                expectUnavailable(in: window, id: documentID)
                return checks == 1
            }
        ) == false)
        #expect(checks == 2)
        #expect(view.string == "原稿")
        #expect(undo.canUndo == false)
        #expect(undo.canRedo == false)
    }

    @Test
    func ignoresMultiSelectionAndCanDeleteAnEntireCRLFExactly() throws {
        let documentID = UUID()
        let source = "a\r\nb"
        let (window, _, view) = try makeEditor(source: source, documentID: documentID, coordinator: nil)
        defer { window.contentView = nil }
        let undo = try #require(view.undoManager)
        let target = NSRange(location: 1, length: 2)
        let nativeSelections = [NSRange(location: 0, length: 1), NSRange(location: 3, length: 1)].map(NSValue.init(range:))
        view.selectedRanges = nativeSelections
        try #require(view.selectedRanges.count == 2)
        #expect(TextKitEditor.captureReviewedEdit(in: window, documentID: documentID) == nil)
        #expect(TextKitEditor.captureReviewedSelection(in: window, documentID: documentID) == nil)
        #expect(apply(in: window, id: documentID, source: source, range: target, replacement: "", result: "ab") == false)
        #expect(view.selectedRanges == nativeSelections)
        #expect(view.string.utf8.elementsEqual(source.utf8))
        #expect(undo.canUndo == false)

        view.setSelectedRange(NSRange(location: 0, length: 0))
        try #require(apply(in: window, id: documentID, source: source, range: target, replacement: "", result: "ab"))
        #expect(view.string == "ab")
        undo.undo()
        #expect(view.string.utf8.elementsEqual(source.utf8))
    }

    @Test
    func invalidRangesAndByteMismatchesDoNotChangeSourceSelectionOrHistory() throws {
        let documentID = UUID()
        let source = "a👩‍💻e\u{0301}\r\nz"
        let coordinator = TextKitEditor.Coordinator { _ in Issue.record("Rejected review reported an edit.") }
        let (window, _, view) = try makeEditor(source: source, documentID: documentID, coordinator: coordinator)
        defer { window.contentView = nil }
        let selection = NSRange(location: 10, length: 1)
        view.setSelectedRange(selection)
        let undo = try #require(view.undoManager)

        // Valid UTF-16 ranges can still split a grapheme (emoji, combining mark, CRLF).
        let invalidRanges = [NSRange(location: NSNotFound, length: 1), NSRange(location: -1, length: 1),
                             NSRange(location: 0, length: -1), NSRange(location: 1, length: Int.max),
                             NSRange(location: 0, length: 0), NSRange(location: 11, length: 1),
                             NSRange(location: 2, length: 4), NSRange(location: 1, length: 2),
                             NSRange(location: 6, length: 1), NSRange(location: 9, length: 1)]
        for range in invalidRanges {
            let candidate: String
            if range.location >= 0, range.location < source.utf16.count,
               range.length > 0, range.length <= source.utf16.count - range.location {
                candidate = (source as NSString).replacingCharacters(in: range, with: "b")
            } else {
                candidate = "b"
            }
            #expect(!apply(in: window, id: documentID, source: source, range: range, replacement: "b", result: candidate))
        }
        let first = NSRange(location: 0, length: 1)
        #expect(!apply(in: window, id: documentID, source: "a👩‍💻é\r\nz", range: first,
                       replacement: "b", result: "b👩‍💻é\r\nz"))
        #expect(!apply(in: window, id: documentID, source: source, range: first,
                       replacement: "b", result: "b👩‍💻é\r\nz"))
        #expect(!apply(in: window, id: documentID, source: source, range: first,
                       replacement: "a", result: source))
        #expect(view.string.utf8.elementsEqual(source.utf8))
        #expect(view.selectedRange() == selection)
        #expect(undo.canUndo == false)
        #expect(undo.canRedo == false)
    }

    @Test
    func requiresMatchingActiveEditorInTheRequestedWindowAndNothingElseAsFirstResponder() throws {
        let documentID = UUID()
        let id2 = UUID()
        let source = "原稿"
        let coordinator = TextKitEditor.Coordinator { _ in Issue.record("Rejected review reported an edit.") }
        let (window, scroll, view) = try makeEditor(source: source, documentID: documentID, coordinator: coordinator)
        defer { window.contentView = nil }
        let (otherWindow, _, otherView) = try makeEditor(source: source, documentID: id2, coordinator: coordinator)
        defer { otherWindow.contentView = nil }
        try #require(window.firstResponder === view)
        try #require(otherWindow.firstResponder === otherView)
        #expect(window.isKeyWindow == false)
        #expect(TextKitEditor.captureReviewedEdit(in: window, documentID: documentID) == source)
        expectUnavailable(in: window, id: id2)
        expectUnavailable(in: otherWindow, id: documentID)

        _ = window.makeFirstResponder(nil)
        expectUnavailable(in: window, id: documentID)
        try #require(window.makeFirstResponder(view))
        TextKitEditor.setActive(false, in: scroll)
        // Simulate a stale responder after deactivation or reparenting.
        window.simulatedFirstResponder = view
        expectUnavailable(in: window, id: documentID)
        TextKitEditor.setActive(true, in: scroll)
        window.contentView = nil
        try #require(view.window == nil)
        expectUnavailable(in: window, id: documentID)

        let (unboundWindow, _, _) = try makeEditor(source: source, documentID: nil, coordinator: nil)
        defer { unboundWindow.contentView = nil }
        expectUnavailable(in: unboundWindow, id: documentID)
    }

    @Test
    func refusesReadOnlyLockedMarkedAndSheetEditsOrUnavailableUndoRegistration() throws {
        let documentID = UUID()
        let policy = EditPolicy()
        let coordinator = TextKitEditor.Coordinator(canEdit: { policy.permitsEdits }) { _ in
            Issue.record("Rejected review reported an edit.")
        }
        let (window, scroll, view) = try makeEditor(source: "原稿", documentID: documentID, coordinator: coordinator)
        defer { window.contentView = nil }
        try #require(window.firstResponder === view)
        let undo = try #require(view.undoManager)
        TextKitEditor.setActive(true, in: scroll, readOnly: true)
        expectUnavailable(in: window, id: documentID)
        TextKitEditor.setActive(true, in: scroll, readOnly: false)

        policy.permitsEdits = false
        expectUnavailable(in: window, id: documentID)
        policy.permitsEdits = true
        view.allowsUndo = false
        expectUnavailable(in: window, id: documentID)
        view.allowsUndo = true
        undo.disableUndoRegistration()
        expectUnavailable(in: window, id: documentID)
        undo.enableUndoRegistration()

        let sheet = HeadlessWindow(contentRect: .zero, styleMask: [.titled], backing: .buffered, defer: true)
        window.simulatedSheet = sheet
        expectUnavailable(in: window, id: documentID)
        window.simulatedSheet = nil
        #expect(view.string == "原稿")
        #expect(undo.canUndo == false)
        view.setMarkedText("候補", selectedRange: NSRange(location: 2, length: 0),
                           replacementRange: NSRange(location: 0, length: 1))
        try #require(view.hasMarkedText())
        let markedSelection = view.selectedRange()
        #expect(TextKitEditor.captureReviewedEdit(in: window, documentID: documentID) == nil)
        #expect(!apply(in: window, id: documentID, source: "候補稿", range: NSRange(location: 0, length: 2),
                       replacement: "別", result: "別稿"))
        #expect(view.string == "候補稿")
        #expect(view.selectedRange() == markedSelection)
        #expect(view.hasMarkedText())
    }

    @Test
    func refusesReviewedEditsInsideNativeTextInputAndUndoRedoOperations() throws {
        let documentID = UUID()
        let (window, _, view) = try makeEditor(source: "原稿", documentID: documentID, coordinator: nil)
        defer { window.contentView = nil }
        let undo = try #require(view.undoManager)
        let interception = InputInterception {
            // Isolate the native input-depth gate from the independent delegate gate.
            view.delegate = nil
            expectUnavailable(in: window, id: documentID)
            return false
        }
        view.delegate = interception
        view.insertText("新", replacementRange: NSRange(location: 0, length: 1))
        #expect(interception.calls == 1)
        #expect(view.string == "原稿")

        let target = UndoTarget()
        undo.registerUndo(withTarget: target) { _ in
            MainActor.assumeIsolated {
                target.calls += 1
                #expect(undo.isUndoing)
                self.expectUnavailable(in: window, id: documentID)
                undo.registerUndo(withTarget: target) { _ in
                    MainActor.assumeIsolated {
                        target.calls += 1
                        #expect(undo.isRedoing)
                        self.expectUnavailable(in: window, id: documentID)
                    }
                }
            }
        }
        undo.undo()
        undo.redo()
        #expect(target.calls == 2)
        #expect(view.string == "原稿")
        #expect(TextKitEditor.captureReviewedEdit(in: window, documentID: documentID) == "原稿")
    }

    private func bytes(_ source: String) -> [UInt8] { Array(source.utf8) }

    private func apply(in window: NSWindow, id: UUID, source: String, range: NSRange,
                       replacement: String, result: String) -> Bool {
        TextKitEditor.applyReviewedEdit(in: window, documentID: id, expectedSource: source,
                                        selection: range, replacement: replacement, resultingSource: result)
    }

    private func expectUnavailable(in window: NSWindow, id: UUID, sourceLocation: SourceLocation = #_sourceLocation) {
        #expect(TextKitEditor.captureReviewedEdit(in: window, documentID: id) == nil, sourceLocation: sourceLocation)
        #expect(!apply(in: window, id: id, source: "原稿", range: NSRange(location: 0, length: 1),
                       replacement: "別", result: "別稿"), sourceLocation: sourceLocation)
    }

    private func makeEditor(source: String, documentID: UUID?, coordinator: TextKitEditor.Coordinator?) throws
        -> (HeadlessWindow, NSScrollView, NSTextView) {
        let scroll = TextKitEditor.makeScrollView(initialText: source, documentID: documentID, coordinator: coordinator)
        let view = try #require(scroll.documentView as? NSTextView)
        let frame = NSRect(x: 0, y: 0, width: 360, height: 240)
        let window = HeadlessWindow(contentRect: frame, styleMask: [.titled], backing: .buffered, defer: true)
        scroll.frame = frame
        window.contentView = scroll
        return (window, scroll, view)
    }

    private final class HeadlessWindow: NSWindow {
        var simulatedSheet: NSWindow?
        weak var simulatedFirstResponder: NSResponder?
        override var attachedSheet: NSWindow? { simulatedSheet }
        override var firstResponder: NSResponder? { simulatedFirstResponder ?? super.firstResponder }
    }

    private final class InputInterception: NSObject, NSTextViewDelegate {
        var calls = 0
        let onInput: @MainActor () -> Bool

        init(onInput: @escaping @MainActor () -> Bool) { self.onInput = onInput }

        func textView(_ textView: NSTextView, shouldChangeTextIn affectedCharRange: NSRange,
                      replacementString: String?) -> Bool {
            calls += 1
            return onInput()
        }
    }

    private final class UndoTarget {
        var calls = 0
    }

    private final class EditPolicy {
        var permitsEdits = true
    }
}
