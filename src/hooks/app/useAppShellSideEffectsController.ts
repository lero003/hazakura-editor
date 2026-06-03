// `useAppShellSideEffectsController` is the final v0.9
// `useAppShellController` Slice E-2 domain composer. It
// bundles the two orchestrator-level side-effect hooks
// (`useAppMenuIntegration` and `useAppRuntimeEffects`) into a
// single typed surface. Both hooks are themselves pure
// bundlers of smaller sub-hooks, so the new controller is a
// pure bundler of bundlers.
//
// The composition is real (not a rename) because both bundled
// hooks are "side effects that run in the background" — they
// are the only hooks in the orchestrator that don't return
// values for the AppShell props; they only attach listeners,
// push state to the Rust side, and schedule effects. Folding
// them into one composer gives the orchestrator a single
// side-effects section instead of two, and names the
// side-effects surface as a domain.
//
// The hook owns no new state of its own. The signature is
// the union of the two bundled signatures, derived via
// `Parameters<...>[0]` so any future change to the source
// hook options is reflected here without duplication.

import { useAppMenuIntegration } from "./useAppMenuIntegration";
import { useAppRuntimeEffects } from "./useAppRuntimeEffects";

type UseAppShellSideEffectsControllerOptions = Parameters<
  typeof useAppMenuIntegration
>[0] &
  Parameters<typeof useAppRuntimeEffects>[0];

export function useAppShellSideEffectsController({
  actions,
  listener,
  activity,
  agentSessionSync,
  appShellSync,
  workspaceRuntime,
  keyboardFocus,
}: UseAppShellSideEffectsControllerOptions) {
  useAppMenuIntegration({ actions, listener });
  useAppRuntimeEffects({
    activity,
    agentSessionSync,
    appShellSync,
    workspaceRuntime,
    keyboardFocus,
  });
}
