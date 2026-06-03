import {
  type Dispatch,
  type SetStateAction,
  useCallback,
} from "react";
import {
  requestAppRestart,
  type AgentWorkbenchProvider,
} from "../../lib/tauri";
import type {
  AgentLaunchGateState,
  MenuLanguage,
} from "../../types";
import { isJapaneseMenuLanguage } from "../../types";
import { isKanaStyle } from "../../lib/locale/_helpers";

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
      const matchesCurrent = enabled === agentWorkbenchActive;
      if (matchesCurrent) {
        setStatus(
          enabled
            ? agentWorkbenchActiveMessage(menuLanguage)
            : safeEditorModeMessage(menuLanguage),
        );
      } else {
        setStatus(
          enabled
            ? agentWorkbenchWillEnableMessage(menuLanguage)
            : agentWorkbenchWillDisableMessage(menuLanguage),
        );
      }
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
    setStatus(restartingAppMessage(menuLanguage));

    try {
      await requestAppRestart();
    } catch (err) {
      setAppRestartPending(false);
      setGlobalError(`Restart failed: ${String(err)}`);
      setStatus(restartFailedMessage(menuLanguage));
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
        acknowledged
          ? agentConsentAcknowledgedMessage(menuLanguage)
          : agentConsentClearedMessage(menuLanguage),
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

function agentWorkbenchActiveMessage(menuLanguage: MenuLanguage): string {
  if (isKanaStyle(menuLanguage)) {
    return "えーじぇんと わーくべんちは ゆうこうです";
  }
  if (isJapaneseMenuLanguage(menuLanguage)) {
    return "エージェントワークベンチは有効です";
  }
  return "Agent Workbench active";
}

function safeEditorModeMessage(menuLanguage: MenuLanguage): string {
  if (isKanaStyle(menuLanguage)) {
    return "Safe Editor もーどです";
  }
  if (isJapaneseMenuLanguage(menuLanguage)) {
    return "Safe Editor モードです";
  }
  return "Agent Workbench disabled";
}

function agentWorkbenchWillEnableMessage(
  menuLanguage: MenuLanguage,
): string {
  if (isKanaStyle(menuLanguage)) {
    return "さいきどうごに えーじぇんと わーくべんちが ゆうこうに なります";
  }
  if (isJapaneseMenuLanguage(menuLanguage)) {
    return "再起動後にエージェントワークベンチが有効になります";
  }
  return "Agent Workbench will enable after restart";
}

function agentWorkbenchWillDisableMessage(
  menuLanguage: MenuLanguage,
): string {
  if (isKanaStyle(menuLanguage)) {
    return "さいきどうごに えーじぇんと わーくべんちが むこうに なります";
  }
  if (isJapaneseMenuLanguage(menuLanguage)) {
    return "再起動後にエージェントワークベンチが無効になります";
  }
  return "Agent Workbench will disable after restart";
}

function restartingAppMessage(menuLanguage: MenuLanguage): string {
  if (isKanaStyle(menuLanguage)) {
    return "hazakura editor を さいきどう ちゅう...";
  }
  if (isJapaneseMenuLanguage(menuLanguage)) {
    return "hazakura editor を再起動中...";
  }
  return "Restarting hazakura editor...";
}

function restartFailedMessage(menuLanguage: MenuLanguage): string {
  if (isKanaStyle(menuLanguage)) {
    return "さいきどうに しっぱいしました";
  }
  if (isJapaneseMenuLanguage(menuLanguage)) {
    return "再起動に失敗しました";
  }
  return "Restart failed";
}

function agentConsentAcknowledgedMessage(
  menuLanguage: MenuLanguage,
): string {
  if (isKanaStyle(menuLanguage)) {
    return "えーじぇんと わーくべんちの せきにん きょうかいを かくにん しました";
  }
  if (isJapaneseMenuLanguage(menuLanguage)) {
    return "エージェントワークベンチの責任境界を確認しました";
  }
  return "Agent Workbench responsibility acknowledged";
}

function agentConsentClearedMessage(menuLanguage: MenuLanguage): string {
  if (isKanaStyle(menuLanguage)) {
    return "えーじぇんと わーくべんちの どういを とく しました";
  }
  if (isJapaneseMenuLanguage(menuLanguage)) {
    return "エージェントワークベンチの同意を解除しました";
  }
  return "Agent Workbench consent cleared";
}
