/**
 * App-private recovery for pathless drafts (new file / Import Assist).
 *
 * Separate from "no auto-save to the source file": recovery candidates live
 * only in the local draft store, never write source paths, and never apply
 * silently. TTL and byte budgets keep the store bounded.
 */

import type { DraftRecord, EditorTab, EditableLineEnding } from "../../types";
import { isDirty } from "../editor/editorTabs";

/** Keep recovery candidates for at most 7 days. */
export const PATHLESS_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Soft per-document cap for recovery payload (UTF-16 code units ≈ chars). */
export const PATHLESS_DRAFT_MAX_CHARS = 1_500_000;

/** Soft total store budget across all drafts. */
export const DRAFT_STORE_MAX_TOTAL_CHARS = 4_000_000;

export function draftStorageKey(draft: DraftRecord): string {
  if (draft.path.length > 0) {
    return `path:${draft.path}`;
  }
  return `pathless:${draft.recoveryId ?? draft.name ?? "unknown"}`;
}

export function isPathlessDraft(draft: DraftRecord): boolean {
  return draft.path.length === 0 && typeof draft.recoveryId === "string";
}

export function isPathlessTab(tab: EditorTab): boolean {
  return tab.path.length === 0;
}

export function draftMatchesTab(draft: DraftRecord, tab: EditorTab): boolean {
  if (draft.path.length > 0) {
    return draft.path === tab.path;
  }
  if (!draft.recoveryId) {
    return false;
  }
  return tab.sessionId === draft.recoveryId || tab.id === draft.recoveryId;
}

export function draftRecordFromTab(tab: EditorTab): DraftRecord {
  const base = {
    path: tab.path,
    contents: tab.contents,
    line_ending: tab.line_ending as EditableLineEnding,
    savedFingerprint: tab.fingerprint,
    updatedAt: Date.now(),
    revision: Date.now(),
    name: tab.name,
  };

  if (tab.path.length > 0) {
    return {
      ...base,
      origin: "file" as const,
    };
  }

  return {
    ...base,
    recoveryId: tab.sessionId,
    origin: guessPathlessOrigin(tab.name),
  };
}

function guessPathlessOrigin(
  name: string,
): "untitled" | "import-assist" {
  const lower = name.toLowerCase();
  if (
    lower.includes("import") ||
    lower.startsWith("import-") ||
    lower.includes("pdf-") ||
    lower.includes("scan")
  ) {
    return "import-assist";
  }
  return "untitled";
}

/** Dirty tabs that should enter the recovery store (path or pathless). */
export function tabsEligibleForDraftPersistence(tabs: EditorTab[]): EditorTab[] {
  return tabs.filter((tab) => {
    if (!isDirty(tab)) {
      return false;
    }
    // Empty brand-new buffer: no useful recovery payload.
    if (tab.path.length === 0 && tab.contents.length === 0) {
      return false;
    }
    if (tab.contents.length > PATHLESS_DRAFT_MAX_CHARS) {
      return false;
    }
    return true;
  });
}

export function pruneDraftRecords(
  drafts: DraftRecord[],
  now = Date.now(),
): DraftRecord[] {
  const fresh = drafts.filter((draft) => {
    if (now - draft.updatedAt > PATHLESS_DRAFT_TTL_MS) {
      return false;
    }
    if (draft.contents.length > PATHLESS_DRAFT_MAX_CHARS) {
      return false;
    }
    if (draft.path.length === 0 && !draft.recoveryId) {
      return false;
    }
    return true;
  });

  // Newest first; enforce total byte budget by dropping oldest.
  const sorted = [...fresh].sort((a, b) => b.updatedAt - a.updatedAt);
  const kept: DraftRecord[] = [];
  let total = 0;
  for (const draft of sorted) {
    const next = total + draft.contents.length;
    if (next > DRAFT_STORE_MAX_TOTAL_CHARS) {
      continue;
    }
    kept.push(draft);
    total = next;
  }
  return kept;
}

export function upsertDraftRecordByKey(
  drafts: DraftRecord[],
  nextDraft: DraftRecord,
): DraftRecord[] {
  const key = draftStorageKey(nextDraft);
  return pruneDraftRecords([
    nextDraft,
    ...drafts.filter((draft) => draftStorageKey(draft) !== key),
  ]);
}

export function removeDraftByKey(
  drafts: DraftRecord[],
  key: string,
): DraftRecord[] {
  return drafts.filter((draft) => draftStorageKey(draft) !== key);
}

export function removeDraftMatching(
  drafts: DraftRecord[],
  match: DraftRecord | string,
): DraftRecord[] {
  if (typeof match === "string") {
    // Back-compat: path string or full storage key.
    if (match.startsWith("path:") || match.startsWith("pathless:")) {
      return removeDraftByKey(drafts, match);
    }
    return drafts.filter((draft) => draft.path !== match);
  }
  const key = draftStorageKey(match);
  return removeDraftByKey(drafts, key);
}
