import { useEffect, type Dispatch, type SetStateAction } from "react";
import type {
  AgentWorkbenchOutputChunk,
  AgentWorkbenchSession,
} from "../../lib/tauri";
import {
  AGENT_WORKBENCH_SESSION_POLL_MS,
  type AgentLaunchGateState,
} from "../../types";
import { isActiveAgentSession } from "../../features/agent/agentWorkbench";

// `useAgentWorkbenchSessionSync` owns the Agent Workbench
// background-sync effects: (a) reset the session and output buffer
// when availability changes, (b) poll the session state on the
// `AGENT_WORKBENCH_SESSION_POLL_MS` cadence while the active
// session is alive and the document is focused (and the UI refresh
// suspension ref is not set), and (c) keep the launch gate in sync
// with workspace-root binding for the active session. It returns
// nothing; all state and side effects are handled through the
// setters and refs passed in from App.tsx (see
// `useAgentWorkbenchRuntimeState`, `useAgentOutputBuffer`, and
// `useAgentUiRefreshGate`). See docs/assist-surface-strategy.md and
// docs/agent-workbench-boundary.md.

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
  setAgentLaunchGate: Dispatch<SetStateAction<AgentLaunchGateState>>;
  setAgentSession: Dispatch<SetStateAction<AgentWorkbenchSession | null>>;
  workspaceRootPath: string | null;
};

export function useAgentWorkbenchSessionSync({
  activeAgentSession,
  agentSession,
  agentUiSuspendedRef,
  agentWorkbenchAvailable,
  onRefreshAgentSessionState,
  onResetAgentOutput,
  setAgentLaunchGate,
  setAgentSession,
  workspaceRootPath,
}: UseAgentWorkbenchSessionSyncOptions) {
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
