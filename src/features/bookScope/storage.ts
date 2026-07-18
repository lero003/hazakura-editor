import { BOOK_SCOPE_STORAGE_KEY } from "../../types";
import {
  documentBookScopeNodes,
  flattenBookScopeNodes,
  MAX_BOOK_SCOPE_CHAPTERS,
  type BookScopeNode,
  normalizeBookScopeRelativePath,
  sanitizeBookScopeNodes,
} from "./model";

export const BOOK_SCOPE_STORAGE_VERSION = 2;
export const MAX_PERSISTED_BOOK_SCOPES = 8;

export type PersistedBookScope = {
  workspaceRootPath: string;
  nodes: BookScopeNode[];
  /** Derived preorder retained for Rust validation, Reader, PDF, and migration callers. */
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
    const parsed = JSON.parse(raw) as {
      version?: unknown;
      workspaces?: unknown;
    };
    if (
      (parsed.version !== BOOK_SCOPE_STORAGE_VERSION && parsed.version !== 1) ||
      !Array.isArray(parsed.workspaces)
    ) {
      return EMPTY_REGISTRY;
    }
    const workspaces = parsed.workspaces
      .map((value) => readScope(value, parsed.version === 1))
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
  nodesOrPaths: readonly BookScopeNode[] | readonly string[],
  updatedAt = Date.now(),
): PersistedBookScopeRegistry {
  const nodes = sanitizeNodesOrPaths(nodesOrPaths);
  const chapterRelativePaths = flattenBookScopeNodes(nodes);
  const registry = readBookScopeRegistry();
  const remaining = registry.workspaces.filter(
    (scope) => scope.workspaceRootPath !== workspaceRootPath,
  );
  const workspaces = chapterRelativePaths.length
    ? [{ workspaceRootPath, nodes, chapterRelativePaths, updatedAt }, ...remaining]
    : remaining;
  const next = {
    version: BOOK_SCOPE_STORAGE_VERSION,
    workspaces: workspaces
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, MAX_PERSISTED_BOOK_SCOPES),
  } satisfies PersistedBookScopeRegistry;
  window.localStorage.setItem(
    BOOK_SCOPE_STORAGE_KEY,
    JSON.stringify({
      version: BOOK_SCOPE_STORAGE_VERSION,
      workspaces: next.workspaces.map(
        ({ chapterRelativePaths: _derivedPaths, ...scope }) => scope,
      ),
    }),
  );
  return next;
}

export function migrateBookScopeWorkspaceRoot(
  oldWorkspaceRootPath: string,
  newWorkspaceRootPath: string,
): void {
  if (!oldWorkspaceRootPath || oldWorkspaceRootPath === newWorkspaceRootPath) return;
  const oldScope = readBookScope(oldWorkspaceRootPath);
  if (!oldScope || readBookScope(newWorkspaceRootPath)) return;
  writeBookScope(newWorkspaceRootPath, oldScope.nodes, oldScope.updatedAt);
  writeBookScope(oldWorkspaceRootPath, []);
}

function readScope(value: unknown, legacyFlat: boolean): PersistedBookScope | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<PersistedBookScope>;
  if (
    typeof candidate.workspaceRootPath !== "string" ||
    !candidate.workspaceRootPath ||
    typeof candidate.updatedAt !== "number" ||
    !Number.isFinite(candidate.updatedAt)
  ) {
    return null;
  }
  const rawCandidate = value as {
    nodes?: unknown;
    chapterRelativePaths?: unknown;
  };
  const nodes = legacyFlat
    ? documentBookScopeNodes(
        Array.isArray(rawCandidate.chapterRelativePaths)
          ? sanitizePaths(rawCandidate.chapterRelativePaths)
          : [],
      )
    : sanitizeBookScopeNodes(
        Array.isArray(rawCandidate.nodes) ? rawCandidate.nodes : [],
      );
  const chapterRelativePaths = flattenBookScopeNodes(nodes);
  if (!chapterRelativePaths.length) return null;
  return {
    workspaceRootPath: candidate.workspaceRootPath,
    nodes,
    chapterRelativePaths,
    updatedAt: candidate.updatedAt,
  };
}

function sanitizeNodesOrPaths(
  value: readonly BookScopeNode[] | readonly string[],
): BookScopeNode[] {
  if (value.every((entry) => typeof entry === "string")) {
    return sanitizeBookScopeNodes(documentBookScopeNodes(value as readonly string[]));
  }
  return sanitizeBookScopeNodes(value as readonly BookScopeNode[]);
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
