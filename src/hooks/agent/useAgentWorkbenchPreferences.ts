import { useEffect, useState } from "react";
import type { AgentWorkbenchProvider } from "../../lib/tauri";
import {
  AGENT_WORKBENCH_CONSENT_STORAGE_KEY,
  AGENT_WORKBENCH_ENABLED_STORAGE_KEY,
  AGENT_WORKBENCH_PROVIDER_STORAGE_KEY,
  ASSIST_SURFACE_PREFERENCE_STORAGE_KEY,
  type AssistSurfacePreference,
} from "../../types";

// Agent Workbench preferences live in this hook so that the
// Safe Editor preferences layer (`useAppPreferences`) does not
// carry Assist Surface state. Two booleans come back from this
// hook and they are NOT redundant:
//   - `agentWorkbenchActive` is the *currently-running* state,
//     read-only here and frozen at app start from localStorage.
//   - `agentWorkbenchPreference` is the *user-desired* setting,
//     settable, and only takes effect after an app restart (the
//     restart-required mode change is part of the Agent Workbench
//     trust boundary). See docs/assist-surface-strategy.md and
//     docs/agent-workbench-boundary.md.

export function useAgentWorkbenchPreferences() {
  const [agentWorkbenchActive] = useState(() =>
    readStoredAgentWorkbenchEnabled(),
  );
  const [agentWorkbenchPreference, setAgentWorkbenchPreference] = useState(() =>
    readStoredAgentWorkbenchEnabled(),
  );
  const [agentWorkbenchConsent, setAgentWorkbenchConsent] = useState(() =>
    readStoredAgentWorkbenchConsent(),
  );
  const [agentWorkbenchProvider, setAgentWorkbenchProvider] =
    useState<AgentWorkbenchProvider>(() => readStoredAgentWorkbenchProvider());
  const [assistSurfaceActive] = useState<AssistSurfacePreference>(() =>
    readStoredAssistSurfacePreference(),
  );
  const [assistSurfacePreference, setAssistSurfacePreference] =
    useState<AssistSurfacePreference>(() => readStoredAssistSurfacePreference());

  useEffect(() => {
    window.localStorage.setItem(
      AGENT_WORKBENCH_ENABLED_STORAGE_KEY,
      agentWorkbenchPreference ? "true" : "false",
    );
  }, [agentWorkbenchPreference]);

  useEffect(() => {
    window.localStorage.setItem(
      AGENT_WORKBENCH_CONSENT_STORAGE_KEY,
      agentWorkbenchConsent ? "true" : "false",
    );
  }, [agentWorkbenchConsent]);

  useEffect(() => {
    window.localStorage.setItem(
      AGENT_WORKBENCH_PROVIDER_STORAGE_KEY,
      agentWorkbenchProvider,
    );
  }, [agentWorkbenchProvider]);

  useEffect(() => {
    window.localStorage.setItem(
      ASSIST_SURFACE_PREFERENCE_STORAGE_KEY,
      assistSurfacePreference,
    );
  }, [assistSurfacePreference]);

  return {
    agentWorkbenchActive,
    agentWorkbenchAvailable: agentWorkbenchActive && agentWorkbenchConsent,
    agentWorkbenchConsent,
    agentWorkbenchPreference,
    agentWorkbenchProvider,
    assistSurfaceActive,
    assistSurfacePreference,
    setAgentWorkbenchConsent,
    setAgentWorkbenchPreference,
    setAgentWorkbenchProvider,
    setAssistSurfacePreference,
  };
}

function readStoredAgentWorkbenchEnabled(): boolean {
  return (
    window.localStorage.getItem(AGENT_WORKBENCH_ENABLED_STORAGE_KEY) === "true"
  );
}

function readStoredAgentWorkbenchConsent(): boolean {
  return (
    window.localStorage.getItem(AGENT_WORKBENCH_CONSENT_STORAGE_KEY) === "true"
  );
}

function readStoredAgentWorkbenchProvider(): AgentWorkbenchProvider {
  const value = window.localStorage.getItem(AGENT_WORKBENCH_PROVIDER_STORAGE_KEY);

  return value === "opencode" || value === "pi" || value === "claude"
    ? value
    : "codex";
}

function readStoredAssistSurfacePreference(): AssistSurfacePreference {
  const value = window.localStorage.getItem(
    ASSIST_SURFACE_PREFERENCE_STORAGE_KEY,
  );
  if (value === "none" || value === "apple-local" || value === "external-cli") {
    return value;
  }

  // Backward compatibility for users who already enabled the old
  // Agent Workbench preference before the shared companion-slot
  // setting existed.
  return readStoredAgentWorkbenchEnabled() ? "external-cli" : "apple-local";
}
