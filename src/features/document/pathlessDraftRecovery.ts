/**
 * App-private recovery for pathless drafts (new file / Import Assist).
 *
 * Separate from "no auto-save to the source file": recovery candidates live
 * only in the local draft store, never write source paths, and never apply
 * silently. Pathless budgets are TTL- and size-bounded; path-backed drafts
 * use a separate, lighter prune so existing recovery behavior is not capped
 * by pathless limits.
 */

import type { DraftRecord, EditorTab, EditableLineEnding } from "../../types";
import { isDirty } from "../editor/editorTabs";

/** Keep pathless recovery candidates for at most 7 days. */
export const PATHLESS_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Soft per-document cap for pathless recovery payload. */
export const PATHLESS_DRAFT_MAX_CHARS = 1_500_000;

/** Soft total store budget for pathless candidates only. */
export const PATHLESS_DRAFT_STORE_MAX_TOTAL_CHARS = 4_000_000;

/** Keep pathless count independent from path-backed draft capacity. */
export const PATHLESS_DRAFT_STORE_MAX_RECORDS = 20;

/** Soft total store budget for path-backed dirty drafts (legacy path). */
export const PATH_DRAFT_STORE_MAX_TOTAL_CHARS = 8_000_000;

/** Keep path-backed count independent from pathless draft capacity. */
export const PATH_DRAFT_STORE_MAX_RECORDS = 20;

export type DraftWriteResult =
  | { ok: true }
  | {
      ok: false;
      reason: "quota" | "oversized-pathless" | "serialize";
      message: string;
    };

export function draftStorageKey(draft: DraftRecord): string {
  if (draft.path.length > 0) {
    return `path:${draft.path}`;
  }
  return `pathless:${draft.recoveryId ?? "unknown"}`;
}

export function isPathlessDraft(draft: DraftRecord): boolean {
  return draft.path.length === 0 && typeof draft.recoveryId === "string";
}

export function isPathlessTab(tab: EditorTab): boolean {
  return tab.path.length === 0;
}

/**
 * Match a draft to an open tab for banner purposes.
 * Pathless drafts only match other pathless tabs by recoveryId (UUID).
 * Never match pathless recoveryId against sessionId of path-backed tabs.
 */
export function draftMatchesTab(draft: DraftRecord, tab: EditorTab): boolean {
  if (draft.path.length > 0) {
    return draft.path === tab.path && tab.path.length > 0;
  }
  if (!draft.recoveryId || tab.path.length > 0) {
    return false;
  }
  return tab.recoveryId === draft.recoveryId;
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

  const recoveryId = tab.recoveryId;
  if (!recoveryId) {
    // Should not happen for new pathless tabs; skip callers via eligibility.
    return {
      ...base,
      recoveryId: "missing-recovery-id",
      origin: guessPathlessOrigin(tab.name),
    };
  }

  return {
    ...base,
    recoveryId,
    origin: guessPathlessOrigin(tab.name),
  };
}

function guessPathlessOrigin(name: string): "untitled" | "import-assist" {
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
    if (tab.path.length === 0) {
      if (!tab.recoveryId || tab.contents.length === 0) {
        return false;
      }
      // Oversized pathless still "eligible" so write path can report failure.
      return true;
    }
    return true;
  });
}

export function isPathlessDraftOversized(draft: DraftRecord): boolean {
  return isPathlessDraft(draft) && draft.contents.length > PATHLESS_DRAFT_MAX_CHARS;
}

/**
 * Prune with separate rules:
 * - pathless: TTL + per-draft char cap + pathless total budget
 * - path-backed: no pathless TTL/char cap; only total path budget + order
 */
export function pruneDraftRecords(
  drafts: DraftRecord[],
  now = Date.now(),
): DraftRecord[] {
  const pathless: DraftRecord[] = [];
  const pathBacked: DraftRecord[] = [];

  for (const draft of drafts) {
    if (isPathlessDraft(draft)) {
      if (now - draft.updatedAt > PATHLESS_DRAFT_TTL_MS) {
        continue;
      }
      if (draft.contents.length > PATHLESS_DRAFT_MAX_CHARS) {
        continue;
      }
      if (!draft.recoveryId) {
        continue;
      }
      pathless.push(draft);
    } else if (draft.path.length > 0) {
      pathBacked.push(draft);
    }
  }

  const keepByBudget = (
    list: DraftRecord[],
    maxTotal: number,
    maxRecords: number,
  ): DraftRecord[] => {
    const sorted = [...list].sort((a, b) => b.updatedAt - a.updatedAt);
    const kept: DraftRecord[] = [];
    let total = 0;
    for (const draft of sorted) {
      if (kept.length >= maxRecords) {
        break;
      }
      const next = total + draft.contents.length;
      if (next > maxTotal) {
        continue;
      }
      kept.push(draft);
      total = next;
    }
    return kept;
  };

  return [
    ...keepByBudget(
      pathless,
      PATHLESS_DRAFT_STORE_MAX_TOTAL_CHARS,
      PATHLESS_DRAFT_STORE_MAX_RECORDS,
    ),
    ...keepByBudget(
      pathBacked,
      PATH_DRAFT_STORE_MAX_TOTAL_CHARS,
      PATH_DRAFT_STORE_MAX_RECORDS,
    ),
  ];
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
    if (match.startsWith("path:") || match.startsWith("pathless:")) {
      return removeDraftByKey(drafts, match);
    }
    return drafts.filter((draft) => draft.path !== match);
  }
  return removeDraftByKey(drafts, draftStorageKey(match));
}
