import type { ReactNode, RefObject } from "react";
import type { DocumentExportScope } from "../../features/document/exportScope";
import type { MenuLanguage } from "../../types";

type Props = {
  format: "EPUB" | "PDF" | "HTML";
  title: string;
  documentName: string;
  scope: DocumentExportScope;
  menuLanguage: MenuLanguage;
  dialogRef: RefObject<HTMLElement | null>;
  cancelButtonRef: RefObject<HTMLButtonElement | null>;
  canConfirm: boolean;
  confirmLabel: string;
  cancelLabel: string;
  /** 形式を選ぶ入口（画面11）。無い場合は従来どおり単一形式のダイアログ。 */
  formatNav?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  children: ReactNode;
};

/** Presentation only; format settings, scope and writers remain with their owners. */
export function ExportDialogFrame(props: Props) {
  const prefix = `${props.format.toLowerCase()}-export-settings`;
  const copy = props.menuLanguage === "en"
    ? { book: "Whole book", note: "Export does not save or change your Markdown. Choose the destination next." }
    : props.menuLanguage === "kana"
      ? { book: "ほん ぜんたい", note: "もとのMarkdownは ほぞんも かきかへも しません。つぎに かきだしさきを えらびます。" }
      : { book: "本全体", note: "元のMarkdownは保存・変更しません。次に書き出し先を選びます。" };
  const targetName = props.scope === "book" ? copy.book : props.documentName;
  return <div className="modal-backdrop" role="presentation">
    <section aria-describedby={`${prefix}-description`} aria-labelledby={`${prefix}-title`}
      aria-modal="true" role="dialog" ref={props.dialogRef}
      className={`close-dialog export-settings-dialog ${prefix}-dialog`}>
      <form className={`export-settings-form ${prefix}-form`} onSubmit={(event) => {
        event.preventDefault();
        if (props.canConfirm) props.onConfirm();
      }}>
        <header className="export-settings-header">
          <span className="export-format-label">{props.format}</span>
          <div><h2 id={`${prefix}-title`}>{props.title}</h2>
            <p id={`${prefix}-description`} title={targetName}>{targetName}</p></div>
        </header>
        {/* 形式ナビは枠が持つ（同じ画面で形式を選べる）。 */}
        {props.formatNav}
        <div className="export-settings-body">{props.children}</div>
        <footer className="export-settings-footer">
          <p>{copy.note}</p>
          <div className="dialog-actions">
            <button disabled={!props.canConfirm} type="submit">{props.confirmLabel}</button>
            <button ref={props.cancelButtonRef} type="button" onClick={props.onCancel}>{props.cancelLabel}</button>
          </div>
        </footer>
      </form>
    </section>
  </div>;
}
