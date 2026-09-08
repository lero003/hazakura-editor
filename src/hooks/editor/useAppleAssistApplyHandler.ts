import { publishSidebarApplyStatus } from "../../lib/appleAssist/sidebarBridge";
import { emitTo } from "@tauri-apps/api/event";
import { aiEditTransactionStore, applyAiEditTransaction } from "../../features/editor/aiEditTransactions";
import { localAssistProposalStore, type LocalAssistProposal } from "../../features/editor/localAssistProposal";
import { readTargetTextForGeneration, isAppleAssistCandidateReadyForReview, type ActiveTab } from "../../features/editor/appleAssistText";
import { APPLE_ASSIST_APPLY_STATUS_EVENT, type AppleAssistApplyEvent, type AppleAssistApplyStatusEvent } from "../../types";
import { isLocalAssistActionId, type LocalAssistActionId } from "../../lib/appleAssist/instruction";

// Compatibility exports: text/range logic no longer depends on IPC or React.
export {
  APPLE_ASSIST_CONTEXT_PRE_CHARS, APPLE_ASSIST_CONTEXT_POST_CHARS,
  APPLE_ASSIST_SELECTION_CONTEXT_PRE_CHARS, APPLE_ASSIST_SELECTION_CONTEXT_POST_CHARS,
  getAppleAssistContextWindow, buildSurroundingDocumentContext, isSameAppleAssistTargetTab,
  readTargetTextForGeneration, sanitizeAppleAssistCandidateText, stripCandidatePreamble,
  type ActiveTab,
} from "../../features/editor/appleAssistText";

export type ApplyReviewedProposalInput = {
  proposal: LocalAssistProposal;
  activeTab: ActiveTab;
  setActiveTabContents: (next: string, sessionId: string) => void;
  setStatus?: (message: string) => void;
};
export type ApplyReviewedProposalResult = { ok: true } | { ok: false; error: string };

/** Single writer: claim the exact reviewed proposal, validate, write once, consume. */
export async function applyReviewedLocalAssistProposal(input: ApplyReviewedProposalInput): Promise<ApplyReviewedProposalResult> {
  const { proposal, activeTab, setActiveTabContents, setStatus } = input;
  const targetCheck = readTargetTextForGeneration(proposal.target, activeTab);
  if (!targetCheck.ok) return { ok: false, error: `Hazakura Local Assist apply failed: ${targetCheck.error}` };
  if (proposal.originalText !== targetCheck.before) return { ok: false, error: "Hazakura Local Assist apply rejected: the pinned original no longer matches the active document." };
  const candidateText = proposal.candidateText;
  if (!candidateText.trim()) return { ok: false, error: "Hazakura Local Assist apply rejected: the reviewed proposal is empty." };
  // Cleanup belongs to generation. Do not change what the user just reviewed.
  if (!isAppleAssistCandidateReadyForReview(candidateText)) return { ok: false, error: "Hazakura Local Assist apply rejected: the reviewed proposal needs regeneration, not additional cleanup." };
  if (!localAssistProposalStore.claimApply(activeTab.sessionId, proposal)) return { ok: false, error: "Hazakura Local Assist apply rejected: this proposal is no longer available for application." };

  let successMessage: string;
  try {
    const result = applyAiEditTransaction({
      tabId: activeTab.sessionId, tabName: activeTab.name, tabPath: activeTab.path,
      request: proposal.request, target: targetCheck.target, buffer: activeTab.contents, afterText: candidateText,
    });
    if (!result.ok) {
      localAssistProposalStore.finishApply(activeTab.sessionId, proposal, false);
      return { ok: false, error: `Hazakura Local Assist apply failed: ${result.error}` };
    }
    // Keep both the proposal and older review state if the write throws.
    setActiveTabContents(result.nextBuffer, activeTab.sessionId);
    successMessage = `Hazakura Local Assist applied: ${result.transaction.request} (${result.transaction.target.kind})`;
  } catch (err) {
    localAssistProposalStore.finishApply(activeTab.sessionId, proposal, false);
    return { ok: false, error: `Hazakura Local Assist apply failed: ${err instanceof Error ? err.message : String(err)}` };
  }
  // From this point the document changed. Notification failures must never be
  // reported as mutation failures or encourage an unsafe second application.
  // Clear legacy review before revealing the editor beneath the proposal.
  try { aiEditTransactionStore.clear(activeTab.sessionId); }
  catch (err) { console.warn("Failed to notify legacy Local Assist review", err); }
  localAssistProposalStore.finishApply(activeTab.sessionId, proposal, true);
  try { setStatus?.(successMessage); }
  catch (err) { console.warn("Failed to show Local Assist apply status", err); }
  return { ok: true };
}

export async function emitLocalAssistApplyStatus(
  phase: AppleAssistApplyStatusEvent["phase"], message: string, requestId: string, request: string,
  conversationId?: string | null,
  options: Pick<AppleAssistApplyStatusEvent, "shouldApplyToDocument"> = {},
): Promise<void> {
  const status: AppleAssistApplyStatusEvent = {
    phase, message, requestId, request, conversationId, ...options, emittedAtMs: Date.now(),
  };
  publishSidebarApplyStatus(status);
  try {
    await emitTo("apple-assist", APPLE_ASSIST_APPLY_STATUS_EVENT, status);
  } catch (err) { console.warn("Failed to emit Hazakura Local Assist apply status", err); }
}

export async function yieldBeforeAppleAssistGeneration(): Promise<void> {
  await new Promise<void>((resolve) => {
    if (typeof window !== "undefined" && "requestAnimationFrame" in window) {
      window.requestAnimationFrame(() => resolve()); return;
    }
    setTimeout(resolve, 0);
  });
}
export function resolveApplyActionId(payload: AppleAssistApplyEvent): LocalAssistActionId {
  if (isLocalAssistActionId(payload.actionId)) return payload.actionId;
  const lower = payload.request.toLowerCase();
  if (payload.request.includes("校正") || lower.includes("proof")) return "proofread_only";
  if (payload.request.includes("要約") || lower.includes("summar")) return "summarize";
  return "rewrite_natural";
}
