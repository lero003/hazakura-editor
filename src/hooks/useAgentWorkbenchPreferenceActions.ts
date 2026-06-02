import {
  type Dispatch,
  type SetStateAction,
  useCallback,
} from "react";
import {
  requestAppRestart,
  type AgentWorkbenchProvider,
} from "../tauri";
import type {
  AgentLaunchGateState,
  MenuLanguage,
} from "../types";

// `useAgentWorkbenchPreferenceActions` owns the Agent Workbench
// preference-level action handlers: toggling the mode preference
// (with the restart-required caveat that drives the Agent Workbench
// trust boundary), requesting the app restart, recording/clearing
// the responsibility-boundary consent, and changing the allowlisted
// provider. It does NOT own the preference state, the launch gate,
// the app-restart-pending flag, or the global error; all of those
// are read from and written to setters passed in from App.tsx (see
// `useAgentWorkbenchPreferences`, `useAgentWorkbenchRuntimeState`).
// The provider-change guard intentionally spreads the current gate
// (so the existing preflight is preserved) and is not a fit for
// `reportAgentLaunchGateError`. See docs/assist-surface-strategy.md
// and docs/agent-workbench-boundary.md.

type UseAgentWorkbenchPreferenceActionsOptions = {
  activeAgentSession: boolean;
  agentWorkbenchActive: boolean;
  menuLanguage: MenuLanguage;
  setAgentLaunchGate: Dispatch<SetStateAction<AgentLaunchGateState>>;
  setAgentWorkbenchConsent: Dispatch<SetStateAction<boolean>>;
  setAgentWorkbenchPreference: Dispatch<SetStateAction<boolean>>;
  setAgentWorkbenchProvider: Dispatch<SetStateAction<AgentWorkbenchProvider>>;
  setAppRestartPending: Dispatch<SetStateAction<boolean>>;
  setGlobalError: Dispatch<SetStateAction<string | null>>;
  setStatus: Dispatch<SetStateAction<string>>;
};

export function useAgentWorkbenchPreferenceActions({
  activeAgentSession,
  agentWorkbenchActive,
  menuLanguage,
  setAgentLaunchGate,
  setAgentWorkbenchConsent,
  setAgentWorkbenchPreference,
  setAgentWorkbenchProvider,
  setAppRestartPending,
  setGlobalError,
  setStatus,
}: UseAgentWorkbenchPreferenceActionsOptions) {
  const updateAgentWorkbenchPreference = useCallback(
    (enabled: boolean) => {
      setAgentWorkbenchPreference(enabled);
      if (menuLanguage !== "en") {
        setStatus(
          enabled === agentWorkbenchActive
            ? enabled
              ? "エージェントワークベンチは有効です"
              : "Safe Editor モードです"
            : enabled
              ? "再起動後にエージェントワークベンチが有効になります"
              : "再起動後にエージェントワークベンチが無効になります",
        );
        return;
      }

      setStatus(
        enabled === agentWorkbenchActive
          ? enabled
            ? "Agent Workbench active"
            : "Agent Workbench disabled"
          : enabled
            ? "Agent Workbench will enable after restart"
            : "Agent Workbench will disable after restart",
      );
    },
    [
      agentWorkbenchActive,
      menuLanguage,
      setAgentWorkbenchPreference,
      setStatus,
    ],
  );

  const restartAppForAgentMode = useCallback(async () => {
    setAppRestartPending(true);
    setStatus(
      menuLanguage !== "en"
        ? "hazakura editor を再起動中..."
        : "Restarting hazakura editor...",
    );

    try {
      await requestAppRestart();
    } catch (err) {
      setAppRestartPending(false);
      setGlobalError(`Restart failed: ${String(err)}`);
      setStatus(menuLanguage !== "en" ? "再起動に失敗しました" : "Restart failed");
    }
  }, [menuLanguage, setAppRestartPending, setGlobalError, setStatus]);

  const updateAgentWorkbenchConsent = useCallback(
    (acknowledged: boolean) => {
      setAgentWorkbenchConsent(acknowledged);
      setAgentLaunchGate({
        kind: "idle",
        message: "Launch gate not checked.",
        preflight: null,
      });
      setStatus(
        menuLanguage !== "en"
          ? acknowledged
            ? "エージェントワークベンチの責任境界を確認しました"
            : "エージェントワークベンチの同意を解除しました"
          : acknowledged
            ? "Agent Workbench responsibility acknowledged"
            : "Agent Workbench consent cleared",
      );
    },
    [
      menuLanguage,
      setAgentLaunchGate,
      setAgentWorkbenchConsent,
      setStatus,
    ],
  );

  const updateAgentWorkbenchProvider = useCallback(
    (provider: AgentWorkbenchProvider) => {
      if (activeAgentSession) {
        setAgentLaunchGate((currentGate) => ({
          ...currentGate,
          kind: "rejected",
          message: "Stop the active Agent session before changing provider.",
        }));
        setStatus("Stop Agent session before changing provider");
        return;
      }

      setAgentWorkbenchProvider(provider);
      setAgentLaunchGate({
        kind: "idle",
        message: "Launch gate not checked.",
        preflight: null,
      });
      setStatus(`Agent provider selected: ${provider}`);
    },
    [
      activeAgentSession,
      setAgentLaunchGate,
      setAgentWorkbenchProvider,
      setStatus,
    ],
  );

  return {
    restartAppForAgentMode,
    updateAgentWorkbenchConsent,
    updateAgentWorkbenchPreference,
    updateAgentWorkbenchProvider,
  };
}
