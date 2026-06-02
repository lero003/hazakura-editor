import React, { useCallback, useEffect, useState } from "react";
import {
  getAgentWorkbenchSessionState,
  resizeAgentWorkbenchTerminal,
  stopAgentWorkbenchSession,
  writeAgentWorkbenchSessionInput,
  type AgentWorkbenchSession,
} from "../tauri";
import {
  AGENT_WORKBENCH_SESSION_POLL_MS,
  type AgentLaunchGateState,
  type AgentTerminalSize,
} from "../types";
import {
  isActiveAgentSession,
  lastAgentOutputSeq,
  providerLabel,
  sameAgentWorkbenchSession,
} from "../agentWorkbench";
import { useAgentOutputBuffer } from "../hooks/useAgentOutputBuffer";
import { useAgentOutputSeqCursor } from "../hooks/useAgentOutputSeqCursor";
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
// It does NOT trigger the launch-gate check, change providers,
// toggle consent, persist window position, or start a second
// session. The only command the agent window can issue besides
// the xterm I/O is `stopAgentWorkbenchSession`, exposed as an
// explicit button. See docs/assist-surface-strategy.md and
// docs/agent-workbench-boundary.md.

export function AgentWindowApp() {
  const [agentSession, setAgentSession] = useState<AgentWorkbenchSession | null>(
    null,
  );
  const [agentLaunchGate] = useState<AgentLaunchGateState>({
    kind: "idle",
    message: "Detached Agent window (terminal + stop only).",
    preflight: null,
  });
  const [status, setStatus] = useState<string>("Detached Agent window");
  const [stopping, setStopping] = useState<boolean>(false);

  const { agentOutput, applyAgentOutput, resetAgentOutput } =
    useAgentOutputBuffer();
  const { getLastSeenSeq, updateLastSeenSeq } = useAgentOutputSeqCursor(
    agentSession?.createdAtMs,
  );

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

  return (
    <div className="agent-window-shell" data-session-state={agentSession?.status ?? "none"}>
      <header className="agent-window-header">
        <h1 className="agent-window-title">hazakura agent</h1>
        <div className="agent-window-meta">
          <span className="agent-window-provider">
            {agentSession ? providerLabel(agentSession.provider) : "no provider"}
          </span>
          <span className="agent-window-status" data-state={agentSession?.status ?? "none"}>
            {agentSession ? agentSession.status : "no session"}
          </span>
        </div>
      </header>

      <section className="agent-window-launch-gate" data-gate={agentLaunchGate.kind}>
        <span className="agent-window-launch-gate-label">Launch gate</span>
        <span className="agent-window-launch-gate-value">{agentLaunchGate.kind}</span>
      </section>

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
        theme="dark"
      />

      <section className="agent-window-controls">
        <div className="agent-window-actions">
          <button
            type="button"
            className="agent-window-stop"
            onClick={() => {
              void handleStopSession();
            }}
            disabled={!activeSession || stopping}
          >
            {stopping ? "Stopping..." : "Stop session"}
          </button>
        </div>
      </section>

      <footer className="agent-window-statusbar" role="status">
        {status}
      </footer>
    </div>
  );
}
