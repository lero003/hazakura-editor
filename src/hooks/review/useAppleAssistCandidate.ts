import { useCallback, useState } from "react";
import {
  generateAppleAssistCandidate,
  type AppleAssistOperation,
  APPLE_ASSIST_V0_12_OPERATIONS,
} from "../../lib/tauri";
import type { ReviewDeskCopy } from "../../lib/locale";

// `useAppleAssistCandidate` is the thin bridge between Apple
// Local Assist and the existing Review Desk candidate flow. It
// does NOT own the candidate state — `useReviewDeskState` does —
// and it does NOT auto-apply anything. The hook's only job is:
//   1. Take a target tab + selected text + operation.
//   2. Call the Rust `generate_apple_assist_candidate` command.
//   3. Hand the response off to the injected
//      `runCandidateCompare` with a fresh `candidateSourceLabel`
//      (so the Review Desk renders the same diff surface as the
//      manual paste flow, with a different source label).
//
// The active tab is passed in as a minimal `AppleAssistTarget`
// shape rather than the full `ActiveTab` type so the hook does
// not become coupled to the editor's full state surface. Future
// callers (a detached Apple Assist window, an L Mode quick
// action) can pass a different target shape as long as the
// four fields are present.
//
// The hook returns a `busy` flag for the call site to disable
// the command palette entry while a request is in flight, and
// an `error` slot for the call site to surface a localized
// message via the existing `setStatus` channel.

export type AppleAssistTarget = {
  id: string;
  name: string;
  path: string;
  contents: string;
};

export type GenerateAppleAssistCandidateResult =
  | { ok: true; candidateText: string; modelId: string }
  | { ok: false; error: string };

export type UseAppleAssistCandidateOptions = {
  activeTab: AppleAssistTarget | null;
  copy: ReviewDeskCopy;
  runCandidateCompare: (params: {
    bufferContents: string;
    documentTabId: string;
    documentPath: string;
    documentLabel: string;
    leftColumnLabel: string;
    rightColumnLabel: string;
    candidateSourceLabel: string;
    candidateText: string;
  }) => { ok: true } | { ok: false; error: string };
};

export type UseAppleAssistCandidateResult = {
  busy: boolean;
  error: string | null;
  generateAndCompare: (
    operation: AppleAssistOperation,
    selectedText: string,
  ) => Promise<GenerateAppleAssistCandidateResult>;
  clearError: () => void;
};

export function useAppleAssistCandidate({
  activeTab,
  copy,
  runCandidateCompare,
}: UseAppleAssistCandidateOptions): UseAppleAssistCandidateResult {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateAndCompare = useCallback(
    async (
      operation: AppleAssistOperation,
      selectedText: string,
    ): Promise<GenerateAppleAssistCandidateResult> => {
      if (!activeTab) {
        const message = "No active editor tab.";
        setError(message);
        return { ok: false, error: message };
      }
      if (selectedText.length === 0) {
        const message = "Selection is empty.";
        setError(message);
        return { ok: false, error: message };
      }
      if (!APPLE_ASSIST_V0_12_OPERATIONS.includes(operation)) {
        const message = `Apple Local Assist operation '${operation}' is not implemented in v0.12.`;
        setError(message);
        return { ok: false, error: message };
      }

      setBusy(true);
      setError(null);

      try {
        const response = await generateAppleAssistCandidate({
          operation,
          selectedText,
        });

        const compareResult = runCandidateCompare({
          bufferContents: activeTab.contents,
          documentTabId: activeTab.id,
          documentPath: activeTab.path,
          documentLabel: activeTab.name,
          leftColumnLabel: copy.candidateColumnLeft,
          rightColumnLabel: copy.candidateColumnRight,
          candidateSourceLabel: copy.candidateSourceAppleAssist,
          candidateText: response.candidateText,
        });

        if (!compareResult.ok) {
          setError(compareResult.error);
          return { ok: false, error: compareResult.error };
        }

        return {
          ok: true,
          candidateText: response.candidateText,
          modelId: response.modelId,
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        return { ok: false, error: message };
      } finally {
        setBusy(false);
      }
    },
    [activeTab, copy, runCandidateCompare],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    busy,
    error,
    generateAndCompare,
    clearError,
  };
}
