import {
  type Dispatch,
  type SetStateAction,
  useCallback,
} from "react";
import {
  getAgentWorkbenchSessionState,
  startAgentWorkbenchSession,
  stopAgentWorkbenchSession,
  writeAgentWorkbenchSessionInput,
  type AgentWorkbenchOutputChunk,
  type AgentWorkbenchProvider,
  type AgentWorkbenchSession,
} from "../tauri";
import {
  lastAgentOutputSeq,
  sameAgentWorkbenchSession,
} from "../agentSession";
import {
  type AgentLaunchGateState,
  type AgentTerminalSize,
  type CompareAnchor,
  type MenuLanguage,
} from "../types";
import {
  isActiveAgentSession,
  providerLabel,
} from "../utils";
import { useAgentOutputSeqCursor } from "./useAgentOutputSeqCursor";

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

export function useAgentWorkbenchSessionActions({
  agentSession,
  agentTerminalSize,
  agentWorkbenchActive,
  agentWorkbenchConsent,
  agentWorkbenchProvider,
  applyAgentOutput,
  closeWorkspaceContextMenu,
  menuLanguage,
  setAgentLaunchGate,
  setAgentSession,
  setAgentStopPending,
  setGlobalError,
  setStatus,
  workspaceRootPath,
}: UseAgentWorkbenchSessionActionsOptions) {
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

  const checkAgentLaunchGate = useCallback(async () => {
    if (!workspaceRootPath) {
      setAgentLaunchGate({
        kind: "rejected",
        message: "Launch unavailable: open a workspace folder first.",
        preflight: null,
      });
      setStatus("Agent launch unavailable");
      return;
    }

    setAgentLaunchGate({
      kind: "checking",
      message: "Checking Agent Workbench launch gate...",
      preflight: null,
    });
    setStatus("Checking Agent Workbench launch gate...");

    try {
      const result = await startAgentWorkbenchSession(
        agentWorkbenchActive,
        agentWorkbenchConsent,
        agentWorkbenchProvider,
        workspaceRootPath,
        agentTerminalSize?.columns,
        agentTerminalSize?.rows,
      );

      if (!result.preflight.providerAvailable) {
        const searchedList = result.preflight.searchedPaths.length
          ? result.preflight.searchedPaths.map((entry) => `  - ${entry}`).join("\n")
          : "  - (none)";
        setAgentLaunchGate({
          kind: "rejected",
          message: `Provider not found: ${providerLabel(agentWorkbenchProvider)} was not found in the app search path, including Homebrew, MacPorts, /usr/local/bin, and common toolchain manager locations (bun, deno, volta, asdf, pnpm, cargo, go).\n\nSearched paths:\n${searchedList}`,
          preflight: result.preflight,
        });
        setAgentSession(null);
        applyAgentOutput(result.output);
        setStatus("Agent provider not found");
        return;
      }

      if (!result.session) {
        setAgentLaunchGate({
          kind: "rejected",
          message: "Provider not found; no Agent session was started.",
          preflight: result.preflight,
        });
        setAgentSession(null);
        applyAgentOutput(result.output);
        setStatus("Agent provider not found");
        return;
      }

      setAgentLaunchGate({
        kind: "passed",
        message: "Agent session running in the selected workspace. Only the selected allowlisted CLI was launched.",
        preflight: result.preflight,
      });
      setAgentSession(result.session);
      applyAgentOutput(result.output);
      setStatus("Agent session running");
    } catch (err) {
      const message = String(err);

      if (message.toLowerCase().includes("not implemented")) {
        setAgentLaunchGate({
          kind: "passed",
          message: "Gate passed; launch is not implemented in this build.",
          preflight: null,
        });
        setStatus("Agent launch gate passed");
        return;
      }

      setAgentLaunchGate({
        kind: "rejected",
        message: `Agent launch rejected: ${message}`,
        preflight: null,
      });
      if (message.toLowerCase().includes("already active")) {
        void refreshAgentSessionState();
      }
      setStatus("Agent launch rejected");
    }
  }, [
    agentTerminalSize,
    agentWorkbenchActive,
    agentWorkbenchConsent,
    agentWorkbenchProvider,
    applyAgentOutput,
    refreshAgentSessionState,
    setAgentLaunchGate,
    setAgentSession,
    setStatus,
    workspaceRootPath,
  ]);

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

  const requestAgentLaunchGateCheck = useCallback(() => {
    void checkAgentLaunchGate();
  }, [checkAgentLaunchGate]);

  const requestAgentSessionStop = useCallback(() => {
    void stopAgentSession();
  }, [stopAgentSession]);

  return {
    refreshAgentSessionState,
    requestAgentLaunchGateCheck,
    requestAgentSessionStop,
    sendWorkspacePathToAgent,
  };
}
