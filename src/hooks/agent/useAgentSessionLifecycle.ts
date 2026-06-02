import {
  type Dispatch,
  type SetStateAction,
  useCallback,
} from "react";
import {
  getAgentWorkbenchSessionState,
  stopAgentWorkbenchSession,
  writeAgentWorkbenchSessionInput,
  type AgentWorkbenchOutputChunk,
  type AgentWorkbenchSession,
} from "../../lib/tauri";
import {
  type AgentLaunchGateState,
  type CompareAnchor,
  type MenuLanguage,
} from "../../types";
import {
  isActiveAgentSession,
  lastAgentOutputSeq,
  reportAgentLaunchGateError,
  sameAgentWorkbenchSession,
} from "../../features/agent/agentWorkbench";
import { useAgentOutputSeqCursor } from "./useAgentOutputSeqCursor";

// `useAgentSessionLifecycle` owns the per-session action handlers for
// the active Agent Workbench session: differential session-state
// refresh, stop, and writing a workspace file path to the session as
// user input. It uses an internal `useAgentOutputSeqCursor` to keep
// the session-state poll incremental. It does NOT own the session
// state, the terminal size, or the output buffer; all of those are
// read from and written to setters passed in from App.tsx (see
// `useAgentWorkbenchRuntimeState` and `useAgentOutputBuffer`).
// See docs/assist-surface-strategy.md and
// docs/agent-workbench-boundary.md.

export type UseAgentSessionLifecycleOptions = {
  agentSession: AgentWorkbenchSession | null;
  applyAgentOutput: (output: AgentWorkbenchOutputChunk[]) => void;
  closeWorkspaceContextMenu: () => void;
  menuLanguage: MenuLanguage;
  setAgentLaunchGate: Dispatch<SetStateAction<AgentLaunchGateState>>;
  setAgentSession: Dispatch<SetStateAction<AgentWorkbenchSession | null>>;
  setAgentStopPending: Dispatch<SetStateAction<boolean>>;
  setGlobalError: Dispatch<SetStateAction<string | null>>;
  setStatus: Dispatch<SetStateAction<string>>;
};

export function useAgentSessionLifecycle({
  agentSession,
  applyAgentOutput,
  closeWorkspaceContextMenu,
  menuLanguage,
  setAgentLaunchGate,
  setAgentSession,
  setAgentStopPending,
  setGlobalError,
  setStatus,
}: UseAgentSessionLifecycleOptions) {
  const { getLastSeenSeq, updateLastSeenSeq } = useAgentOutputSeqCursor(
    agentSession?.createdAtMs,
  );

  const refreshAgentSessionState = useCallback(async () => {
    try {
      const state = await getAgentWorkbenchSessionState(getLastSeenSeq());
      const maxSeq = lastAgentOutputSeq(state.output);
      updateLastSeenSeq(maxSeq);
      setAgentSession((currentSession) =>
        sameAgentWorkbenchSession(currentSession, state.session)
          ? currentSession
          : state.session,
      );
      applyAgentOutput(state.output);

      if (state.session?.status === "exited") {
        setAgentLaunchGate((currentGate) => ({
          ...currentGate,
          kind: currentGate.kind === "idle" ? "passed" : currentGate.kind,
          message: "Agent session exited.",
        }));
        setStatus("Agent session exited");
      } else if (state.session?.status === "stopped") {
        setAgentLaunchGate((currentGate) => ({
          ...currentGate,
          kind: currentGate.kind === "idle" ? "passed" : currentGate.kind,
          message: "Agent session stopped.",
        }));
        setStatus("Agent session stopped");
      }
    } catch (err) {
      reportAgentLaunchGateError(
        setAgentLaunchGate,
        setStatus,
        "Agent session state unavailable",
        err,
      );
    }
  }, [
    applyAgentOutput,
    getLastSeenSeq,
    setAgentLaunchGate,
    setAgentSession,
    setStatus,
    updateLastSeenSeq,
  ]);

  const sendWorkspacePathToAgent = useCallback(
    async (file: CompareAnchor) => {
      closeWorkspaceContextMenu();
      setGlobalError(null);

      if (!isActiveAgentSession(agentSession)) {
        setStatus(
          menuLanguage !== "en"
            ? "実行中の Agent セッションが必要です"
            : "Running Agent session required",
        );
        return;
      }

      try {
        await writeAgentWorkbenchSessionInput(file.path);
        setStatus(
          menuLanguage !== "en"
            ? `Agent にフルパスを送信: ${file.name}`
            : `Sent full path to Agent: ${file.name}`,
        );
      } catch (err) {
        reportAgentLaunchGateError(
          setAgentLaunchGate,
          setStatus,
          menuLanguage !== "en"
            ? "Agent へのパス送信に失敗しました"
            : "Agent path send failed",
          err,
        );
        void refreshAgentSessionState();
      }
    },
    [
      agentSession,
      closeWorkspaceContextMenu,
      menuLanguage,
      refreshAgentSessionState,
      setAgentLaunchGate,
      setGlobalError,
      setStatus,
    ],
  );

  const stopAgentSession = useCallback(async () => {
    setAgentStopPending(true);
    setStatus("Stopping Agent session...");

    try {
      const state = await stopAgentWorkbenchSession();
      setAgentSession(state.session);
      applyAgentOutput(state.output);
      setAgentLaunchGate((currentGate) => ({
        ...currentGate,
        kind: state.session ? "passed" : currentGate.kind,
        message: state.session
          ? "Agent session stopped."
          : "No Agent session to stop.",
      }));
      setStatus(
        state.session
          ? "Agent session stopped"
          : "No Agent session to stop",
      );
    } catch (err) {
      reportAgentLaunchGateError(
        setAgentLaunchGate,
        setStatus,
        "Agent session stop failed",
        err,
      );
    } finally {
      setAgentStopPending(false);
    }
  }, [
    applyAgentOutput,
    setAgentLaunchGate,
    setAgentSession,
    setAgentStopPending,
    setStatus,
  ]);

  const requestAgentSessionStop = useCallback(() => {
    void stopAgentSession();
  }, [stopAgentSession]);

  return {
    refreshAgentSessionState,
    requestAgentSessionStop,
    sendWorkspacePathToAgent,
  };
}
