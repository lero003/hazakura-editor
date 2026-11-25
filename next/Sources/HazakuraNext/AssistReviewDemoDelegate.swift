import AppKit
import HazakuraNextCore
import HazakuraNextEditor
import SwiftUI

/// The development demo only: one in-memory fixture, with no normal workspace commands.
@MainActor
final class AssistReviewDemoDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate {
    static let source = "# 内蔵の合成原稿\n\n表記: が \r\n余白:\t残す\n不可視: A\u{200B}B\r末尾\nこの行は選択範囲外です。\n"
    private static let candidate = "表記: か\u{3099}\n余白: 残す\n不可視: AB\r末尾"

    let session = WorkspaceSession(source: AssistReviewDemoDelegate.source, recovery: nil)
    private var window: NSWindow?
    private var reviewButton: NSButton?
    private var undoButton: NSButton?
    private var recordButton: NSButton?
    private var latestReceipt: AssistNativeReview.Receipt?
    private weak var recordSheet: NSWindow?
    private var status: NSTextField?
    private var operation: Operation?
    private weak var failedDismissalSheet: NSWindow?

    private struct ReviewSheet {
        let window: NSWindow
        let reviewID: UUID
        let header: NSTextField
        let cancel: NSButton
        let approve: NSButton
    }

    @MainActor
    private final class Operation {
        enum Decision { case approved, cancelled, presentationFailed }

        enum Phase {
            case preparing
            case attaching(ReviewSheet)
            case reviewing(ReviewSheet)
            case closing(ReviewSheet, Decision)
            case completing
        }

        let handoff: AssistReviewHandoff
        var phase: Phase = .preparing
        var task: Task<Void, Never>?

        init(_ handoff: AssistReviewHandoff) { self.handoff = handoff }
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        prepareWindow().makeKeyAndOrderFront(nil)
        NSApp.activate()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    func applicationWillTerminate(_ notification: Notification) {
        abandonReview()
        latestReceipt = nil
    }

    func windowShouldClose(_ sender: NSWindow) -> Bool {
        sender === window && sender.attachedSheet == nil
    }

    func windowWillClose(_ notification: Notification) {
        guard (notification.object as? NSWindow) === window else { return }
        abandonReview()
        latestReceipt = nil
        recordSheet = nil
        session.window = nil
        window = nil
    }

    func prepareWindow() -> NSWindow {
        if let window { return window }
        let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 760, height: 450),
                              styleMask: [.titled, .closable, .resizable], backing: .buffered, defer: true)
        window.title = "Hazakura Editor Next — 合成候補のレビューデモ"
        window.contentMinSize = NSSize(width: 580, height: 350)
        window.isRestorable = false
        window.isReleasedWhenClosed = false
        window.delegate = self
        self.window = window
        session.window = window

