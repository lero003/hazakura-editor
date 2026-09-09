import { useEffect, useState } from "react";
import type { EditorTab } from "../../types";

/** Presentation dismissal never acknowledges or changes the disk conflict. */
export function useSaveConflictSurface(tab: EditorTab | null, activeConflict: boolean) {
  const [dismissed, setDismissed] = useState<string | null>(null);
  const identity = activeConflict && tab
    ? JSON.stringify([tab.id, tab.sessionId, tab.path, tab.externalFingerprint, tab.error])
    : null;
  useEffect(() => { if (identity === null) setDismissed(null); }, [identity]);
  return {
    tab: identity !== null && identity !== dismissed ? tab : null,
    dismiss: () => setDismissed(identity),
    reopen: () => setDismissed(null),
  };
}
