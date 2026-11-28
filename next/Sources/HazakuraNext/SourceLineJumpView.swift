import SwiftUI

struct SourceLineJumpView: View {
    let title: String
    let move: (Int) -> Bool
    let cancel: () -> Void
    @State private var input = ""
    @State private var rejected = false
    @FocusState private var isLineFieldFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("原文の行へ移動").font(.headline)
            Text(verbatim: title).lineLimit(1).foregroundStyle(.secondary)
            TextField("行番号", text: $input, prompt: Text("例：25"))
                .focused($isLineFieldFocused)
                .onChange(of: input) { rejected = false }
            Text("行番号は1以上の半角数字で入力してください。")
                .font(.callout)
                .foregroundStyle(.secondary)
            if rejected {
                Text("指定の行に移動できません。行番号と原稿を確認してください。")
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
            HStack {
                Spacer()
                Button("キャンセル", action: cancel).keyboardShortcut(.cancelAction)
                Button("移動") {
                    guard let line else { return }
                    rejected = !move(line)
                }
                .keyboardShortcut(.defaultAction)
                .disabled(line == nil)
            }
        }
        .defaultFocus($isLineFieldFocused, true)
        .padding(20)
        .frame(width: 380)
    }

    private var line: Int? {
        guard (1...10).contains(input.utf8.count), input.utf8.allSatisfy({ (48...57).contains($0) }),
              let number = Int(input), number > 0 else { return nil }
        return number
    }
}