        // The private session always starts with this one editable fixture tab.
        if let tab = session.tabs.selectedTab {
            let id = tab.id
            let editor = NSHostingView(rootView: TextKitEditor(
                initialText: tab.document.source, documentID: id,
                canEdit: { [session] in session.canEditSource },
                onCompositionChange: { [session] in session.tabs.setComposing($0, in: id) },
                onChange: { [session] in session.applyCommittedSource($0, to: id) }
            ))
            editor.sizingOptions = []
            let instructions = NSTextField(wrappingLabelWithString: "内蔵の合成原稿だけをメモリ上で編集します。保存・復旧・AIによる生成や通信は行いません。置き換える範囲（例：「表記:」から「末尾」の行まで）を選んでください。候補は選択内容によらず固定です。")
            let status = NSTextField(wrappingLabelWithString: "範囲を選んだまま「候補を確認…」を押してください（⌘⇧R）。")
            status.textColor = .secondaryLabelColor
            let review = NSButton(title: "候補を確認…", target: self, action: #selector(startReview))
            // NSButton represents Shift in the key-equivalent character itself.
            review.keyEquivalent = "R"
            review.keyEquivalentModifierMask = [.command]
            let undo = NSButton(title: "元に戻す", target: self, action: #selector(undoEdit))
            undo.keyEquivalent = "z"
            undo.keyEquivalentModifierMask = [.command]
            let record = NSButton(title: "直近の採用差分…", target: self, action: #selector(showLatestRecord))
            record.keyEquivalent = "d"
            record.keyEquivalentModifierMask = [.command, .shift]
            record.isEnabled = latestReceipt != nil
            // Native push buttons act on the current responder without taking editing focus.
            review.refusesFirstResponder = true
            undo.refusesFirstResponder = true
            record.refusesFirstResponder = true
            self.reviewButton = review
            self.undoButton = undo
            self.recordButton = record
            self.status = status
            window.contentView = Self.layout(header: instructions, body: editor,
                                             buttons: [review, undo, record], status: status)
        }
        window.center()
        return window
    }

    @objc private func startReview() {
        guard operation == nil, recordSheet == nil, failedDismissalSheet?.sheetParent == nil else { return }
        do {
            let operation = Operation(try AssistReviewHandoff.begin(in: session))
            self.operation = operation
            reviewButton?.isEnabled = false
            undoButton?.isEnabled = false
            recordButton?.isEnabled = false
            status?.stringValue = "合成候補との差分を準備中…"
            operation.task = Task { [weak self, weak operation] in
                guard let handoff = operation?.handoff else { return }
                do {
                    let review = try await handoff.prepare(candidate: Self.candidate)
                    try Task.checkCancellation()
                    guard let self, let operation, self.operation === operation else { return }
                    operation.task = nil
                    try handoff.present(review)
                    self.showSheet(for: review, operation: operation)
                } catch {
                    guard let self, let operation, self.operation === operation else { return }
                    self.finish(operation, notice: "差分を準備できませんでした。本文の選択や編集状態を確認し、もう一度お試しください。")
                }
            }
        } catch {
            status?.stringValue = "本文にフォーカスを置き、変換を終えてから、置き換える範囲を一つ選んでください。"
        }
    }

    private func showSheet(for review: AssistProposalFlow.Review, operation: Operation) {
        guard let host = window, host === session.window, host.attachedSheet == nil else {
            finish(operation, notice: "差分シートを表示できませんでした。")
            return
        }
        let sheet = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 640, height: 500),
                             styleMask: [.titled], backing: .buffered, defer: true)
        sheet.title = "合成候補の差分"
        sheet.isRestorable = false
        sheet.isReleasedWhenClosed = false
        let cancel = NSButton(title: "キャンセル", target: self, action: #selector(closeReview(_:)))
        cancel.keyEquivalent = "\u{1B}"
        cancel.keyEquivalentModifierMask = []
        let approve = NSButton(title: "合成候補を反映", target: self, action: #selector(closeReview(_:)))
        approve.keyEquivalent = ""
        let header = NSTextField(wrappingLabelWithString: "差分を確認してください。反映を選んだ場合にだけ、元の選択範囲を置き換えます。変更は保存されません。")
        let diff = NSHostingView(rootView: AssistReviewDiff(
            review: review,
            boundaryNote: "行番号と行末は選択範囲内。改行を削除すると選択外の行とつながることがあります。"
        ))
        diff.sizingOptions = []
        sheet.contentView = Self.layout(header: header, body: diff, buttons: [cancel, approve])
        sheet.initialFirstResponder = cancel
        sheet.defaultButtonCell = nil

        let presentation = ReviewSheet(window: sheet, reviewID: review.id, header: header, cancel: cancel, approve: approve)
        operation.phase = .attaching(presentation)
        host.beginSheet(sheet) { [weak self, weak operation, weak sheet, weak host] response in
            guard let self, let operation, let sheet, let host else { return }
            self.sheetCompleted(sheet, in: host, operation: operation, response: response)
        }
        guard self.operation === operation, case .attaching = operation.phase else { return }
        guard operation.handoff.bindSheet(sheet, reviewID: review.id) else {
            operation.handoff.cancel()
            if host.attachedSheet === sheet || sheet.sheetParent === host {
                endSheet(presentation, in: host, operation: operation, decision: .presentationFailed)
            } else {
                finish(operation, notice: "差分シートを表示できませんでした。")
            }
            return
        }
        operation.phase = .reviewing(presentation)
        status?.stringValue = "シートで合成候補を確認してください。"
    }

    @objc private func closeReview(_ sender: NSButton) {
        guard let operation, case .reviewing(let sheet) = operation.phase,
              let host = window, host === session.window, host.attachedSheet === sheet.window else { return }
        if sender === sheet.cancel {
            operation.handoff.cancel()
            endSheet(sheet, in: host, operation: operation, decision: .cancelled)
        } else if sender === sheet.approve,
                  operation.handoff.approve(reviewID: sheet.reviewID, in: sheet.window) {
            endSheet(sheet, in: host, operation: operation, decision: .approved)
        }
    }

    private func endSheet(_ sheet: ReviewSheet, in host: NSWindow, operation: Operation, decision: Operation.Decision) {
        operation.phase = .closing(sheet, decision)
        sheet.cancel.isEnabled = false
        sheet.approve.isEnabled = false
        host.endSheet(sheet.window, returnCode: decision == .approved ? .OK : .cancel)
    }

    private func sheetCompleted(_ endedSheet: NSWindow, in host: NSWindow, operation: Operation,
                                response: NSApplication.ModalResponse) {
        guard self.operation === operation, window === host else { return }
        let sheet: ReviewSheet
        let decision: Operation.Decision
        switch operation.phase {
        case .attaching(let current):
            sheet = current
            decision = .presentationFailed
        case .reviewing(let current):
            sheet = current
            decision = .cancelled
        case .closing(let current, let chosen):
            sheet = current
            decision = chosen
        case .preparing, .completing:
            return
        }
        guard sheet.window === endedSheet else { return }
        operation.phase = .completing

        // The callback can be inside AppKit's closing transition. Inspect the actual
        // attachment and responder on the next turn exactly once; never force focus.
        DispatchQueue.main.async { [weak self, weak operation, weak host] in
            guard let self, let operation, self.operation === operation else { return }
            guard let host, self.window === host, self.session.window === host,
                  host.attachedSheet == nil, endedSheet.sheetParent == nil else {
                operation.handoff.cancel()
                if let host, self.window === host,
                   (host.attachedSheet === endedSheet || endedSheet.sheetParent === host) {
                    // Drop the approval even if AppKit leaves its sheet up. Do not call endSheet
                    // again; provide an explicit exit for this memory-only demo.
                    self.failedDismissalSheet = endedSheet
                    sheet.approve.isEnabled = false
                    sheet.header.stringValue = "シートの終了を確認できなかったため、候補は反映していません。デモを終了すると、編集内容は保存されずに失われます。"
                    sheet.cancel.title = "デモを終了"
                    sheet.cancel.keyEquivalent = "" // Escape must not quit the demo.
                    sheet.cancel.action = #selector(self.exitAfterFailedDismissal(_:))
                    sheet.cancel.isEnabled = true
                }
                self.finish(operation, notice: "シート終了後の編集画面を確認できなかったため、反映していません。")
                return
            }
            let notice: String
            if decision == .approved && response == .OK {
                do {
                    let receipt = try operation.handoff.sheetDidEnd(reviewID: sheet.reviewID, sheet: endedSheet, response: response)
                    if let receipt { self.latestReceipt = receipt }
                    switch receipt?.confirmation {
                    case .nativeCallback:
                        notice = "合成候補を反映しました。「元に戻す」（⌘Z）で取り消せます。"
                    case .reconciledFromEditor:
                        notice = "編集結果が原稿の状態に反映されていなかったため、確定した本文を照合して同期しました。「元に戻す」（⌘Z）で取り消せます。"
                    case nil:
                        notice = "採用を確認できなかったため、反映していません。"
                    }
                } catch AssistNativeReview.ApplyError.commitNotConfirmed {
                    notice = "本文が変わった可能性がありますが、編集の確定を確認できませんでした。再適用はしていません。本文を確認し、必要なら「元に戻す」（⌘Z）を使ってください。"
                } catch AssistNativeReview.ApplyError.nativeRefused {
                    notice = "エディタから反映の成功が返らなかったため、反映結果を確認できませんでした。本文を確認し、必要なら「元に戻す」（⌘Z）を使ってください。"
                } catch {
                    notice = "元の編集画面・原稿の状態を確認できなかったため、反映できませんでした。"
                }
            } else if decision == .presentationFailed {
                notice = "差分シートを表示できませんでした。"
            } else {
                notice = "候補の確認を取り消しました。"
            }
            self.finish(operation, notice: notice)
        }
    }

    @objc private func exitAfterFailedDismissal(_ sender: NSButton) {
        guard let sheet = failedDismissalSheet, sender.window === sheet, let window,
              window.attachedSheet === sheet || sheet.sheetParent === window else { return }
        NSApp.terminate(nil)
    }

    @objc private func showLatestRecord() {
        guard let host = window, host === session.window, host.isKeyWindow, host.attachedSheet == nil,
              operation == nil, recordSheet == nil, failedDismissalSheet?.sheetParent == nil,
              !session.tabs.isComposing, (host.firstResponder as? NSTextView)?.hasMarkedText() != true,
              let receipt = latestReceipt else { return }

        let sheet = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 640, height: 500),
                             styleMask: [.titled], backing: .buffered, defer: true)
        sheet.title = "直近の採用差分"
        sheet.isRestorable = false
        sheet.isReleasedWhenClosed = false
        let verification = switch receipt.confirmation {
        case .nativeCallback: "編集結果の通知と本文を照合"
        case .reconciledFromEditor: "編集面の確定本文から同期"
        }
        let header = NSTextField(wrappingLabelWithString: "デモの合成候補を反映した時点の記録（原稿の版 \(receipt.appliedRevision)、\(verification)）です。現在の本文との比較ではありません。Undoやその後の編集でこの記録は変わりません。")
        let diff = NSHostingView(rootView: AssistReviewDiff(
            rows: receipt.rows, before: receipt.before, after: receipt.after,
            boundaryNote: "採用時の選択部分だけを表示します。行番号と行末は選択範囲内です。"
        ))
        diff.sizingOptions = []
        let close = NSButton(title: "閉じる", target: self, action: #selector(closeRecord(_:)))
        close.keyEquivalent = "\u{1B}"
        close.keyEquivalentModifierMask = []
        sheet.contentView = Self.layout(header: header, body: diff, buttons: [close])
        sheet.initialFirstResponder = close
        sheet.defaultButtonCell = nil
        recordSheet = sheet
        host.beginSheet(sheet) { [weak self, weak sheet] _ in
            if let sheet, self?.recordSheet === sheet { self?.recordSheet = nil }
        }
    }

    @objc private func closeRecord(_ sender: NSButton) {
        guard sender.isEnabled, let sheet = recordSheet, sender.window === sheet,
              let host = window, host === session.window, host.attachedSheet === sheet else { return }
        sender.isEnabled = false
        host.endSheet(sheet, returnCode: .cancel)
    }

    @objc private func undoEdit() {
        guard operation == nil, recordSheet == nil, failedDismissalSheet?.sheetParent == nil,
              let window, window === session.window, window.isKeyWindow,
              window.attachedSheet == nil, !session.tabs.isComposing,
              let editor = window.firstResponder as? NSTextView, editor.window === window,
              !editor.hasMarkedText(), let undo = editor.undoManager, undo.canUndo else { return }
        undo.undo()
        status?.stringValue = "直前の編集を取り消しました。"
    }

    private func abandonReview() {
        operation?.task?.cancel()
        operation?.handoff.cancel()
        operation = nil
    }

    private func finish(_ operation: Operation, notice: String) {
        guard self.operation === operation else { return }
        abandonReview()
        reviewButton?.isEnabled = true
        undoButton?.isEnabled = true
        recordButton?.isEnabled = latestReceipt != nil
        status?.stringValue = notice
    }

    private static func layout(header: NSTextField, body: NSView, buttons: [NSButton], status: NSTextField? = nil) -> NSView {
        let controls = NSStackView(views: buttons)
        controls.orientation = .horizontal
        let stack = NSStackView(views: [header, body, controls] + (status.map { [$0] } ?? []))
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 12
        stack.edgeInsets = NSEdgeInsets(top: 16, left: 16, bottom: 16, right: 16)
        for view in [header, body] + (status.map { [$0] } ?? []) {
            view.widthAnchor.constraint(equalTo: stack.widthAnchor, constant: -32).isActive = true
        }
        return stack
    }
}
