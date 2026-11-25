import AppKit
import SwiftUI

@MainActor
private final class MarkdownTextView: NSTextView {
    weak var editorCoordinator: TextKitEditor.Coordinator?
    private lazy var editorUndoManager = EditorUndoManager(textView: self)
    private var isActive = true
    private var isReadOnly = false
    private(set) var textInputDepth = 0

    private var policyAllowsEdits: Bool { editorCoordinator?.canEdit() ?? true }
    private var canMutate: Bool { isEditable && policyAllowsEdits }
    fileprivate var canApplyUndo: Bool { !isReadOnly && policyAllowsEdits }
    fileprivate var canRevealSource: Bool {
        guard isActive, isSelectable, textInputDepth == 0, !hasMarkedText(),
              let window, window.isKeyWindow, window.attachedSheet == nil else { return false }
        return policyAllowsEdits
    }
    // AppKit can reinsert the existing characters from inside unmarkText().
    private var canContinueTextInput: Bool { isEditable && (textInputDepth > 0 || policyAllowsEdits) }

    override var undoManager: UndoManager? { isReadOnly ? nil : editorUndoManager }
    override var acceptsFirstResponder: Bool { isActive && super.acceptsFirstResponder }
    override var readablePasteboardTypes: [NSPasteboard.PasteboardType] { [.string] }
    override var acceptableDragTypes: [NSPasteboard.PasteboardType] { [] }

