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
import { isPathInsideDirectory, normalizeAbsolutePath } from "./utils";

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

    const tabFileBookmarks = readPersistedFileBookmarks(
      parsed.tabFileBookmarks,
    );
    const state: PersistedWorkspaceState = {
      workspaceRootPath:
        typeof parsed.workspaceRootPath === "string"
          ? parsed.workspaceRootPath
          : null,
      workspaceRootBookmark: Array.isArray(parsed.workspaceRootBookmark)
        ? normalizeBookmarkBytes(parsed.workspaceRootBookmark)
        : null,
      tabPaths: Array.isArray(parsed.tabPaths)
        ? parsed.tabPaths.filter((path): path is string => typeof path === "string")
        : [],
      activeTabPath:
        typeof parsed.activeTabPath === "string" ? parsed.activeTabPath : null,
    };
    if (Object.keys(tabFileBookmarks).length > 0) {
      state.tabFileBookmarks = tabFileBookmarks;
    }
    return state;
  } catch {
    return null;
  }
}

export function writePersistedWorkspaceState(state: PersistedWorkspaceState) {
  const existing = readPersistedWorkspaceState();
  const resolvedRoot = resolveWorkspaceRootForWrite(state, existing);
  const tabFileBookmarks = resolveTabFileBookmarksForWrite(state, existing);
  const nextState: PersistedWorkspaceState = {
    workspaceRootPath: resolvedRoot.workspaceRootPath,
    workspaceRootBookmark: resolvedRoot.workspaceRootBookmark,
    tabPaths: state.tabPaths,
    activeTabPath: state.activeTabPath,
  };
  if (Object.keys(tabFileBookmarks).length > 0) {
    nextState.tabFileBookmarks = tabFileBookmarks;
  }

  window.localStorage.setItem(
    WORKSPACE_STATE_STORAGE_KEY,
    JSON.stringify(nextState),
  );
}

function normalizeBookmarkBytes(value: unknown): number[] {
  return Array.isArray(value)
    ? value.filter(
        (byte): byte is number =>
          Number.isInteger(byte) && byte >= 0 && byte <= 255,
      )
    : [];
}

function readPersistedFileBookmarks(
  value: unknown,
): Record<string, number[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value).reduce<Record<string, number[]>>(
    (bookmarks, [path, bookmark]) => {
      const normalized = normalizeBookmarkBytes(bookmark);
      if (normalized.length > 0) {
        bookmarks[path] = normalized;
      }
      return bookmarks;
    },
    {},
  );
}

function resolveTabFileBookmarksForWrite(
  state: PersistedWorkspaceState,
  existing: PersistedWorkspaceState | null,
): Record<string, number[]> {
  return state.tabPaths.reduce<Record<string, number[]>>((bookmarks, path) => {
    const bookmark = findPersistedFileBookmark(path, state, existing);
    const normalized = normalizeBookmarkBytes(bookmark);
    if (normalized.length > 0) {
      bookmarks[path] = normalized;
    }
    return bookmarks;
  }, {});
}

function findPersistedFileBookmark(
  path: string,
  state: PersistedWorkspaceState,
  existing: PersistedWorkspaceState | null,
): number[] | undefined {
  const directBookmark =
    state.tabFileBookmarks?.[path] ?? existing?.tabFileBookmarks?.[path];
  if (directBookmark) {
    return directBookmark;
  }

  for (const candidatePath of equivalentMacOSPrivatePaths(path)) {
    const bookmark =
      state.tabFileBookmarks?.[candidatePath] ??
      existing?.tabFileBookmarks?.[candidatePath];
    if (bookmark) {
      return bookmark;
    }
  }

  return undefined;
}

function equivalentMacOSPrivatePaths(path: string): string[] {
  const normalized = normalizeAbsolutePath(path);
  const aliases = new Set<string>();

  if (normalized.startsWith("/private/tmp/")) {
    aliases.add(normalized.replace(/^\/private\/tmp/, "/tmp"));
  } else if (normalized.startsWith("/tmp/")) {
    aliases.add(normalized.replace(/^\/tmp/, "/private/tmp"));
  }

  if (normalized.startsWith("/private/var/")) {
    aliases.add(normalized.replace(/^\/private\/var/, "/var"));
  } else if (normalized.startsWith("/var/")) {
    aliases.add(normalized.replace(/^\/var/, "/private/var"));
  }

  return Array.from(aliases);
}

