import {
  DRAFT_STATE_STORAGE_KEY,
  MAX_RECENT_ITEMS,
  MAX_STORED_DRAFTS,
  RECENT_FILES_STORAGE_KEY,
  RECENT_FOLDERS_STORAGE_KEY,
  WORKSPACE_STATE_STORAGE_KEY,
  type DraftRecord,
  type EditorTab,
  type PersistedWorkspaceState,
  type RecentEntry,
} from "../types";

export function readStoredDrafts(): DraftRecord[] {
  const value = window.localStorage.getItem(DRAFT_STATE_STORAGE_KEY);

  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(isDraftRecord)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_STORED_DRAFTS);
  } catch {
    return [];
  }
}

export function writeStoredDrafts(drafts: DraftRecord[]) {
  const normalizedDrafts = drafts
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_STORED_DRAFTS);

  if (normalizedDrafts.length === 0) {
    window.localStorage.removeItem(DRAFT_STATE_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(
    DRAFT_STATE_STORAGE_KEY,
    JSON.stringify(normalizedDrafts),
  );
}

export function removeStoredDraft(path: string) {
  writeStoredDrafts(readStoredDrafts().filter((draft) => draft.path !== path));
}

export function removeStoredDrafts(paths: string[]) {
  if (paths.length === 0) {
    return;
  }

  writeStoredDrafts(
    readStoredDrafts().filter((draft) => !paths.includes(draft.path)),
  );
}

export function draftRecordFromTab(tab: EditorTab): DraftRecord {
  return {
    path: tab.path,
    contents: tab.contents,
    line_ending: tab.line_ending,
    savedFingerprint: tab.fingerprint,
    updatedAt: Date.now(),
  };
}

export function upsertDraftRecord(
  drafts: DraftRecord[],
  nextDraft: DraftRecord,
): DraftRecord[] {
  return [
    nextDraft,
    ...drafts.filter((draft) => draft.path !== nextDraft.path),
  ].slice(0, MAX_STORED_DRAFTS);
}

export function readStoredRecentFiles(): RecentEntry[] {
  return readStoredRecentEntries(RECENT_FILES_STORAGE_KEY);
}

export function readStoredRecentFolders(): RecentEntry[] {
  return readStoredRecentEntries(RECENT_FOLDERS_STORAGE_KEY);
}

export function writeStoredRecentFiles(entries: RecentEntry[]) {
  writeStoredRecentEntries(RECENT_FILES_STORAGE_KEY, entries);
}

export function writeStoredRecentFolders(entries: RecentEntry[]) {
  writeStoredRecentEntries(RECENT_FOLDERS_STORAGE_KEY, entries);
}

export function upsertRecentEntry(
  entries: RecentEntry[],
  path: string,
  label: string,
): RecentEntry[] {
  // Preserve an existing pin across the upsert. Re-opening a
  // pinned file should not silently unpin it; the user has to
  // explicitly unpin to make it fall back to the recency list.
  const existing = entries.find((entry) => entry.path === path);

  return [
    {
      path,
      label,
      openedAt: Date.now(),
      pinnedAt: existing?.pinnedAt ?? null,
    },
    ...entries.filter((entry) => entry.path !== path),
  ].slice(0, MAX_RECENT_ITEMS);
}

// `pinRecentEntry` sets the `pinnedAt` field on the entry that
// matches `path`. If no entry exists yet, the caller is expected
// to have already inserted one through `upsertRecentEntry` so
// the path can flow through the standard open path. The hook
// callers do exactly that: pin / unpin only fire for entries
// the user has already opened.
export function pinRecentEntry(
  entries: RecentEntry[],
  path: string,
): RecentEntry[] {
  return entries.map((entry) =>
    entry.path === path
      ? { ...entry, pinnedAt: entry.pinnedAt ?? Date.now() }
      : entry,
  );
}

export function unpinRecentEntry(
  entries: RecentEntry[],
  path: string,
): RecentEntry[] {
  return entries.map((entry) =>
    entry.path === path ? { ...entry, pinnedAt: null } : entry,
  );
}

export function readPersistedWorkspaceState(): PersistedWorkspaceState | null {
  const value = window.localStorage.getItem(WORKSPACE_STATE_STORAGE_KEY);

  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<PersistedWorkspaceState>;

    return {
      workspaceRootPath:
        typeof parsed.workspaceRootPath === "string"
          ? parsed.workspaceRootPath
          : null,
      workspaceRootBookmark: Array.isArray(parsed.workspaceRootBookmark)
        ? parsed.workspaceRootBookmark.filter(
            (byte): byte is number =>
              Number.isInteger(byte) && byte >= 0 && byte <= 255,
          )
        : null,
      tabPaths: Array.isArray(parsed.tabPaths)
        ? parsed.tabPaths.filter((path): path is string => typeof path === "string")
        : [],
      activeTabPath:
        typeof parsed.activeTabPath === "string" ? parsed.activeTabPath : null,
    };
  } catch {
    return null;
  }
}

