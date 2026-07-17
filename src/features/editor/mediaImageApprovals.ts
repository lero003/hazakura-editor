/**
 * Outside-local approvals are controller-owned and scoped to one open tab.
 * No module cache and no localStorage persistence: a newly opened document
 * always starts at the safe ask boundary.
 */

import {
  mergeApprovedRoot,
  parentDirectoryOfPath,
  type OutsideImagePolicy,
} from "./mediaImageSettings";

export type MediaImageApprovalState = {
  contextKey: string | null;
  roots: string[];
};

export function effectiveApprovedRoots(
  state: MediaImageApprovalState,
  contextKey: string | null,
  policy: OutsideImagePolicy,
): string[] {
  if (policy === "allow") {
    return ["/"];
  }
  if (!contextKey || state.contextKey !== contextKey) {
    return [];
  }
  return [...state.roots];
}

export function approveParentFolderForContext(
  state: MediaImageApprovalState,
  contextKey: string | null,
  resolvedImagePath: string,
  policy: OutsideImagePolicy,
): MediaImageApprovalState {
  if (policy !== "ask" || !contextKey) {
    return state;
  }
  const currentRoots = state.contextKey === contextKey ? state.roots : [];
  return {
    contextKey,
    roots: mergeApprovedRoot(
      currentRoots,
      parentDirectoryOfPath(resolvedImagePath),
    ),
  };
}
