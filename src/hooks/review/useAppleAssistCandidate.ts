import { useCallback, useRef, useState } from "react";
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
// callers (a detached Hazakura Local Assist window, an L Mode quick
// action) can pass a different target shape as long as the
// four fields are present.
//
// The hook returns a `busy` flag for the call site to disable
// the command palette entry while a request is in flight, and
// an `error` slot for the call site to surface a localized
// message via the existing `setStatus` channel.
//
// v0.12+ direction (post-slice-18): the Hazakura Local Assist UX
// is moving from "selected-text command palette helper" to an
// external Writing Companion that updates the unsaved editor
// buffer through an AI edit transaction. See
// `docs/apple-local-assist-writing-companion-plan.md`. The
// command-palette + Review-Desk handoff wired up here is
// retained as foundation plumbing, but the new Writing
// Companion mock does NOT route through this hook — it talks
// to the main window via a Tauri event and records an AI edit
// transaction through the dedicated store (slice 4+).

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
  const activeTabRef = useRef<AppleAssistTarget | null>(activeTab);
  activeTabRef.current = activeTab;
  const requestSeqRef = useRef(0);

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
        const message = `Hazakura Local Assist operation '${operation}' is not implemented in v0.12.`;
        setError(message);
        return { ok: false, error: message };
      }

      const requestSeq = requestSeqRef.current + 1;
      requestSeqRef.current = requestSeq;
      const requestTab = activeTab;
      setBusy(true);
      setError(null);

      try {
        const response = await generateAppleAssistCandidate({
          operation,
          selectedText,
        });
        const staleReason = getStaleAppleAssistResultReason(
          requestSeq,
          requestSeqRef.current,
          requestTab,
          activeTabRef.current,
        );
        if (staleReason) {
          if (requestSeqRef.current === requestSeq) {
            setError(staleReason);
          }
          return { ok: false, error: staleReason };
        }

        const compareResult = runCandidateCompare({
          bufferContents: requestTab.contents,
          documentTabId: requestTab.id,
          documentPath: requestTab.path,
          documentLabel: requestTab.name,
          leftColumnLabel: copy.candidateColumnLeft,
          rightColumnLabel: copy.candidateColumnRight,
          candidateSourceLabel: copy.candidateSourceAppleAssist,
          candidateText: response.candidateText,
        });

        if (!compareResult.ok) {
          if (requestSeqRef.current === requestSeq) {
            setError(compareResult.error);
          }
          return { ok: false, error: compareResult.error };
        }

        return {
          ok: true,
          candidateText: response.candidateText,
          modelId: response.modelId,
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (requestSeqRef.current === requestSeq) {
          setError(message);
        }
        return { ok: false, error: message };
      } finally {
        if (requestSeqRef.current === requestSeq) {
          setBusy(false);
        }
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

function getStaleAppleAssistResultReason(
  requestSeq: number,
  latestRequestSeq: number,
  requestTab: AppleAssistTarget,
  latestTab: AppleAssistTarget | null,
): string | null {
  if (requestSeq !== latestRequestSeq) {
    return "Hazakura Local Assist result ignored because a newer request is active.";
  }
  if (!latestTab) {
    return "Hazakura Local Assist result ignored because there is no active editor tab.";
  }
  if (latestTab.id !== requestTab.id || latestTab.path !== requestTab.path) {
    return "Hazakura Local Assist result ignored because the active editor tab changed.";
  }
  if (latestTab.contents !== requestTab.contents) {
    return "Hazakura Local Assist result ignored because the editor buffer changed.";
  }
  return null;
}
