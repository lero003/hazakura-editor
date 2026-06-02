import { useEffect, useState } from "react";
import type { AgentWorkbenchProvider } from "../tauri";
import {
  AGENT_WORKBENCH_CONSENT_STORAGE_KEY,
  AGENT_WORKBENCH_ENABLED_STORAGE_KEY,
  AGENT_WORKBENCH_PROVIDER_STORAGE_KEY,
} from "../types";

// Agent Workbench preferences live in this hook so that the
// Safe Editor preferences layer (`useAppPreferences`) does not
// carry Assist Surface state. See
// docs/assist-surface-strategy.md and
// docs/agent-workbench-boundary.md.

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

  return {
    agentWorkbenchActive,
    agentWorkbenchConsent,
    agentWorkbenchPreference,
    agentWorkbenchProvider,
    setAgentWorkbenchConsent,
    setAgentWorkbenchPreference,
    setAgentWorkbenchProvider,
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

  return value === "opencode" || value === "pi" ? value : "codex";
}
