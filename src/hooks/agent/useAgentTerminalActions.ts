import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
} from "react";
import type { EditorPaneHandle } from "../../components/editor/EditorPane";
import {
  resizeAgentWorkbenchTerminal,
  writeAgentWorkbenchSessionInput,
  type AgentWorkbenchSession,
} from "../../tauri";
import type {
  AgentLaunchGateState,
  AgentTerminalSize,
} from "../../types";
import {
  isActiveAgentSession,
  reportAgentLaunchGateError,
} from "../../agentWorkbench";

// `useAgentTerminalActions` owns the Agent Workbench terminal I/O
// action handlers: write user input to the active session, resize
// the PTY, send a preset prompt, and forward the active editor
// selection. It does NOT own the active session, the terminal size,
// the launch gate, or the output buffer; all of those are read from
// and written to setters passed in from App.tsx (see
// `useAgentWorkbenchRuntimeState`). A terminal resize failure is
// status-only by design (a PTY resize failure during an already-
// passed active session is a transport concern, not a launch-gate
// rejection), so it does not flow through
// `reportAgentLaunchGateError`. See docs/assist-surface-strategy.md
// and docs/agent-workbench-boundary.md.

type UseAgentTerminalActionsOptions = {
  agentSession: AgentWorkbenchSession | null;
  editorPaneRef: RefObject<EditorPaneHandle | null>;
  onRefreshAgentSessionState: () => void | Promise<void>;
  setAgentLaunchGate: Dispatch<SetStateAction<AgentLaunchGateState>>;
  setAgentSession: Dispatch<SetStateAction<AgentWorkbenchSession | null>>;
  setAgentTerminalSize: Dispatch<SetStateAction<AgentTerminalSize | null>>;
  setStatus: Dispatch<SetStateAction<string>>;
};

export function useAgentTerminalActions({
  agentSession,
  editorPaneRef,
  onRefreshAgentSessionState,
  setAgentLaunchGate,
  setAgentSession,
  setAgentTerminalSize,
  setStatus,
}: UseAgentTerminalActionsOptions) {
  const sendAgentTerminalData = useCallback(
    (data: string) => {
      if (!data || !isActiveAgentSession(agentSession)) {
        return;
      }

      void writeAgentWorkbenchSessionInput(data)
        .then(() => {
          // Immediately poll for output after sending input.
          void onRefreshAgentSessionState();
        })
        .catch((err) => {
          reportAgentLaunchGateError(
            setAgentLaunchGate,
            setStatus,
            "Agent input failed",
            err,
          );
          void onRefreshAgentSessionState();
        });
    },
    [
      agentSession,
      onRefreshAgentSessionState,
      setAgentLaunchGate,
      setStatus,
    ],
  );

  const resizeAgentTerminal = useCallback(
    (size: AgentTerminalSize) => {
      setAgentTerminalSize((current) => {
        if (
          current?.columns === size.columns &&
          current.rows === size.rows
        ) {
          return current;
        }

        return size;
      });

      if (!isActiveAgentSession(agentSession)) {
        return;
      }

      void resizeAgentWorkbenchTerminal(size.columns, size.rows)
        .then((state) => {
          setAgentSession(state.session);
        })
        .catch(() => {
          setStatus("Agent terminal resize failed");
        });
    },
    [
      agentSession,
      setAgentSession,
      setAgentTerminalSize,
      setStatus,
    ],
  );

  const handlePresetPrompt = useCallback(
    (preset: string) => {
      const selection = editorPaneRef.current?.getSelectionText() ?? "";
      const context = selection.trim()
        ? `\n\n---\n${selection}`
        : "";
      const message = `${preset}${context}\n`;
      sendAgentTerminalData(message);
    },
    [editorPaneRef, sendAgentTerminalData],
  );

  const handleSendSelectionToAgent = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      sendAgentTerminalData(text.trim() + "\n");
    },
    [sendAgentTerminalData],
  );

  return {
    handlePresetPrompt,
    handleSendSelectionToAgent,
    resizeAgentTerminal,
    sendAgentTerminalData,
  };
}
