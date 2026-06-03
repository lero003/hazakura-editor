import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  getAgentWorkbenchSessionState,
  listAgentProviderAvailability,
  resizeAgentWorkbenchTerminal,
  setAgentWindowTheme,
  stopAgentWorkbenchSession,
  writeAgentWorkbenchSessionInput,
  type AgentProviderAvailability,
  type AgentWorkbenchProvider,
  type AgentWorkbenchSession,
} from "../../lib/tauri";
import {
  AGENT_WORKBENCH_CONSENT_STORAGE_KEY,
  AGENT_WORKBENCH_ENABLED_STORAGE_KEY,
  AGENT_WORKBENCH_PROVIDER_STORAGE_KEY,
  AGENT_WORKBENCH_SESSION_POLL_MS,
  THEME_STORAGE_KEY,
  type AgentLaunchGateState,
  type AgentTerminalSize,
  type ThemePreference,
} from "../../types";
import {
  isActiveAgentSession,
  lastAgentOutputSeq,
  providerLabel,
  sameAgentWorkbenchSession,
} from "../../features/agent/agentWorkbench";
import { useAgentLaunchGate } from "../../hooks/agent/useAgentLaunchGate";
import { useAgentOutputBuffer } from "../../hooks/agent/useAgentOutputBuffer";
import { useAgentOutputSeqCursor } from "../../hooks/agent/useAgentOutputSeqCursor";
import { useMainWindowWorkspace } from "../../hooks/agent/useMainWindowWorkspace";
import { AgentTerminalView } from "./AgentTerminalView";

// `AgentWindowApp` is the root of the detached `hazakura agent`
// window — a thin UI mirror of the Agent Workbench session state
// owned by Rust. It polls the session state at the same 200 ms
// cadence as the main window, owns a bounded output mirror via
// `useAgentOutputBuffer`, and renders the output through
// `AgentTerminalView` (xterm + addon-fit + ResizeObserver) so the
// detached window can drive a real PTY — input is captured by
// xterm's `onData` and forwarded to
// `writeAgentWorkbenchSessionInput`, and PTY size changes from
// the fit addon are forwarded to `resizeAgentWorkbenchTerminal`.
//
// As of the v0.8+ slice the agent window is the only Agent
// surface; the right pane is gone. The window now owns the full
// Start / Stop lifecycle:
//   - The active workspace path comes from the main window via
//     `useMainWindowWorkspace` (Rust-side cache + event).
//   - The agent's enabled / consent / provider preferences are
//     read from localStorage on mount and shadowed into local
//     state for the Start panel's provider picker (the main
//     window's preferences are authoritative).
//   - Start uses `useAgentLaunchGate` to invoke
//     `startAgentWorkbenchSession` and run the same preflight as
//     the main window. On success the next 200 ms poll picks up
//     the new session; the Start panel disappears.
//
// Theme, OS chrome, and the PTY input / output paths are
// unchanged from the v0.7+ slice. The agent window no longer
// emits the dead "Show in main pane" reverse link — the right
// pane is gone, so there's nothing to show.

const TIME_TICK_MS = 1000;

