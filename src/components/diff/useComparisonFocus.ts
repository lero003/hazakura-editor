import { useEffect, useRef } from "react";

/** Focus only a newly opened comparison; never follow buffer/stale updates. */
export function useComparisonFocus(caseKey: string, enabled: boolean) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!enabled) return;
    const frame = requestAnimationFrame(() => {
      const button = closeRef.current;
      if (!button?.isConnected || button.closest('[hidden], [inert]')) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"], dialog[open]')) return;
      for (let node: HTMLElement | null = button; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.display === "none" || style.visibility === "hidden") return;
      }
      button.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [caseKey, enabled]);
  return closeRef;
}
