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

  if (index >= 0) {
    if (event.shiftKey && index === 0) {
      event.preventDefault();
      elements[elements.length - 1].focus();
    } else if (!event.shiftKey && index === elements.length - 1) {
      event.preventDefault();
      elements[0].focus();
    }
    return;
  }

  // ここから先は active が Tab 移動対象に無い場合。ダイアログ内の tabindex=-1
  // 要素（見出しなど）にフォーカスがあるときは、その位置から前後の対象へ進める。
  // ダイアログ外へ抜けているときだけ、先頭/末尾へ戻す。
  const insideDialog = active instanceof HTMLElement && container.contains(active);
  if (insideDialog) {
    const next = event.shiftKey
      ? previousFocusable(elements, active)
      : nextFocusable(elements, active);
    event.preventDefault();
    (next ?? (event.shiftKey ? elements[elements.length - 1] : elements[0])).focus();
    return;
  }

  event.preventDefault();
  (event.shiftKey ? elements[elements.length - 1] : elements[0]).focus();
}

/** `active` より後ろにある最初の Tab 対象。無ければ undefined（末尾）。 */
function nextFocusable(elements: HTMLElement[], active: HTMLElement): HTMLElement | undefined {
  return elements.find((element) => follows(active, element));
}

/** `active` より前にある最後の Tab 対象。無ければ undefined（先頭）。 */
function previousFocusable(elements: HTMLElement[], active: HTMLElement): HTMLElement | undefined {
  for (let index = elements.length - 1; index >= 0; index -= 1) {
    if (follows(elements[index], active)) return elements[index];
  }
  return undefined;
}

/** DOM 順で `later` が `earlier` より後ろにあるか。 */
function follows(earlier: HTMLElement, later: HTMLElement): boolean {
  return Boolean(
    earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING,
  );
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
