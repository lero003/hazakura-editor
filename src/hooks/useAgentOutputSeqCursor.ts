import { useCallback, useEffect, useRef } from "react";

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
