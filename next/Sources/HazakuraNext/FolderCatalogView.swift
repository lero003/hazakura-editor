import Foundation
import HazakuraNextCore
import SwiftUI

/// Displays one scan's names, without file actions, refresh, or URLs.
struct FolderCatalogView: View {
    let catalog: SelectedFolderCatalog
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("フォルダの原稿一覧")
                .font(.title2)
                .accessibilityAddTraits(.isHeader)
            Text(verbatim: catalog.folderName)
                .font(.headline)
                .lineLimit(2)
            Text("取得時の候補名だけを表示し、自動更新はしません。ここからファイルを開いたり変更したりすることはできません。")
                .foregroundStyle(.secondary)
            Group {
                if catalog.names.isEmpty {
                    ContentUnavailableView("候補がありません", systemImage: "doc.text", description: Text("直下の .md、.markdown、.txt が対象です。"))
                } else {
                    List {
                        ForEach(catalog.names.map(Row.init)) { row in
                            Text(verbatim: row.name)
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            Button("閉じる") { dismiss() }
                .keyboardShortcut(.cancelAction)
                .frame(maxWidth: .infinity, alignment: .trailing)
        }
        .padding(20)
        .frame(width: 540, height: 420)
    }

    private struct Row: Identifiable {
        let name: String
        // Swift String equality folds canonically equivalent spellings; filesystem names may not.
        var id: Data { Data(name.utf8) }
    }
}
