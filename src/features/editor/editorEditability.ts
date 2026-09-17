import type { EditorView } from "@codemirror/view";

// CodeMirror の `EditorState.readOnly` は「コマンドが参照する情報」であり、
// `view.dispatch({ changes })` 自体を止めるものではない。DOM からの直接編集は
// `EditorView.editable` が止めるが、自作コマンドの API 経由の変更は止まらない。
//
// ユーザー起点で本文を変更する自作コマンドは、入口で必ずここを通して検査する。
// 外部値の同期・タブ復元・検索ハイライトの再適用など「システム側の更新」は
// 対象外（一律に止めると復元や同期が壊れる）。
export function canEditView(view: EditorView): boolean {
  return !view.state.readOnly;
}
