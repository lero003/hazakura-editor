import AppKit
import HazakuraNextCore
import SwiftUI

/// AppKit owns the single window and both exit paths; SwiftUI owns its contents.
@MainActor
final class ScratchApplicationDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate, NSMenuItemValidation {
    typealias PresentExit = @MainActor (NSWindow, WindowExitGate.Ticket, @escaping @MainActor (Bool) -> Void) -> Void
    typealias ReplyToQuit = @MainActor (NSApplication, Bool) -> Void

    let source: String
    private(set) var window: NSWindow?
    private(set) var session: WorkspaceSession?
    private var exitGate = WindowExitGate()
    private var presentedExit: WindowExitGate.Ticket?
    private(set) var exitCleanupTask: Task<Void, Never>?
    private let recovery: RecoveryCheckpointQueue?
    private let recoveryUnavailable: Bool
    private let presentExit: PresentExit
    private let replyToQuit: ReplyToQuit

    init(
        source: String,
        recovery: RecoveryCheckpointQueue? = nil,
        recoveryUnavailable: Bool = false,
        presentExit: PresentExit? = nil,
        replyToQuit: @escaping ReplyToQuit = { $0.reply(toApplicationShouldTerminate: $1) }
    ) {
        self.source = source
        self.recovery = recovery
        self.recoveryUnavailable = recoveryUnavailable
        let includesRecovery = recovery != nil
        self.presentExit = presentExit ?? { window, ticket, completion in
            Self.presentNativeExit(window, ticket, includesRecovery: includesRecovery, completion)
        }
        self.replyToQuit = replyToQuit
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        installMenus()
        showWindow()
        NSApp.activate()
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        if !flag, presentedExit == nil { showWindow() }
        return true
    }

    private func showWindow() {
        prepareWindow().makeKeyAndOrderFront(nil)
    }

