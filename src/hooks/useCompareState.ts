import { useState } from "react";
import type { CompareAnchor, CompareViewState } from "../types";

export function useCompareState() {
  const [compareAnchor, setCompareAnchor] = useState<CompareAnchor | null>(null);
  const [compareTarget, setCompareTarget] = useState<CompareAnchor | null>(null);
  const [compareView, setCompareView] = useState<CompareViewState | null>(null);

  return {
    compareAnchor,
    compareTarget,
    compareView,
    setCompareAnchor,
    setCompareTarget,
    setCompareView,
  };
}
