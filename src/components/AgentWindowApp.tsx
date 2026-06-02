import React, { useCallback, useEffect, useState } from "react";
import {
  getAgentWorkbenchSessionState,
  stopAgentWorkbenchSession,
  writeAgentWorkbenchSessionInput,
  type AgentWorkbenchOutputChunk,
  type AgentWorkbenchSession,
} from "../tauri";
import {
  AGENT_WORKBENCH_SESSION_POLL_MS,
  type AgentLaunchGateState,
} from "../types";
import {
  isActiveAgentSession,
  lastAgentOutputSeq,
  providerLabel,
  sameAgentWorkbenchSession,
} from "../agentWorkbench";
import { useAgentOutputBuffer } from "../hooks/useAgentOutputBuffer";
import { useAgentOutputSeqCursor } from "../hooks/useAgentOutputSeqCursor";

// `AgentWindowApp` is the root of the detached `hazakura agent`
// window — a thin UI mirror of the Agent Workbench session state
// owned by Rust (the main window's right-pane Agent path remains
// the authoritative UI). It polls the session state at the same
// 200 ms cadence as the main window, owns a bounded output mirror
// via `useAgentOutputBuffer`, and exposes two actions only: stop
// the active session, and write a line of input. It does NOT
// trigger the launch-gate check, change providers, toggle
// consent, resize the PTY, render xterm, or persist window
// position. See docs/assist-surface-strategy.md and
// docs/agent-workbench-boundary.md.

export function AgentWindowApp() {
  const [agentSession, setAgentSession] = useState<AgentWorkbenchSession | null>(
    null,
  );
  const [agentLaunchGate] = useState<AgentLaunchGateState>({
    kind: "idle",
    message: "Detached Agent window (read + stop + send input only).",
    preflight: null,
  });
  const [status, setStatus] = useState<string>("Detached Agent window");
  const [input, setInput] = useState<string>("");
  const [sending, setSending] = useState<boolean>(false);
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

  const handleSendInput = useCallback(async () => {
    const trimmed = input.replace(/\r\n/g, "\n");
    if (!trimmed) {
      return;
    }
    if (!isActiveAgentSession(agentSession)) {
      setStatus("Agent session is not active");
      return;
    }

    setSending(true);
    setStatus("Sending input to Agent...");

    try {
      await writeAgentWorkbenchSessionInput(trimmed.endsWith("\n") ? trimmed : `${trimmed}\n`);
      setInput("");
      setStatus("Sent input to Agent");
    } catch (err) {
      setStatus(`Agent input failed: ${String(err)}`);
    } finally {
      setSending(false);
    }
  }, [agentSession, input]);

  const handleInputKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        void handleSendInput();
        return;
      }

      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void handleSendInput();
      }
    },
    [handleSendInput],
  );

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

      <pre className="agent-window-output" aria-label="Agent session output">
        {formatOutputForDisplay(agentOutput)}
      </pre>

      <section className="agent-window-controls">
        <label className="agent-window-input-label" htmlFor="agent-window-input">
          Send to Agent
        </label>
        <textarea
          id="agent-window-input"
          className="agent-window-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleInputKeyDown}
          rows={4}
          placeholder="Type a message and press Enter (Cmd/Ctrl+Enter for newline-free send)"
          disabled={!isActiveAgentSession(agentSession) || sending}
        />
        <div className="agent-window-actions">
          <button
            type="button"
            className="agent-window-send"
            onClick={() => {
              void handleSendInput();
            }}
            disabled={!isActiveAgentSession(agentSession) || sending || input.trim().length === 0}
          >
            {sending ? "Sending..." : "Send"}
          </button>
          <button
            type="button"
            className="agent-window-stop"
            onClick={() => {
              void handleStopSession();
            }}
            disabled={!isActiveAgentSession(agentSession) || stopping}
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

function formatOutputForDisplay(chunks: AgentWorkbenchOutputChunk[]): string {
  return chunks
    .map((chunk) => stripAnsi(chunk.text))
    .join("");
}

function stripAnsi(text: string): string {
  // Plain-text rendering for the spike — drop ANSI escape sequences.
  // A future slice can layer xterm on top of the same buffer.
  return text.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");
}
