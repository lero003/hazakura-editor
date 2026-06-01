import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
} from "react";
import type { EditorPaneHandle } from "../components/EditorPane";
import {
  resizeAgentWorkbenchTerminal,
  writeAgentWorkbenchSessionInput,
  type AgentWorkbenchSession,
} from "../tauri";
import type {
  AgentLaunchGateState,
  AgentTerminalSize,
} from "../types";
import { isActiveAgentSession } from "../utils";

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
          setAgentLaunchGate({
            kind: "rejected",
            message: String(err),
            preflight: null,
          });
          setStatus("Agent input failed");
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
