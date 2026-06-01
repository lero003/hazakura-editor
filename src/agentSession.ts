import type {
  AgentWorkbenchOutputChunk,
  AgentWorkbenchSession,
} from "./tauri";

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
