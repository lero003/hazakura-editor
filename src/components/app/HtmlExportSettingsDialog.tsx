import { useEffect, type ReactNode, type RefObject } from "react";
import type { HtmlExportRequest } from "../../hooks/document/useDocumentExport";
import type { MenuLanguage } from "../../types";
import { ExportDialogFrame } from "./ExportDialogFrame";

type Props = {
  request: HtmlExportRequest;
  /** 形式を選ぶ入口（画面11）。 */
  formatNav?: ReactNode;
  menuLanguage: MenuLanguage;
  dialogRef: RefObject<HTMLElement | null>;
  cancelButtonRef: RefObject<HTMLButtonElement | null>;
  onCancel: () => void;
  onConfirm: () => void;
};

export function HtmlExportSettingsDialog(props: Props) {
  const copy = props.menuLanguage === "en" ? {
    title: "Export HTML", confirm: "Choose destination", cancel: "Cancel",
    scope: "Export this document using the current preview appearance.",
    draft: "Unsaved edits are included. The original document is not saved.",
    limit: "The complete HTML, including images and CSS, must fit within 10 MiB. Existing image permissions apply.",
    scopeNote: "“Whole book” is available for PDF and EPUB; HTML exports one document at a time.",
  } : props.menuLanguage === "kana" ? {
    title: "HTMLを かきだす", confirm: "かきだしさきを えらぶ", cancel: "やめる",
    scope: "この ぶんしょを、いまの プレビューの みためで かきだします。",
    draft: "ほぞんしてゐない へんしゅうも ふくみます。もとの ぶんしょは ほぞんしません。",
    limit: "がぞう・CSSを ふくむ HTMLぜんたいで 10 MiBまでです。がぞうの きょかせっていは そのままです。",
    scopeNote: "「ふみ ぜんたい」は PDF と EPUB で かきだせます（HTMLは 1ぶんしょずつ）。",
  } : {
    title: "HTMLを書き出す", confirm: "書き出し先を選ぶ", cancel: "キャンセル",
    scope: "この文書を、現在のプレビューの見た目で書き出します。",
    draft: "未保存の編集も含みます。元の文書は保存しません。",
    limit: "画像・CSSを含むHTML全体で10 MiBまでです。画像の許可設定はそのまま適用されます。",
    scopeNote: "「本全体」は PDF と EPUB で書き出せます（HTMLは1文書ずつ）。",
  };
  useEffect(() => { props.cancelButtonRef.current?.focus(); }, [props.cancelButtonRef]);
  return <ExportDialogFrame format="HTML" title={copy.title} documentName={props.request.documentName}
    scope="document" formatNav={props.formatNav} menuLanguage={props.menuLanguage} dialogRef={props.dialogRef}
    cancelButtonRef={props.cancelButtonRef} canConfirm confirmLabel={copy.confirm} cancelLabel={copy.cancel}
    onConfirm={props.onConfirm} onCancel={props.onCancel}>
    <p>{copy.scope}</p>
    {props.request.hasUnsavedChanges ? <p>{copy.draft}</p> : null}
    <p>{copy.limit}</p>
    {/* 本全体を選べない理由を、選べないまま黙っていない。 */}
    <p className="export-scope-note">{copy.scopeNote}</p>
  </ExportDialogFrame>;
}
