import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "./_runtime";

export type AgentWorkbenchProvider = "codex" | "opencode" | "pi" | "claude";

export type AgentWorkbenchPreflight = {
  provider: AgentWorkbenchProvider;
  workspaceRoot: string;
  providerAvailable: boolean;
  providerPath: string | null;
  launchImplemented: boolean;
  searchedPaths: string[];
};

export type AgentWorkbenchSessionStatus = "active" | "stopped" | "exited";

export type AgentRuntimeStatus = "running" | "stopped" | "exited";

export type AgentRuntimeHandle = {
  provider: AgentWorkbenchProvider;
  workspaceRoot: string;
  providerPath: string;
  status: AgentRuntimeStatus;
};

export type AgentWorkbenchOutputStream = "stdout" | "stderr" | "system";

export type AgentWorkbenchOutputChunk = {
  seq: number;
  stream: AgentWorkbenchOutputStream;
  text: string;
  receivedAtMs: number;
};

export type AgentWorkbenchSession = {
  provider: AgentWorkbenchProvider;
  workspaceRoot: string;
  providerPath: string;
  createdAtMs: number;
  status: AgentWorkbenchSessionStatus;
  runtime: AgentRuntimeHandle;
};

export type AgentWorkbenchSessionStartResult = {
  preflight: AgentWorkbenchPreflight;
  session: AgentWorkbenchSession | null;
  output: AgentWorkbenchOutputChunk[];
};

export type AgentWorkbenchSessionState = {
  session: AgentWorkbenchSession | null;
  output: AgentWorkbenchOutputChunk[];
};

export async function startAgentWorkbenchSession(
  agentWorkbenchEnabled: boolean,
  consentAcknowledged: boolean,
  provider: AgentWorkbenchProvider,
  workspaceRoot: string,
  terminalColumns?: number,
  terminalRows?: number,
): Promise<AgentWorkbenchSessionStartResult> {
  return invoke<AgentWorkbenchSessionStartResult>("start_agent_workbench_session", {
    agentWorkbenchEnabled,
    consentAcknowledged,
    provider,
    workspaceRoot,
    terminalColumns,
    terminalRows,
  });
}

export async function stopAgentWorkbenchSession(): Promise<AgentWorkbenchSessionState> {
  return invoke<AgentWorkbenchSessionState>("stop_agent_workbench_session");
}

export async function getAgentWorkbenchSessionState(
  lastSeenSeq?: number,
): Promise<AgentWorkbenchSessionState> {
  if (!isTauriRuntime()) {
    return { session: null, output: [] };
  }

  return invoke<AgentWorkbenchSessionState>(
    "get_agent_workbench_session_state",
    lastSeenSeq !== undefined ? { lastSeenSeq } : undefined,
  );
}

export async function writeAgentWorkbenchSessionInput(
  input: string,
): Promise<void> {
  return invoke<void>("write_agent_workbench_session_input", {
    input,
  });
}

export async function resizeAgentWorkbenchTerminal(
  columns: number,
  rows: number,
): Promise<AgentWorkbenchSessionState> {
  return invoke<AgentWorkbenchSessionState>("resize_agent_workbench_terminal", {
    columns,
    rows,
  });
}

export async function openAgentWindow(theme?: string): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  try {
    await invoke("open_agent_window", { theme: theme ?? null });
  } catch (err) {
    console.warn("Failed to open Agent window", err);
  }
}

// Reverse link from the detached Agent window's "Show in main pane"
// footer button. The Rust side gates this to the main|agent labels and
// emits OPEN_MAIN_AGENT_PANE_EVENT to the main window; the main
// window's useMainAgentPaneFocus hook flips the right pane to Agent.
// We only need to fire the invoke; the response payload is empty.
export async function openMainAgentPane(): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  try {
    await invoke("open_main_agent_pane");
  } catch (err) {
    console.warn("Failed to open main Agent pane", err);
  }
}

// Cross-window workspace bridge: the main window writes the active
// workspace path on open / close via setMainActiveWorkspace, and the
// detached agent window reads it on mount via getMainActiveWorkspace.
// The agent window also subscribes to MAIN_WORKSPACE_CHANGED_EVENT
// (see src/hooks/agent/useMainWindowWorkspace.ts) so live open /
// close in the main window pushes into the agent window within the
// event round-trip — no polling needed.
export async function getMainActiveWorkspace(): Promise<string | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  try {
    const result = await invoke<string | null>("get_main_active_workspace");
    return result ?? null;
  } catch (err) {
    console.warn("Failed to read main active workspace", err);
    return null;
  }
}

export async function setMainActiveWorkspace(
  workspace: string | null,
): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  try {
    await invoke("set_main_active_workspace", { workspace });
  } catch (err) {
    console.warn("Failed to set main active workspace", err);
  }
}

export async function setAgentWindowTheme(theme: string): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  try {
    await invoke("set_agent_window_theme", { theme });
  } catch (err) {
    console.warn("Failed to set Agent window theme", err);
  }
}
