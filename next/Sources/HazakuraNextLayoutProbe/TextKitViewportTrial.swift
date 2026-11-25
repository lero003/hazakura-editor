import AppKit
import HazakuraNextEditor

/// Uses the app's editor factory, but never orders a window on screen or starts the app.
@MainActor
enum TextKitViewportTrial {
    private static let wide = NSSize(width: 900, height: 560)
    private static let narrow = NSSize(width: 550, height: 560)

    static func measure(source: String) -> LayoutProbeCommand.Sample? {
        _ = NSApplication.shared
        return autoreleasepool { measureInWindow(source: source) }
    }

    private static func measureInWindow(source: String) -> LayoutProbeCommand.Sample? {
        let end = NSRange(location: source.utf16.count, length: 0)
        guard end.location > 0 else { return nil }
        let window = NSWindow(contentRect: NSRect(origin: .zero, size: wide), styleMask: [.titled],
                              backing: .buffered, defer: true)
        defer { window.contentView = nil }

        let initialStart = ContinuousClock.now
        let scroll = TextKitEditor.makeScrollView(initialText: source, coordinator: nil)
        scroll.scrollerStyle = .overlay
        scroll.frame = NSRect(origin: .zero, size: wide)
        window.contentView = scroll
        scroll.layoutSubtreeIfNeeded()
        guard let textView = scroll.documentView as? NSTextView,
              let layout = textView.textLayoutManager,
              let container = textView.textContainer else { return nil }
        let viewport = layout.textViewportLayoutController
        viewport.layoutViewport()
        let initial = microseconds(since: initialStart)
        guard abs(scroll.contentView.bounds.width - wide.width) < 1,
              let initialRange = viewport.viewportRange, !initialRange.isEmpty,
              initialRange.location.compare(layout.documentRange.location) == .orderedSame else { return nil }
        let wideTextWidth = container.size.width

        let narrowStart = ContinuousClock.now
        window.setContentSize(narrow)
        scroll.layoutSubtreeIfNeeded()
        viewport.layoutViewport()
        let reflow = microseconds(since: narrowStart)
        guard abs(scroll.contentView.bounds.width - narrow.width) < 1,
              container.size.width < wideTextWidth,
              let narrowRange = viewport.viewportRange, !narrowRange.isEmpty,
              narrowRange.location.compare(layout.documentRange.location) == .orderedSame,
              narrowRange.endLocation.compare(initialRange.endLocation) == .orderedAscending else { return nil }

        let oldScrollPosition = scroll.contentView.bounds.minY
        let endStart = ContinuousClock.now
        let terminal = layout.documentRange.endLocation
        guard let last = layout.textContentManager?.location(terminal, offsetBy: -1),
              let terminalRange = NSTextRange(location: last, end: terminal) else { return nil }
        layout.ensureLayout(for: terminalRange)
        guard let fragment = layout.textLayoutFragment(for: last) else { return nil }
        textView.setSelectedRange(end)
        // Use the final fragment's actual geometry instead of relying on an
        // offscreen NSTextView to update the viewport for a zero-width end caret.
        let origin = textView.textContainerOrigin
        let target = fragment.layoutFragmentFrame.offsetBy(dx: origin.x, dy: origin.y)
        textView.scrollToVisible(target)
        let endLayout = microseconds(since: endStart)
        guard textView.selectedRange() == end, scroll.contentView.bounds.minY > oldScrollPosition,
              !fragment.textLineFragments.isEmpty, textView.visibleRect.intersects(target),
              fragment.rangeInElement.endLocation.compare(terminal) == .orderedSame,
              textView.textLayoutManager === layout, window.isVisible == false else { return nil }

        return LayoutProbeCommand.Sample(initialViewportMicroseconds: initial,
                                         narrowViewportMicroseconds: reflow,
                                         endViewportMicroseconds: endLayout)
    }

    private static func microseconds(since start: ContinuousClock.Instant) -> Int64 {
        let elapsed = start.duration(to: .now).components
        return elapsed.seconds * 1_000_000 + elapsed.attoseconds / 1_000_000_000_000
    }
}
