import { useAgentWorkbenchSessionSync } from "./agent/useAgentWorkbenchSessionSync";
import { useAppActivityListeners } from "./useAppActivityListeners";
import { useAppKeyboardFocusEffects } from "./useAppKeyboardFocusEffects";
import { useAppShellSync } from "./useAppShellSync";
import { useWorkspaceRuntimeEffects } from "./workspace/useWorkspaceRuntimeEffects";

type UseAppRuntimeEffectsOptions = {
  activity: Parameters<typeof useAppActivityListeners>[0];
  agentSessionSync: Parameters<typeof useAgentWorkbenchSessionSync>[0];
  appShellSync: Parameters<typeof useAppShellSync>[0];
  keyboardFocus: Parameters<typeof useAppKeyboardFocusEffects>[0];
  workspaceRuntime: Parameters<typeof useWorkspaceRuntimeEffects>[0];
};

export function useAppRuntimeEffects({
  activity,
  agentSessionSync,
  appShellSync,
  keyboardFocus,
  workspaceRuntime,
}: UseAppRuntimeEffectsOptions) {
  useAppActivityListeners(activity);
  useAgentWorkbenchSessionSync(agentSessionSync);
  useAppShellSync(appShellSync);
  useWorkspaceRuntimeEffects(workspaceRuntime);
  useAppKeyboardFocusEffects(keyboardFocus);
}
