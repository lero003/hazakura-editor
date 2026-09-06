/** Trap only keyboard Tab navigation; leave typing and shortcuts untouched. */
export function trapFocusInElement(container: HTMLElement | null, event: KeyboardEvent): void {
  if (!container || event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey) return;
  const elements = getFocusableElements(container);
  if (!elements.length) {
    event.preventDefault();
    if (!container.hasAttribute("tabindex")) container.tabIndex = -1;
    container.focus({ preventScroll: true });
    return;
  }
  const active = container.ownerDocument.activeElement;
  const index = elements.findIndex((element) => element === active);
  if (event.shiftKey && index <= 0) {
    event.preventDefault();
    elements[elements.length - 1].focus();
  } else if (!event.shiftKey && (index < 0 || index === elements.length - 1)) {
    event.preventDefault();
    elements[0].focus();
  }
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const window = container.ownerDocument.defaultView;
  if (!window) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(
    'button,input,select,textarea,a[href],summary,[contenteditable="true"],[tabindex]',
  )).filter((element) => {
    if (element.tabIndex < 0 || element.matches(":disabled") || element.closest("[hidden],[inert]")) return false;
    const style = window.getComputedStyle(element);
    // offsetParent is null for visible fixed-position controls as well.
    return style.visibility !== "hidden" && style.visibility !== "collapse" && element.getClientRects().length > 0;
  }).sort((a, b) => {
    // Match the browser's positive-tabindex order, preserving DOM order at ties.
    const first = a.tabIndex > 0 ? a.tabIndex : Number.MAX_SAFE_INTEGER;
    const second = b.tabIndex > 0 ? b.tabIndex : Number.MAX_SAFE_INTEGER;
    return first - second;
  });
}