function readInitialTheme(): ThemePreference {
  if (typeof window === "undefined") {
    return "dark";
  }
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return (stored as ThemePreference) ?? "dark";
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

function formatElapsed(fromMs: number, nowMs: number): string {
  const seconds = Math.max(0, Math.floor((nowMs - fromMs) / 1000));
  if (seconds < 5) {
    return "just now";
  }
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ${seconds % 60}s ago`;
  }
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m ago`;
}

function statePillLabel(
  status: AgentWorkbenchSession["status"] | "none",
  active: boolean,
): string {
  if (!active) {
    if (status === "stopped") {
      return "stopped";
    }
    if (status === "exited") {
      return "exited";
    }
    return "no session";
  }
  return "running";
}

export function AgentWindowApp() {
  const [agentSession, setAgentSession] = useState<AgentWorkbenchSession | null>(
    null,
  );
  const [agentLaunchGate, setAgentLaunchGate] = useState<AgentLaunchGateState>({
    kind: "idle",
    message: "Launch gate not checked.",
    preflight: null,
  });
  const [agentTerminalSize, setAgentTerminalSize] =
    useState<AgentTerminalSize | null>(null);
  const [theme, setTheme] = useState<ThemePreference>(readInitialTheme);
  const [now, setNow] = useState<number>(() => Date.now());
  // When the session goes inactive (stopped / exited), freeze the
  // reference timestamp used for the "started Xs ago" and "last
  // output Xs ago" labels at the moment of transition, so the meta
  // row stops ticking after the user stops the session. Cleared
  // back to `null` when a new active session starts so the next
  // run reads the live `now` again.
  const [stoppedNowMs, setStoppedNowMs] = useState<number | null>(null);
  const [status, setStatus] = useState<string>("Detached Agent window");
  const [stopping, setStopping] = useState<boolean>(false);
  const [agentWorkbenchActive] = useState<boolean>(readStoredAgentWorkbenchEnabled);
  const [agentWorkbenchConsent] = useState<boolean>(readStoredAgentWorkbenchConsent);
  const [selectedProvider, setSelectedProvider] =
    useState<AgentWorkbenchProvider>(readStoredAgentWorkbenchProvider);
  // Fetch the allowlisted-provider availability snapshot on mount so
  // the Start panel can append the "(not installed)" suffix and
  // disable the Start button when the selected CLI is missing. The
  // fetch is cheap and idempotent; we intentionally do not cache.
  const [providerAvailability, setProviderAvailability] = useState<
    AgentProviderAvailability[]
  >([]);
  useEffect(() => {
    let disposed = false;
    void listAgentProviderAvailability()
      .then((snapshot) => {
        if (!disposed) {
          setProviderAvailability(snapshot);
        }
      })
      .catch((err) => {
        console.warn("Failed to read Agent provider availability", err);
      });
    return () => {
      disposed = true;
    };
  }, []);
  const availabilityByProvider = useMemo(
    () => new Map(providerAvailability.map((entry) => [entry.provider, entry])),
    [providerAvailability],
  );
  const selectedProviderUnavailable =
    availabilityByProvider.get(selectedProvider)?.available === false;
  const activeWorkspaceRoot = useMainWindowWorkspace();

  const { agentOutput, applyAgentOutput, resetAgentOutput } =
    useAgentOutputBuffer();
  const { getLastSeenSeq, updateLastSeenSeq } = useAgentOutputSeqCursor(
    agentSession?.createdAtMs,
  );

  // Apply theme to the agent window's document so the CSS variable
  // surface matches the main window. The `storage` event fires only
  // in OTHER windows, which is what we want — the agent window
  // never mutates the theme, so it just listens for cross-window
  // changes from the main window's theme toggle.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.themePreference = theme;
    void setAgentWindowTheme(theme).catch((err) => {
      console.warn("Failed to update Agent window OS theme", err);
    });
  }, [theme]);

  useEffect(() => {
    const handler = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY || !event.newValue) {
        return;
      }
      setTheme(event.newValue as ThemePreference);
    };
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("storage", handler);
    };
  }, []);

  // Tick `now` once a second so the meta row can show "started 2m
  // ago" / "last output 3s ago" without re-rendering the whole
  // session polling effect.
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, TIME_TICK_MS);
    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  // Manual session refresh hook used by the launch-gate error
  // recovery path ("already active" → re-pull state).
  const refreshAgentSessionState = useCallback(async () => {
    try {
      const state = await getAgentWorkbenchSessionState(getLastSeenSeq());
      const maxSeq = lastAgentOutputSeq(state.output);
      updateLastSeenSeq(maxSeq);
      setAgentSession((currentSession) =>
        sameAgentWorkbenchSession(currentSession, state.session)
          ? currentSession
          : state.session,
      );
      applyAgentOutput(state.output);
    } catch (err) {
      setStatus(`Agent session state unavailable: ${String(err)}`);
    }
  }, [applyAgentOutput, getLastSeenSeq, updateLastSeenSeq]);

  useEffect(() => {
    let disposed = false;
    const intervalId = window.setInterval(() => {
      if (disposed || !document.hasFocus()) {
        return;
      }

      const lastSeenSeq = getLastSeenSeq();
      void getAgentWorkbenchSessionState(lastSeenSeq)
        .then((state) => {
          if (disposed) {
            return;
          }

          const maxSeq = lastAgentOutputSeq(state.output);
          updateLastSeenSeq(maxSeq);
          setAgentSession((currentSession) =>
            sameAgentWorkbenchSession(currentSession, state.session)
              ? currentSession
              : state.session,
          );
          applyAgentOutput(state.output);
        })
        .catch((err) => {
          if (disposed) {
            return;
          }

          setStatus(`Agent session state unavailable: ${String(err)}`);
        });
    }, AGENT_WORKBENCH_SESSION_POLL_MS);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      resetAgentOutput([]);
    };
  }, [applyAgentOutput, getLastSeenSeq, resetAgentOutput, updateLastSeenSeq]);

  // Reuse the same `useAgentLaunchGate` the main window uses, with
  // the agent window's own local state. The hook owns the
  // preflight + `startAgentWorkbenchSession` invoke + the
  // launch-gate status transitions.
  const { requestAgentLaunchGateCheck } = useAgentLaunchGate({
    agentTerminalSize,
    agentWorkbenchActive,
    agentWorkbenchConsent,
    agentWorkbenchProvider: selectedProvider,
    applyAgentOutput,
    refreshAgentSessionState,
    setAgentLaunchGate,
    setAgentSession,
    setStatus,
    workspaceRootPath: activeWorkspaceRoot,
  });

  // Mirror the provider picker to localStorage so the main
  // window's preferences stay in sync (the main window reads from
  // the same key on next mount; the `storage` event is the
  // cross-window propagation path the agent window uses for
  // themes).
  useEffect(() => {
    window.localStorage.setItem(
      AGENT_WORKBENCH_PROVIDER_STORAGE_KEY,
      selectedProvider,
    );
  }, [selectedProvider]);

  const handleStartSession = useCallback(() => {
    // Stop → restart with the same provider is a "resume": keep the
    // captured output so the user can scroll back into the previous
    // session's tail. Switching providers (e.g. codex → pi) is not a
    // resume — the previous session's chunks are unrelated to the new
    // provider's stream and the `pi` provider in particular would
    // continue appending to the stale buffer. Clear only in that case.
    const previousProvider = agentSession?.provider;
    if (
      agentSession !== null &&
      previousProvider !== undefined &&
      previousProvider !== selectedProvider
    ) {
      resetAgentOutput([]);
    }
    requestAgentLaunchGateCheck();
  }, [
    agentSession,
    requestAgentLaunchGateCheck,
    resetAgentOutput,
    selectedProvider,
  ]);

  const handleStopSession = useCallback(async () => {
    setStopping(true);
    setStatus("Stopping Agent session...");

    try {
      const state = await stopAgentWorkbenchSession();
      setAgentSession(state.session);
      applyAgentOutput(state.output);
      setStatus(state.session ? "Agent session stopped" : "No Agent session to stop");
    } catch (err) {
      setStatus(`Agent session stop failed: ${String(err)}`);
    } finally {
      setStopping(false);
    }
  }, [applyAgentOutput]);

  const handleTerminalData = useCallback(
    (data: string) => {
      if (!data) {
        return;
      }
      if (!isActiveAgentSession(agentSession)) {
        return;
      }

      void writeAgentWorkbenchSessionInput(data)
        .then(() => {
          // xterm has already echoed the keystroke; no client-side
          // state to update. The next poll picks up provider output.
        })
        .catch((err) => {
          setStatus(`Agent input failed: ${String(err)}`);
        });
    },
    [agentSession],
  );

  const handleTerminalResize = useCallback((size: AgentTerminalSize) => {
    setAgentTerminalSize(size);
    void resizeAgentWorkbenchTerminal(size.columns, size.rows)
      .then((state) => {
        setAgentSession(state.session);
      })
      .catch((err) => {
        setStatus(`Agent terminal resize failed: ${String(err)}`);
      });
  }, []);

  // Engage / release used to overwrite the footer status with
  // "Agent terminal focused/blurred" on every pointer enter /
  // leave, which made the status bar unusable while the terminal
  // surface was being touched. The status now only updates on
  // real outcomes (start / stop / input / resize / error) — the
  // host element is the source of truth for focus state.
  const handleTerminalEngage = useCallback(() => {}, []);

  const handleTerminalRelease = useCallback(() => {}, []);

  const activeSession = isActiveAgentSession(agentSession);
  const sessionState = agentSession?.status ?? "none";

  // Snapshot the freeze timestamp when the session transitions to
  // inactive (and there is something to freeze: a real session that
  // just stopped/exited), and clear it whenever the session is
  // active again. The empty initial state (`agentSession === null`
  // before any session has run) leaves `stoppedNowMs` at `null` so
  // the placeholder "—" labels keep their dash.
  useEffect(() => {
    if (activeSession) {
      if (stoppedNowMs !== null) {
        setStoppedNowMs(null);
      }
      return;
    }
    if (agentSession !== null && stoppedNowMs === null) {
      setStoppedNowMs(Date.now());
    }
  }, [activeSession, agentSession, stoppedNowMs]);

  const referenceNow = activeSession ? now : (stoppedNowMs ?? now);

  const lastOutputAt = useMemo(() => {
    if (agentOutput.length === 0) {
      return null;
    }
    return agentOutput[agentOutput.length - 1]?.receivedAtMs ?? null;
  }, [agentOutput]);

  const workspaceLabel = agentSession?.workspaceRoot ?? "no workspace";
  const startedLabel = agentSession
    ? formatElapsed(agentSession.createdAtMs, referenceNow)
    : "—";
  const lastOutputLabel =
    lastOutputAt !== null ? formatElapsed(lastOutputAt, referenceNow) : "—";
  const stateLabel = statePillLabel(sessionState, activeSession);
  const inputStateLabel = activeSession ? "ready" : "disabled";

  const showStartPanel = !activeSession;
  const startPanelUnavailable = activeWorkspaceRoot === null;
  const startPanelBlockedByGate = agentLaunchGate.kind === "rejected";
  const startButtonDisabled =
    showStartPanel &&
    (startPanelUnavailable ||
      startPanelBlockedByGate ||
      agentLaunchGate.kind === "checking" ||
      !agentWorkbenchActive ||
      !agentWorkbenchConsent ||
      selectedProviderUnavailable);

  return (
    <div
      className="agent-window-shell"
      data-session-state={sessionState}
      data-active={activeSession ? "true" : "false"}
    >
      <header className="agent-window-header">
        <div className="agent-window-title-block">
          <h1 className="agent-window-title">hazakura agent</h1>
          <span className="agent-window-subtitle">Detached tool window</span>
        </div>
        <div className="agent-window-header-right">
          <span className="agent-window-provider">
            {agentSession ? providerLabel(agentSession.provider) : providerLabel(selectedProvider)}
          </span>
          <span
            className="agent-window-state"
            data-state={sessionState}
            data-active={activeSession ? "true" : "false"}
            title={`Session ${stateLabel}`}
          >
            <span className="agent-window-state-dot" aria-hidden="true" />
            <span className="agent-window-state-label">{stateLabel}</span>
          </span>
        </div>
      </header>

      <div className="agent-window-info">
        <span className="agent-window-info-cell">
          <span className="agent-window-info-key">workspace</span>
          <span
            className="agent-window-info-val"
            title={activeWorkspaceRoot ?? undefined}
          >
            {workspaceLabel}
          </span>
        </span>
        <span className="agent-window-info-cell">
          <span className="agent-window-info-key">started</span>
          <span className="agent-window-info-val">{startedLabel}</span>
        </span>
        <span className="agent-window-info-cell">
          <span className="agent-window-info-key">last output</span>
          <span className="agent-window-info-val">{lastOutputLabel}</span>
        </span>
        <span className="agent-window-info-cell">
          <span className="agent-window-info-key">input</span>
          <span
            className="agent-window-info-val"
            data-input={activeSession ? "ready" : "disabled"}
          >
            {inputStateLabel}
          </span>
        </span>
      </div>

      {showStartPanel ? (
        <section className="agent-window-start" aria-label="Start Agent session">
          <div className="agent-window-start-row">
            <label className="agent-window-start-provider">
              <span className="agent-window-start-key">provider</span>
              <select
                aria-label="Agent provider"
                className="agent-window-start-select"
                value={selectedProvider}
                onChange={(event) =>
                  setSelectedProvider(event.target.value as AgentWorkbenchProvider)
                }
              >
                {(
                  [
                    "codex",
                    "opencode",
                    "pi",
                    "claude",
                  ] satisfies AgentWorkbenchProvider[]
                ).map((providerOption) => {
                  const entry = availabilityByProvider.get(providerOption);
                  const available = entry?.available ?? true;
                  return (
                    <option
                      key={providerOption}
                      disabled={!available}
                      value={providerOption}
                    >
                      {providerLabel(providerOption)}
                      {entry && !entry.available ? " (not installed)" : ""}
                    </option>
                  );
                })}
              </select>
            </label>
            <button
              type="button"
              className="agent-window-start-button"
              onClick={() => {
                void handleStartSession();
              }}
              disabled={startButtonDisabled}
              title={
                startPanelUnavailable
                  ? "Open a workspace in the main window to start an Agent session."
                  : selectedProviderUnavailable
                    ? "Selected provider is not installed in the app search path."
                    : startPanelBlockedByGate
                      ? agentLaunchGate.message
                      : "Start Agent session"
              }
            >
              {agentLaunchGate.kind === "checking"
                ? "Starting..."
                : "Start session"}
            </button>
          </div>
          {startPanelUnavailable ? (
            <span className="agent-window-start-hint">
              Open a workspace in the main window to start an Agent session.
            </span>
          ) : selectedProviderUnavailable ? (
            <span className="agent-window-start-hint">
              Selected provider is not installed in the app search path. Pick an installed CLI.
            </span>
          ) : !agentWorkbenchActive ? (
            <span className="agent-window-start-hint">
              Enable the Agent Workbench in Preferences and restart to start a session.
            </span>
          ) : !agentWorkbenchConsent ? (
            <span className="agent-window-start-hint">
              Grant the Agent Workbench consent in Preferences to start a session.
            </span>
          ) : agentLaunchGate.kind === "rejected" ? (
            <span className="agent-window-start-hint">{agentLaunchGate.message}</span>
          ) : null}
        </section>
      ) : null}

      <AgentTerminalView
        activeSession={activeSession}
        outputLabel="Output chunks"
        onData={handleTerminalData}
        onEngage={handleTerminalEngage}
        onRelease={handleTerminalRelease}
        onResize={handleTerminalResize}
        output={agentOutput}
        placeholder={
          activeSession
            ? "Agent is starting..."
            : activeWorkspaceRoot === null
              ? "No Agent session. Open a workspace in the main window to start one."
              : "No Agent session. Start one above to use this terminal."
        }
        terminalLabel="Detached Agent terminal"
        theme={theme}
      />

      <footer className="agent-window-footer">
        <button
          type="button"
          className="agent-window-stop"
          onClick={() => {
            void handleStopSession();
          }}
          disabled={!activeSession || stopping}
        >
          <span className="agent-window-stop-dot" aria-hidden="true" />
          {stopping ? "Stopping..." : "Stop session"}
        </button>
        <span className="agent-window-statusbar" role="status">
          {status}
        </span>
      </footer>
    </div>
  );
}
