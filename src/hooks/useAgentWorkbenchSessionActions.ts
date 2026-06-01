import {
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  type AgentWorkbenchOutputChunk,
  type AgentWorkbenchProvider,
  type AgentWorkbenchSession,
} from "../tauri";
import {
  type AgentLaunchGateState,
  type AgentTerminalSize,
  type MenuLanguage,
} from "../types";
import { useAgentLaunchGate } from "./useAgentLaunchGate";
import { useAgentSessionLifecycle } from "./useAgentSessionLifecycle";

type UseAgentWorkbenchSessionActionsOptions = {
  agentSession: AgentWorkbenchSession | null;
  agentTerminalSize: AgentTerminalSize | null;
  agentWorkbenchActive: boolean;
  agentWorkbenchConsent: boolean;
  agentWorkbenchProvider: AgentWorkbenchProvider;
  applyAgentOutput: (output: AgentWorkbenchOutputChunk[]) => void;
  closeWorkspaceContextMenu: () => void;
  menuLanguage: MenuLanguage;
  setAgentLaunchGate: Dispatch<SetStateAction<AgentLaunchGateState>>;
  setAgentSession: Dispatch<SetStateAction<AgentWorkbenchSession | null>>;
  setAgentStopPending: Dispatch<SetStateAction<boolean>>;
  setGlobalError: Dispatch<SetStateAction<string | null>>;
  setStatus: Dispatch<SetStateAction<string>>;
  workspaceRootPath: string | null;
};

export function useAgentWorkbenchSessionActions(
  options: UseAgentWorkbenchSessionActionsOptions,
) {
  const {
    refreshAgentSessionState,
    requestAgentSessionStop,
    sendWorkspacePathToAgent,
  } = useAgentSessionLifecycle(options);

  const { requestAgentLaunchGateCheck } = useAgentLaunchGate({
    ...options,
    refreshAgentSessionState,
  });

  return {
    refreshAgentSessionState,
    requestAgentLaunchGateCheck,
    requestAgentSessionStop,
    sendWorkspacePathToAgent,
  };
}
