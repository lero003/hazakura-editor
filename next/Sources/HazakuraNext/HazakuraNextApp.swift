import AppKit
import HazakuraNextCore

@main
struct HazakuraNextApp {
    @MainActor static func main() {
        let arguments = ProcessInfo.processInfo.arguments.dropFirst()
        if Bundle.main.bundleIdentifier == "dev.hazakura.editor.next.assist-demo.dev" {
            // The demo has its own delegate and skips even the lookup/lease of the recovery directory.
            run(delegate: AssistReviewDemoDelegate())
            return
        }
        if arguments.contains("--assist-review-demo") {
            // Never let a direct invocation of the ordinary bundle fall through to recovery.
            let message = "採用デモは専用バンドルか開発用起動スクリプトで開いてください。\n"
            FileHandle.standardError.write(Data(message.utf8))
            exit(EXIT_FAILURE)
        }
        let source = arguments.contains("--long-sample")
            ? String(repeating: sample + "\n\n", count: 1_500)
            : sample
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
