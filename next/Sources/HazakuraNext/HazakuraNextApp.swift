import AppKit

@main
struct HazakuraNextApp {
    @MainActor static func main() {
        let application = NSApplication.shared
        let source = ProcessInfo.processInfo.arguments.contains("--long-sample")
            ? String(repeating: sample + "\n\n", count: 1_500)
            : sample
        let delegate = ScratchApplicationDelegate(source: source)
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