    func prepareWindow() -> NSWindow {
        if let window { return window }
        let session = WorkspaceSession(source: source, recovery: recovery, recoveryUnavailable: recoveryUnavailable)
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 900, height: 660),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: true
        )
        self.window = window
        self.session = session
        session.window = window
        window.delegate = self
        window.isReleasedWhenClosed = false
        window.isRestorable = false
        window.title = "Hazakura Editor Next — 開発用"
        window.contentMinSize = NSSize(width: 450, height: 300)
        window.contentViewController = NSHostingController(rootView: ScratchWorkspaceView(session: session))
        window.setContentSize(NSSize(width: 900, height: 660))
        window.center()
        return window
    }

    func windowShouldClose(_ sender: NSWindow) -> Bool {
        guard sender === window, let session, presentedExit == nil else { return false }
        switch exitGate.request(.window, tabs: session.tabs, busy: session.isBusy || sender.attachedSheet != nil) {
        case .allow:
            return true
        case .blocked:
            break
        case .confirm(let ticket):
            confirm(ticket, in: sender) { [weak sender] discard in
                // Native close bypasses windowShouldClose only for this revalidated decision.
                if discard { sender?.close() }
            }
        }
        return false
    }

    func windowWillClose(_ notification: Notification) {
        guard (notification.object as? NSWindow) === window else { return }
        window = nil
        session = nil
    }

    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        // AppKit expects a single reply for the active deferred termination request.
        if let presentedExit {
            return presentedExit.destination == .application ? .terminateLater : .terminateCancel
        }
        guard let window, let session else { return .terminateNow }
        switch exitGate.request(.application, tabs: session.tabs, busy: session.isBusy || window.attachedSheet != nil) {
        case .allow:
            return .terminateNow
        case .blocked:
            return .terminateCancel
        case .confirm(let ticket):
            confirm(ticket, in: window) { [replyToQuit] discard in replyToQuit(sender, discard) }
            return .terminateLater
        }
    }

    private func confirm(_ ticket: WindowExitGate.Ticket, in window: NSWindow, finish: @escaping (Bool) -> Void) {
        presentedExit = ticket
        presentExit(window, ticket) { [weak self, weak window] discard in
            guard let self, presentedExit == ticket, exitCleanupTask == nil else { return }
            guard let window, window === self.window, let session else {
                presentedExit = nil
                exitGate = WindowExitGate()
                finish(false)
                return
            }
            let accepted = exitGate.resolve(ticket, discard: discard, tabs: session.tabs, busy: session.isBusy)
            guard accepted, recovery != nil else {
                presentedExit = nil
                if discard && !accepted {
                    session.exitNotice = "原稿の状態が変わったため、閉じませんでした。操作をやり直してください。"
                }
                finish(accepted)
                return
            }

            guard let confirmed = session.reserveExitDiscard() else {
                presentedExit = nil
                finish(false)
                return
            }
            exitCleanupTask = Task {
                await session.finishExitDiscard(confirmed) { ready in
                    finish(ready && self.session === session)
                    self.exitCleanupTask = nil
                    self.presentedExit = nil
                }
            }
        }
    }

    private static func presentNativeExit(
        _ window: NSWindow,
        _ ticket: WindowExitGate.Ticket,
        includesRecovery: Bool,
        _ completion: @escaping @MainActor (Bool) -> Void
    ) {
        if NSApp.isHidden { NSApp.unhide(nil) }
        if window.isMiniaturized { window.deminiaturize(nil) }
        window.makeKeyAndOrderFront(nil)
        NSApp.activate()
        let alert = NSAlert()
        alert.alertStyle = .warning
        alert.messageText = "未保存の原稿が\(ticket.count)件あります"
        let isQuit = ticket.destination == .application
        let drafts = includesRecovery ? "未保存原稿とその復旧記録" : "未保存原稿"
        alert.informativeText = isQuit
            ? "破棄して終了すると、開いている\(drafts)が削除されます。"
            : "破棄して閉じると、このウィンドウの\(drafts)が削除されます。"
        let keep = alert.addButton(withTitle: "編集を続ける")
        keep.keyEquivalent = "\u{1B}"
        let discard = alert.addButton(withTitle: isQuit ? "破棄して終了" : "破棄して閉じる")
        discard.keyEquivalent = ""
        discard.hasDestructiveAction = true
        alert.beginSheetModal(for: window) { result in completion(result == .alertSecondButtonReturn) }
    }

    // Keep standard text actions on the responder chain; app-specific actions share the window's session.
    private func installMenus() {
        let bar = NSMenu()
        let app = addMenu("Hazakura Editor Next", to: bar)
        app.addItem(withTitle: "Hazakura Editor Next を隠す", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        app.addItem(.separator())
        app.addItem(withTitle: "Hazakura Editor Next を終了", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")

        let file = addMenu("ファイル", to: bar)
        addCommand("新規タブ", #selector(newTab(_:)), "t", to: file)
        addCommand("読み取り専用で開く…", #selector(openFile(_:)), "o", to: file)
        addCommand("編集用コピーを開く", #selector(makeEditableCopy(_:)), "", to: file)
        addCommand("原本の版を比較…", #selector(compareOriginal(_:)), "", to: file)
        addCommand("コピーを保存…", #selector(saveCopy(_:)), "S", to: file)
        addCommand("HTMLを書き出す…", #selector(exportHTML(_:)), "", to: file)
        file.addItem(.separator())
        file.addItem(withTitle: "ウィンドウを閉じる", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")

        let edit = addMenu("編集", to: bar)
        addCommand("取り消す", #selector(undo(_:)), "z", to: edit)
        addCommand("やり直す", #selector(redo(_:)), "Z", to: edit)
        edit.addItem(.separator())
        edit.addItem(withTitle: "カット", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        edit.addItem(withTitle: "コピー", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        edit.addItem(withTitle: "ペースト", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        edit.addItem(withTitle: "すべてを選択", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        let view = addMenu("表示", to: bar)
        addCommand("Markdownプレビュー…", #selector(previewMarkdown(_:)), "", to: view)
        NSApp.mainMenu = bar
    }

    private func addMenu(_ title: String, to bar: NSMenu) -> NSMenu {
        let item = NSMenuItem(title: title, action: nil, keyEquivalent: "")
        let menu = NSMenu(title: title)
        item.submenu = menu
        bar.addItem(item)
        return menu
    }

    private func addCommand(_ title: String, _ action: Selector, _ key: String, to menu: NSMenu) {
        let item = menu.addItem(withTitle: title, action: action, keyEquivalent: key)
        item.target = self
    }

    private var menuSession: WorkspaceSession? {
        guard presentedExit == nil, let window, window.isKeyWindow, window.isVisible,
              window.attachedSheet == nil else { return nil }
        return session
    }

    private var activeUndoManager: UndoManager? {
        guard let session = menuSession, !session.isBusy, !session.tabs.isComposing else { return nil }
        return window?.firstResponder?.undoManager
    }

    @objc private func newTab(_ sender: Any?) { menuSession?.newTab() }
    @objc private func openFile(_ sender: Any?) { menuSession?.requestOpen() }
    @objc private func makeEditableCopy(_ sender: Any?) { menuSession?.makeEditableCopy() }
    @objc private func compareOriginal(_ sender: Any?) { menuSession?.requestOriginalComparison() }
    @objc private func saveCopy(_ sender: Any?) { menuSession?.requestSaveCopy() }
    @objc private func exportHTML(_ sender: Any?) { menuSession?.requestHTMLExport() }
    @objc private func previewMarkdown(_ sender: Any?) { menuSession?.requestMarkdownPreview() }
    @objc private func undo(_ sender: Any?) { activeUndoManager?.undo() }
    @objc private func redo(_ sender: Any?) { activeUndoManager?.redo() }

    func validateMenuItem(_ item: NSMenuItem) -> Bool {
        switch item.action {
        case #selector(newTab(_:)), #selector(openFile(_:)): menuSession?.canAddTab == true
        case #selector(makeEditableCopy(_:)): menuSession?.canMakeEditableCopy == true
        case #selector(compareOriginal(_:)): menuSession?.canCompareOriginal == true
        case #selector(saveCopy(_:)): menuSession?.canSaveCopy == true
        case #selector(exportHTML(_:)): menuSession?.canExportHTML == true
        case #selector(previewMarkdown(_:)): menuSession?.canPreviewMarkdown == true
        case #selector(undo(_:)): activeUndoManager?.canUndo == true
        case #selector(redo(_:)): activeUndoManager?.canRedo == true
        default: true
        }
    }
}
