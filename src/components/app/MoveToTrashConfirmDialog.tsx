import type { MenuLanguage } from "../../types";
import { isJapaneseMenuLanguage } from "../../types";
import { isKanaStyle } from "../../lib/locale/_helpers";
import type { WorkspaceFileOpsCopy } from "../../lib/locale/workspaceFileOps";

type MoveToTrashConfirmDialogProps = {
  copy: WorkspaceFileOpsCopy;
  isDirectory: boolean;
  menuLanguage: MenuLanguage;
  name: string;
  onCancel: () => void;
  onConfirm: () => void;
};

// Confirmation dialog for the v0.9 move-to-trash flow. The trash
// is irreversible from the app's perspective (the file lands in
// the OS Trash and is restored via Finder, not via Hazakura),
// so the dialog always fires before the Tauri command runs.
export function MoveToTrashConfirmDialog({
  copy,
  isDirectory,
  menuLanguage,
  name,
  onCancel,
  onConfirm,
}: MoveToTrashConfirmDialogProps) {
  const description = isKanaStyle(menuLanguage)
    ? isDirectory
      ? `ふぉるだ「${name}」を ごみばこに すてます。よろしいですか？`
      : `ふみ「${name}」を ごみばこに すてます。よろしいですか？`
    : isJapaneseMenuLanguage(menuLanguage)
      ? isDirectory
        ? `フォルダ「${name}」をゴミ箱へ捨てます。よろしいですか？`
        : `ファイル「${name}」をゴミ箱へ捨てます。よろしいですか？`
      : isDirectory
        ? `Move the folder “${name}” to the Trash? This cannot be undone from Hazakura.`
        : `Move the file “${name}” to the Trash? This cannot be undone from Hazakura.`;

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        aria-describedby="trash-confirm-description"
        aria-labelledby="trash-confirm-title"
        aria-modal="true"
        className="close-dialog"
        role="dialog"
      >
        <h2 id="trash-confirm-title">{copy.moveToTrashTitle}</h2>
        <p id="trash-confirm-description">{description}</p>
        <div className="dialog-actions">
          <button type="button" onClick={onConfirm}>
            {copy.moveToTrashConfirm}
          </button>
          <button type="button" onClick={onCancel}>
            {copy.moveToTrashCancel}
          </button>
        </div>
      </section>
    </div>
  );
}
