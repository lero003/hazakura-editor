import Foundation
import HazakuraNextCore
import SwiftUI

/// Displays one scan and lets the user reserve one entry without retaining folder access.
struct FolderCatalogView: View {
    let catalog: SelectedFolderCatalog
    let canChoose: Bool
    let choose: (Data) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var selectedID: Data?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("フォルダの原稿一覧")
                .font(.title2)
                .accessibilityAddTraits(.isHeader)
            Text(verbatim: catalog.folderName)
                .font(.headline)
                .lineLimit(2)
            Text("一覧は自動更新されません。原稿を1件選び、続けて同じフォルダを選び直すと、読み取り専用で開けます。")
                .foregroundStyle(.secondary)
            Group {
                if catalog.entries.isEmpty {
                    ContentUnavailableView("候補がありません", systemImage: "doc.text", description: Text("直下の .md、.markdown、.txt が対象です。"))
                } else {
                    List(selection: $selectedID) {
                        ForEach(catalog.entries) { entry in
                            Text(verbatim: entry.name)
                                .tag(entry.id)
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            HStack {
                if !canChoose {
                    Text("新しいタブを開ける状態で、一覧を取り直してください。")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Button("閉じる") { dismiss() }
                    .keyboardShortcut(.cancelAction)
                Button("この原稿を選ぶ") {
                    if let selectedID { choose(selectedID) }
                }
                .disabled(!canChoose || selectedID == nil)
            }
        }
        .padding(20)
        .frame(width: 540, height: 420)
    }
}
