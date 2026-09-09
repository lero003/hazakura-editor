import { useCallback, useState } from "react";
import type { RightPaneMode } from "../../types";

// All explicit Preview entries share this presentation state, including native menus.
export function usePreviewSurface({
  sidePaneMode,
  togglePreviewPane,
  leaveReference,
}: {
  sidePaneMode: RightPaneMode | null;
  togglePreviewPane: () => void;
  leaveReference: () => void;
}) {
  const [compactPreviewFocus, setCompactPreviewFocus] = useState<"editor" | "preview">("editor");
  const togglePreviewSurface = useCallback(() => {
    if (sidePaneMode !== "preview") setCompactPreviewFocus("preview");
    leaveReference();
    togglePreviewPane();
  }, [leaveReference, sidePaneMode, togglePreviewPane]);
  return { compactPreviewFocus, setCompactPreviewFocus, togglePreviewSurface };
}
