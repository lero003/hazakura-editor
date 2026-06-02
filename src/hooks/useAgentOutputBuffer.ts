import { useCallback, useState } from "react";
import type { AgentWorkbenchOutputChunk } from "../tauri";

// Agent Workbench output buffer state lives in this hook so that
// App.tsx does not carry Assist Surface state. This is the frontend
// mirror of the bounded provider-output buffer owned by the Rust
// runtime; it is appended to on each successful session-state
// refresh and is reset when the session goes away.
// See docs/assist-surface-strategy.md and
// docs/agent-workbench-boundary.md.

export function useAgentOutputBuffer() {
  const [agentOutput, setAgentOutput] = useState<AgentWorkbenchOutputChunk[]>(
    [],
  );

  const applyAgentOutput = useCallback(
    (
      nextOutput: AgentWorkbenchOutputChunk[],
      options: { allowReset?: boolean } = {},
    ) => {
      setAgentOutput((currentOutput) => {
        if (options.allowReset) {
          return nextOutput;
        }

        if (nextOutput.length === 0) {
          return currentOutput;
        }

        return [...currentOutput, ...nextOutput];
      });
    },
    [],
  );

  const resetAgentOutput = useCallback(
    (nextOutput: AgentWorkbenchOutputChunk[]) => {
      applyAgentOutput(nextOutput, { allowReset: true });
    },
    [applyAgentOutput],
  );

  return {
    agentOutput,
    applyAgentOutput,
    resetAgentOutput,
  };
}
