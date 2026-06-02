import { useCallback, useState } from "react";
import type {
  CompareAnchor,
  CompareCase,
  CompareViewState,
} from "../../types";

export function useCompareState() {
  const [compareAnchor, setCompareAnchor] = useState<CompareAnchor | null>(null);
  const [compareTarget, setCompareTarget] = useState<CompareAnchor | null>(null);
  const [compareView, setCompareView] = useState<CompareViewState | null>(null);
  const [compareCaseByKey, setCompareCaseByKey] = useState<Map<string, CompareCase>>(
    () => new Map(),
  );

  const setCompareCaseEntry = useCallback((entry: CompareCase) => {
    setCompareCaseByKey((current) => {
      if (current.size === 1 && current.get(entry.key) === entry) {
        return current;
      }
      return new Map([[entry.key, entry]]);
    });
  }, []);

  const getCompareCaseByKey = useCallback(
    (caseKey: string): CompareCase | undefined =>
      compareCaseByKey.get(caseKey),
    [compareCaseByKey],
  );

  return {
    compareAnchor,
    compareCaseByKey,
    compareTarget,
    compareView,
    getCompareCaseByKey,
    setCompareAnchor,
    setCompareCaseEntry,
    setCompareTarget,
    setCompareView,
  };
}
