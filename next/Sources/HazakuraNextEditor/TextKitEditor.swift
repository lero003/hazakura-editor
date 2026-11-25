import AppKit
import SwiftUI

@MainActor
private final class MarkdownTextView: NSTextView {
    weak var editorCoordinator: TextKitEditor.Coordinator?
    private lazy var editorUndoManager = EditorUndoManager(textView: self)
    private var documentID: UUID?
    private var isActive = true
    private var isReadOnly = false
    private var isDismantled = false
    private var reviewedEditValidation: (([NSValue], [String]?) -> Bool)?
    private var textInputDepth = 0
    var isProcessingEdit: Bool { textInputDepth > 0 || reviewedEditValidation != nil }

    static func make(documentID: UUID?) -> MarkdownTextView {
        let textView = MarkdownTextView(usingTextLayoutManager: true)
        textView.documentID = documentID
        return textView
    }

    func markDismantled() { isDismantled = true }

    func reviewedEditUndoManager(in window: NSWindow, for documentID: UUID) -> UndoManager? {
        guard !isProcessingEdit, self.documentID == documentID,
              let undoManager, canReview(in: window, undo: undoManager), policyAllowsEdits,
              !isProcessingEdit, canReview(in: window, undo: undoManager) else { return nil }
        return undoManager
    }

    private func canReview(in window: NSWindow, undo: UndoManager) -> Bool {
        !isDismantled && isActive && !isReadOnly && isEditable && allowsUndo
            && textInputDepth == 0 && !hasMarkedText() && selectedRanges.count == 1
            && self.window === window && window.firstResponder === self && window.attachedSheet == nil
            // AppKit registers Undo inside shouldChangeText, after invoking a custom delegate.
            // This editor has no delegate; refuse rather than permit a delegate to invalidate the
            // target inside that native call, after our last safe check.
            && delegate == nil && undo.isUndoRegistrationEnabled && !undo.isUndoing && !undo.isRedoing
    }

    func performReviewedReplacement(
        _ selection: NSRange, with replacement: String, in window: NSWindow, undo: UndoManager,
        source: String, stillCurrent: @escaping @MainActor () -> Bool
    ) -> Bool {
        let validate = {
            stillCurrent() && self.policyAllowsEdits && self.canReview(in: window, undo: undo)
                && self.string.utf8.elementsEqual(source.utf8)
        }
        var awaitingNativeValidation = false
        var finishUndoGroup: (() -> Void)?
        reviewedEditValidation = { ranges, replacements in
            guard awaitingNativeValidation else { return false }
            awaitingNativeValidation = false
            guard ranges.count == 1, ranges[0].rangeValue == selection,
                  let replacements, replacements.count == 1,
                  replacements[0].utf8.elementsEqual(replacement.utf8), validate() else { return false }
            // Only open the group on the accepted native edit. Even an empty explicit group
            // can affect undo history, so all refusal checks must precede this operation.
            finishUndoGroup = self.beginReviewedUndoGroup(undo)
            return finishUndoGroup != nil
        }
        // Report committed bytes only after closing the undo group. Do not let a storage
        // observer start a new reviewed edit or run Undo/Redo while the transaction is open.
        defer {
            finishUndoGroup?()
            reviewedEditValidation = nil
            reportEditsWhenIdle()
        }
        guard validate() else { return false }
        awaitingNativeValidation = true
        return performValidatedReplacement(in: selection, with: NSAttributedString(string: replacement))
    }

    private func beginReviewedUndoGroup(_ undo: UndoManager) -> (() -> Void)? {
        // This editor owns its manager and opens no other explicit groups. A single open
        // event group contains earlier typing; an unexpected nested group is not safe to split.
        let groupsByEvent = undo.groupsByEvent
        let hadEventGroup = undo.groupingLevel == 1 && groupsByEvent
        guard undo.groupingLevel == 0 || hadEventGroup else { return nil }
        breakUndoCoalescing()
        if hadEventGroup {
            undo.endUndoGrouping()
        } else {
            // Do not let beginUndoGrouping implicitly nest inside a new event group.
            undo.groupsByEvent = false
        }
        undo.beginUndoGrouping()
        return {
            self.breakUndoCoalescing()
            undo.endUndoGrouping()
            if hadEventGroup {
                // The pending run-loop close will now close this group for later typing.
                undo.beginUndoGrouping()
            } else {
                undo.groupsByEvent = groupsByEvent
            }
        }
    }

