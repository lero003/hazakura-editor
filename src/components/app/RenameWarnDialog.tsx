import type { WorkspaceFileOpsCopy } from "../../lib/locale/workspaceFileOps";

// Warning variants surfaced before a rename commits when the open
// tab is dirty (warningKind === "dirty") or when the file has been
// modified outside the app since it was last loaded
// (warningKind === "external"). The dialog intentionally does not
// block on either condition — the user can choose to proceed —
// because the rename itself is a metadata operation on the
// filesystem and does not lose data; the warning is a "you may
// want to save first" affordance, not a safety gate.
export type RenameWarningKind = "dirty" | "external";

type RenameWarnDialogProps = {
  copy: WorkspaceFileOpsCopy;
  onCancel: () => void;
  onConfirm: () => void;
  warningKind: RenameWarningKind;
};

export function RenameWarnDialog({
  copy,
  onCancel,
  onConfirm,
  warningKind,
}: RenameWarnDialogProps) {
  const description =
    warningKind === "dirty" ? copy.renameDirtyWarning : copy.renameExternalChangeWarning;

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        aria-describedby="rename-warn-description"
        aria-labelledby="rename-warn-title"
        aria-modal="true"
        className="close-dialog"
        role="dialog"
      >
        <h2 id="rename-warn-title">{copy.renameDialogTitle}</h2>
        <p id="rename-warn-description">{description}</p>
        <div className="dialog-actions">
          <button type="button" onClick={onConfirm}>
            {copy.renameConfirm}
          </button>
          <button type="button" onClick={onCancel}>
            {copy.renameCancel}
          </button>
        </div>
      </section>
    </div>
  );
}
