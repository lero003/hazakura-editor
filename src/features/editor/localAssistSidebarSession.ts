import type { AppleAssistApplyEvent, AppleAssistProposalStatusEvent, AppleAssistTargetSnapshot } from "../../types";
import type { LocalAssistActionId } from "../../lib/appleAssist/instruction";
import { normalizeRevisionHistory } from "../../lib/appleAssist/revisionContext";
import type { SidebarScope } from "./localAssistSidebarTarget";

export type SidebarTurn = {
  id: string; request: string; phase: "pending" | "completed" | "failed" | "cancelled";
  /** 失敗・取消の理由（内部文字列）。表示は分類して短い案内へ写す。 */
  message?: string;
};
export type SidebarSession = {
  draft: string; scope: SidebarScope; firstLine: string; lastLine: string;
  actionId: LocalAssistActionId; target: AppleAssistTargetSnapshot | null;
  conversationId: string; nextTurn: number; history: string[]; turns: SidebarTurn[];
  pendingRequestId: string | null; notice: "failed" | "cancelled" | "applied" | "discarded" | null;
};
export function createSidebarSession(): SidebarSession {
  return { draft: "", scope: "selection", firstLine: "1", lastLine: "1", actionId: "rewrite_natural",
    target: null, conversationId: "", nextTurn: 0, history: [], turns: [], pendingRequestId: null, notice: null };
}
export function beginSidebarTurn(session: SidebarSession, payload: AppleAssistApplyEvent): SidebarSession {
  if (session.pendingRequestId || !payload.target || !payload.conversationId) return session;
  return { ...session, draft: "", target: payload.target, conversationId: payload.conversationId,
    pendingRequestId: payload.requestId, notice: null,
    turns: [...session.turns, { id: payload.requestId, request: payload.request, phase: "pending" } as SidebarTurn].slice(-20) };
}
export function settleSidebarTurn(session: SidebarSession, status: AppleAssistProposalStatusEvent): SidebarSession {
  if (status.requestId !== session.pendingRequestId || (status.conversationId && status.conversationId !== session.conversationId) ||
      status.phase === "partial" || status.phase === "started" || status.phase === "cancelling") return session;
  const turn = session.turns.find((entry) => entry.id === status.requestId);
  if (!turn) return session;
  const completed = status.phase === "completed";
  return { ...session, pendingRequestId: null,
    nextTurn: session.nextTurn + (completed ? 1 : 0),
    history: completed ? normalizeRevisionHistory([...session.history, turn.request]) : session.history,
    draft: completed ? session.draft : session.draft || turn.request,
    notice: status.phase === "completed" ? null : status.phase,
    turns: session.turns.map((entry) => entry.id === status.requestId
      ? { ...entry, phase: status.phase, message: completed ? undefined : status.message } as SidebarTurn
      : entry) };
}

let sidebarIdSequence = 0;
/** Correlation identity, not a security token; custom webviews may lack randomUUID. */
export function createSidebarId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return `sidebar-${uuid ?? `${Date.now().toString(36)}-${++sidebarIdSequence}`}`;
}
