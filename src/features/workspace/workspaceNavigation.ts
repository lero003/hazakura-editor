import type { RightPaneMode } from "../../types";

export type WorkspaceMode = "write" | "read" | "review";
export type WorkspaceReviewTarget = "proposal" | "disk" | "reference" | "comparison";

/** Presentation only. The editor, reference and proposal owners retain their state. */
export function resolveWorkspaceNavigation(state: {
  hasDocument: boolean;
  imageVisible: boolean;
  sidePaneMode: RightPaneMode | null;
  referenceVisible: boolean;
  referenceLoaded: boolean;
  hasProposal: boolean;
  canReviewDisk: boolean;
  hasComparison: boolean;
}): { mode: WorkspaceMode; canNavigate: boolean; reviewTargets: WorkspaceReviewTarget[] } {
  const canNavigate = state.hasDocument && !state.imageVisible;
  const mode = state.imageVisible ? "read"
    : state.referenceVisible || state.sidePaneMode === "compare" ? "review"
    : state.sidePaneMode === "ebook" ? "read" : "write";
  const reviewTargets: WorkspaceReviewTarget[] = [];
  if (canNavigate) {
    if (state.hasProposal) reviewTargets.push("proposal");
    if (state.canReviewDisk) reviewTargets.push("disk");
    if (state.referenceLoaded) reviewTargets.push("reference");
    if (state.hasComparison) reviewTargets.push("comparison");
  }
  return { mode, canNavigate, reviewTargets };
}
