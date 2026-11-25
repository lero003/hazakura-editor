import AppKit
import HazakuraNextCore

@main
struct HazakuraNextApp {
    enum LaunchMode: Equatable {
        case development(longSample: Bool), assistDemo, sandboxPreview
        case rejectAssistArgument, rejectPreviewArgument

        static func resolve(bundleID: String?, arguments: [String]) -> Self {
            switch bundleID {
            case "dev.hazakura.editor.next.assist-demo.dev": return .assistDemo
            case "dev.hazakura.editor.next.sandbox-preview.dev": return .sandboxPreview
            default: break
            }
            if arguments.contains("--assist-review-demo") { return .rejectAssistArgument }
            if arguments.contains("--sandbox-preview") || arguments.contains("--build-sandbox-preview") {
                return .rejectPreviewArgument
            }
            return .development(longSample: arguments.contains("--long-sample"))
        }
    }

    @MainActor static func main() {
        let mode = LaunchMode.resolve(bundleID: Bundle.main.bundleIdentifier,
                                      arguments: Array(ProcessInfo.processInfo.arguments.dropFirst()))
        switch mode {
        case .assistDemo:
            run(delegate: AssistReviewDemoDelegate())
        case .sandboxPreview:
            run(delegate: makeSandboxPreviewDelegate())
        case .rejectAssistArgument:
            rejectLaunch("採用デモは専用バンドルか開発用起動スクリプトで開いてください。")
        case .rejectPreviewArgument:
            rejectLaunch("権限検証は専用バンドルで行ってください。")
        case .development(let longSample):
            runDevelopment(longSample: longSample)
        }
    }

    private static func rejectLaunch(_ message: String) -> Never {
        FileHandle.standardError.write(Data((message + "\n").utf8))
        exit(EXIT_FAILURE)
    }

    @MainActor static func makeSandboxPreviewDelegate() -> ScratchApplicationDelegate {
        // Picker experiments do not need a recovery store. Never resolve the normal store's URL here.
        ScratchApplicationDelegate(source: sample, recoveryUnavailable: true,
                                   windowTitle: "Hazakura Editor Next — 権限検証用")
    }

    @MainActor private static func runDevelopment(longSample: Bool) {
        let source = longSample ? String(repeating: sample + "\n\n", count: 1_500) : sample
        do {
            let directory = try DraftRecoveryStore.defaultDirectory()
            let lease = try DraftRecoveryStore.claimApplicationSession(in: directory)
            let recovery = RecoveryCheckpointQueue(store: DraftRecoveryStore(directory: directory))
            withExtendedLifetime(lease) { run(source: source, recovery: recovery) }
        } catch DraftRecoveryStore.StoreError.lockContended {
            // Launch Services brings the running app forward. If invoked directly, a second
            // process must not start editing or delete the running app's recovery records.
            return
        } catch {
            run(source: source, recovery: nil, recoveryUnavailable: true)
        }
    }

    @MainActor private static func run(
        source: String, recovery: RecoveryCheckpointQueue?, recoveryUnavailable: Bool = false
    ) {
        run(delegate: ScratchApplicationDelegate(source: source, recovery: recovery, recoveryUnavailable: recoveryUnavailable))
    }

    @MainActor private static func run(delegate: any NSApplicationDelegate) {
        let application = NSApplication.shared
        application.setActivationPolicy(.regular)
        application.delegate = delegate
        withExtendedLifetime(delegate) { application.run() }
    }

    private static let sample = """
        # 日本語の原稿

        ここは保存しない検証用の原稿です。入力・変換・取り消しを試せます。

        - Markdownの記号は原文のまま
        - 絵文字 🌸 と結合文字 が
        - 長い行もここで編集できます。
        """
}
