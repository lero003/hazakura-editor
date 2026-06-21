import { useState } from "react";
import type { RightPaneMode } from "../../types";

export function useAppViewState() {
  const [sidePaneOpen, setSidePaneOpen] = useState(true);
  const [rightPaneMode, setRightPaneMode] =
    useState<RightPaneMode>("preview");

  return {
    rightPaneMode,
    setRightPaneMode,
    setSidePaneOpen,
    sidePaneOpen,
  };
}
