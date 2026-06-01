import type { RefObject } from "react";
import type { EditorTab, MenuLanguage } from "../types";

type DirtyTabCloseDialogProps = {
  cancelButtonRef: RefObject<HTMLButtonElement | null>;
  dialogRef: RefObject<HTMLElement | null>;
  onCancel: () => void;
  onDiscard: () => void;
  onSave: () => void;
  tab: EditorTab;
  menuLanguage: MenuLanguage;
};

type AppCloseDialogProps = {
  cancelButtonRef: RefObject<HTMLButtonElement | null>;
  dialogRef: RefObject<HTMLElement | null>;
  dirtyTabCount: number;
  menuLanguage: MenuLanguage;
  onCancel: () => void;
  onDiscardAll: () => void;
  onSaveAll: () => void;
};

export function DirtyTabCloseDialog({
  cancelButtonRef,
  dialogRef,
  onCancel,
  onDiscard,
  onSave,
  tab,
  menuLanguage,
}: DirtyTabCloseDialogProps) {
  const copy = getCloseDialogCopy(menuLanguage);

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        aria-describedby="close-tab-description"
        aria-labelledby="close-tab-title"
        aria-modal="true"
        className="close-dialog"
        ref={dialogRef}
        role="dialog"
      >
        <h2 id="close-tab-title">{copy.title}</h2>
        <p id="close-tab-description">{copy.tabDescription(tab.name)}</p>
        <div className="dialog-actions">
          <button type="button" onClick={onSave}>
            {copy.save}
          </button>
          <button type="button" onClick={onDiscard}>
            {copy.discard}
          </button>
          <button type="button" ref={cancelButtonRef} onClick={onCancel}>
            {copy.cancel}
          </button>
        </div>
      </section>
    </div>
  );
}

export function AppCloseDialog({
  cancelButtonRef,
  dialogRef,
  dirtyTabCount,
  menuLanguage,
  onCancel,
  onDiscardAll,
  onSaveAll,
}: AppCloseDialogProps) {
  const copy = getCloseDialogCopy(menuLanguage);

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        aria-describedby="close-app-description"
        aria-labelledby="close-app-title"
        aria-modal="true"
        className="close-dialog"
        ref={dialogRef}
        role="dialog"
      >
        <h2 id="close-app-title">{copy.title}</h2>
        <p id="close-app-description">
          {copy.appDescription(dirtyTabCount)}
        </p>
        <div className="dialog-actions">
          <button type="button" onClick={onSaveAll}>
            {copy.saveAll}
          </button>
          <button type="button" onClick={onDiscardAll}>
            {copy.discardAll}
          </button>
          <button type="button" ref={cancelButtonRef} onClick={onCancel}>
            {copy.cancel}
          </button>
        </div>
      </section>
    </div>
  );
}

function getCloseDialogCopy(lang: MenuLanguage) {
  return lang !== "en"
    ? {
        appDescription: (count: number) =>
          `${formatDirtyTabCount(count, lang)}を、hazakura editor を閉じる前に保存または破棄してください。`,
        cancel: "キャンセル",
        discard: "破棄",
        discardAll: "すべて破棄",
        save: "保存",
        saveAll: "すべて保存",
        tabDescription: (name: string) =>
          `${name} に未保存の変更があります。`,
        title: "未保存の変更",
      }
    : {
        appDescription: (count: number) =>
          `${formatDirtyTabCount(count, lang)} must be saved or discarded before closing hazakura editor.`,
        cancel: "Cancel",
        discard: "Discard",
        discardAll: "Discard All",
        save: "Save",
        saveAll: "Save All",
        tabDescription: (name: string) => `${name} has unsaved changes.`,
        title: "Unsaved changes",
      };
}

function formatDirtyTabCount(count: number, lang: MenuLanguage): string {
  if (lang !== "en") {
    return `未保存タブ ${count} 件`;
  }

  return count === 1 ? "1 unsaved tab" : `${count} unsaved tabs`;
}
