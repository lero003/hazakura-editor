import AppKit
import SwiftUI

@MainActor
private final class MarkdownTextView: NSTextView {
    weak var editorCoordinator: TextKitEditor.Coordinator?
    private let editorUndoManager = UndoManager()
    private var isActive = true
    private(set) var textInputDepth = 0

    override var undoManager: UndoManager? { editorUndoManager }
    override var acceptsFirstResponder: Bool { isActive && super.acceptsFirstResponder }
    override var readablePasteboardTypes: [NSPasteboard.PasteboardType] { [.string] }
    override var acceptableDragTypes: [NSPasteboard.PasteboardType] { [] }

    func setActive(_ active: Bool) {
        guard isActive != active else { return }
        isActive = active
        // Leave isSelectable alone so the inactive tab keeps its selection.
        isEditable = active
        if active {
            window?.makeFirstResponder(self)
        } else if let window, window.firstResponder === self {
            window.makeFirstResponder(nil)
        }
    }

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        if isActive { window?.makeFirstResponder(self) }
    }

    override func readSelection(from pboard: NSPasteboard, type: NSPasteboard.PasteboardType) -> Bool {
        guard type == .string else { return false }
        return super.readSelection(from: pboard, type: type)
    }

    override func setMarkedText(_ string: Any, selectedRange: NSRange, replacementRange: NSRange) {
        textInputDepth += 1
        defer { finishTextInput() }
        super.setMarkedText(string, selectedRange: selectedRange, replacementRange: replacementRange)
    }

    override func insertText(_ string: Any, replacementRange: NSRange) {
        textInputDepth += 1
        defer { finishTextInput() }
        super.insertText(string, replacementRange: replacementRange)
    }

    override func unmarkText() {
        textInputDepth += 1
        defer { finishTextInput() }
        super.unmarkText()
    }

    private func finishTextInput() {
        textInputDepth -= 1
        // AppKit may call one text input hook from another. Only the outer operation
        // sees the final buffer and marked state, even when unmark edits no characters.
        if textInputDepth == 0 { editorCoordinator?.didFinishTextInput() }
    }
}

/// An in-memory Markdown source editor. AppKit owns the editing buffer and undo history.
@MainActor
public struct TextKitEditor: NSViewRepresentable {
    private let initialText: String
    private let isActive: Bool
    private let onCompositionChange: (Bool) -> Void
    private let onChange: (String) -> Void

    /// `initialText` seeds one SwiftUI identity; subsequent updates do not replace the buffer.
    /// `isActive` enables editing and requests native focus on activation. Inactive editors
    /// retain selection and undo history; the caller controls visibility and hit testing.
    /// Keep the editor active, and block tab switches/new tabs, from `onCompositionChange(true)`
    /// until `onCompositionChange(false)`.
    ///
    /// Both callbacks are synchronous on the main actor, only while attached to a window.
    /// `onChange` reports committed source (including Undo/Redo), never marked candidates.
    /// If composition changes the source, `onChange` precedes `onCompositionChange(false)`.
    /// Identical UTF-8 bytes do not produce another `onChange`.
    /// No callbacks are sent for seeding or dismantling.
    public init(
        initialText: String,
        isActive: Bool = true,
        onCompositionChange: @escaping (Bool) -> Void = { _ in },
        onChange: @escaping (String) -> Void
    ) {
        self.initialText = initialText
        self.isActive = isActive
        self.onCompositionChange = onCompositionChange
        self.onChange = onChange
    }

    public func makeCoordinator() -> Coordinator {
        Coordinator(onCompositionChange: onCompositionChange, onChange: onChange)
    }

    public func makeNSView(context: Context) -> NSScrollView {
        Self.makeScrollView(initialText: initialText, isActive: isActive, coordinator: context.coordinator)
    }

    public func updateNSView(_ nsView: NSScrollView, context: Context) {
        // Replacing the buffer here would disturb selection, undo and marked text.
        context.coordinator.onCompositionChange = onCompositionChange
        context.coordinator.onChange = onChange
        Self.setActive(isActive, in: nsView)
    }

    public static func dismantleNSView(_ nsView: NSScrollView, coordinator: Coordinator) {
        coordinator.stopObserving()
    }

    static func setActive(_ isActive: Bool, in scrollView: NSScrollView) {
        (scrollView.documentView as? MarkdownTextView)?.setActive(isActive)
    }

