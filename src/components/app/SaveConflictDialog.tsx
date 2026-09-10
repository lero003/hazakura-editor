import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { trapFocusInElement } from "../../lib/focusTrap";
import { formatTimestamp } from "../backup/formatBackupTimestamp";
import { useDiskFileMetadata } from "../../hooks/document/useDiskFileMetadata";
import type { EditorTab, MenuLanguage } from "../../types";

/** 1,268 のような桁区切り。環境の ICU に依存させない。 */
function groupDigits(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function WarningIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
      <path d="M12 4.6 21 19.4H3z" />
      <path d="M12 9.6v4.3M12 16.7v.9" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="M14 6l4 4" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
      <path d="M6 3h7l5 5v13H6z" />
      <path d="M13 3v5h5" />
    </svg>
  );
}

export function saveConflictCopy(language: MenuLanguage) {
  return language === "en" ? {
    title: "The file changed somewhere else",
    detailSuffix: " changed on disk. Compare the two before saving so neither version is lost.",
    bufferTitle: "Edits in this window", bufferBody: "Your unsaved text is still here.",
    bufferMeta: (count: string) => `${count} characters · local change`,
    diskTitle: "File on disk", diskBody: "Updated outside the editor.",
    diskMeta: (size: string, updated: string) => `${size} · updated ${updated} · other change`,
    diskMetaFallback: "other change",
    notice: "Nothing has been overwritten yet. Returning to the editor keeps the conflict: no reload, no overwrite.",
    back: "Return to editor", compare: "Compare changes", saveAs: "Save As…", reopen: "Review save conflict",
  } : language === "kana" ? {
    title: "べつの ばしょで、ふみが かはりました",
    detailSuffix: " の ないようが かはりました。どちらも なくさない ために、ほぞんの まへに ちがひを みてください。",
    bufferTitle: "この ウィンドウの へんしゅう", bufferBody: "みほぞんの ぶんしょうが のこっています。",
    bufferMeta: (count: string) => `${count} もじ · てもとの へんか`,
    diskTitle: "ディスクの うへの ふみ", diskBody: "そとで かきかへられています。",
    diskMeta: (size: string, updated: string) => `${size} · さいしゅう こうしん ${updated} · べつの へんか`,
    diskMetaFallback: "べつの へんか",
    notice: "この だんかいは、どちらの ないようも うはがきして いません。へんしゅうへ もどっても くひちがひは のこります。よみなほしや うはがきは しません。",
    back: "へんしゅうへ もどる", compare: "ちがひを くらべる", saveAs: "べつの なまへで ほぞん…", reopen: "ほぞんの くひちがひを みる",
  } : {
    title: "別の場所で、ファイルが変更されています",
    detailSuffix: " のディスク上の内容が変わりました。どちらかを失わないように、保存する前に違いを確認しましょう。",
    bufferTitle: "このウィンドウの編集", bufferBody: "未保存の文章が残っています。",
    bufferMeta: (count: string) => `${count} 文字 · 手元の変更`,
    diskTitle: "ディスク上のファイル", diskBody: "外部で更新されています。",
    diskMeta: (size: string, updated: string) => `${size} · 最終更新 ${updated} · 別の変更`,
    diskMetaFallback: "別の変更",
    notice: "この段階では、どちらの内容も上書きしていません。編集へ戻っても衝突情報は残ります。再読込や上書きは行いません。",
    back: "編集へ戻る", compare: "差分を確認", saveAs: "別名で保存…", reopen: "保存の衝突を確認",
  };
}

export function SaveConflictDialog({ tab, menuLanguage, onBack, onCompare, onSaveAs }: {
  tab: EditorTab; menuLanguage: MenuLanguage;
  onBack: () => void; onCompare: () => void; onSaveAs: () => void;
}) {
  const copy = saveConflictCopy(menuLanguage);
  const disk = useDiskFileMetadata(tab.path);
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
      <div className="save-conflict-body">
        <span className="save-conflict-alert" aria-hidden="true"><WarningIcon /></span>
        <h2 id={titleId}>{copy.title}</h2>
        <p id={detailId} className="save-conflict-detail">
          <strong className="save-conflict-document" title={tab.path}>{tab.name}</strong>{copy.detailSuffix}
        </p>
        <div className="save-conflict-versions">
          <section className="version-card" aria-label={copy.bufferTitle}>
            <h3><EditIcon />{copy.bufferTitle}</h3>
            <p>{copy.bufferBody}</p>
            <p className="version-meta">{copy.bufferMeta(groupDigits(tab.contents.length))}</p>
          </section>
          <section className="version-card" aria-label={copy.diskTitle}>
            <h3><FileIcon />{copy.diskTitle}</h3>
            <p>{copy.diskBody}</p>
            {/* ディスク側の文字数は本文を読まないと分からないため出さない。
                読めた場合だけバイト数と最終更新を実データとして示す。 */}
            <p className="version-meta">
              {disk
                ? copy.diskMeta(formatBytes(disk.size), disk.modifiedMs === null ? "—" : formatTimestamp(disk.modifiedMs))
                : copy.diskMetaFallback}
            </p>
          </section>
        </div>
        <p className="save-conflict-notice">{copy.notice}</p>
      </div>
      <div className="save-conflict-actions">
        <button ref={backRef} onClick={onBack}>{copy.back}</button>
        <button onClick={onSaveAs}>{copy.saveAs}</button>
        <button className="save-conflict-primary" onClick={onCompare}>{copy.compare}</button>
      </div>
    </section>
  </div>, document.body);
}
