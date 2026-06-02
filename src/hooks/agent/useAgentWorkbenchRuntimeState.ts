import { useState } from "react";
import type { AgentWorkbenchSession } from "../../lib/tauri";
import type { AgentLaunchGateState, AgentTerminalSize } from "../../types";
import { isActiveAgentSession } from "../../features/agent/agentWorkbench";

// Agent Workbench runtime state lives in this hook so that App.tsx
// does not carry Assist Surface state. The fields are launch gate,
// session, terminal size, stop-pending, app-restart-pending, and
// the active-session derivation. `appRestartPending` stays here
// because the only writer is the Agent Workbench mode-change
// restart flow (`useAgentWorkbenchPreferenceActions.restartAppForAgentMode`).
// See docs/assist-surface-strategy.md and
// docs/agent-workbench-boundary.md.

export function useAgentWorkbenchRuntimeState() {
  const [agentLaunchGate, setAgentLaunchGate] =
    useState<AgentLaunchGateState>({
      kind: "idle",
      message: "Launch gate not checked.",
      preflight: null,
    });
  const [agentSession, setAgentSession] =
    useState<AgentWorkbenchSession | null>(null);
  const [agentTerminalSize, setAgentTerminalSize] =
    useState<AgentTerminalSize | null>(null);
  const [agentStopPending, setAgentStopPending] = useState(false);
  const [appRestartPending, setAppRestartPending] = useState(false);
  const activeAgentSession = isActiveAgentSession(agentSession);

  return {
    activeAgentSession,
    agentLaunchGate,
    agentSession,
    agentStopPending,
    agentTerminalSize,
    appRestartPending,
    setAgentLaunchGate,
    setAgentSession,
    setAgentStopPending,
    setAgentTerminalSize,
    setAppRestartPending,
  };
}
