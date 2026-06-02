import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  getAgentWorkbenchSessionState,
  openMainAgentPane,
  resizeAgentWorkbenchTerminal,
  setAgentWindowTheme,
  stopAgentWorkbenchSession,
  writeAgentWorkbenchSessionInput,
  type AgentWorkbenchSession,
} from "../../tauri";
import {
  AGENT_WORKBENCH_SESSION_POLL_MS,
  THEME_STORAGE_KEY,
  type AgentTerminalSize,
  type ThemePreference,
} from "../../types";
import {
  isActiveAgentSession,
  lastAgentOutputSeq,
  providerLabel,
  sameAgentWorkbenchSession,
} from "../../agentWorkbench";
import { useAgentOutputBuffer } from "../../hooks/agent/useAgentOutputBuffer";
import { useAgentOutputSeqCursor } from "../../hooks/agent/useAgentOutputSeqCursor";
import { AgentTerminalView } from "./AgentTerminalView";

// `AgentWindowApp` is the root of the detached `hazakura agent`
// window — a thin UI mirror of the Agent Workbench session state
// owned by Rust (the main window's right-pane Agent path remains
// the authoritative UI). It polls the session state at the same
// 200 ms cadence as the main window, owns a bounded output mirror
// via `useAgentOutputBuffer`, and renders the output through
// `AgentTerminalView` (xterm + addon-fit + ResizeObserver) so the
// detached window can drive a real PTY — input is captured by
// xterm's `onData` and forwarded to
// `writeAgentWorkbenchSessionInput`, and PTY size changes from
// the fit addon are forwarded to `resizeAgentWorkbenchTerminal`.
//
// The detached window mirrors the main window's theme via
// `THEME_STORAGE_KEY` (read on mount, refreshed on the cross-
// window `storage` event) and stamps `document.documentElement
// .dataset.theme` so the same CSS variable surface used by the
// main window applies here. Theme is also forwarded to
// `AgentTerminalView` so the xterm palette tracks the main window.
//
// The shell is laid out as a four-row tool window: a panel-style
// header (title + provider + state pill with a live dot), a
// monospace info row (workspace + started + last output), the
// xterm surface, and a compact footer with the Stop button and
// last action message. The agent window does NOT trigger the
// launch-gate check, change providers, toggle consent, persist
// window position, or start a second session. See
// docs/assist-surface-strategy.md and
// docs/agent-workbench-boundary.md.

const TIME_TICK_MS = 1000;

function readInitialTheme(): ThemePreference {
  if (typeof window === "undefined") {
    return "dark";
  }
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return (stored as ThemePreference) ?? "dark";
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
  const [theme, setTheme] = useState<ThemePreference>(readInitialTheme);
  const [now, setNow] = useState<number>(() => Date.now());
  const [status, setStatus] = useState<string>("Detached Agent window");
  const [stopping, setStopping] = useState<boolean>(false);

  const { agentOutput, applyAgentOutput, resetAgentOutput } =
    useAgentOutputBuffer();
  const { getLastSeenSeq, updateLastSeenSeq } = useAgentOutputSeqCursor(
    agentSession?.createdAtMs,
  );

  // Apply theme to the agent window's document so the CSS variable
  // surface matches the main window. The `storage` event fires only
  // in OTHER windows, which is what we want — the agent window
  // never mutates the theme, so it just listens for cross-window
  // changes from the main window's theme toggle. The Rust builder
  // sets a static dark `background_color` + `title_bar_style(Transparent)`
  // so the OS chrome (title bar / traffic lights) reads the same dark
  // surface as the page body; per-theme background colors are a
  // Apply the resolved theme to the page body (CSS variable surface)
  // and to the agent window's OS chrome (title bar / traffic-lights)
  // via the `set_agent_window_theme` custom Tauri command. The custom
  // command does the `set_background_color` + `set_theme` work on the
  // Rust side, so no JS-side core window permissions are needed on the
  // agent-window capability (the auto-allowlist for custom commands
  // covers the IPC). The main window calls the same command on its
  // own theme change so a theme toggle in Preferences pushes into an
  // already-open agent window in real time.
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
    void resizeAgentWorkbenchTerminal(size.columns, size.rows)
      .then((state) => {
        setAgentSession(state.session);
      })
      .catch((err) => {
        setStatus(`Agent terminal resize failed: ${String(err)}`);
      });
  }, []);

  const handleTerminalEngage = useCallback(() => {
    setStatus("Agent terminal focused");
  }, []);

  const handleTerminalRelease = useCallback(() => {
    setStatus("Agent terminal blurred");
  }, []);

  const activeSession = isActiveAgentSession(agentSession);
  const sessionState = agentSession?.status ?? "none";
  const lastOutputAt = useMemo(() => {
    if (agentOutput.length === 0) {
      return null;
    }
    return agentOutput[agentOutput.length - 1]?.receivedAtMs ?? null;
  }, [agentOutput]);

  const workspaceLabel = agentSession?.workspaceRoot ?? "no workspace";
  const startedLabel = agentSession
    ? formatElapsed(agentSession.createdAtMs, now)
    : "—";
  const lastOutputLabel =
    lastOutputAt !== null ? formatElapsed(lastOutputAt, now) : "—";
  const stateLabel = statePillLabel(sessionState, activeSession);
  const inputStateLabel = activeSession ? "ready" : "disabled";

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
            {agentSession ? providerLabel(agentSession.provider) : "no provider"}
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
            title={agentSession?.workspaceRoot ?? undefined}
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
            : "No Agent session. Start one from the main window to use this terminal."
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
        <button
          type="button"
          className="agent-window-show-in-main"
          // Reverse-link affordance: ask the main window to flip its
          // right pane to Agent mode and bring the main window to
          // the front. Always enabled (this is a navigation, not a
          // session action) — clicking before a session is active
          // just shows the right pane in its idle state. See
          // open_main_agent_pane in src-tauri/src/lib.rs and the
          // main|agent capability description.
          onClick={() => {
            void openMainAgentPane();
          }}
          title="Open the Agent pane in the main window"
        >
          Show in main pane
        </button>
        <span className="agent-window-statusbar" role="status">
          {status}
        </span>
      </footer>
    </div>
  );
}
