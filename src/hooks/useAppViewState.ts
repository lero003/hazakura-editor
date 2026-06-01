import { useState } from "react";
import type { RightPaneMode } from "../types";

export function useAppViewState() {
  const [zenMode, setZenMode] = useState(false);
  const [rightPaneMode, setRightPaneMode] =
    useState<RightPaneMode>("preview");

  return {
    rightPaneMode,
    setRightPaneMode,
    setZenMode,
    zenMode,
  };
}
