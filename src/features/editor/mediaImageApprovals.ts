/**
 * Session + optional durable approved roots for outside-workspace images.
 * Shared module store so Preview (AppWorkspace) and export (shell) agree.
 */

import {
  clearStoredApprovedRoots,
  mergeApprovedRoot,
  parentDirectoryOfPath,
  readStoredApprovedRoots,
  writeStoredApprovedRoots,
  type OutsideImagePolicy,
} from "./mediaImageSettings";

const sessionRootsByWorkspace = new Map<string, string[]>();

function workspaceKey(workspaceRoot: string | null): string {
  return workspaceRoot?.replace(/\/+$/, "") || "";
}

export function loadInitialApprovedRoots(
  workspaceRoot: string | null,
  policy: OutsideImagePolicy,
): string[] {
  const key = workspaceKey(workspaceRoot);
  if (policy === "off") {
    if (key) {
      sessionRootsByWorkspace.delete(key);
    }
    return [];
  }
  if (policy === "remember") {
    const stored = readStoredApprovedRoots(workspaceRoot);
    if (key) {
      sessionRootsByWorkspace.set(key, stored);
    }
    return stored;
  }
  // ask: session-only
  if (key && sessionRootsByWorkspace.has(key)) {
    return [...(sessionRootsByWorkspace.get(key) ?? [])];
  }
  return [];
}

export function getApprovedRoots(
  workspaceRoot: string | null,
  policy: OutsideImagePolicy,
): string[] {
  if (policy === "off") {
    return [];
  }
  const key = workspaceKey(workspaceRoot);
  if (key && sessionRootsByWorkspace.has(key)) {
    return [...(sessionRootsByWorkspace.get(key) ?? [])];
  }
  return loadInitialApprovedRoots(workspaceRoot, policy);
}

export function approveParentFolder(
  resolvedImagePath: string,
  currentRoots: readonly string[],
  workspaceRoot: string | null,
  policy: OutsideImagePolicy,
): string[] {
  const parent = parentDirectoryOfPath(resolvedImagePath);
  const next = mergeApprovedRoot(currentRoots, parent);
  const key = workspaceKey(workspaceRoot);
  if (key) {
    sessionRootsByWorkspace.set(key, next);
  }
  if (policy === "remember") {
    writeStoredApprovedRoots(workspaceRoot, next);
  }
  return next;
}

export function revokeApprovedRoots(
  workspaceRoot: string | null,
  policy: OutsideImagePolicy,
): string[] {
  const key = workspaceKey(workspaceRoot);
  if (key) {
    sessionRootsByWorkspace.delete(key);
  }
  if (policy === "remember") {
    clearStoredApprovedRoots(workspaceRoot);
  }
  return [];
}
