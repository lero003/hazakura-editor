import {
  type Dispatch,
  type SetStateAction,
} from "react";
import { type AgentWorkbenchOutputChunk, type AgentWorkbenchPreflight, type AgentWorkbenchProvider, type AgentWorkbenchSession } from "../../lib/tauri/agent";
import {
  type AgentLaunchGateState,
  AGENT_WORKBENCH_PROVIDERS,
  isJapaneseMenuLanguage,
  type MenuLanguage,
} from "../../types";
import { isKanaStyle } from "../../lib/locale/_helpers";

// Agent Workbench stateless helpers live in this file so that the
// Safe Editor utility layer (`utils.ts`) does not carry Assist
// Surface helpers. This file is the single home for Agent Workbench
// output sequencing, session-identity checks, provider labels, gate
// message localization, and the launch-gate error-reporting helper.
// See docs/assist-surface-strategy.md and
// docs/agent-workbench-boundary.md.

// ── Output sequence / session identity ──

export function lastAgentOutputSeq(
  output: AgentWorkbenchOutputChunk[],
): number {
  return output.at(-1)?.seq ?? 0;
}

export function sameAgentWorkbenchSession(
  left: AgentWorkbenchSession | null,
  right: AgentWorkbenchSession | null,
): boolean {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return (
    left.provider === right.provider &&
    left.workspaceRoot === right.workspaceRoot &&
    left.providerPath === right.providerPath &&
    left.createdAtMs === right.createdAtMs &&
    left.status === right.status &&
    left.runtime.status === right.runtime.status
  );
}

// ── Provider / session state presentation ──

export function providerLabel(provider: AgentWorkbenchProvider): string {
  return (
    AGENT_WORKBENCH_PROVIDERS.find((candidate) => candidate.id === provider)
      ?.label ?? provider
  );
}

export function isActiveAgentSession(
  session: AgentWorkbenchSession | null,
): boolean {
  return session?.status === "active";
}

export function agentSessionStateLabel(
  session: AgentWorkbenchSession | null,
  menuLanguage: MenuLanguage = "en",
): string {
  if (!session) {
    return localizeSessionState("notRunning", menuLanguage);
  }

  switch (session.status) {
    case "active":
      return localizeSessionState("running", menuLanguage);
    case "exited":
      return localizeSessionState("exited", menuLanguage);
    case "stopped":
      return localizeSessionState("stopped", menuLanguage);
  }
}

type SessionStateKey = "notRunning" | "running" | "exited" | "stopped" | "idle";

function localizeSessionState(
  key: SessionStateKey,
  menuLanguage: MenuLanguage,
): string {
  if (isKanaStyle(menuLanguage)) {
    switch (key) {
      case "notRunning":
        return "うごかじ";
      case "running":
        return "うごきや";
      case "exited":
        return "おはり";
      case "stopped":
        return "とまり";
      case "idle":
        return "まてりや";
    }
  }

  if (isJapaneseMenuLanguage(menuLanguage)) {
    switch (key) {
      case "notRunning":
        return "未実行";
      case "running":
        return "実行中";
      case "exited":
        return "終了済み";
      case "stopped":
        return "停止済み";
      case "idle":
        return "待機中";
    }
  }

  switch (key) {
    case "notRunning":
      return "Not running";
    case "running":
      return "Running";
    case "exited":
      return "Exited";
    case "stopped":
      return "Stopped";
    case "idle":
      return "Idle";
  }
}

// ── Launch gate error reporting ──

// `reportAgentLaunchGateError` consolidates the repeated pattern of
// setting `agentLaunchGate` to `kind: "rejected"` with the error
// message and a status-bar label. Agent Workbench lifecycle / gate /
// input / stop / refresh catch sites all use it so the "rejected
// gate + status label" pair stays in sync. Resize failures are
// status-only by design (they do not flip the launch gate), so they
// stay outside this helper. Callers that also need to reset the
// session, drop the output buffer, or refresh the session state
// should do that work after calling this helper.

export function reportAgentLaunchGateError(
  setAgentLaunchGate: Dispatch<SetStateAction<AgentLaunchGateState>>,
  setStatus: Dispatch<SetStateAction<string>>,
  statusLabel: string,
  error: unknown,
  preflight: AgentWorkbenchPreflight | null = null,
): void {
  setAgentLaunchGate({
    kind: "rejected",
    message: String(error),
    preflight,
  });
  setStatus(statusLabel);
}
