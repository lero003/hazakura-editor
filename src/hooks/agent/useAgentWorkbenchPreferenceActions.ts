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
  AssistSurfacePreference,
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
  assistSurfaceActive: AssistSurfacePreference;
  agentWorkbenchActive: boolean;
  menuLanguage: MenuLanguage;
  setAgentLaunchGate: Dispatch<SetStateAction<AgentLaunchGateState>>;
  setAgentWorkbenchConsent: Dispatch<SetStateAction<boolean>>;
  setAgentWorkbenchPreference: Dispatch<SetStateAction<boolean>>;
  setAgentWorkbenchProvider: Dispatch<SetStateAction<AgentWorkbenchProvider>>;
  setAssistSurfacePreference: Dispatch<SetStateAction<AssistSurfacePreference>>;
  setAppRestartPending: Dispatch<SetStateAction<boolean>>;
  setGlobalError: Dispatch<SetStateAction<string | null>>;
  setStatus: Dispatch<SetStateAction<string>>;
};

export function useAgentWorkbenchPreferenceActions({
  activeAgentSession,
  assistSurfaceActive,
  agentWorkbenchActive,
  menuLanguage,
  setAgentLaunchGate,
  setAgentWorkbenchConsent,
  setAgentWorkbenchPreference,
  setAgentWorkbenchProvider,
  setAssistSurfacePreference,
  setAppRestartPending,
  setGlobalError,
  setStatus,
}: UseAgentWorkbenchPreferenceActionsOptions) {
  const updateAssistSurfacePreference = useCallback(
    (surface: AssistSurfacePreference) => {
      if (activeAgentSession && surface !== "external-cli") {
        setAgentLaunchGate((currentGate) => ({
          ...currentGate,
          kind: "rejected",
          message:
            "Stop the active Agent session before changing the assist surface.",
        }));
        setStatus("Stop Agent session before changing assist surface");
        return;
      }

      setAssistSurfacePreference(surface);
      setAgentWorkbenchPreference(surface === "external-cli");
      setAgentLaunchGate({
        kind: "idle",
        message: "Launch gate not checked.",
        preflight: null,
      });
      setStatus(
        assistSurfaceSelectedMessage(
          menuLanguage,
          surface,
          surface === assistSurfaceActive,
        ),
      );
    },
    [
      activeAgentSession,
      assistSurfaceActive,
      menuLanguage,
      setAgentLaunchGate,
      setAgentWorkbenchPreference,
      setAssistSurfacePreference,
      setStatus,
    ],
  );

  const updateAgentWorkbenchPreference = useCallback(
    (enabled: boolean) => {
      setAgentWorkbenchPreference(enabled);
      setAssistSurfacePreference(enabled ? "external-cli" : "none");
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
      setAssistSurfacePreference,
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
    updateAssistSurfacePreference,
    updateAgentWorkbenchConsent,
    updateAgentWorkbenchPreference,
    updateAgentWorkbenchProvider,
  };
}

function assistSurfaceSelectedMessage(
  menuLanguage: MenuLanguage,
  surface: AssistSurfacePreference,
  active: boolean,
): string {
  if (isKanaStyle(menuLanguage)) {
    if (active) {
      return "この あしすとの せっていは ゆうこうです";
    }
    if (surface === "apple-local") {
      return "さいきどうごに Apple Local Assist を つかひます";
    }
    if (surface === "external-cli") {
      return "さいきどうごに CLI Agent を つかひます";
    }
    return "さいきどうごに そとの あしすとを つかひません";
  }
  if (isJapaneseMenuLanguage(menuLanguage)) {
    if (active) {
      return "このアシスト設定は現在有効です";
    }
    if (surface === "apple-local") {
      return "再起動後に Apple Local Assist を使います";
    }
    if (surface === "external-cli") {
      return "再起動後に CLI Agent を使います";
    }
    return "再起動後に外部アシストを使いません";
  }
  if (active) {
    return "Assist surface already active";
  }
  if (surface === "apple-local") {
    return "Apple Local Assist will be used after restart";
  }
  if (surface === "external-cli") {
    return "CLI Agent will be used after restart";
  }
  return "Assist surface will be off after restart";
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
    return "Hazakura Editor を さいきどう ちゅう...";
  }
  if (isJapaneseMenuLanguage(menuLanguage)) {
    return "Hazakura Editor を再起動中...";
  }
  return "Restarting Hazakura Editor...";
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
