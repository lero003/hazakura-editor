import { readTargetTextForGeneration } from "./appleAssistText";
import type { LocalAssistProposal } from "./localAssistProposal";

type ReviewDocument = { path: string; sessionId: string; contents: string };

/** A pinned range is never silently replaced by the editor's new selection. */
export function isProposalCurrentForDocument(proposal: LocalAssistProposal, document: ReviewDocument | null): boolean {
  if (!document || proposal.streaming) return false;
  return proposal.target.text === proposal.originalText &&
    readTargetTextForGeneration(proposal.target, document).ok;
}

export function countProposalCharacters(text: string): number {
  let count = 0;
  for (const _character of text) count += 1;
  return count;
}

/** Bound the expensive line diff; the exact full-text review remains available. */
export function canBuildProposalLineDiff(original: string, candidate: string): boolean {
  if (original.length + candidate.length > 20_000) return false;
  let lines = 2;
  for (const text of [original, candidate]) {
    for (const character of text) {
      if (character === "\n" && ++lines > 600) return false;
    }
  }
  return true;
}
