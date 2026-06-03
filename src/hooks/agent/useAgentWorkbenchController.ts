// `useAgentWorkbenchController` is the v0.9 `useAppShellController`
// Slice D domain composer. It bundles the three Agent Workbench
// action hooks (`useAgentWorkbenchPreferenceActions`,
// `useAgentWorkbenchSessionActions`, `useAgentTerminalActions`)
// into a single typed surface (12 fields, ~21 args).
//
// The composition is real (not a rename) because
// `useAgentTerminalActions` consumes `refreshAgentSessionState`
// produced by `useAgentWorkbenchSessionActions` — folding the
// wiring into the new controller removes one cross-section
// handoff in the orchestrator. The preference and session hooks
// have no cross-deps, so they can run in either order. The
// terminal hook runs last because it depends on the session
// hook's `refreshAgentSessionState` callback.
//
// The hook owns no new state of its own — it is a pure
// bundler. The 21-arg signature is the union of the three
// bundled signatures (deduplicating the ~10 fields they share).
// The flat object shape keeps the orchestrator's wiring to a
// single destructure block.

import type { Dispatch, RefObject, SetStateAction } from "react";
import type { EditorPaneHandle } from "../../components/editor/EditorPane";
import type {
  AgentWorkbenchOutputChunk,
  AgentWorkbenchProvider,
  AgentWorkbenchSession,
} from "../../lib/tauri/agent";
import type {
  AgentLaunchGateState,
  AgentTerminalSize,
  MenuLanguage,
} from "../../types";
import { useAgentTerminalActions } from "./useAgentTerminalActions";
import { useAgentWorkbenchPreferenceActions } from "./useAgentWorkbenchPreferenceActions";
import { useAgentWorkbenchSessionActions } from "./useAgentWorkbenchSessionActions";

type UseAgentWorkbenchControllerOptions = {
  activeAgentSession: boolean;
  agentSession: AgentWorkbenchSession | null;
  agentTerminalSize: AgentTerminalSize | null;
  agentWorkbenchActive: boolean;
  agentWorkbenchConsent: boolean;
  agentWorkbenchProvider: AgentWorkbenchProvider;
  applyAgentOutput: (output: AgentWorkbenchOutputChunk[]) => void;
  closeWorkspaceContextMenu: () => void;
  editorPaneRef: RefObject<EditorPaneHandle | null>;
  menuLanguage: MenuLanguage;
  setAgentLaunchGate: Dispatch<SetStateAction<AgentLaunchGateState>>;
  setAgentSession: Dispatch<SetStateAction<AgentWorkbenchSession | null>>;
  setAgentStopPending: Dispatch<SetStateAction<boolean>>;
  setAgentTerminalSize: Dispatch<SetStateAction<AgentTerminalSize | null>>;
  setAgentWorkbenchConsent: Dispatch<SetStateAction<boolean>>;
  setAgentWorkbenchPreference: Dispatch<SetStateAction<boolean>>;
  setAgentWorkbenchProvider: Dispatch<SetStateAction<AgentWorkbenchProvider>>;
  setAppRestartPending: Dispatch<SetStateAction<boolean>>;
  setGlobalError: Dispatch<SetStateAction<string | null>>;
  setStatus: Dispatch<SetStateAction<string>>;
  workspaceRootPath: string | null;
};

export function useAgentWorkbenchController({
  activeAgentSession,
  agentSession,
  agentTerminalSize,
  agentWorkbenchActive,
  agentWorkbenchConsent,
  agentWorkbenchProvider,
  applyAgentOutput,
  closeWorkspaceContextMenu,
  editorPaneRef,
  menuLanguage,
  setAgentLaunchGate,
  setAgentSession,
  setAgentStopPending,
  setAgentTerminalSize,
  setAgentWorkbenchConsent,
  setAgentWorkbenchPreference,
  setAgentWorkbenchProvider,
  setAppRestartPending,
  setGlobalError,
  setStatus,
  workspaceRootPath,
}: UseAgentWorkbenchControllerOptions) {
  const preference = useAgentWorkbenchPreferenceActions({
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
  });
  const session = useAgentWorkbenchSessionActions({
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
  });
  const terminal = useAgentTerminalActions({
    agentSession,
    editorPaneRef,
    onRefreshAgentSessionState: session.refreshAgentSessionState,
    setAgentLaunchGate,
    setAgentSession,
    setAgentTerminalSize,
    setStatus,
  });
  return {
    ...preference,
    ...session,
    ...terminal,
  };
}