    private var policyAllowsEdits: Bool { editorCoordinator?.canEdit() ?? true }
    private var canMutate: Bool { reviewedEditValidation == nil && isEditable && policyAllowsEdits }
    fileprivate var canApplyUndo: Bool {
        isActive && !isDismantled && reviewedEditValidation == nil && !isReadOnly && !hasMarkedText() && policyAllowsEdits
    }
    fileprivate var canRevealSource: Bool {
        guard isActive, isSelectable, !isProcessingEdit, !hasMarkedText(),
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
        if let validate = reviewedEditValidation {
            guard validate(affectedRanges, replacementStrings) else { return false }
            return super.shouldChangeText(inRanges: affectedRanges, replacementStrings: replacementStrings)
        }
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
        guard reviewedEditValidation == nil, canContinueTextInput else { return }
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
        reportEditsWhenIdle()
    }

    private func reportEditsWhenIdle() {
        // AppKit may call one text input hook from another. Only the outer operation
        // sees the final buffer and marked state, even when unmark edits no characters.
        guard !isProcessingEdit else { return }
        editorCoordinator?.didFinishTextInput()
        (enclosingScrollView as? EditorScrollView)?.applyEditorInsets()
    }
}

@MainActor
private final class EditorScrollView: NSScrollView {
    static let normalInset = NSSize(width: 12, height: 12)

    var isFocusLayout = false {
        didSet {
            if oldValue != isFocusLayout { applyEditorInsets() }
        }
    }

    override func tile() {
        super.tile()
        applyEditorInsets()
    }

