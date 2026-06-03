import { isJapaneseMenuLanguage, type MenuLanguage } from "../../types";
import { isKanaStyle } from "./_helpers";

export type SafeEditorCopy = {
  emptyTabs: string;
  newFile: string;
  noFileOpen: string;
  noFolderOpen: string;
  openFile: string;
  openFolder: string;
  openWorkspaceFolder: string;
  pinnedFiles: string;
  pinFile: string;
  unpinFile: string;
  recentFiles: string;
  startHeading: string;
  startActions: string;
  workspace: string;
  workspaceFileTree: string;
};

export function getSafeEditorCopy(lang: MenuLanguage): SafeEditorCopy {
  if (isKanaStyle(lang)) {
    return {
      emptyTabs: "ふみなし",
      newFile: "あたらしきふみ",
      noFileOpen: "ふみなし",
      noFolderOpen: "ふぉるだなし",
      openFile: "ふみをひらく",
      openFolder: "ふぉるだをひらく",
      openWorkspaceFolder: "ところをひらく",
      pinnedFiles: "いつもこのふみ",
      pinFile: "いつもこのふみにする",
      unpinFile: "いつもこのふみをやめる",
      recentFiles: "このごろのふみ",
      startHeading: "しづかにかきはじめる",
      startActions: "はじめのわざ",
      workspace: "ところ",
      workspaceFileTree: "ところのふみならび",
    };
  }

  return isJapaneseMenuLanguage(lang)
    ? {
        emptyTabs: "ファイル未選択",
        newFile: "新規ファイル",
        noFileOpen: "ファイル未選択",
        noFolderOpen: "フォルダ未選択",
        openFile: "ファイルを開く",
        openFolder: "フォルダを開く",
        openWorkspaceFolder: "ワークスペースフォルダを開く",
        pinnedFiles: "ピン留めのファイル",
        pinFile: "ピン留めする",
        unpinFile: "ピン留めを外す",
        recentFiles: "最近使ったファイル",
        startHeading: "静かに書き始める",
        startActions: "開始操作",
        workspace: "ワークスペース",
        workspaceFileTree: "ワークスペースのファイルツリー",
      }
    : {
        emptyTabs: "No open files",
        newFile: "New File",
        noFileOpen: "No file open",
        noFolderOpen: "No folder open",
        openFile: "Open File",
        openFolder: "Open Folder",
        openWorkspaceFolder: "Open workspace folder",
        pinnedFiles: "Pinned files",
        pinFile: "Pin file",
        unpinFile: "Unpin file",
        recentFiles: "Recent files",
        startHeading: "Start writing quietly",
        startActions: "Start actions",
        workspace: "Workspace",
        workspaceFileTree: "Workspace file tree",
      };
}
