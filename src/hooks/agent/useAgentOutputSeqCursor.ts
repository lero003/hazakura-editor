import { useCallback, useEffect, useRef } from "react";

// Agent Workbench output sequence cursor lives in this hook so
// that App.tsx does not carry Assist Surface ref state. The cursor
// tracks the last `seq` already applied to the frontend output
// buffer (see useAgentOutputBuffer), so subsequent
// `getAgentWorkbenchSessionState` polls can fetch only the delta.
// `resetKey` is the session `createdAtMs`; the cursor resets to 0
// when the active session changes. See
// docs/assist-surface-strategy.md and
// docs/agent-workbench-boundary.md.

export function useAgentOutputSeqCursor(resetKey: unknown) {
  const lastSeenSeqRef = useRef(0);

  useEffect(() => {
    lastSeenSeqRef.current = 0;
  }, [resetKey]);

  const getLastSeenSeq = useCallback(
    () => lastSeenSeqRef.current || undefined,
    [],
  );

  const updateLastSeenSeq = useCallback((seq: number) => {
    if (seq > lastSeenSeqRef.current) {
      lastSeenSeqRef.current = seq;
    }
  }, []);

  return {
    getLastSeenSeq,
    updateLastSeenSeq,
  };
}
