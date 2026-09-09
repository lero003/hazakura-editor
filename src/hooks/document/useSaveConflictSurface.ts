import { useEffect, useState } from "react";
import type { EditorTab } from "../../types";

/** Presentation dismissal never acknowledges or changes the disk conflict. */
export function useSaveConflictSurface(tab: EditorTab | null, activeConflict: boolean) {
  const [dismissed, setDismissed] = useState<Map<string, string>>(() => new Map());
  const identity = activeConflict && tab
    ? JSON.stringify([tab.id, tab.sessionId, tab.path, tab.externalFingerprint, tab.error])
    : null;
  useEffect(() => {
    if (tab && !activeConflict) setDismissed(previous => {
      if (!previous.has(tab.sessionId)) return previous;
      const next = new Map(previous); next.delete(tab.sessionId); return next;
    });
  }, [tab?.sessionId, activeConflict]);
  return {
    tab: identity !== null && identity !== dismissed.get(tab!.sessionId) ? tab : null,
    dismiss: () => { if (tab && identity) setDismissed(previous => new Map(previous).set(tab.sessionId, identity)); },
    reopen: () => { if (tab) setDismissed(previous => { const next = new Map(previous); next.delete(tab.sessionId); return next; }); },
  };
}
