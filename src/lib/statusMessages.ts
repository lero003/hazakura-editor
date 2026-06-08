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
    "Bold markup applied": "太字の Markdown を適用しました",
    "Checking Agent Workbench launch gate...":
      "エージェントワークベンチの起動ゲートを確認中です...",
    "Change review failed": "変更確認に失敗しました",
    "Change review ready": "変更確認の準備ができました",
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
    "Manual candidate applied": "手動候補を適用しました",
    "Manual candidate apply failed": "手動候補の適用に失敗しました",
    "Creating file...": "ファイルを作成中...",
    "Draft discarded": "下書きを破棄しました",
    "Draft restored": "下書きを復元しました",
    "Enter a valid line number": "有効な行番号を入力してください",
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
    "Image markup inserted": "画像の Markdown を挿入しました",
    "Image preview closed": "画像プレビューを閉じました",
    "Image preview failed": "画像プレビューに失敗しました",
    "Image preview opened": "画像プレビューを開きました",
    "Inline code markup applied": "インラインコードの Markdown を適用しました",
    "Italic markup applied": "斜体の Markdown を適用しました",
    "Keeping local edits": "ローカル編集を保持します",
    "Link markup inserted": "リンクの Markdown を挿入しました",
    "Metadata check failed": "メタデータ確認に失敗しました",
    "New file cancelled": "新規ファイル作成をキャンセルしました",
    "New file created": "新規ファイルを作成しました",
    "New file created; folder refresh failed":
      "新規ファイルを作成しました。フォルダ更新には失敗しました",
    "New file failed": "新規ファイル作成に失敗しました",
    "No active tab to close": "閉じる対象のタブがありません",
    "No active tab to convert": "変換するアクティブタブがありません",
    "No active tab to format": "整形するアクティブタブがありません",
    "No active tab to save": "保存するアクティブタブがありません",
    "No Agent session to stop": "停止する Agent セッションはありません",
    "Open cancelled": "開く操作をキャンセルしました",
    "Open failed": "開けませんでした",
    "Opened safely": "安全に開きました",
    "Opening file...": "ファイルを開いています...",
    "Opening image preview...": "画像プレビューを開いています...",
    "Reading folder...": "フォルダを読み込み中...",
    "Ready": "準備完了",
    "Reopen failed": "再読み込みに失敗しました",
    "Reopened from disk": "ディスクから再読み込みしました",
    "Reopening from disk...": "ディスクから再読み込み中...",
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
    "Saving...": "保存中...",
    "Stop Agent session before changing provider":
      "プロバイダー変更前に Agent セッションを停止してください",
    "Stopping Agent session...": "Agent セッションを停止中...",
    "Strikethrough markup applied": "打ち消し線の Markdown を適用しました",
    "Tab closed": "タブを閉じました",
    "Tab focused": "タブにフォーカスしました",
    "Workspace restore skipped": "ワークスペース復元をスキップしました",
    "Workspace restored": "ワークスペースを復元しました",
    "Workspace restored with drafts": "下書き付きでワークスペースを復元しました",
  };

  if (exact[message]) {
    return exact[message];
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

  if (message.startsWith("Moved to line ")) {
    return `${message.slice("Moved to line ".length)} 行目へ移動しました`;
  }

  if (message.startsWith("Workspace restored: ")) {
    return `ワークスペースを復元しました: ${message.slice(
      "Workspace restored: ".length,
    )}`;
  }

  if (message.startsWith("Image saved: ")) {
    return `画像を保存しました: ${message.slice("Image saved: ".length)}`;
  }

  if (message.startsWith("Imported: ")) {
    return `画像を取込みました: ${message.slice("Imported: ".length)}`;
  }

  if (message.startsWith("Failed to import image: ")) {
    return `画像の取込みに失敗しました: ${message.slice("Failed to import image: ".length)}`;
  }

  if (message === "Saving pasted image...") {
    return "貼り付けた画像を保存中...";
  }

  if (message === "Image paste failed") {
    return "画像の貼り付けに失敗しました";
  }

  if (message === "Print unavailable") {
    return "印刷できません";
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
