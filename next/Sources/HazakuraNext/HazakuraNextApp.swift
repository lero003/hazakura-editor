import HazakuraNextCore
import HazakuraNextEditor
import SwiftUI

@main
struct HazakuraNextApp: App {
    var body: some Scene {
        Window("Hazakura Editor Next — 開発用", id: "scratch") {
            ScratchEditorView(source: ProcessInfo.processInfo.arguments.contains("--long-sample")
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

private struct ScratchEditorView: View {
    @State private var document: ScratchDocument

    init(source: String) {
        _document = State(initialValue: ScratchDocument(source: source))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("検証用の原稿です。ファイルを開く機能・保存・復旧はありません。")
                .font(.callout)
                .foregroundStyle(.secondary)
                .padding(12)
            Divider()
            TextKitEditor(initialText: document.source) { source in
                document.replaceSource(source)
            }
            .id(document.id)
        }
        .frame(minWidth: 450, minHeight: 300)
    }
}
