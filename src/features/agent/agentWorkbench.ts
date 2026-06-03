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

export function agentCompactSessionStateLabel(
  session: AgentWorkbenchSession | null,
  menuLanguage: MenuLanguage = "en",
): string {
  if (!session) {
    return localizeSessionState("idle", menuLanguage);
  }

  return agentSessionStateLabel(session, menuLanguage);
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

export function localizeAgentGateMessage(
  message: string,
  menuLanguage: MenuLanguage,
): string {
  if (!isJapaneseMenuLanguage(menuLanguage) && !isKanaStyle(menuLanguage)) {
    return message;
  }

  if (isKanaStyle(menuLanguage)) {
    switch (message) {
      case "Launch gate not checked.":
        return "きどうげーとは まだ かくにん されていません。";
      case "Checking Agent Workbench launch gate...":
        return "えーじぇんと わーくべんちの きどうげーとを かくにんちゅう...";
      case "Agent session exited.":
        return "Agent せっしょんは 終わり ました。";
      case "Agent session stopped.":
        return "Agent せっしょんは ていし しました。";
      case "Provider not found; no Agent session was started.":
        return "ぷろばいだーが みつからないため、Agent せっしょんは かいし されませんでした。";
      case "Agent session running in the selected workspace. Only the selected allowlisted CLI was launched.":
        return "せんたくちゅうの わーくすぺーすで Agent せっしょんが じっこうちゅう。きどうされたのは せんたくされた ゆるされた CLI だけです。";
      default:
        if (message.startsWith("Provider not found: ")) {
          return message
            .replace("Provider not found:", "ぷろばいだーが みつかりません:")
            .replace(
              " was not found in the app search path, including common Homebrew and user bin locations.",
              " はあぷりの けんさくぱす（いっぱんな Homebrew と user bin を ふくむ）で みつかりませんでした。",
            );
        }

        return message;
    }
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
