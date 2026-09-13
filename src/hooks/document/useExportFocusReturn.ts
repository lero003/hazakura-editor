import { useLayoutEffect, useRef } from "react";

/** One focus owner for the entire EPUB/PDF/HTML session, including format switches. */
export function useExportFocusReturn(open: boolean) {
  const opener = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (open) return;
    const rememberFocus = () => {
      // React autoFocus runs before parent layout effects. Remember the opener
      // while closed, and never replace it with an export field during mount.
      const active = document.activeElement;
      if (active instanceof HTMLElement && active !== document.body && !active.closest('[role="dialog"]')) {
        opener.current = active;
      }
    };
    rememberFocus();
    document.addEventListener("focusin", rememberFocus);
    return () => document.removeEventListener("focusin", rememberFocus);
  }, [open]);

  const wasOpen = useRef(false);
  useLayoutEffect(() => {
    const closed = wasOpen.current && !open;
    wasOpen.current = open;
    if (!closed) return;
    const target = opener.current;
    opener.current = null;
    if (
      !target?.isConnected ||
      target.closest('[hidden], [inert], [aria-hidden="true"]') ||
      document.querySelector('[role="dialog"][aria-modal="true"]')
    ) return;
    target.focus();
  }, [open]);
}
