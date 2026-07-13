import { isJapaneseMenuLanguage, type MenuLanguage } from "../../types";
import { isKanaStyle } from "./_helpers";

export type SafeEditorCopy = {
  collapseWorkspaceSidebar: string;
  closeFile: (name: string) => string;
  editor: string;
  emptyTabs: string;
  newFile: string;
  noFileOpen: string;
  noFolderOpen: string;
  openFileTabs: string;
  openFiles: string;
  openFile: string;
  openFolder: string;
  openWorkspaceFolder: string;
  restoreWorkspaceSidebar: string;
  startHeading: string;
  startActions: string;
  /** Short purpose-led pitch: write / read / verify. */
  startValuePitch: string;
  startHintWrite: string;
  startHintRead: string;
  startHintVerify: string;
  workspace: string;
  workspaceFileTree: string;
};

export function getSafeEditorCopy(lang: MenuLanguage): SafeEditorCopy {
  if (isKanaStyle(lang)) {
  return {
      collapseWorkspaceSidebar: "ところをたたむ",
      closeFile: (name) => `${name}をとじる`,
      editor: "へんしゅう",
      emptyTabs: "ふみなし",
      newFile: "あたらしきふみ",
      noFileOpen: "ふみなし",
      noFolderOpen: "ふぉるだなし",
      openFileTabs: "ひらいている ふみのならび",
      openFiles: "ひらいている ふみ",
      openFile: "ふみをひらく",
      openFolder: "ふぉるだをひらく",
      openWorkspaceFolder: "ところをひらく",
      restoreWorkspaceSidebar: "ところをもどす",
      startHeading: "しづかにかきはじめる",
      startActions: "はじめのわざ",
      startValuePitch: "かき、よみ、たしかめる。",
      startHintWrite: "かく — Markdown を中央で",
      startHintRead: "よむ — プレビュー・L・電子書籍・参照",
      startHintVerify: "たしかめる — 差分・要確認・下書き復旧",
      workspace: "ところ",
      workspaceFileTree: "ところのふみならび",
    };
  }

  return isJapaneseMenuLanguage(lang)
    ? {
        collapseWorkspaceSidebar: "ワークスペースサイドバーを折りたたむ",
        closeFile: (name) => `${name}を閉じる`,
        editor: "編集",
        emptyTabs: "ファイル未選択",
        newFile: "新規ファイル",
        noFileOpen: "ファイル未選択",
        noFolderOpen: "フォルダ未選択",
        openFileTabs: "開いているファイルの一覧",
        openFiles: "開いているファイル",
        openFile: "ファイルを開く",
        openFolder: "フォルダを開く",
        openWorkspaceFolder: "ワークスペースフォルダを開く",
        restoreWorkspaceSidebar: "ワークスペースサイドバーを戻す",
        startHeading: "静かに書き始める",
        startActions: "開始操作",
        startValuePitch: "書いて、読んで、確かめる。",
        startHintWrite: "書く — 中央の Markdown 編集",
        startHintRead:
          "読む — プレビュー / L Mode / 電子書籍 / 右の参照",
        startHintVerify: "確かめる — 差分・要確認・未保存下書きの復旧",
        workspace: "ワークスペース",
        workspaceFileTree: "ワークスペースのファイルツリー",
      }
    : {
        collapseWorkspaceSidebar: "Collapse workspace sidebar",
        closeFile: (name) => `Close ${name}`,
        editor: "Editor",
        emptyTabs: "No open files",
        newFile: "New File",
        noFileOpen: "No file open",
        noFolderOpen: "No folder open",
        openFileTabs: "Open file tabs",
        openFiles: "Open files",
        openFile: "Open File",
        openFolder: "Open Folder",
        openWorkspaceFolder: "Open workspace folder",
        restoreWorkspaceSidebar: "Restore workspace sidebar",
        startHeading: "Start writing quietly",
        startActions: "Start actions",
        startValuePitch: "Write, read, and verify.",
        startHintWrite: "Write — Markdown in the center",
        startHintRead: "Read — Preview, L Mode, e-book, or a right-hand reference",
        startHintVerify: "Verify — Diff, review flags, and draft recovery",
        workspace: "Workspace",
        workspaceFileTree: "Workspace file tree",
      };
}
