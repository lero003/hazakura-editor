import { useState } from "react";
import type { ReviewSurface, RightPaneMode } from "../types";

export function useAppViewState() {
  const [zenMode, setZenMode] = useState(false);
  const [rightPaneMode, setRightPaneMode] =
    useState<RightPaneMode>("preview");
  const [reviewSurface, setReviewSurface] = useState<ReviewSurface>(null);

  return {
    reviewSurface,
    rightPaneMode,
    setReviewSurface,
    setRightPaneMode,
    setZenMode,
    zenMode,
  };
}