    func applyEditorInsets() {
        guard let textView = documentView as? MarkdownTextView,
              !textView.isProcessingEdit, !textView.hasMarkedText(),
              let container = textView.textContainer else { return }
        var inset = Self.normalInset
        if isFocusLayout {
            // The clip view excludes any non-overlay scroller; TextKit adds line padding inside the inset.
            let availableWidth = contentView.bounds.width - 2 * container.lineFragmentPadding
            let gutter = min(inset.width, max(0, (availableWidth - 160) / 2))
            // Aim for 720 pt, but cap the margin so its old value still fits a narrow window
            // if the user resizes before their current composition ends.
            inset = NSSize(width: max(gutter, min(136, (availableWidth - 720) / 2)), height: 32)
        }
        if textView.textContainerInset != inset { textView.textContainerInset = inset }
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
    private let documentID: UUID?
    private let isActive: Bool
    private let isReadOnly: Bool
    private let isFocusLayout: Bool
    private let canEdit: @MainActor () -> Bool
    private let onCompositionChange: (Bool) -> Void
    private let revealSourceSelection: @MainActor (String) -> NSRange?
    private let onChange: (String) -> Void

    /// `initialText` and `documentID` are bound when the native view is created;
    /// use a new SwiftUI identity for a different document.
    /// `isActive` enables editing and requests native focus on activation. Inactive editors
    /// retain selection and undo history; the caller controls visibility and hit testing.
    /// `isReadOnly` lets an active tab select and copy its source without editing.
    /// `isFocusLayout` adjusts only the text insets, deferring changes during marked input.
    /// `canEdit` is checked synchronously before native edits and Undo/Redo, without
    /// changing the selection or history. Only block edits when no composition is active.
    /// Keep the editor active, and block tab switches/new tabs, from `onCompositionChange(true)`
    /// until `onCompositionChange(false)`.
    ///
    /// `revealSourceSelection` may consume a pending request using the current native buffer.
    /// It is asked after view updates or native availability changes, only while the editor
    /// is active, selectable, unlocked, not composing, and in a key window without a sheet.
    /// Return a UTF-16 range at character boundaries to select and scroll, or nil.
    /// Navigation does not focus or edit the view and creates no undo operation.
    ///
    /// Edit and composition callbacks are synchronous on the main actor, only while attached to a window.
    /// `onChange` reports committed source (including Undo/Redo), never marked candidates.
    /// If composition changes the source, `onChange` precedes `onCompositionChange(false)`.
    /// Identical UTF-8 bytes do not produce another `onChange`.
    /// No callbacks are sent for seeding or dismantling.
    public init(
        initialText: String,
        documentID: UUID? = nil,
        isActive: Bool = true,
        isReadOnly: Bool = false,
        isFocusLayout: Bool = false,
        canEdit: @escaping @MainActor () -> Bool = { true },
        onCompositionChange: @escaping (Bool) -> Void = { _ in },
        revealSourceSelection: @escaping @MainActor (String) -> NSRange? = { _ in nil },
        onChange: @escaping (String) -> Void
    ) {
        self.initialText = initialText
        self.documentID = documentID
        self.isActive = isActive
        self.isReadOnly = isReadOnly
        self.isFocusLayout = isFocusLayout
        self.canEdit = canEdit
        self.onCompositionChange = onCompositionChange
        self.revealSourceSelection = revealSourceSelection
        self.onChange = onChange
    }

    public func makeCoordinator() -> Coordinator {
        Coordinator(canEdit: canEdit, onCompositionChange: onCompositionChange,
                    revealSourceSelection: revealSourceSelection, onChange: onChange)
    }

    public func makeNSView(context: Context) -> NSScrollView {
        Self.makeScrollView(initialText: initialText, documentID: documentID, isActive: isActive,
                            isReadOnly: isReadOnly, isFocusLayout: isFocusLayout, coordinator: context.coordinator)
    }

    public func updateNSView(_ nsView: NSScrollView, context: Context) {
        // Replacing the buffer here would disturb selection, undo and marked text.
        context.coordinator.canEdit = canEdit
        context.coordinator.onCompositionChange = onCompositionChange
        context.coordinator.revealSourceSelection = revealSourceSelection
        context.coordinator.onChange = onChange
        Self.setActive(isActive, in: nsView, readOnly: isReadOnly)
        Self.setFocusLayout(isFocusLayout, in: nsView)
        context.coordinator.scheduleSourceReveal()
    }

    public static func dismantleNSView(_ nsView: NSScrollView, coordinator: Coordinator) {
        (nsView.documentView as? MarkdownTextView)?.markDismantled()
        coordinator.stopObserving()
    }

    /// Capture only the matching, focused native buffer. Callers gate production window visibility and key status.
    @MainActor
    package static func captureReviewedEdit(in window: NSWindow, documentID: UUID) -> String? {
        guard let view = window.firstResponder as? MarkdownTextView,
              view.reviewedEditUndoManager(in: window, for: documentID) != nil else { return nil }
        return view.string
    }

    /// Snapshot one non-empty selection in the matching, focused native buffer.
    /// Callers gate production window visibility and key status, and revalidate before applying.
    @MainActor
    package static func captureReviewedSelection(in window: NSWindow, documentID: UUID)
        -> (source: String, range: NSRange, editor: NSTextView)? {
        guard let view = window.firstResponder as? MarkdownTextView,
              view.reviewedEditUndoManager(in: window, for: documentID) != nil else { return nil }
        let ranges = view.selectedRanges
        guard ranges.count == 1, let range = ranges.first?.rangeValue else { return nil }
        let source = view.string
        guard reviewedCharacterRange(range, in: source) != nil else { return nil }
        return (source, range, view)
    }

    /// Apply a previously reviewed target without touching the model or replacing the native buffer.
    @MainActor
    package static func applyReviewedEdit(
        in window: NSWindow, documentID: UUID, expectedSource: String, selection: NSRange,
        replacement: String, resultingSource: String
    ) -> Bool {
        applyReviewedEdit(in: window, documentID: documentID, expectedSource: expectedSource,
                          selection: selection, replacement: replacement, resultingSource: resultingSource,
                          stillCurrent: { true })
    }

    @MainActor
    package static func applyReviewedEdit(
        in window: NSWindow, documentID: UUID, expectedSource: String, selection: NSRange,
        replacement: String, resultingSource: String, stillCurrent: @escaping @MainActor () -> Bool
    ) -> Bool {
        guard let view = window.firstResponder as? MarkdownTextView,
              let undo = view.reviewedEditUndoManager(in: window, for: documentID) else { return false }
        let source = view.string
        guard source.utf8.elementsEqual(expectedSource.utf8),
              !source.utf8.elementsEqual(resultingSource.utf8),
              let range = reviewedCharacterRange(selection, in: source) else { return false }
        let candidate = source[..<range.lowerBound] + replacement + source[range.upperBound...]
        guard candidate.utf8.elementsEqual(resultingSource.utf8) else { return false }
        return view.performReviewedReplacement(selection, with: replacement, in: window, undo: undo,
                                               source: source, stillCurrent: stillCurrent)
    }

    private static func reviewedCharacterRange(_ selection: NSRange, in source: String) -> Range<String.Index>? {
        // Check the arithmetic before bridging a UTF-16 range, then require both ends
        // to be Character boundaries (not just valid UTF-16 code unit offsets).
        let utf16 = source.utf16
        let length = utf16.count
        guard selection.location >= 0, selection.location < length, selection.length > 0,
              selection.length <= length - selection.location else { return nil }
        let start = utf16.index(utf16.startIndex, offsetBy: selection.location)
        let end = utf16.index(start, offsetBy: selection.length)
        guard let lower = String.Index(start, within: source),
              let upper = String.Index(end, within: source) else { return nil }
        return lower..<upper
    }

    static func setActive(_ isActive: Bool, in scrollView: NSScrollView, readOnly: Bool = false) {
        (scrollView.documentView as? MarkdownTextView)?.setActive(isActive, readOnly: readOnly)
    }

    static func setFocusLayout(_ isFocusLayout: Bool, in scrollView: NSScrollView) {
        (scrollView as? EditorScrollView)?.isFocusLayout = isFocusLayout
    }

    package static func makeScrollView(
        initialText: String, documentID: UUID? = nil, isActive: Bool = true, isReadOnly: Bool = false,
        isFocusLayout: Bool = false, coordinator: Coordinator?
    ) -> NSScrollView {
        let scrollView = EditorScrollView()
        scrollView.hasVerticalScroller = true
        scrollView.autohidesScrollers = true

        let textView = MarkdownTextView.make(documentID: documentID)
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
        textView.textContainerInset = EditorScrollView.normalInset
        textView.isVerticallyResizable = true
        textView.isHorizontallyResizable = false
        let unbounded = CGFloat.greatestFiniteMagnitude
        textView.maxSize = NSSize(width: unbounded, height: unbounded)
        textView.autoresizingMask = [.width]
        textView.textContainer?.widthTracksTextView = true

        textView.string = initialText
        textView.setActive(isActive, readOnly: isReadOnly)
        scrollView.documentView = textView
        setFocusLayout(isFocusLayout, in: scrollView)

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
        fileprivate var revealSourceSelection: @MainActor (String) -> NSRange?
        fileprivate var onChange: (String) -> Void
        private weak var textView: MarkdownTextView?
        private weak var revealWindow: NSWindow?
        private var revealScheduled = false
        private var lastCommittedSource = ""
        private var isComposing = false

        init(
            canEdit: @escaping @MainActor () -> Bool = { true },
            onCompositionChange: @escaping (Bool) -> Void = { _ in },
            revealSourceSelection: @escaping @MainActor (String) -> NSRange? = { _ in nil },
            onChange: @escaping (String) -> Void
        ) {
            self.canEdit = canEdit
            self.onCompositionChange = onCompositionChange
            self.revealSourceSelection = revealSourceSelection
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
                self.revealSourceSelectionIfAvailable()
            }
        }

        private func revealSourceSelectionIfAvailable() {
            guard let textView, textView.canRevealSource else { return }
            let source = textView.string
            guard let range = revealSourceSelection(source), range.location >= 0, range.length >= 0 else { return }
            let utf16 = source.utf16
            let length = utf16.count
            guard range.location <= length, range.length <= length - range.location else { return }
            let start = utf16.index(utf16.startIndex, offsetBy: range.location)
            let end = utf16.index(start, offsetBy: range.length)
            guard String.Index(start, within: source) != nil, String.Index(end, within: source) != nil,
                  self.textView === textView, textView.canRevealSource,
                  textView.string.utf8.elementsEqual(source.utf8) else { return }
            textView.setSelectedRange(range)
            textView.scrollRangeToVisible(range)
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
            guard let textView, textView.window != nil, !textView.isProcessingEdit,
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