    static func makeScrollView(initialText: String, isActive: Bool = true, coordinator: Coordinator?) -> NSScrollView {
        let scrollView = NSScrollView()
        scrollView.hasVerticalScroller = true
        scrollView.autohidesScrollers = true

        let textView = MarkdownTextView(usingTextLayoutManager: true)
        textView.isEditable = true
        textView.isSelectable = true
        textView.allowsUndo = true
        textView.isRichText = false
        textView.importsGraphics = false
        textView.usesFontPanel = false
        textView.usesRuler = false
        textView.isAutomaticQuoteSubstitutionEnabled = false
        textView.isAutomaticDashSubstitutionEnabled = false
        textView.isAutomaticTextReplacementEnabled = false
        textView.isAutomaticSpellingCorrectionEnabled = false
        textView.isContinuousSpellCheckingEnabled = false
        textView.isGrammarCheckingEnabled = false
        textView.isAutomaticLinkDetectionEnabled = false
        textView.isAutomaticDataDetectionEnabled = false
        textView.smartInsertDeleteEnabled = false
        textView.inlinePredictionType = .no
        textView.mathExpressionCompletionType = .no
        textView.writingToolsBehavior = .none

        textView.font = .monospacedSystemFont(ofSize: NSFont.systemFontSize, weight: .regular)
        textView.textContainerInset = NSSize(width: 12, height: 12)
        textView.isVerticallyResizable = true
        textView.isHorizontallyResizable = false
        let unbounded = CGFloat.greatestFiniteMagnitude
        textView.maxSize = NSSize(width: unbounded, height: unbounded)
        textView.autoresizingMask = [.width]
        textView.textContainer?.widthTracksTextView = true

        textView.string = initialText
        textView.setActive(isActive)
        scrollView.documentView = textView

        // Inspect the TextKit 2 properties only; accessing the legacy manager forces compatibility mode.
        guard textView.textLayoutManager != nil, let storage = textView.textContentStorage?.textStorage else {
            preconditionFailure("The Markdown editor requires TextKit 2.")
        }
        coordinator?.observeEdits(in: textView, storage: storage)
        return scrollView
    }

    @MainActor
    public final class Coordinator: NSObject {
        fileprivate var onCompositionChange: (Bool) -> Void
        fileprivate var onChange: (String) -> Void
        private weak var textView: MarkdownTextView?
        private var lastCommittedSource = ""
        private var isComposing = false

        init(onCompositionChange: @escaping (Bool) -> Void = { _ in }, onChange: @escaping (String) -> Void) {
            self.onCompositionChange = onCompositionChange
            self.onChange = onChange
        }

        fileprivate func observeEdits(in textView: MarkdownTextView, storage: NSTextStorage) {
            self.textView = textView
            textView.editorCoordinator = self
            lastCommittedSource = storage.string

            // TextKit 2 undo/redo can change the storage without sending NSTextView's edit notification.
            NotificationCenter.default.addObserver(
                self,
                selector: #selector(didProcessEditing(_:)),
                name: NSTextStorage.didProcessEditingNotification,
                object: storage
            )
        }

        fileprivate func stopObserving() {
            textView?.editorCoordinator = nil
            textView = nil
            NotificationCenter.default.removeObserver(self, name: NSTextStorage.didProcessEditingNotification, object: nil)
        }

        fileprivate func didFinishTextInput() {
            guard let textView, textView.window != nil else { return }
            let hasMarkedText = textView.hasMarkedText()
            if hasMarkedText == false { publishSource(textView.string) }
            guard isComposing != hasMarkedText, self.textView?.window != nil else { return }
            isComposing = hasMarkedText
            onCompositionChange(hasMarkedText)
        }

        @objc private func didProcessEditing(_ notification: Notification) {
            guard let textView, textView.window != nil, textView.textInputDepth == 0,
                  isComposing == false, textView.hasMarkedText() == false,
                  let storage = notification.object as? NSTextStorage,
                  storage.editedMask.contains(.editedCharacters) else { return }
            publishSource(storage.string)
        }

        private func publishSource(_ source: String) {
            // Swift String equality treats canonically equivalent spellings as equal; Markdown bytes do not.
            guard source.utf8.elementsEqual(lastCommittedSource.utf8) == false else { return }
            lastCommittedSource = source
            onChange(source)
        }
    }
}
