import { useCallback, useRef } from "react";

// Agent session-polling UI refresh suspension lives in this hook so
// that App.tsx does not carry Assist Surface ref state. The ref is
// consulted by the Agent session polling effect (in
// useAgentWorkbenchSessionSync) and is flipped by hover/focus
// events that should pause polling. See
// docs/assist-surface-strategy.md and
// docs/agent-workbench-boundary.md.

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
