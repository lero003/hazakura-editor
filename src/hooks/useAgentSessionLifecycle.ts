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
} from "../tauri";
import {
  lastAgentOutputSeq,
  sameAgentWorkbenchSession,
} from "../agentSession";
import {
  type AgentLaunchGateState,
  type CompareAnchor,
  type MenuLanguage,
} from "../types";
import { isActiveAgentSession } from "../utils";
import { useAgentOutputSeqCursor } from "./useAgentOutputSeqCursor";

type UseAgentSessionLifecycleOptions = {
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
      setAgentLaunchGate({
        kind: "rejected",
        message: String(err),
        preflight: null,
      });
      setStatus("Agent session state unavailable");
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
          menuLanguage === "ja"
            ? "実行中の Agent セッションが必要です"
            : "Running Agent session required",
        );
        return;
      }

      try {
        await writeAgentWorkbenchSessionInput(file.path);
        setStatus(
          menuLanguage === "ja"
            ? `Agent にフルパスを送信: ${file.name}`
            : `Sent full path to Agent: ${file.name}`,
        );
      } catch (err) {
        setAgentLaunchGate({
          kind: "rejected",
          message: String(err),
          preflight: null,
        });
        setStatus(
          menuLanguage === "ja"
            ? "Agent へのパス送信に失敗しました"
            : "Agent path send failed",
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
      setAgentLaunchGate({
        kind: "rejected",
        message: String(err),
        preflight: null,
      });
      setStatus("Agent session stop failed");
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
