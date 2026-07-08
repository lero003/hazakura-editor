import type { MarkdownFormat } from "../components/editor/EditorPane";
import type { MenuLanguage } from "../types";

export function localizeStatusMessage(
  message: string,
  menuLanguage: MenuLanguage,
): string {
  if (menuLanguage === "en") {
    return message;
  }

  const exact: Record<string, string> = {
    "A tab is already open at the selected Save As path.":
      "選択した別名保存先には既にタブが開かれています。",
    "Agent input failed": "Agent 入力に失敗しました",
    "Agent launch gate passed": "Agent 起動ゲートを通過しました",
    "Agent launch rejected": "Agent 起動が拒否されました",
    "Agent launch unavailable": "Agent 起動は利用できません",
    "Agent provider not found": "Agent プロバイダーが見つかりません",
    "Agent session exited": "Agent セッションは終了しました",
    "Agent session running": "Agent セッション実行中",
    "Agent session state unavailable": "Agent セッション状態を取得できません",
    "Agent session stop failed": "Agent セッションの停止に失敗しました",
    "Agent session stopped": "Agent セッションを停止しました",
    "Agent terminal resize failed": "Agent ターミナルのリサイズに失敗しました",
    "Hazakura Local Assist discard failed": "Hazakura Local Assist の破棄に失敗しました",
    "Hazakura Local Assist edit discarded": "Hazakura Local Assist の編集を破棄しました",
    "Backup applied — save to keep changes":
      "バックアップを適用しました。変更を保存して保持してください",
    "Backup apply failed": "バックアップの適用に失敗しました",
    "Backup review failed": "バックアップ確認に失敗しました",
    "Backup review ready": "バックアップ確認の準備ができました",
    "Bold markup applied": "太字の Markdown を適用しました",
    "Cannot move a folder into itself.":
      "フォルダを同じ場所に移動することはできません。",
    "Checking Agent Workbench launch gate...":
      "エージェントワークベンチの起動ゲートを確認中です...",
    "Change review failed": "変更確認に失敗しました",
    "Change review ready": "変更確認の準備ができました",
    "Change review skipped; document changed":
      "文書変更のため変更確認をスキップしました",
    "Choosing file...": "ファイルを選択中...",
    "Choosing folder...": "フォルダを選択中...",
    "Choosing new file path...": "新規ファイルの保存先を選択中...",
    "Choosing Save As path...": "別名保存先を選択中...",
    "Close cancelled": "閉じる操作をキャンセルしました",
    "Close failed": "閉じる操作に失敗しました",
    "Close needs confirmation": "閉じる前に確認が必要です",
    "Close stopped": "閉じる操作を停止しました",
    "Closing window...": "ウィンドウを閉じています...",
    "Compare closed": "比較結果を閉じました",
    "Compare failed": "比較に失敗しました",
    "Compare ready": "比較の準備ができました",
    "Comparing files...": "ファイルを比較中...",
    "Create folder failed": "フォルダ作成に失敗しました",
    "Creating file...": "ファイルを作成中...",
    "Creating folder...": "フォルダ作成中...",
    "Creating workspace...": "ワークスペースを作成中...",
    "Draft discarded": "下書きを破棄しました",
    "Draft restored": "下書きを復元しました",
    "Enter a valid line number": "有効な行番号を入力してください",
    "Error dismissed": "エラー表示を閉じました",
    "Export EPUB beta failed": "EPUB書き出しに失敗しました",
    "Export EPUB beta stopped; document changed":
      "文書の変更で EPUB書き出しを停止しました",
    "Export HTML failed": "HTML のエクスポートに失敗しました",
    "Export HTML stopped; document changed":
      "文書の変更で HTML エクスポートを停止しました",
    "External change detected": "外部変更を検出しました",
    "External change refreshed": "外部変更を再読み込みしました",
    "Find closed": "検索を閉じました",
    "Folder load failed": "フォルダの読み込みに失敗しました",
    "Folder open cancelled": "フォルダを開く操作をキャンセルしました",
    "Folder open failed": "フォルダを開けませんでした",
    "Folder opened": "フォルダを開きました",
    "Failed to update window theme": "ウィンドウのテーマ更新に失敗しました",
    "Failed to update window background color":
      "ウィンドウの背景色更新に失敗しました",
    "Failed to update window title": "ウィンドウのタイトル更新に失敗しました",
    "Failed to update app menu state":
      "アプリケーションメニューの状態更新に失敗しました",
    "Failed to update theme menu state":
      "テーマメニューの状態更新に失敗しました",
    "Image markup inserted": "画像の Markdown を適用しました",
    "Image paste failed": "画像の貼り付けに失敗しました",
    "Choosing PDF or image to import…": "取り込む PDF / 画像を選択中…",
    "Import cancelled": "取り込みをキャンセルしました",
    "Importing to Markdown draft…": "Markdown 下書きを作成中…",
    "Import failed": "取り込みに失敗しました",
    "Imported text draft": "テキスト抽出の下書きを開きました",
    "Imported OCR draft": "OCR 下書きを開きました",
    "Image preview closed": "画像プレビューを閉じました",
    "Image preview failed": "画像プレビューに失敗しました",
    "Image preview opened": "画像プレビューを開きました",
    "Inline code markup applied": "インラインコードの Markdown を適用しました",
    "Inserted 3-column table — edit cells manually":
      "3 列テーブルを挿入しました。セルを手動で編集してください",
    "Italic markup applied": "斜体の Markdown を適用しました",
    "Keeping local edits": "ローカル編集を保持します",
    "Link markup inserted": "リンクの Markdown を挿入しました",
    "Manual candidate applied": "手動候補を適用しました",
    "Manual candidate apply failed": "手動候補の適用に失敗しました",
    "Metadata check failed": "メタデータ確認に失敗しました",
    "Move cancelled": "移動をキャンセルしました",
    "Move failed": "移動に失敗しました",
    "Move to Trash failed": "ゴミ箱への移動に失敗しました",
    "Moved; folder refresh failed":
      "移動しました。フォルダ更新には失敗しました",
    "Moving...": "移動中...",
    "Moving to Trash...": "ゴミ箱に移動中...",
    "Moved to line ": "行目へ移動しました",
    "New file cancelled": "新規ファイル作成をキャンセルしました",
    "New file created": "新規ファイルを作成しました",
    "New file created; folder refresh failed":
      "新規ファイルを作成しました。フォルダ更新には失敗しました",
    "New file failed": "新規ファイル作成に失敗しました",
    "New folder created; folder refresh failed":
      "新規フォルダを作成しました。フォルダ更新には失敗しました",
    "New folder failed": "新規フォルダの作成に失敗しました",
    "No active document to export": "エクスポート対象のドキュメントがありません",
    "No active document to export PDF":
      "PDF書き出し対象のドキュメントがありません",
    "No active document to print": "印刷対象のドキュメントがありません",
    "No active tab to close": "閉じる対象のタブがありません",
    "No active tab to convert": "変換するアクティブタブがありません",
    "No active tab to format": "整形するアクティブタブがありません",
    "No active tab to save": "保存するアクティブタブがありません",
    "No Agent session to stop": "停止する Agent セッションはありません",
    "No other tab to focus": "フォーカスできる他のタブがありません",
    "No workspace open": "ワークスペースが開かれていません",
    "Open a file in a workspace to restore a backup":
      "バックアップを復元するには、ワークスペースでファイルを開いてください",
    "Open a folder first to enable image paste":
      "画像貼り付けを有効にするには先にフォルダを開いてください",
    "Open cancelled": "開く操作をキャンセルしました",
    "Open failed": "開けませんでした",
    "Opened safely": "安全に開きました",
    "Opened": "開きました: ",
    "Opening file...": "ファイルを開いています...",
    "Opening in browser for printing...": "印刷用にブラウザで開いています...",
    "Opening image preview...": "画像プレビューを開いています...",
    "Reading folder...": "フォルダを読み込み中...",
    "Ready": "準備完了",
    "Reopen failed": "再読み込みに失敗しました",
    "Reopen skipped; document changed":
      "ドキュメント変更により再読み込みをスキップしました",
    "Reopened from disk": "ディスクから再読み込みしました",
    "Reopening from disk...": "ディスクから再読み込み中...",
    "PDF export stopped; document changed":
      "ドキュメント変更によりPDF書き出しを停止しました",
    "PDF export unavailable": "PDFを書き出せません",
    "PDF exported": "PDFを書き出しました",
    "Preparing PDF export...": "PDF書き出しを準備中...",
    "Print unavailable": "印刷できません",
    "Rename cancelled": "名前変更をキャンセルしました",
    "Rename failed": "名前変更に失敗しました",
    "Renamed; folder refresh failed":
      "名前を変更しました。フォルダ更新には失敗しました",
    "Renamed to ": "名前を変更しました: ",
    "Renaming...": "名前変更中...",
    "Restore from backup failed": "バックアップ復元に失敗しました",
    "Reviewing backup...": "バックアップを確認中...",
    "Reviewing changes...": "変更を確認中...",
    "Restoring workspace...": "ワークスペースを復元中...",
    "Save As cancelled": "別名保存をキャンセルしました",
    "Save As failed": "別名保存に失敗しました",
    "Save As stopped": "別名保存を停止しました",
    "Saved": "保存しました",
    "Saved as": "別名保存しました",
    "Saved as; folder refresh failed":
      "別名保存しました。フォルダ更新には失敗しました",
    "Saving as...": "別名保存中...",
    "Saving before close...": "閉じる前に保存中...",
    "Saving pasted image...": "貼り付け画像を保存中...",
    "Saving...": "保存中...",
    "Stop Agent session before changing assist surface":
      "Assist surface 変更前に Agent セッションを停止してください",
    "Stop Agent session before changing provider":
      "プロバイダー変更前に Agent セッションを停止してください",
    "Stopping Agent session...": "Agent セッションを停止中...",
    "Strikethrough markup applied": "打ち消し線の Markdown を適用しました",
    "Tab closed": "タブを閉じました",
    "Tab focused": "タブにフォーカスしました",
    "Trashed; folder refresh failed":
      "ゴミ箱へ移動しました。フォルダ更新には失敗しました",
    "Workspace restore skipped": "ワークスペース復元をスキップしました",
    "Workspace restored": "ワークスペースを復元しました",
    "Workspace restored with drafts": "下書き付きでワークスペースを復元しました",
  };

  if (exact[message]) {
    return exact[message];
  }

  if (message.startsWith("Agent session state unavailable: ")) {
    return `Agent セッション状態を取得できません: ${message.slice(
      "Agent session state unavailable: ".length,
    )}`;
  }

  if (message.startsWith("Agent session stop failed: ")) {
    return `Agent セッションの停止に失敗しました: ${message.slice(
      "Agent session stop failed: ".length,
    )}`;
  }

  if (message.startsWith("Agent input failed: ")) {
    return `Agent 入力に失敗しました: ${message.slice(
      "Agent input failed: ".length,
    )}`;
  }

  if (message.startsWith("Agent terminal resize failed: ")) {
    return `Agent ターミナルのリサイズに失敗しました: ${message.slice(
      "Agent terminal resize failed: ".length,
    )}`;
  }

  if (message.startsWith("Close failed: ")) {
    return `閉じる操作に失敗しました: ${message.slice("Close failed: ".length)}`;
  }

  if (message.startsWith("Restore from backup failed: ")) {
    return `バックアップ復元に失敗しました: ${message.slice(
      "Restore from backup failed: ".length,
    )}`;
  }

  if (message.startsWith("Export HTML failed: ")) {
    return `HTML のエクスポートに失敗しました: ${message.slice(
      "Export HTML failed: ".length,
    )}`;
  }

  if (message.startsWith("Export EPUB beta failed: ")) {
    return `EPUB書き出しに失敗しました: ${message.slice(
      "Export EPUB beta failed: ".length,
    )}`;
  }

  if (message.startsWith("Restart failed: ")) {
    return `再起動に失敗しました: ${message.slice("Restart failed: ".length)}`;
  }

  if (message.startsWith("Agent provider selected: ")) {
    return `Agent プロバイダーを選択: ${message.slice("Agent provider selected: ".length)}`;
  }

  if (message.startsWith("Provider not found: ")) {
    return message
      .replace("Provider not found:", "プロバイダーが見つかりません:")
      .replace(
        " was not found in the app search path, including common Homebrew and user bin locations.",
        " はアプリの検索パス（一般的な Homebrew と user bin を含む）で見つかりませんでした。",
      );
  }

  if (message.startsWith("Line endings set to ")) {
    return `改行コードを ${message.slice("Line endings set to ".length)} に変更しました`;
  }

  if (message.startsWith("Encoding set to ")) {
    return `文字エンコーディングを ${message.slice("Encoding set to ".length)} に変更しました`;
  }

  if (message.startsWith("Moved to line ")) {
    return `${message.slice("Moved to line ".length)} 行目へ移動しました`;
  }

  if (message.startsWith("Moved to ")) {
    return `移動先: ${message.slice("Moved to ".length)} に移動しました`;
  }

  if (message.startsWith("Moved ")) {
    const detail = message.slice("Moved ".length);
    const toTrashSuffix = " to Trash";
    if (detail.endsWith(toTrashSuffix)) {
      return `${detail.slice(0, -toTrashSuffix.length)} をゴミ箱に移動しました`;
    }

    return `${detail} を移動しました`;
  }

  if (message.startsWith("Renamed to ")) {
    return `名前を変更しました: ${message.slice("Renamed to ".length)}`;
  }

  if (message.startsWith("New file created: ")) {
    return `新規ファイルを作成しました: ${message.slice("New file created: ".length)}`;
  }

  if (message.startsWith("Opened ")) {
    return `開きました: ${message.slice("Opened ".length)}`;
  }

  if (message.startsWith("Workspace restored: ")) {
    return `ワークスペースを復元しました: ${message.slice(
      "Workspace restored: ".length,
    )}`;
  }

  if (message.startsWith("Exported HTML: ")) {
    return `HTML を保存しました: ${message.slice("Exported HTML: ".length)}`;
  }

  if (message.startsWith("Exported EPUB beta: ")) {
    return `EPUBを保存しました: ${message.slice(
      "Exported EPUB beta: ".length,
    )}`;
  }

  if (message.startsWith("Exported EPUB with image warnings: ")) {
    return `EPUBを保存しました（一部の画像は置き換えました）: ${message.slice(
      "Exported EPUB with image warnings: ".length,
    )}`;
  }

  if (message.startsWith("Exported EPUB: ")) {
    return `EPUBを保存しました: ${message.slice("Exported EPUB: ".length)}`;
  }

  if (message.startsWith("Image saved: ")) {
    return `画像を保存しました: ${message.slice("Image saved: ".length)}`;
  }

  if (message.startsWith("Image paste failed: ")) {
    return `画像の貼り付けに失敗しました: ${message.slice(
      "Image paste failed: ".length,
    )}`;
  }

  if (message.startsWith("Imported: ")) {
    return `画像を取り込みました: ${message.slice("Imported: ".length)}`;
  }

  if (message.startsWith("Imported text draft (")) {
    return `テキスト抽出の下書きを開きました（${message.slice(
      "Imported text draft (".length,
    )}`;
  }

  if (message.startsWith("Imported OCR draft (")) {
    return `OCR 下書きを開きました（${message.slice("Imported OCR draft (".length)}`;
  }

  if (message.startsWith("Failed to import image: ")) {
    return `画像の取り込みに失敗しました: ${message.slice(
      "Failed to import image: ".length,
    )}`;
  }

  if (message === "Print unavailable") {
    return "印刷できません";
  }

  if (message === "PDF export unavailable") {
    return "PDFを書き出せません";
  }

  return message;
}

export function markdownFormatStatus(format: MarkdownFormat): string {
  switch (format) {
    case "bold":
      return "Bold markup applied";
    case "italic":
      return "Italic markup applied";
    case "code":
      return "Inline code markup applied";
    case "strikethrough":
      return "Strikethrough markup applied";
    case "link":
      return "Link markup inserted";
    case "image":
      return "Image markup inserted";
  }
}
