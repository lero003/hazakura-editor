import { useEffect, useId, useRef, useState } from "react";
import type { MenuLanguage } from "../../types";
import { getAssistConversationCopy } from "../../lib/locale/assistConversation";
import { ChevronIcon } from "../app/Icons";

// The product currently generates only with System. Selecting its checked row
// confirms that selection; it must not send a backend override or start generation.
export function AssistModelPicker({ language, disabled }: {
  language: MenuLanguage;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const option = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const title = getAssistConversationCopy(language).chooseModel;
  const expanded = open && !disabled;
  const close = (restoreFocus: boolean) => {
    if (restoreFocus) trigger.current?.focus();
    setOpen(false);
  };

  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  useEffect(() => {
    if (!expanded) return;
    option.current?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", outside);
    return () => window.removeEventListener("pointerdown", outside);
  }, [expanded]);

  return <div className="apple-assist-model-picker" ref={root}
    onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
    }}
    onKeyDown={(event) => {
      if (event.key === "Escape" && expanded) {
        event.preventDefault(); event.stopPropagation(); close(true);
      } else if (event.key === "Tab" && expanded) {
        // Continue native tab order from the trigger to the next/previous control.
        close(true);
      } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) && !disabled) {
        event.preventDefault(); setOpen(true); option.current?.focus();
      }
    }}>
    <button ref={trigger} type="button" className="apple-assist-model-trigger"
      aria-haspopup="menu" aria-expanded={expanded} aria-controls={expanded ? menuId : undefined}
      aria-label={`${title}: Apple Intelligence`} disabled={disabled}
      onClick={() => setOpen(!expanded)}>
      <span>Apple Intelligence</span>
      <span className="apple-assist-model-chevron" aria-hidden="true"><ChevronIcon expanded /></span>
    </button>
    {expanded ? <div id={menuId} className="apple-assist-model-menu" role="menu" aria-label={title}>
      <p className="apple-assist-model-heading" aria-hidden="true">{title}</p>
      <button ref={option} type="button" role="menuitemradio" aria-checked="true" tabIndex={-1}
        className="apple-assist-model-option" onClick={() => close(true)}>
        <span>Apple Intelligence</span><span aria-hidden="true">✓</span>
      </button>
    </div> : null}
  </div>;
}