// `resolveWorkspaceRootForWrite` decides which workspace
// root (path + bookmark) to write alongside `state`. The
// bookmark is the only thing the next launch needs to
// re-authorize the same folder through the file picker,
// but `useWorkspaceRestore` only consults the bookmark
// when `persistedState.workspaceRootPath` is truthy, so
// the path has to be preserved too on the partial-restore
// shape. The hierarchy is:
//
// 1. An explicit `workspaceRootBookmark` on the incoming
//    state always wins (the caller has spoken); the
//    `workspaceRootPath` is taken from the incoming state
//    as-is.
// 2. Otherwise, if the workspaceRootPath is unchanged
//    from the previous write, the previous bookmark is
//    preserved (same workspace, same grant).
// 3. Otherwise, if the incoming state lost its
//    workspaceRootPath but at least one tab path still
//    sits inside the previous workspace, the previous
//    workspaceRootPath and its bookmark are preserved
//    together (partial restore: the user has not actually
//    left the folder, the workspace tree grant was just
//    dropped on relaunch). Without this branch the next
//    launch would not even reach the bookmark-resolution
//    path because `useWorkspaceRestore` only attempts it
//    for truthy `workspaceRootPath`.
// 4. Otherwise the bookmark is null and the
//    workspaceRootPath mirrors the incoming state
//    (different workspace opened, or no in-workspace
//    tab anchoring the previous folder).
function resolveWorkspaceRootForWrite(
  state: PersistedWorkspaceState,
  existing: PersistedWorkspaceState | null,
): {
  workspaceRootPath: string | null;
  workspaceRootBookmark: number[] | null;
} {
  if (state.workspaceRootBookmark !== undefined) {
    return {
      workspaceRootPath: state.workspaceRootPath ?? null,
      workspaceRootBookmark: state.workspaceRootBookmark,
    };
  }
  if (!existing) {
    return {
      workspaceRootPath: state.workspaceRootPath ?? null,
      workspaceRootBookmark: null,
    };
  }
  if (existing.workspaceRootPath === state.workspaceRootPath) {
    return {
      workspaceRootPath: existing.workspaceRootPath,
      workspaceRootBookmark: existing.workspaceRootBookmark ?? null,
    };
  }
  if (tabsReferenceExistingWorkspace(state, existing)) {
    return {
      workspaceRootPath: existing.workspaceRootPath,
      workspaceRootBookmark: existing.workspaceRootBookmark ?? null,
    };
  }
  return {
    workspaceRootPath: state.workspaceRootPath ?? null,
    workspaceRootBookmark: null,
  };
}

// `tabsReferenceExistingWorkspace` returns true when the
// incoming state lost its `workspaceRootPath` (e.g. a
// partial restore where the workspace tree grant was
// dropped on relaunch but the tab files are still
// reachable) and at least one of its tab paths is still
// strictly inside the previous `workspaceRootPath`.
//
// In that case the user has not actually left the old
// folder — they are still editing a file in it. The
// security-scoped bookmark is the only thing that lets
// the next launch re-authorize that folder through the
// file picker, so dropping it on this write would mean
// the user has to pick the folder from scratch again
// even though the partial restore already proved they
// were just in it. Keeping the bookmark alive for this
// shape is intentionally narrower than the
// `useWorkspaceStatePersistence` empty-restore guard:
// the effect-level guard only fires on
// `tabs = [] && workspaceRootPath = null`, whereas this
// helper also handles `tabs.length > 0 && workspaceRootPath = null`
// when a tab path still anchors the workspace context.
//
// The check keys on `isPathInsideDirectory` rather than a
// free-form string match so `..` segments, redundant
// separators, and the workspace root itself cannot trick
// the heuristic into dragging a stale bookmark across.
function tabsReferenceExistingWorkspace(
  state: PersistedWorkspaceState,
  existing: PersistedWorkspaceState | null,
): boolean {
  if (!existing) {
    return false;
  }
  if (existing.workspaceRootPath === null) {
    return false;
  }
  if (state.workspaceRootPath !== null) {
    return false;
  }
  if (state.tabPaths.length === 0) {
    return false;
  }

  const existingRoot = existing.workspaceRootPath;
  return state.tabPaths.some((tabPath) =>
    isPathInsideDirectory(tabPath, existingRoot),
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

export function writePersistedFileBookmark(
  path: string,
  fileBookmark: number[] | null,
) {
  const existing = readPersistedWorkspaceState();
  const tabFileBookmarks = {
    ...(existing?.tabFileBookmarks ?? {}),
  };
  const normalized = normalizeBookmarkBytes(fileBookmark);

  if (normalized.length > 0) {
    tabFileBookmarks[path] = normalized;
  } else {
    delete tabFileBookmarks[path];
  }

  const nextState: PersistedWorkspaceState = {
    workspaceRootPath: existing?.workspaceRootPath ?? null,
    workspaceRootBookmark: existing?.workspaceRootBookmark ?? null,
    tabPaths: existing?.tabPaths ?? [],
    activeTabPath: existing?.activeTabPath ?? null,
  };
  if (Object.keys(tabFileBookmarks).length > 0) {
    nextState.tabFileBookmarks = tabFileBookmarks;
  }

  window.localStorage.setItem(
    WORKSPACE_STATE_STORAGE_KEY,
    JSON.stringify(nextState),
  );
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
