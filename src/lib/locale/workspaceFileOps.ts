import { isJapaneseMenuLanguage, type MenuLanguage } from "../../types";
import { isKanaStyle } from "./_helpers";

// Strings for the v0.9 bounded workspace file ops lane (New
// File / New Folder from the sidebar header and folder right-
// click, Rename via the inline tree editor, Move via drag/drop,
// and the dirty / external-change warn dialog that fires before
// a rename if the open tab is dirty or the file was modified
// outside the app). All entries are localized in three styles
// (kana / Japanese menu / English) so the new chrome and dialog
// match the existing 3-way split.

export type WorkspaceFileOpsCopy = {
  loading: string;
  partialEntries: string;
  openFileState: string;
  unsavedOpenFileState: string;
  sidebarNewButton: string;
  newFileRoot: string;
  newFolderRoot: string;
  newOkfScaffoldMinimalRoot: string;
  newOkfScaffoldBookLikeRoot: string;
  /** Section label grouping OKF starters under New (progressive disclosure). */
  newOkfScaffoldGroup: string;
  newFileHere: string;
  newFolderHere: string;
  rename: string;
  renameDialogTitle: string;
  renameDirtyWarning: string;
  renameExternalChangeWarning: string;
  renameConfirm: string;
  renameCancel: string;
  moveOverwriteError: string;
  moveError: string;
  moveToTrash: string;
  moveToTrashTitle: string;
  moveToTrashConfirm: string;
  moveToTrashCancel: string;
  moveToTrashError: string;
  sidebarTrashButton: string;
  /** Footer trash when the target is known (exact name). */
  sidebarTrashTarget: (name: string) => string;
  sidebarTrashDisabledNoActive: string;
  sidebarTrashDisabledNotInTree: string;
};

export function getWorkspaceFileOpsCopy(
  lang: MenuLanguage,
): WorkspaceFileOpsCopy {
  if (isKanaStyle(lang)) {
    return {
      loading: "よみこみちゅう…",
      partialEntries: "ふぉるだごとの じょうげんにより いちぶの ふみは みえません。",
      openFileState: "ひらいている",
      unsavedOpenFileState: "ほぞんまえ",
      sidebarNewButton: "あたらしく",
      newFileRoot: "あたらしきふみ",
      newFolderRoot: "あたらしきふぉるだ",
      newOkfScaffoldMinimalRoot: "さいしょう",
      newOkfScaffoldBookLikeRoot: "ほんっぽい しょうだて",
      newOkfScaffoldGroup: "ちしきフォルダの ひながた",
      newFileHere: "このふぉるだに あたらしきふみ",
      newFolderHere: "このふぉるだに あたらしきふぉるだ",
      rename: "なまえを かえる",
      renameDialogTitle: "なまえを かえる",
      renameDirtyWarning:
        "このふみには ほぞんしていない へんこうが あります。なまえを かえますか？",
      renameExternalChangeWarning:
        "このふみは アプリのそとで へんこうされた ようです。なまえを かえますか？",
      renameConfirm: "かえる",
      renameCancel: "やめる",
      moveOverwriteError: "いどうさきに おなじなまえの ふみまたは ふぉるだが あります。",
      moveError: "ふみの いどうに しっぱいしました。",
      moveToTrash: "ごみばこに すてる",
      moveToTrashTitle: "ごみばこに すてる",
      moveToTrashConfirm: "すてる",
      moveToTrashCancel: "やめる",
      moveToTrashError: "ごみばこへの すてかたに しっぱいしました。",
      sidebarTrashButton: "ごみばこ",
      sidebarTrashTarget: (name) => `「${name}」を ごみばこへ`,
      sidebarTrashDisabledNoActive: "ツリーで ふみまたは ふぉるだを えらんでください",
      sidebarTrashDisabledNotInTree:
        "ひらいている ふみが ツリーに みえるまで ふぉるだを ひらいてください",
    };
  }

  return isJapaneseMenuLanguage(lang)
    ? {
        loading: "読み込み中…",
        partialEntries: "フォルダごとの上限により一部の項目は非表示です。",
        openFileState: "開いている",
        unsavedOpenFileState: "未保存",
        sidebarNewButton: "新規",
        newFileRoot: "新規ファイル",
        newFolderRoot: "新規フォルダ",
        newOkfScaffoldMinimalRoot: "最小",
        newOkfScaffoldBookLikeRoot: "本っぽい章立て",
        newOkfScaffoldGroup: "知識フォルダのひな形",
        newFileHere: "このフォルダに新規ファイル",
        newFolderHere: "このフォルダに新規フォルダ",
        rename: "名前を変更",
        renameDialogTitle: "名前を変更",
        renameDirtyWarning:
          "このファイルには未保存の変更があります。名前を変更しますか？",
        renameExternalChangeWarning:
          "このファイルはアプリ外で変更されたようです。名前を変更しますか？",
        renameConfirm: "変更する",
        renameCancel: "キャンセル",
        moveOverwriteError:
          "移動先に同じ名前のファイルまたはフォルダがあります。",
        moveError: "ファイルの移動に失敗しました。",
        moveToTrash: "ゴミ箱へ",
        moveToTrashTitle: "ゴミ箱へ移動",
        moveToTrashConfirm: "ゴミ箱へ",
        moveToTrashCancel: "キャンセル",
        moveToTrashError: "ゴミ箱への移動に失敗しました。",
        sidebarTrashButton: "ゴミ箱",
        sidebarTrashTarget: (name) => `「${name}」をゴミ箱へ`,
        sidebarTrashDisabledNoActive:
          "ツリーでファイルまたはフォルダを選択してください",
        sidebarTrashDisabledNotInTree:
          "開いているファイルがツリーに見えるまでフォルダを展開してください",
      }
    : {
        loading: "Loading…",
        partialEntries: "Some entries are hidden by the per-folder limit.",
        openFileState: "open",
        unsavedOpenFileState: "unsaved",
        sidebarNewButton: "New",
        newFileRoot: "New File",
        newFolderRoot: "New Folder",
        newOkfScaffoldMinimalRoot: "Minimal",
        newOkfScaffoldBookLikeRoot: "Book-like chapters",
        newOkfScaffoldGroup: "Knowledge folder starters",
        newFileHere: "New File Here",
        newFolderHere: "New Folder Here",
        rename: "Rename",
        renameDialogTitle: "Rename",
        renameDirtyWarning:
          "This file has unsaved changes. Rename anyway?",
        renameExternalChangeWarning:
          "This file was modified outside the app. Rename anyway?",
        renameConfirm: "Rename",
        renameCancel: "Cancel",
        moveOverwriteError:
          "A file or folder with the same name already exists at the destination.",
        moveError: "Could not move the file.",
        moveToTrash: "Move to Trash",
        moveToTrashTitle: "Move to Trash",
        moveToTrashConfirm: "Move to Trash",
        moveToTrashCancel: "Cancel",
        moveToTrashError: "Could not move the entry to the Trash.",
        sidebarTrashButton: "Trash",
        sidebarTrashTarget: (name) => `Move “${name}” to Trash`,
        sidebarTrashDisabledNoActive: "Select a file or folder in the tree",
        sidebarTrashDisabledNotInTree:
          "Expand the tree until the active file is visible",
      };
}
