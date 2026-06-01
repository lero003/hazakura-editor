import type { RefObject } from "react";
import type { EditorTab } from "../types";

type DirtyTabCloseDialogProps = {
  cancelButtonRef: RefObject<HTMLButtonElement | null>;
  dialogRef: RefObject<HTMLElement | null>;
  onCancel: () => void;
  onDiscard: () => void;
  onSave: () => void;
  tab: EditorTab;
};

type AppCloseDialogProps = {
  cancelButtonRef: RefObject<HTMLButtonElement | null>;
  dialogRef: RefObject<HTMLElement | null>;
  dirtyTabCount: number;
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
}: DirtyTabCloseDialogProps) {
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
        <h2 id="close-tab-title">Unsaved changes</h2>
        <p id="close-tab-description">{tab.name} has unsaved changes.</p>
        <div className="dialog-actions">
          <button type="button" onClick={onSave}>
            Save
          </button>
          <button type="button" onClick={onDiscard}>
            Discard
          </button>
          <button type="button" ref={cancelButtonRef} onClick={onCancel}>
            Cancel
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
  onCancel,
  onDiscardAll,
  onSaveAll,
}: AppCloseDialogProps) {
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
        <h2 id="close-app-title">Unsaved changes</h2>
        <p id="close-app-description">
          {formatDirtyTabCount(dirtyTabCount)} must be saved or discarded before
          closing hazakura editor.
        </p>
        <div className="dialog-actions">
          <button type="button" onClick={onSaveAll}>
            Save All
          </button>
          <button type="button" onClick={onDiscardAll}>
            Discard All
          </button>
          <button type="button" ref={cancelButtonRef} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </section>
    </div>
  );
}

function formatDirtyTabCount(count: number): string {
  return count === 1 ? "1 unsaved tab" : `${count} unsaved tabs`;
}
