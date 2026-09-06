/** Accept only HTML produced by the existing sanitized Markdown renderer. */
export function paintPreviewHtml(
  host: HTMLElement,
  html: string,
  previousHtml: string | null,
  restoreImages: () => void,
): string {
  if (previousHtml !== html) {
    const scroller = host.parentElement;
    // Snapshot at the DOM write, not before a deferred React transition:
    // the reader may have scrolled while the update was waiting to commit.
    const top = scroller?.scrollTop;
    host.innerHTML = html;
    restoreImages();
    if (scroller && top !== undefined) scroller.scrollTop = top;
  } else {
    restoreImages();
  }
  return html;
}

type PreviewLinkEvent = {
  target: EventTarget | null;
  currentTarget: HTMLElement;
  preventDefault: () => void;
};

/** Block WebView navigation even if the owning route has no link handler. */
export function interceptPreviewLink(event: PreviewLinkEvent): string | null {
  const target = event.target;
  if (!(target instanceof Element)) return null;
  const link = target.closest("a[href]");
  if (!link || !event.currentTarget.contains(link)) return null;
  event.preventDefault();
  return link.getAttribute("href")?.trim() ?? "";
}

/** A pointer release outside the WebView must not leave selection mode stuck. */
export function subscribePreviewGestureEnd(
  ownerDocument: Document,
  onEnd: () => void,
): () => void {
  const ownerWindow = ownerDocument.defaultView;
  const onVisibilityChange = () => {
    if (ownerDocument.visibilityState === "hidden") onEnd();
  };
  ownerDocument.addEventListener("pointerup", onEnd);
  ownerDocument.addEventListener("pointercancel", onEnd);
  ownerDocument.addEventListener("visibilitychange", onVisibilityChange);
  ownerWindow?.addEventListener("blur", onEnd);
  return () => {
    ownerDocument.removeEventListener("pointerup", onEnd);
    ownerDocument.removeEventListener("pointercancel", onEnd);
    ownerDocument.removeEventListener("visibilitychange", onVisibilityChange);
    ownerWindow?.removeEventListener("blur", onEnd);
  };
}
