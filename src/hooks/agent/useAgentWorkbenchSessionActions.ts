import {
  useAgentLaunchGate,
  type UseAgentLaunchGateOptions,
} from "./useAgentLaunchGate";
import {
  useAgentSessionLifecycle,
  type UseAgentSessionLifecycleOptions,
} from "./useAgentSessionLifecycle";

// `useAgentWorkbenchSessionActions` is a fan-in wrapper that exposes
// the four Agent Workbench session-level action handlers (the three
// lifecycle handlers plus the launch-gate check) under a single
// boundary name. The options type is derived from the two sub-hook
// options types minus the cross-link field
// (`refreshAgentSessionState`) which the wrapper composes
// internally: the lifecycle hook creates it, and the launch-gate
// hook consumes it. It does NOT own any state; all setters come
// from App.tsx (see `useAgentWorkbenchRuntimeState`).
// See docs/assist-surface-strategy.md and
// docs/agent-workbench-boundary.md.

type UseAgentWorkbenchSessionActionsOptions = Omit<
  UseAgentSessionLifecycleOptions & UseAgentLaunchGateOptions,
  "refreshAgentSessionState"
>;

export function useAgentWorkbenchSessionActions(
  options: UseAgentWorkbenchSessionActionsOptions,
) {
  const {
    refreshAgentSessionState,
    requestAgentSessionStop,
    sendWorkspacePathToAgent,
  } = useAgentSessionLifecycle(options);

  const { requestAgentLaunchGateCheck } = useAgentLaunchGate({
    ...options,
    refreshAgentSessionState,
  });

  return {
    refreshAgentSessionState,
    requestAgentLaunchGateCheck,
    requestAgentSessionStop,
    sendWorkspacePathToAgent,
  };
}
