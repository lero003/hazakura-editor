import { useCallback, useState } from "react";
import type {
  ReferenceCompareState,
  ReferenceDocument,
  ReferenceNarrowFocus,
} from "../../features/referenceCompare/types";

export function useReferenceCompareState() {
  const [referenceCompare, setReferenceCompare] =
    useState<ReferenceCompareState | null>(null);
  const [referenceNarrowFocus, setReferenceNarrowFocus] =
    useState<ReferenceNarrowFocus>("editor");
  /** Share of the editor-preview grid width for the reference column (percent). */
  const [referenceColumnPercent, setReferenceColumnPercent] = useState(42);

  const clearReferenceCompare = useCallback(() => {
    setReferenceCompare(null);
    setReferenceNarrowFocus("editor");
  }, []);

  const setReferenceDocument = useCallback(
    (
      reference: ReferenceDocument,
      options: {
        origin?: ReferenceCompareState["origin"];
        linkedEditorSessionId?: string | null;
      } = {},
    ) => {
      setReferenceCompare({
        reference,
        origin: options.origin ?? "manual",
        linkedEditorSessionId: options.linkedEditorSessionId ?? null,
        followMode: "off",
      });
      setReferenceNarrowFocus("reference");
    },
    [],
  );

  return {
    clearReferenceCompare,
    referenceColumnPercent,
    referenceCompare,
    referenceNarrowFocus,
    setReferenceColumnPercent,
    setReferenceCompare,
    setReferenceDocument,
    setReferenceNarrowFocus,
  };
}
