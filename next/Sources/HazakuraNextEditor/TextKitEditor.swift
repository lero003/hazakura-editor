import AppKit
import SwiftUI

@MainActor
private final class MarkdownTextView: NSTextView {
    override var readablePasteboardTypes: [NSPasteboard.PasteboardType] { [.string] }
    override var acceptableDragTypes: [NSPasteboard.PasteboardType] { [] }

    override func readSelection(from pboard: NSPasteboard, type: NSPasteboard.PasteboardType) -> Bool {
        guard type == .string else { return false }
        return super.readSelection(from: pboard, type: type)
    }
}

/// An in-memory Markdown source editor. AppKit owns the editing buffer and undo history.
@MainActor
public struct TextKitEditor: NSViewRepresentable {
    private let initialText: String
    private let onChange: (String) -> Void

    /// `initialText` seeds a new SwiftUI identity; later changes to it are ignored.
    /// `onChange` receives the native buffer when AppKit reports an edit.
    public init(initialText: String, onChange: @escaping (String) -> Void) {
        self.initialText = initialText
        self.onChange = onChange
    }

    public func makeCoordinator() -> Coordinator {
        Coordinator(onChange: onChange)
    }

    public func makeNSView(context: Context) -> NSScrollView {
        Self.makeScrollView(initialText: initialText, coordinator: context.coordinator)
    }

    public func updateNSView(_ nsView: NSScrollView, context: Context) {
        // Replacing the buffer here would disturb selection, undo and marked text.
        context.coordinator.onChange = onChange
    }

    public static func dismantleNSView(_ nsView: NSScrollView, coordinator: Coordinator) {
        coordinator.stopObserving()
    }

    static func makeScrollView(initialText: String, coordinator: Coordinator?) -> NSScrollView {
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
        scrollView.documentView = textView

        // Inspect the TextKit 2 properties only; accessing the legacy manager forces compatibility mode.
        guard textView.textLayoutManager != nil, let storage = textView.textContentStorage?.textStorage else {
            preconditionFailure("The Markdown editor requires TextKit 2.")
        }
        coordinator?.observeEdits(in: storage)
        return scrollView
    }

    @MainActor
    public final class Coordinator: NSObject {
        fileprivate var onChange: (String) -> Void

        init(onChange: @escaping (String) -> Void) {
            self.onChange = onChange
        }

        fileprivate func observeEdits(in storage: NSTextStorage) {
            // TextKit 2 undo/redo can change the storage without sending NSTextView's edit notification.
            NotificationCenter.default.addObserver(
                self,
                selector: #selector(didProcessEditing(_:)),
                name: NSTextStorage.didProcessEditingNotification,
                object: storage
            )
        }

        fileprivate func stopObserving() {
            NotificationCenter.default.removeObserver(self, name: NSTextStorage.didProcessEditingNotification, object: nil)
        }

        @objc private func didProcessEditing(_ notification: Notification) {
            guard let storage = notification.object as? NSTextStorage,
                  storage.editedMask.contains(.editedCharacters) else { return }
            onChange(storage.string)
        }
    }
}
