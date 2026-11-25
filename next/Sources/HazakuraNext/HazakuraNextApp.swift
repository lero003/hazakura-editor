import SwiftUI

@main
struct HazakuraNextApp: App {
    var body: some Scene {
        Window("Hazakura Editor Next — 開発用", id: "scratch") {
            ScratchWorkspaceView(source: ProcessInfo.processInfo.arguments.contains("--long-sample")
                ? String(repeating: Self.sample + "\n\n", count: 1_500)
                : Self.sample)
        }
        .defaultSize(width: 900, height: 660)
        .restorationBehavior(.disabled)
    }

    private static let sample = """
        # 日本語の原稿

        ここは保存しない検証用の原稿です。入力・変換・取り消しを試せます。

        - Markdownの記号は原文のまま
        - 絵文字 🌸 と結合文字 が
        - 長い行もここで編集できます。
        """
}
