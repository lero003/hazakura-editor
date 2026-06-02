import {
  type Dispatch,
  type SetStateAction,
} from "react";
import type {
  AgentWorkbenchOutputChunk,
  AgentWorkbenchPreflight,
  AgentWorkbenchProvider,
  AgentWorkbenchSession,
} from "../../lib/tauri";
import {
  type AgentLaunchGateState,
  AGENT_WORKBENCH_PROVIDERS,
  type MenuLanguage,
} from "../../types";

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
    return menuLanguage !== "en" ? "未実行" : "Not running";
  }

  switch (session.status) {
    case "active":
      return menuLanguage !== "en" ? "実行中" : "Running";
    case "exited":
      return menuLanguage !== "en" ? "終了済み" : "Exited";
    case "stopped":
      return menuLanguage !== "en" ? "停止済み" : "Stopped";
  }
}

export function agentCompactSessionStateLabel(
  session: AgentWorkbenchSession | null,
  menuLanguage: MenuLanguage = "en",
): string {
  if (!session) {
    return menuLanguage !== "en" ? "待機中" : "Idle";
  }

  return agentSessionStateLabel(session, menuLanguage);
}

export function localizeAgentGateMessage(
  message: string,
  menuLanguage: MenuLanguage,
): string {
  if (menuLanguage === "en") {
    return message;
  }

  switch (message) {
    case "Launch gate not checked.":
      return "起動ゲートはまだ確認されていません。";
    case "Checking Agent Workbench launch gate...":
      return "エージェントワークベンチの起動ゲートを確認中です...";
    case "Agent session exited.":
      return "Agent セッションは終了しました。";
    case "Agent session stopped.":
      return "Agent セッションは停止しました。";
    case "Provider not found; no Agent session was started.":
      return "プロバイダーが見つからないため、Agent セッションは開始されませんでした。";
    case "Agent session running in the selected workspace. Only the selected allowlisted CLI was launched.":
      return "選択中のワークスペースで Agent セッションが実行中です。起動されたのは選択された allowlist 済み CLI だけです。";
    default:
      if (message.startsWith("Provider not found: ")) {
        return message
          .replace("Provider not found:", "プロバイダーが見つかりません:")
          .replace(
            " was not found in the app search path, including common Homebrew and user bin locations.",
            " はアプリの検索パス（一般的な Homebrew と user bin を含む）で見つかりませんでした。",
          );
      }

      return message;
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