export function writePersistedWorkspaceState(state: PersistedWorkspaceState) {
  const existing = readPersistedWorkspaceState();
  const workspaceRootBookmark =
    state.workspaceRootBookmark !== undefined
      ? state.workspaceRootBookmark
      : existing?.workspaceRootPath === state.workspaceRootPath
        ? existing.workspaceRootBookmark
        : null;

  window.localStorage.setItem(
    WORKSPACE_STATE_STORAGE_KEY,
    JSON.stringify({ ...state, workspaceRootBookmark }),
  );
}

export function writeWorkspaceRootBookmark(
  workspaceRootPath: string,
  workspaceRootBookmark: number[] | null,
) {
  const existing = readPersistedWorkspaceState();

  writePersistedWorkspaceState({
    workspaceRootPath,
    workspaceRootBookmark,
    tabPaths: existing?.tabPaths ?? [],
    activeTabPath: existing?.activeTabPath ?? null,
  });
}

function readStoredRecentEntries(storageKey: string): RecentEntry[] {
  const value = window.localStorage.getItem(storageKey);

  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(isRecentEntry)
      .map(normalizeRecentEntry)
      .sort(recentEntryOrder)
      .slice(0, MAX_RECENT_ITEMS);
  } catch {
    return [];
  }
}

function writeStoredRecentEntries(storageKey: string, entries: RecentEntry[]) {
  const normalizedEntries = entries
    .map(normalizeRecentEntry)
    .sort(recentEntryOrder)
    .slice(0, MAX_RECENT_ITEMS);

  if (normalizedEntries.length === 0) {
    window.localStorage.removeItem(storageKey);
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(normalizedEntries));
}

// `normalizeRecentEntry` back-fills the `pinnedAt` field for
// entries written by an older build that did not know about
// the field. The read filter already enforces the shape, so
// the cast is safe at this point.
function normalizeRecentEntry(value: RecentEntry): RecentEntry {
  if (value.pinnedAt === null || typeof value.pinnedAt === "number") {
    return value;
  }

  return { ...value, pinnedAt: null };
}

// `recentEntryOrder` is the sort key the start panel uses to
// surface pinned entries above recents and break ties on
// recency. Pinned entries are sorted by `pinnedAt` (most
// recently pinned first); unpinned entries fall through to
// `openedAt`.
function recentEntryOrder(left: RecentEntry, right: RecentEntry): number {
  const leftPinned = left.pinnedAt ?? 0;
  const rightPinned = right.pinnedAt ?? 0;

  if (leftPinned !== rightPinned) {
    return rightPinned - leftPinned;
  }

  return right.openedAt - left.openedAt;
}

function isRecentEntry(value: unknown): value is RecentEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<RecentEntry>;

  return (
    typeof candidate.path === "string" &&
    typeof candidate.label === "string" &&
    typeof candidate.openedAt === "number"
  );
}

function isDraftRecord(value: unknown): value is DraftRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<DraftRecord>;

  return (
    typeof candidate.path === "string" &&
    typeof candidate.contents === "string" &&
    (candidate.line_ending === "lf" || candidate.line_ending === "crlf") &&
    typeof candidate.savedFingerprint === "string" &&
    typeof candidate.updatedAt === "number"
  );
}
