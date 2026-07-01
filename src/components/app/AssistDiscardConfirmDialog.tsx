import type { RefObject } from "react";
import type { MenuLanguage } from "../../types";
import { isJapaneseMenuLanguage } from "../../types";
import { isKanaStyle } from "../../lib/locale/_helpers";

type AssistDiscardConfirmDialogProps = {
  cancelButtonRef: RefObject<HTMLButtonElement | null>;
  dialogRef: RefObject<HTMLElement | null>;
  menuLanguage: MenuLanguage;
  onCancel: () => void;
  onConfirm: () => void;
};

// v1.3 Hazakura Local Assist discard confirmation.
//
// When the user hand-edits the buffer after an assist apply, a blind
// "Discard" revert to the transaction's `beforeBuffer` would destroy those
// hand-edits along with the assist change. This dialog asks the user to
// confirm before reverting the whole buffer.
//
// The dialog exposes the same `dialogRef` + `cancelButtonRef` shape the
// move-to-trash / close / app-close dialogs use, so the central
// `useDialogInitialFocus` lands focus on Cancel (the safe default for a
// destructive action) and `useModalKeyboardGuard` traps Tab / Shift+Tab
// inside the dialog and routes Escape back to the cancel handler, on the
// same footing as the other blocking confirmations.
export function AssistDiscardConfirmDialog({
  cancelButtonRef,
  dialogRef,
  menuLanguage,
  onCancel,
  onConfirm,
}: AssistDiscardConfirmDialogProps) {
  const copy = getAssistDiscardCopy(menuLanguage);

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        ref={dialogRef}
        aria-describedby="assist-discard-description"
        aria-labelledby="assist-discard-title"
        aria-modal="true"
        className="close-dialog"
        role="dialog"
      >
        <h2 id="assist-discard-title">{copy.title}</h2>
        <p id="assist-discard-description">{copy.description}</p>
        <div className="dialog-actions">
          <button
            className="danger"
            onClick={onConfirm}
            type="button"
          >
            {copy.confirm}
          </button>
          <button ref={cancelButtonRef} onClick={onCancel} type="button">
            {copy.cancel}
          </button>
        </div>
      </section>
    </div>
  );
}

function getAssistDiscardCopy(lang: MenuLanguage) {
  if (isKanaStyle(lang)) {
    return {
      title: "てあての へんこうも すてます",
      description:
        "Hazakura Local Assist の ていあんを すてると、その あとに てで なおした ぶんしょうも いっしょに もとに もどります。てあての へんこうは のこりますか？",
      confirm: "ていあんも いっしょに すてる",
      cancel: "キャンセル",
    };
  }
  if (isJapaneseMenuLanguage(lang)) {
    return {
      title: "手編集も破棄されます",
      description:
        "Hazakura Local Assistの提案を破棄すると、提案後に手で編集した文章も一緒に元に戻ります。手編集を残しますか？",
      confirm: "提案も一緒に破棄",
      cancel: "キャンセル",
    };
  }
  return {
    title: "Hand edits will be discarded",
    description:
      "Discarding the Hazakura Local Assist proposal also reverts any hand edits made after it was applied. Keep your hand edits instead?",
    confirm: "Discard proposal too",
    cancel: "Cancel",
  };
}
