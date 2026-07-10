import { useCallback, useState } from "react";
import type {
  ReferenceCompareState,
  ReferenceDocument,
  ReferenceFollowMode,
  ReferenceNarrowFocus,
} from "../../features/referenceCompare/types";

export function useReferenceCompareState() {
  const [referenceCompare, setReferenceCompare] =
    useState<ReferenceCompareState | null>(null);
  const [referenceNarrowFocus, setReferenceNarrowFocus] =
    useState<ReferenceNarrowFocus>("editor");
  /** Share of the editor-preview grid width for the reference column (percent). */
  const [referenceColumnPercent, setReferenceColumnPercent] = useState(42);
  /** Current PDF page (0-based) for the active PDF reference. */
  const [pdfPageIndex, setPdfPageIndex] = useState(0);

  const clearReferenceCompare = useCallback(() => {
    setReferenceCompare(null);
    setReferenceNarrowFocus("editor");
    setPdfPageIndex(0);
  }, []);

  const setReferenceDocument = useCallback(
    (
      reference: ReferenceDocument,
      options: {
        origin?: ReferenceCompareState["origin"];
        linkedEditorSessionId?: string | null;
        followMode?: ReferenceFollowMode;
        sourceFingerprint?: string | null;
      } = {},
    ) => {
      setReferenceCompare({
        reference,
        origin: options.origin ?? "manual",
        linkedEditorSessionId: options.linkedEditorSessionId ?? null,
        followMode:
          options.followMode ??
          (options.linkedEditorSessionId && reference.kind === "pdf"
            ? "following"
            : "off"),
        sourceFingerprint: options.sourceFingerprint ?? null,
        externalChangePending: false,
      });
      setReferenceNarrowFocus("reference");
      setPdfPageIndex(0);
    },
    [],
  );

  const setReferenceFollowMode = useCallback((followMode: ReferenceFollowMode) => {
    setReferenceCompare((current) =>
      current ? { ...current, followMode } : current,
    );
  }, []);

  const markReferenceExternalChange = useCallback((pending: boolean) => {
    setReferenceCompare((current) =>
      current ? { ...current, externalChangePending: pending } : current,
    );
  }, []);

  return {
    clearReferenceCompare,
    markReferenceExternalChange,
    pdfPageIndex,
    referenceColumnPercent,
    referenceCompare,
    referenceNarrowFocus,
    setPdfPageIndex,
    setReferenceColumnPercent,
    setReferenceCompare,
    setReferenceDocument,
    setReferenceFollowMode,
    setReferenceNarrowFocus,
  };
}
