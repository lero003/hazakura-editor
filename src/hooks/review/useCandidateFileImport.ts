import { useCallback, useRef, useState } from "react";
import { openTextFile, pickCandidateTextFile } from "../../lib/tauri";
import type { ReviewDeskCopy } from "../../lib/locale";

export type CandidateFileImportTarget = {
  id: string;
  name: string;
  path: string;
  contents: string;
};

export type CandidateFileImportResult =
  | {
      ok: true;
      candidateText: string;
      sourceName: string;
      sourcePath: string;
    }
  | { ok: false; error: string }
  | { ok: false; canceled: true };

export type UseCandidateFileImportOptions = {
  activeTab: CandidateFileImportTarget | null;
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
  setCandidateInputText: (value: string) => void;
};

export type UseCandidateFileImportResult = {
  busy: boolean;
  error: string | null;
  importAndCompare: () => Promise<CandidateFileImportResult>;
  clearError: () => void;
};

// Thin file-import bridge for v0.29 AI Markdown ingest.
// It opens only a user-selected text file, places its contents in
// the existing Review Desk candidate input, and renders the same
// explicit diff preview as manual paste. It never applies or saves.
export function useCandidateFileImport({
  activeTab,
  copy,
  runCandidateCompare,
  setCandidateInputText,
}: UseCandidateFileImportOptions): UseCandidateFileImportResult {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeTabRef = useRef<CandidateFileImportTarget | null>(activeTab);
  activeTabRef.current = activeTab;
  const requestSeqRef = useRef(0);

  const importAndCompare =
    useCallback(async (): Promise<CandidateFileImportResult> => {
      if (!activeTab) {
        const message = "No active editor tab.";
        setError(message);
        return { ok: false, error: message };
      }

      const requestSeq = requestSeqRef.current + 1;
      requestSeqRef.current = requestSeq;
      const requestTab = activeTab;
      setBusy(true);
      setError(null);

      try {
        const sourcePath = await pickCandidateTextFile();
        if (sourcePath === null) {
          return { ok: false, canceled: true };
        }

        const document = await openTextFile(sourcePath);
        const staleReason = getStaleCandidateFileImportReason(
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

        setCandidateInputText(document.contents);
        const compareResult = runCandidateCompare({
          bufferContents: requestTab.contents,
          documentTabId: requestTab.id,
          documentPath: requestTab.path,
          documentLabel: requestTab.name,
          leftColumnLabel: copy.candidateColumnLeft,
          rightColumnLabel: copy.candidateColumnRight,
          candidateSourceLabel: copy.candidateSourceFile(document.name),
          candidateText: document.contents,
        });

        if (!compareResult.ok) {
          if (requestSeqRef.current === requestSeq) {
            setError(compareResult.error);
          }
          return { ok: false, error: compareResult.error };
        }

        return {
          ok: true,
          candidateText: document.contents,
          sourceName: document.name,
          sourcePath: document.path,
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
    }, [activeTab, copy, runCandidateCompare, setCandidateInputText]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    busy,
    error,
    importAndCompare,
    clearError,
  };
}

function getStaleCandidateFileImportReason(
  requestSeq: number,
  latestRequestSeq: number,
  requestTab: CandidateFileImportTarget,
  latestTab: CandidateFileImportTarget | null,
): string | null {
  if (requestSeq !== latestRequestSeq) {
    return "Candidate file import ignored because a newer request is active.";
  }
  if (!latestTab) {
    return "Candidate file import ignored because there is no active editor tab.";
  }
  if (latestTab.id !== requestTab.id || latestTab.path !== requestTab.path) {
    return "Candidate file import ignored because the active editor tab changed.";
  }
  if (latestTab.contents !== requestTab.contents) {
    return "Candidate file import ignored because the editor buffer changed.";
  }
  return null;
}
