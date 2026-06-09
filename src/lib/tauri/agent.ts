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

export type AgentProviderAvailability = {
  provider: AgentWorkbenchProvider;
  available: boolean;
  path: string;
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
  const terminalSize =
    terminalColumns !== undefined && terminalRows !== undefined
      ? [terminalColumns, terminalRows]
      : undefined;

  return invoke<AgentWorkbenchSessionStartResult>("start_agent_workbench_session", {
    agentWorkbenchEnabled,
    consentAcknowledged,
    provider,
    workspaceRoot,
    terminalSize,
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

// `listAgentProviderAvailability` is the read-only probe counterpart
// to `startAgentWorkbenchSession`'s preflight. It returns a flat
// availability snapshot for every allowlisted provider so the
// preferences pane and the detached Agent window can render
// "(not installed)" markers and disable the Start button BEFORE the
// user reaches the start path.
export async function listAgentProviderAvailability(): Promise<
  AgentProviderAvailability[]
> {
  if (!isTauriRuntime()) {
    return [];
  }

  return invoke<AgentProviderAvailability[]>(
    "list_agent_provider_availability",
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

// v0.12+ Apple Local Assist Writing Companion mock (slice 2+).
// `openAppleAssistWindow` asks Rust to spawn the detached
// `apple-assist` webview. The Apple Assist window is the
// outside-companion slot that replaces the Agent window (see
// `docs/apple-local-assist-writing-companion-plan.md`). The
// Rust side enforces companion-slot mutual exclusion: opening
// the Apple Assist window closes the Agent window if it is
// open, and vice versa. The mock is a small form for rough
// requests; the actual body editing happens in the main
// window via the AI edit transaction channel.
export async function openAppleAssistWindow(theme?: string): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  try {
    await invoke("open_apple_assist_window", { theme: theme ?? null });
  } catch (err) {
    console.warn("Failed to open Apple Assist window", err);
  }
}

// Main-window chrome uses Apple Assist as a visible companion-slot
// toggle: press once to show, press again to hide. Keep this separate
// from `openAppleAssistWindow` so menu / command-palette "open"
// actions remain open-or-focus.
export async function toggleAppleAssistWindow(theme?: string): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  try {
    await invoke("toggle_apple_assist_window", { theme: theme ?? null });
  } catch (err) {
    console.warn("Failed to toggle Apple Assist window", err);
  }
}

export async function setAppleAssistWindowTheme(theme: string): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  try {
    await invoke("set_apple_assist_window_theme", { theme });
  } catch (err) {
    console.warn("Failed to set Apple Assist window theme", err);
  }
}

export async function requestApplyAiEditTransaction(
  payload: import("../../types").AppleAssistApplyEvent,
): Promise<void> {
  if (!isTauriRuntime()) {
    throw new Error("Tauri runtime is not available.");
  }

  await invoke("request_apply_ai_edit_transaction", { payload });
}

// v0.12+ Apple Local Assist Writing Companion (slice 3+).
// `getMainAppleAssistTarget` reads the latest inferred
// target snapshot from the Rust-side cache. The main window
// keeps this cache fresh on every selection / cursor
// change via `setMainAppleAssistTarget`; the Apple Assist
// window can pull the value lazily on Apply or subscribe
// to `MAIN_APPLE_ASSIST_TARGET_CHANGED_EVENT` for live
// updates. See
// `src/features/editor/aiEditTarget.ts` and
// `docs/apple-local-assist-writing-companion-plan.md`.
export async function getMainAppleAssistTarget(): Promise<
  import("../../types").AppleAssistTargetSnapshot | null
> {
  if (!isTauriRuntime()) {
    return null;
  }

  try {
    return await invoke<import("../../types").AppleAssistTargetSnapshot | null>(
      "get_main_apple_assist_target",
    );
  } catch (err) {
    console.warn("Failed to read main apple assist target", err);
    return null;
  }
}

export async function setMainAppleAssistTarget(
  target: import("../../types").AppleAssistTargetSnapshot,
): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  try {
    await invoke("set_main_apple_assist_target", { target });
  } catch (err) {
    console.warn("Failed to push main apple assist target", err);
  }
}
