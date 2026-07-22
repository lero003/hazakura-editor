import { BOOK_READER_POSITION_STORAGE_KEY } from "../../types";
import { normalizeBookScopeRelativePath } from "./model";

export const BOOK_READER_POSITION_STORAGE_VERSION = 1;
export const MAX_PERSISTED_BOOK_READER_POSITIONS = 8;

export type BookReaderPosition = {
  workspaceRootPath: string;
  /** Relative path of the chapter last shown as current. */
  relativePath: string;
  /** 0–1 scroll progress of the manuscript container. */
  scrollRatio: number;
  updatedAt: number;
};

export type BookReaderPositionRegistry = {
  version: typeof BOOK_READER_POSITION_STORAGE_VERSION;
  workspaces: BookReaderPosition[];
};

const EMPTY_REGISTRY: BookReaderPositionRegistry = {
  version: BOOK_READER_POSITION_STORAGE_VERSION,
  workspaces: [],
};

export function clampScrollRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function readBookReaderPositionRegistry(): BookReaderPositionRegistry {
  const raw = window.localStorage.getItem(BOOK_READER_POSITION_STORAGE_KEY);
  if (!raw) return EMPTY_REGISTRY;
  try {
    const parsed = JSON.parse(raw) as {
      version?: unknown;
      workspaces?: unknown;
    };
    if (
      parsed.version !== BOOK_READER_POSITION_STORAGE_VERSION ||
      !Array.isArray(parsed.workspaces)
    ) {
      return EMPTY_REGISTRY;
    }
    const workspaces = parsed.workspaces
      .map(readPosition)
      .filter((entry): entry is BookReaderPosition => entry !== null)
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, MAX_PERSISTED_BOOK_READER_POSITIONS);
    return { version: BOOK_READER_POSITION_STORAGE_VERSION, workspaces };
  } catch {
    return EMPTY_REGISTRY;
  }
}

export function readBookReaderPosition(
  workspaceRootPath: string,
): BookReaderPosition | null {
  return (
    readBookReaderPositionRegistry().workspaces.find(
      (entry) => entry.workspaceRootPath === workspaceRootPath,
    ) ?? null
  );
}

export function writeBookReaderPosition(
  workspaceRootPath: string,
  relativePathInput: string,
  scrollRatioInput: number,
  updatedAt = Date.now(),
): BookReaderPositionRegistry {
  const relativePath = normalizeBookScopeRelativePath(relativePathInput);
  if (!workspaceRootPath || !relativePath) {
    return readBookReaderPositionRegistry();
  }
  const scrollRatio = clampScrollRatio(scrollRatioInput);
  const remaining = readBookReaderPositionRegistry().workspaces.filter(
    (entry) => entry.workspaceRootPath !== workspaceRootPath,
  );
  const next: BookReaderPositionRegistry = {
    version: BOOK_READER_POSITION_STORAGE_VERSION,
    workspaces: [
      { workspaceRootPath, relativePath, scrollRatio, updatedAt },
      ...remaining,
    ]
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, MAX_PERSISTED_BOOK_READER_POSITIONS),
  };
  window.localStorage.setItem(
    BOOK_READER_POSITION_STORAGE_KEY,
    JSON.stringify(next),
  );
  return next;
}

export function clearBookReaderPosition(workspaceRootPath: string): void {
  const next = {
    version: BOOK_READER_POSITION_STORAGE_VERSION,
    workspaces: readBookReaderPositionRegistry().workspaces.filter(
      (entry) => entry.workspaceRootPath !== workspaceRootPath,
    ),
  } satisfies BookReaderPositionRegistry;
  window.localStorage.setItem(
    BOOK_READER_POSITION_STORAGE_KEY,
    JSON.stringify(next),
  );
}

/**
 * Map a saved relative path onto the currently loaded reader documents.
 * Returns the first chapter when the saved path is no longer available.
 */
export function resolveReaderDocumentIndex(
  documents: ReadonlyArray<{ relativePath: string }>,
  relativePath: string | null | undefined,
): number {
  if (documents.length === 0) return 0;
  if (!relativePath) return 0;
  const index = documents.findIndex(
    (document) => document.relativePath === relativePath,
  );
  return index >= 0 ? index : 0;
}

function readPosition(value: unknown): BookReaderPosition | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<BookReaderPosition>;
  if (
    typeof candidate.workspaceRootPath !== "string" ||
    !candidate.workspaceRootPath ||
    typeof candidate.relativePath !== "string" ||
    typeof candidate.scrollRatio !== "number" ||
    typeof candidate.updatedAt !== "number" ||
    !Number.isFinite(candidate.updatedAt)
  ) {
    return null;
  }
  const relativePath = normalizeBookScopeRelativePath(candidate.relativePath);
  if (!relativePath) return null;
  return {
    workspaceRootPath: candidate.workspaceRootPath,
    relativePath,
    scrollRatio: clampScrollRatio(candidate.scrollRatio),
    updatedAt: candidate.updatedAt,
  };
}
