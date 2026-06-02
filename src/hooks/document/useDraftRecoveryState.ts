import { useState } from "react";
import type { DraftRecord } from "../../types";

export function useDraftRecoveryState() {
  const [pendingDrafts, setPendingDrafts] = useState<DraftRecord[]>([]);

  return {
    pendingDrafts,
    setPendingDrafts,
  };
}
