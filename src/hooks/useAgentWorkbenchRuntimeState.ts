import { useState } from "react";
import type { AgentWorkbenchSession } from "../tauri";
import type { AgentLaunchGateState, AgentTerminalSize } from "../types";
import { isActiveAgentSession } from "../agentWorkbench";

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
