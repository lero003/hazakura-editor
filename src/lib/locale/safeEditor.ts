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
  /** サイドバー下端の「フォルダ内を検索」（モック準拠）。 */
  searchInFolder: string;
  resizeWorkspaceSidebar: string;
  resizeWorkspaceSidebarTitle: string;
  startHeading: string;
  /** Returning visit heading when resume or recovery is available. */
  startHeadingReturning: string;
  startActions: string;
  /** Short purpose-led pitch: write / read / verify. */
  startValuePitch: string;
  /** Where the files live (local-first promise). Mock 01 の盾つき一行。 */
  startLocalNote: string;
  /** Primary resume control for the last workspace folder. */
  startResumeWorkspace: (folderLabel: string) => string;
  startResumeSection: string;
  /** Explicit recent workspace folders (capped list; no indexing). */
  startRecentWorkspacesSection: string;
  startOpenRecentWorkspace: (folderLabel: string) => string;
  /** 履歴が無いときの案内。主要操作は消さずに理由を示す。 */
  startRecentEmpty: string;
  startRecoverySection: string;
  startRecoveryHeading: string;
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
      searchInFolder: "ふぉるだのなかをさがす",
      resizeWorkspaceSidebar: "ところとへんしゅうのはばをかへる",
      resizeWorkspaceSidebarTitle: "ひきて、ところとへんしゅうのはばをかへます",
      startHeading: "しづかにかきはじめる",
      startHeadingReturning: "つづきから かく",
      startActions: "はじめのわざ",
      startValuePitch: "かき、よみ、たしかめる。",
      startLocalNote: "ふぁいるは、じぶんのMacに。",
      startResumeWorkspace: (folderLabel) =>
        `まへの ところ「${folderLabel}」をひらく`,
      startResumeSection: "つづきを かく",
      startRecentWorkspacesSection: "さいきん ひらいた ところ",
      startOpenRecentWorkspace: (folderLabel) =>
        `ところ「${folderLabel}」をひらく`,
      startRecentEmpty: "さいきん ひらいた ところは まだ ありません",
      startRecoverySection: "たしかめる",
      startRecoveryHeading: "ほぞんまえの メモを ふっきゅう",
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
        searchInFolder: "フォルダ内を検索",
        resizeWorkspaceSidebar: "ワークスペースと編集領域の幅を変更",
        resizeWorkspaceSidebarTitle:
          "ドラッグしてワークスペースと編集領域の幅を変更します",
        startHeading: "静かに書き始める",
        startHeadingReturning: "続きから書く",
        startActions: "開始操作",
        startValuePitch: "書いて、読んで、確かめる。",
        startLocalNote: "ファイルは、自分のMacに。",
        startResumeWorkspace: (folderLabel) =>
          `前回のフォルダ「${folderLabel}」を開く`,
        startResumeSection: "続きを書く",
        startRecentWorkspacesSection: "最近開いたフォルダ",
        startOpenRecentWorkspace: (folderLabel) =>
          `フォルダ「${folderLabel}」を開く`,
        startRecentEmpty: "最近開いたフォルダはまだありません",
        startRecoverySection: "確かめる",
        startRecoveryHeading: "保存前のメモを復旧",
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
        searchInFolder: "Search in folder",
        resizeWorkspaceSidebar: "Resize workspace and editor columns",
        resizeWorkspaceSidebarTitle:
          "Drag to resize the workspace and editor columns",
        startHeading: "Start writing quietly",
        startHeadingReturning: "Continue where you left off",
        startActions: "Start actions",
        startValuePitch: "Write, read, and verify.",
        startLocalNote: "Your files stay on your Mac.",
        startResumeWorkspace: (folderLabel) =>
          `Open last folder “${folderLabel}”`,
        startResumeSection: "Continue writing",
        startRecentWorkspacesSection: "Recent folders",
        startOpenRecentWorkspace: (folderLabel) =>
          `Open folder “${folderLabel}”`,
        startRecentEmpty: "No recent folders yet",
        startRecoverySection: "Verify",
        startRecoveryHeading: "Recover pre-save notes",
        workspace: "Workspace",
        workspaceFileTree: "Workspace file tree",
      };
}
