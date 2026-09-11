import { useEffect, useId, useRef, useState } from "react";
import { isJapaneseMenuLanguage, type MenuLanguage } from "../../types";
import type { WorkspaceMode, WorkspaceReviewTarget } from "../../features/workspace/workspaceNavigation";
import { BookIcon, LModeIcon, ReferenceIcon } from "./Icons";

export function WorkspaceModeNavigation({ mode, canNavigate, documentName, contextKey = documentName,
  menuLanguage, readingOpen = false, reviewTargets, referenceName, comparisonName,
  onWrite, onRead, onReview }: {
  mode: WorkspaceMode;
  canNavigate: boolean;
  /** 読書面（電子書籍の全幅表示）を開いているか。「書く」だけは押せるまま残す。 */
  readingOpen?: boolean;
  documentName: string;
  contextKey?: string;
  menuLanguage: MenuLanguage;
  reviewTargets: WorkspaceReviewTarget[];
  referenceName?: string;
  comparisonName?: string;
  onWrite: () => void;
  onRead: () => void;
  onReview: (target: WorkspaceReviewTarget) => void;
}) {
  const ja = isJapaneseMenuLanguage(menuLanguage);
  const copy = ja ? {
    navigation: "文書の作業", write: "書く", read: "読む", review: "確認",
    targets: "確認する対象", empty: "確認できる提案・保存前の変更・参照がありません",
    readTitle: "現在の文書を本として読む", proposal: "Local Assistの提案", disk: "保存前の変更",
    reference: "参照ファイル", comparison: "開いている比較",
    writeTitle: "いまの文書の編集へ戻る", writeExitTitle: "読むのをやめて編集へ戻る",
  } : {
    navigation: "Document activity", write: "Write", read: "Read", review: "Review",
    targets: "Choose what to review", empty: "No proposal, unsaved changes or reference to review",
    readTitle: "Read the current document as a book", proposal: "Local Assist proposal", disk: "Unsaved changes",
    reference: "Reference file", comparison: "Open comparison",
    writeTitle: "Return to editing this document", writeExitTitle: "Stop reading and return to editing",
  };
  // 読書面を開いている間も「書く」は押せる（読みから編集へ戻る唯一の導線。実機指摘②）。
  // 「読む」「確認」は、いま開いている面と同じ行き先なので押させない。
  const canRead = canNavigate && !readingOpen;
  const canReview = canRead;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstChoiceRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  // Only disclosure state is local. A different document/target set invalidates the choice.
  const signature = JSON.stringify([contextKey, canNavigate, reviewTargets]);
  const [openFor, setOpenFor] = useState<string | null>(null);
  const open = openFor === signature;
  useEffect(() => {
    setOpenFor((previous) => previous === signature ? previous : null);
  }, [signature]);
  useEffect(() => {
    if (!open) return;
    firstChoiceRef.current?.focus();
    const dismiss = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpenFor(null);
    };
    window.addEventListener("pointerdown", dismiss);
    return () => window.removeEventListener("pointerdown", dismiss);
  }, [open]);

  return <div className="workspace-mode-navigation" ref={rootRef} role="group" aria-label={copy.navigation}
    onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpenFor(null);
    }} onKeyDown={(event) => {
      if (open && event.key === "Escape" && !event.nativeEvent.isComposing && event.keyCode !== 229) {
        event.preventDefault(); event.stopPropagation();
        triggerRef.current?.focus(); setOpenFor(null);
      }
    }}>
    <button type="button" aria-pressed={mode === "write"} disabled={!canNavigate} onClick={onWrite}
      title={readingOpen ? copy.writeExitTitle : copy.writeTitle}>
      <span aria-hidden="true"><LModeIcon /></span>{copy.write}
    </button>
    <button type="button" aria-pressed={mode === "read"} disabled={!canRead} onClick={onRead} title={copy.readTitle}>
      <span aria-hidden="true"><BookIcon /></span>{copy.read}
    </button>
    <button type="button" ref={triggerRef} aria-pressed={mode === "review"}
      aria-expanded={reviewTargets.length > 1 ? open : undefined} aria-controls={open ? panelId : undefined}
      disabled={!canReview || reviewTargets.length === 0} title={reviewTargets.length ? copy.targets : copy.empty}
      onClick={() => {
        if (reviewTargets.length === 1) onReview(reviewTargets[0]);
        else setOpenFor(open ? null : signature);
      }}><span aria-hidden="true"><ReferenceIcon /></span>{copy.review}</button>
    {open && <div className="workspace-review-choices" role="group" aria-label={copy.targets} id={panelId}>
      <strong>{copy.targets}</strong>
      {reviewTargets.map((target, index) => <button type="button" key={target} ref={index === 0 ? firstChoiceRef : undefined}
        onClick={() => { triggerRef.current?.focus(); setOpenFor(null); onReview(target); }}>
        <span>{copy[target]}</span><small>{target === "reference" && referenceName ? `${documentName} ↔ ${referenceName}` : target === "comparison" && comparisonName ? comparisonName : documentName}</small>
      </button>)}
    </div>}
  </div>;
}
