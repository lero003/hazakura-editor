import AppKit
import HazakuraNextCore

@main
struct HazakuraNextApp {
    @MainActor static func main() {
        let source = ProcessInfo.processInfo.arguments.contains("--long-sample")
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
        let application = NSApplication.shared
        let delegate = ScratchApplicationDelegate(source: source, recovery: recovery, recoveryUnavailable: recoveryUnavailable)
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
