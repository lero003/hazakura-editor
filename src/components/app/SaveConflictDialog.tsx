import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { trapFocusInElement } from "../../lib/focusTrap";
import type { EditorTab, MenuLanguage } from "../../types";

export function saveConflictCopy(language: MenuLanguage) {
  return language === "en" ? {
    title: "The saved file has changed", detail: "Your unsaved text is still here. Compare it with the file on disk, or save a separate copy.",
    retained: "Returning to the editor keeps the conflict unresolved. Nothing is reloaded or overwritten.", back: "Return to editor", compare: "Compare changes", saveAs: "Save As…", reopen: "Review save conflict",
  } : language === "kana" ? {
    title: "ほぞんずみの ふみが かはりました", detail: "いまの へんしゅうは のこっています。ほぞんずみの ふみと くらべるか、べつの なまへで ほぞんできます。",
    retained: "へんしゅうへ もどっても くひちがひは のこります。よみなほしや うはがきは しません。", back: "へんしゅうへ もどる", compare: "ちがひを くらべる", saveAs: "べつの なまへで ほぞん…", reopen: "ほぞんの くひちがひを みる",
  } : {
    title: "保存済みのファイルが変更されました", detail: "編集中の本文は残っています。ディスク上のファイルと比較するか、別名で保存できます。",
    retained: "編集へ戻っても衝突情報は残ります。再読込や上書きは行いません。", back: "編集へ戻る", compare: "変更を比較", saveAs: "別名で保存…", reopen: "保存の衝突を確認",
  };
}

export function SaveConflictDialog({ tab, menuLanguage, onBack, onCompare, onSaveAs }: {
  tab: EditorTab; menuLanguage: MenuLanguage;
  onBack: () => void; onCompare: () => void; onSaveAs: () => void;
}) {
  const copy = saveConflictCopy(menuLanguage);
  const titleId = useId();
  const detailId = useId();
  const backdropRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    // Portal is a body sibling of the application. Keep the mounted editor
    // and its history, while removing background input and a11y exposure.
    const siblings = Array.from(document.body.children).filter(
      (node): node is HTMLElement => node instanceof HTMLElement && node !== backdropRef.current,
    );
    const previous = siblings.map(node => [node, node.inert] as const);
    siblings.forEach(node => { node.inert = true; });
    backRef.current?.focus();
    return () => { previous.forEach(([node, inert]) => { node.inert = inert; }); };
  }, []);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.isComposing || event.keyCode === 229) return;
      trapFocusInElement(dialogRef.current, event);
      if (event.key === "Escape") {
        event.preventDefault(); event.stopImmediatePropagation(); onBack();
      }
    };
    window.addEventListener("keydown", keydown, true);
    return () => window.removeEventListener("keydown", keydown, true);
  }, [onBack]);
  return createPortal(<div ref={backdropRef} className="modal-backdrop save-conflict-backdrop">
    <section ref={dialogRef} data-save-conflict="true" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={detailId} className="close-dialog save-conflict-dialog">
      <h2 id={titleId}>{copy.title}</h2>
      <strong className="save-conflict-document" title={tab.path}>{tab.name}</strong>
      <p id={detailId}>{copy.detail}</p><p>{copy.retained}</p>
      <div className="save-conflict-actions">
        <button ref={backRef} onClick={onBack}>{copy.back}</button>
        <button onClick={onSaveAs}>{copy.saveAs}</button>
        <button onClick={onCompare}>{copy.compare}</button>
      </div>
    </section>
  </div>, document.body);
}
