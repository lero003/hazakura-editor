import { BOOK_SCOPE_STORAGE_KEY } from "../../types";
import {
  MAX_BOOK_SCOPE_CHAPTERS,
  normalizeBookScopeRelativePath,
} from "./model";

export const BOOK_SCOPE_STORAGE_VERSION = 1;
export const MAX_PERSISTED_BOOK_SCOPES = 8;

export type PersistedBookScope = {
  workspaceRootPath: string;
  chapterRelativePaths: string[];
  updatedAt: number;
};

export type PersistedBookScopeRegistry = {
  version: typeof BOOK_SCOPE_STORAGE_VERSION;
  workspaces: PersistedBookScope[];
};

const EMPTY_REGISTRY: PersistedBookScopeRegistry = {
  version: BOOK_SCOPE_STORAGE_VERSION,
  workspaces: [],
};

export function readBookScopeRegistry(): PersistedBookScopeRegistry {
  const raw = window.localStorage.getItem(BOOK_SCOPE_STORAGE_KEY);
  if (!raw) return EMPTY_REGISTRY;
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedBookScopeRegistry>;
    if (parsed.version !== BOOK_SCOPE_STORAGE_VERSION || !Array.isArray(parsed.workspaces)) {
      return EMPTY_REGISTRY;
    }
    const workspaces = parsed.workspaces
      .map(readScope)
      .filter((scope): scope is PersistedBookScope => scope !== null)
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, MAX_PERSISTED_BOOK_SCOPES);
    return { version: BOOK_SCOPE_STORAGE_VERSION, workspaces };
  } catch {
    return EMPTY_REGISTRY;
  }
}

export function readBookScope(workspaceRootPath: string): PersistedBookScope | null {
  return (
    readBookScopeRegistry().workspaces.find(
      (scope) => scope.workspaceRootPath === workspaceRootPath,
    ) ?? null
  );
}

export function writeBookScope(
  workspaceRootPath: string,
  chapterRelativePaths: readonly string[],
  updatedAt = Date.now(),
): PersistedBookScopeRegistry {
  const paths = sanitizePaths(chapterRelativePaths);
  const registry = readBookScopeRegistry();
  const remaining = registry.workspaces.filter(
    (scope) => scope.workspaceRootPath !== workspaceRootPath,
  );
  const workspaces = paths.length
    ? [{ workspaceRootPath, chapterRelativePaths: paths, updatedAt }, ...remaining]
    : remaining;
  const next = {
    version: BOOK_SCOPE_STORAGE_VERSION,
    workspaces: workspaces
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, MAX_PERSISTED_BOOK_SCOPES),
  } satisfies PersistedBookScopeRegistry;
  window.localStorage.setItem(BOOK_SCOPE_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function migrateBookScopeWorkspaceRoot(
  oldWorkspaceRootPath: string,
  newWorkspaceRootPath: string,
): void {
  if (!oldWorkspaceRootPath || oldWorkspaceRootPath === newWorkspaceRootPath) return;
  const oldScope = readBookScope(oldWorkspaceRootPath);
  if (!oldScope || readBookScope(newWorkspaceRootPath)) return;
  writeBookScope(newWorkspaceRootPath, oldScope.chapterRelativePaths, oldScope.updatedAt);
  writeBookScope(oldWorkspaceRootPath, []);
}

function readScope(value: unknown): PersistedBookScope | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<PersistedBookScope>;
  if (
    typeof candidate.workspaceRootPath !== "string" ||
    !candidate.workspaceRootPath ||
    !Array.isArray(candidate.chapterRelativePaths) ||
    typeof candidate.updatedAt !== "number" ||
    !Number.isFinite(candidate.updatedAt)
  ) {
    return null;
  }
  const chapterRelativePaths = sanitizePaths(candidate.chapterRelativePaths);
  if (!chapterRelativePaths.length) return null;
  return {
    workspaceRootPath: candidate.workspaceRootPath,
    chapterRelativePaths,
    updatedAt: candidate.updatedAt,
  };
}

function sanitizePaths(paths: readonly unknown[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const value of paths) {
    if (typeof value !== "string") continue;
    const path = normalizeBookScopeRelativePath(value);
    if (!path || seen.has(path)) continue;
    seen.add(path);
    normalized.push(path);
    if (normalized.length >= MAX_BOOK_SCOPE_CHAPTERS) break;
  }
  return normalized;
}
