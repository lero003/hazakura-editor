import { useCallback, useState } from "react";
import type { AgentWorkbenchOutputChunk } from "../tauri";

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
