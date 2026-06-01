import { useCallback, useRef } from "react";

export function useAgentUiRefreshGate() {
  const agentUiSuspendedRef = useRef(false);

  const suspendAgentUiRefresh = useCallback(() => {
    agentUiSuspendedRef.current = true;
  }, []);

  const resumeAgentUiRefresh = useCallback(() => {
    agentUiSuspendedRef.current = false;
  }, []);

  return {
    agentUiSuspendedRef,
    resumeAgentUiRefresh,
    suspendAgentUiRefresh,
  };
}
