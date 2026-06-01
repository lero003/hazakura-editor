import {
  type Dispatch,
  type SetStateAction,
  useCallback,
} from "react";
import {
  startAgentWorkbenchSession,
  type AgentWorkbenchOutputChunk,
  type AgentWorkbenchProvider,
  type AgentWorkbenchSession,
} from "../tauri";
import {
  type AgentLaunchGateState,
  type AgentTerminalSize,
} from "../types";
import { providerLabel } from "../utils";

type UseAgentLaunchGateOptions = {
  agentTerminalSize: AgentTerminalSize | null;
  agentWorkbenchActive: boolean;
  agentWorkbenchConsent: boolean;
  agentWorkbenchProvider: AgentWorkbenchProvider;
  applyAgentOutput: (output: AgentWorkbenchOutputChunk[]) => void;
  refreshAgentSessionState: () => Promise<void>;
  setAgentLaunchGate: Dispatch<SetStateAction<AgentLaunchGateState>>;
  setAgentSession: Dispatch<SetStateAction<AgentWorkbenchSession | null>>;
  setStatus: Dispatch<SetStateAction<string>>;
  workspaceRootPath: string | null;
};

export function useAgentLaunchGate({
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
}: UseAgentLaunchGateOptions) {
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

  const requestAgentLaunchGateCheck = useCallback(() => {
    void checkAgentLaunchGate();
  }, [checkAgentLaunchGate]);

  return {
    requestAgentLaunchGateCheck,
  };
}