    func setActive(_ active: Bool, readOnly: Bool) {
        let activationChanged = isActive != active
        guard activationChanged || isReadOnly != readOnly else { return }
        isActive = active
        isReadOnly = readOnly
        // Leave isSelectable alone so the inactive tab keeps its selection.
        isEditable = active && !readOnly
        allowsUndo = !readOnly
        if active {
            if activationChanged { window?.makeFirstResponder(self) }
        } else if let window, window.firstResponder === self {
            window.makeFirstResponder(nil)
        }
    }

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        if isActive { window?.makeFirstResponder(self) }
        editorCoordinator?.observeRevealWindow(window)
    }

    override func shouldChangeText(inRanges affectedRanges: [NSValue], replacementStrings: [String]?) -> Bool {
        guard canContinueTextInput else { return false }
        return super.shouldChangeText(inRanges: affectedRanges, replacementStrings: replacementStrings)
    }

    override func cut(_ sender: Any?) {
        // Refuse before AppKit can copy the selection to the pasteboard.
        guard canMutate else { return }
        super.cut(sender)
    }

    override func readSelection(from pboard: NSPasteboard, type: NSPasteboard.PasteboardType) -> Bool {
        guard canMutate, type == .string else { return false }
        return super.readSelection(from: pboard, type: type)
    }

    override func setMarkedText(_ string: Any, selectedRange: NSRange, replacementRange: NSRange) {
        guard canMutate else { return }
        textInputDepth += 1
        defer { finishTextInput() }
        super.setMarkedText(string, selectedRange: selectedRange, replacementRange: replacementRange)
    }

    override func insertText(_ string: Any, replacementRange: NSRange) {
        guard canContinueTextInput else { return }
        textInputDepth += 1
        defer { finishTextInput() }
        super.insertText(string, replacementRange: replacementRange)
    }

    override func unmarkText() {
        // Ending an existing composition must still report any committed source.
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

@MainActor
private final class EditorUndoManager: UndoManager {
    private weak var textView: MarkdownTextView?

    init(textView: MarkdownTextView) {
        self.textView = textView
        super.init()
    }

    // TextKit undo can edit storage directly; check even if the caller already holds this manager.
    private var canApply: Bool { textView?.canApplyUndo == true }
    override var canUndo: Bool { canApply && super.canUndo }
    override var canRedo: Bool { canApply && super.canRedo }

    override func undo() {
        guard canApply else { return }
        super.undo()
    }

    override func redo() {
        guard canApply else { return }
        super.redo()
    }
}

/// An in-memory Markdown source editor. AppKit owns the editing buffer and undo history.
@MainActor
public struct TextKitEditor: NSViewRepresentable {
    private let initialText: String
    private let isActive: Bool
    private let isReadOnly: Bool
    private let canEdit: @MainActor () -> Bool
    private let onCompositionChange: (Bool) -> Void
    private let revealSourceLocation: @MainActor (String) -> Int?
    private let onChange: (String) -> Void

    /// `initialText` seeds one SwiftUI identity; subsequent updates do not replace the buffer.
    /// `isActive` enables editing and requests native focus on activation. Inactive editors
    /// retain selection and undo history; the caller controls visibility and hit testing.
    /// `isReadOnly` lets an active tab select and copy its source without editing.
    /// `canEdit` is checked synchronously before native edits and Undo/Redo, without
    /// changing the selection or history. Only block edits when no composition is active.
    /// Keep the editor active, and block tab switches/new tabs, from `onCompositionChange(true)`
    /// until `onCompositionChange(false)`.
    ///
    /// `revealSourceLocation` may consume a pending request using the current native buffer.
    /// It is asked after view updates or native availability changes, only while the editor
    /// is active, selectable, unlocked, not composing, and in a key window without a sheet.
    /// Return a UTF-16 offset at a character boundary to move the caret and scroll, or nil.
    /// Navigation does not focus or edit the view and creates no undo operation.
    ///
    /// Edit and composition callbacks are synchronous on the main actor, only while attached to a window.
    /// `onChange` reports committed source (including Undo/Redo), never marked candidates.
    /// If composition changes the source, `onChange` precedes `onCompositionChange(false)`.
    /// Identical UTF-8 bytes do not produce another `onChange`.
    /// No callbacks are sent for seeding or dismantling.
    public init(
        initialText: String,
        isActive: Bool = true,
        isReadOnly: Bool = false,
        canEdit: @escaping @MainActor () -> Bool = { true },
        onCompositionChange: @escaping (Bool) -> Void = { _ in },
        revealSourceLocation: @escaping @MainActor (String) -> Int? = { _ in nil },
        onChange: @escaping (String) -> Void
    ) {
        self.initialText = initialText
        self.isActive = isActive
        self.isReadOnly = isReadOnly
        self.canEdit = canEdit
        self.onCompositionChange = onCompositionChange
        self.revealSourceLocation = revealSourceLocation
        self.onChange = onChange
    }

    public func makeCoordinator() -> Coordinator {
        Coordinator(canEdit: canEdit, onCompositionChange: onCompositionChange,
                    revealSourceLocation: revealSourceLocation, onChange: onChange)
    }

    public func makeNSView(context: Context) -> NSScrollView {
        Self.makeScrollView(initialText: initialText, isActive: isActive, isReadOnly: isReadOnly, coordinator: context.coordinator)
    }

    public func updateNSView(_ nsView: NSScrollView, context: Context) {
        // Replacing the buffer here would disturb selection, undo and marked text.
        context.coordinator.canEdit = canEdit
        context.coordinator.onCompositionChange = onCompositionChange
        context.coordinator.revealSourceLocation = revealSourceLocation
        context.coordinator.onChange = onChange
        Self.setActive(isActive, in: nsView, readOnly: isReadOnly)
        context.coordinator.scheduleSourceReveal()
    }

    public static func dismantleNSView(_ nsView: NSScrollView, coordinator: Coordinator) {
        coordinator.stopObserving()
    }

    static func setActive(_ isActive: Bool, in scrollView: NSScrollView, readOnly: Bool = false) {
        (scrollView.documentView as? MarkdownTextView)?.setActive(isActive, readOnly: readOnly)
    }

    static func makeScrollView(
        initialText: String, isActive: Bool = true, isReadOnly: Bool = false, coordinator: Coordinator?
    ) -> NSScrollView {
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
        textView.setActive(isActive, readOnly: isReadOnly)
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
        fileprivate var canEdit: @MainActor () -> Bool
        fileprivate var onCompositionChange: (Bool) -> Void
        fileprivate var revealSourceLocation: @MainActor (String) -> Int?
        fileprivate var onChange: (String) -> Void
        private weak var textView: MarkdownTextView?
        private weak var revealWindow: NSWindow?
        private var revealScheduled = false
        private var lastCommittedSource = ""
        private var isComposing = false

        init(
            canEdit: @escaping @MainActor () -> Bool = { true },
            onCompositionChange: @escaping (Bool) -> Void = { _ in },
            revealSourceLocation: @escaping @MainActor (String) -> Int? = { _ in nil },
            onChange: @escaping (String) -> Void
        ) {
            self.canEdit = canEdit
            self.onCompositionChange = onCompositionChange
            self.revealSourceLocation = revealSourceLocation
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
            observeRevealWindow(textView.window)
        }

        fileprivate func stopObserving() {
            textView?.editorCoordinator = nil
            textView = nil
            observeRevealWindow(nil)
            NotificationCenter.default.removeObserver(self, name: NSTextStorage.didProcessEditingNotification, object: nil)
        }

        fileprivate func observeRevealWindow(_ window: NSWindow?) {
            guard revealWindow !== window else { return }
            let center = NotificationCenter.default
            // Scope observation to the host window and remove it on reparenting or teardown.
            for name in [NSWindow.didEndSheetNotification, NSWindow.didBecomeKeyNotification] {
                center.removeObserver(self, name: name, object: revealWindow)
                if let window {
                    center.addObserver(self, selector: #selector(windowAvailabilityChanged(_:)), name: name, object: window)
                }
            }
            revealWindow = window
            if window != nil { scheduleSourceReveal() }
        }

        @objc private func windowAvailabilityChanged(_ notification: Notification) {
            guard let window = notification.object as? NSWindow, window === textView?.window else { return }
            scheduleSourceReveal()
        }

        func scheduleSourceReveal() {
            guard textView?.window != nil, !revealScheduled else { return }
            revealScheduled = true
            // Let SwiftUI finish updating and AppKit finish the native transition before
            // invoking a callback that may consume observable state. Read nothing stale.
            DispatchQueue.main.async { [weak self] in
                guard let self else { return }
                self.revealScheduled = false
                self.revealSourceLocationIfAvailable()
            }
        }

        private func revealSourceLocationIfAvailable() {
            guard let textView, textView.canRevealSource else { return }
            let source = textView.string
            guard let offset = revealSourceLocation(source), offset >= 0 else { return }
            let utf16 = source.utf16
            guard offset <= utf16.count,
                  String.Index(utf16.index(utf16.startIndex, offsetBy: offset), within: source) != nil,
                  self.textView === textView, textView.canRevealSource,
                  textView.string.utf8.elementsEqual(source.utf8) else { return }
            let caret = NSRange(location: offset, length: 0)
            textView.setSelectedRange(caret)
            textView.scrollRangeToVisible(caret)
        }

        fileprivate func didFinishTextInput() {
            guard let textView, textView.window != nil else { return }
            let hasMarkedText = textView.hasMarkedText()
            if hasMarkedText == false { publishSource(textView.string) }
            guard isComposing != hasMarkedText, self.textView?.window != nil else { return }
            isComposing = hasMarkedText
            onCompositionChange(hasMarkedText)
            if !hasMarkedText { scheduleSourceReveal() }
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
