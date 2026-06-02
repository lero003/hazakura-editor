import { useEffect, type Dispatch, type SetStateAction } from "react";
import type {
  AgentWorkbenchOutputChunk,
  AgentWorkbenchSession,
} from "../tauri";
import {
  AGENT_WORKBENCH_SESSION_POLL_MS,
  type AgentLaunchGateState,
  type RightPaneMode,
} from "../types";
import { isActiveAgentSession } from "../agentWorkbench";

type RefValue<T> = {
  current: T;
};

type UseAgentWorkbenchSessionSyncOptions = {
  activeAgentSession: boolean;
  agentSession: AgentWorkbenchSession | null;
  agentUiSuspendedRef: RefValue<boolean>;
  agentWorkbenchAvailable: boolean;
  onRefreshAgentSessionState: () => unknown;
  onResetAgentOutput: (output: AgentWorkbenchOutputChunk[]) => void;
  rightPaneMode: RightPaneMode;
  setAgentLaunchGate: Dispatch<SetStateAction<AgentLaunchGateState>>;
  setAgentSession: Dispatch<SetStateAction<AgentWorkbenchSession | null>>;
  setRightPaneMode: Dispatch<SetStateAction<RightPaneMode>>;
  workspaceRootPath: string | null;
};

export function useAgentWorkbenchSessionSync({
  activeAgentSession,
  agentSession,
  agentUiSuspendedRef,
  agentWorkbenchAvailable,
  onRefreshAgentSessionState,
  onResetAgentOutput,
  rightPaneMode,
  setAgentLaunchGate,
  setAgentSession,
  setRightPaneMode,
  workspaceRootPath,
}: UseAgentWorkbenchSessionSyncOptions) {
  useEffect(() => {
    if (!agentWorkbenchAvailable && rightPaneMode === "agent") {
      setRightPaneMode("preview");
    }
  }, [agentWorkbenchAvailable, rightPaneMode, setRightPaneMode]);

  useEffect(() => {
    if (agentWorkbenchAvailable) {
      void onRefreshAgentSessionState();
      return;
    }

    setAgentSession(null);
    onResetAgentOutput([]);
  }, [
    agentWorkbenchAvailable,
    onRefreshAgentSessionState,
    onResetAgentOutput,
    setAgentSession,
  ]);

  useEffect(() => {
    if (!agentWorkbenchAvailable || !isActiveAgentSession(agentSession)) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (!document.hasFocus() || agentUiSuspendedRef.current) {
        return;
      }

      void onRefreshAgentSessionState();
    }, AGENT_WORKBENCH_SESSION_POLL_MS);

    return () => window.clearInterval(intervalId);
  }, [
    agentSession,
    agentUiSuspendedRef,
    agentWorkbenchAvailable,
    onRefreshAgentSessionState,
  ]);

  useEffect(() => {
    if (activeAgentSession && agentSession?.workspaceRoot !== workspaceRootPath) {
      setAgentLaunchGate((currentGate) => ({
        ...currentGate,
        kind: "rejected",
        message:
          "Active Agent session remains bound to its launch workspace. Stop it before starting in another workspace.",
      }));
      return;
    }

    if (activeAgentSession) {
      return;
    }

    setAgentLaunchGate({
      kind: "idle",
      message: "Launch gate not checked.",
      preflight: null,
    });
  }, [
    activeAgentSession,
    agentSession?.workspaceRoot,
    setAgentLaunchGate,
    workspaceRootPath,
  ]);
}
