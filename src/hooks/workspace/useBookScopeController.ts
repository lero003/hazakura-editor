import { useCallback, useEffect, useRef, useState } from "react";
import {
  resolveBookScope,
  type BookScopeChapter,
  type BookScopeUnavailableEntry,
} from "../../lib/tauri/bookScope";
import {
  readBookScope,
  remapBookScopePathPrefix,
  removeBookScopePath,
  writeBookScope,
} from "../../features/bookScope";
import { workspaceRelativePath } from "./workspaceRelativePath";
import { isJapaneseMenuLanguage, type MenuLanguage } from "../../types";

type UseBookScopeControllerOptions = {
  setGlobalError: (message: string | null) => void;
  setStatus: (message: string) => void;
  menuLanguage: MenuLanguage;
  workspaceRootPath: string | null;
};

export function useBookScopeController({
  setGlobalError,
  setStatus,
  menuLanguage,
  workspaceRootPath,
}: UseBookScopeControllerOptions) {
  const [chapterRelativePaths, setChapterRelativePaths] = useState<string[]>([]);
  const [chapters, setChapters] = useState<BookScopeChapter[]>([]);
  const [unavailable, setUnavailable] = useState<BookScopeUnavailableEntry[]>([]);
  const [resolving, setResolving] = useState(false);
  const [revision, setRevision] = useState(0);
  const requestIdRef = useRef(0);

  useEffect(() => {
    setChapterRelativePaths(
      workspaceRootPath
        ? (readBookScope(workspaceRootPath)?.chapterRelativePaths ?? [])
        : [],
    );
  }, [workspaceRootPath]);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    if (!workspaceRootPath || chapterRelativePaths.length === 0) {
      setChapters([]);
      setUnavailable([]);
      setResolving(false);
      return;
    }

    setResolving(true);
    void resolveBookScope(workspaceRootPath, chapterRelativePaths)
      .then((result) => {
        if (requestId !== requestIdRef.current) return;
        setChapters(result.chapters);
        setUnavailable(result.unavailable);
        if (result.unavailable.length > 0) {
          setStatus(
            isJapaneseMenuLanguage(menuLanguage)
              ? `Book Scope: ${result.unavailable.length}章を利用できません`
              : `Book Scope: ${result.unavailable.length} chapter(s) unavailable`,
          );
        }
      })
      .catch((error) => {
        if (requestId !== requestIdRef.current) return;
        setChapters([]);
        setUnavailable([]);
        setGlobalError(String(error));
        setStatus(
          isJapaneseMenuLanguage(menuLanguage)
            ? "Book Scopeの確認に失敗しました"
            : "Book Scope validation failed",
        );
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setResolving(false);
      });
  }, [chapterRelativePaths, menuLanguage, revision, setGlobalError, setStatus, workspaceRootPath]);

  const commitChapterPaths = useCallback(
    (nextPaths: readonly string[]) => {
      if (!workspaceRootPath) return;
      const persisted = writeBookScope(workspaceRootPath, nextPaths);
      const saved =
        persisted.workspaces.find(
          (scope) => scope.workspaceRootPath === workspaceRootPath,
        )?.chapterRelativePaths ?? [];
      setChapterRelativePaths(saved);
      setStatus(
        isJapaneseMenuLanguage(menuLanguage)
          ? saved.length
            ? `Book Scopeを保存しました: ${saved.length}章`
            : "Book Scopeを解除しました"
          : saved.length
            ? `Book Scope saved: ${saved.length} chapter(s)`
            : "Book Scope cleared",
      );
    },
    [menuLanguage, setStatus, workspaceRootPath],
  );

  const remapWorkspaceEntry = useCallback(
    (oldPath: string, newPath: string) => {
      if (!workspaceRootPath) return;
      const oldRelative = workspaceRelativePath({ workspaceRoot: workspaceRootPath, filePath: oldPath });
      const newRelative = workspaceRelativePath({ workspaceRoot: workspaceRootPath, filePath: newPath });
      if (!oldRelative || !newRelative) return;
      setChapterRelativePaths((current) => {
        const next = remapBookScopePathPrefix(current, oldRelative, newRelative);
        const persisted = writeBookScope(workspaceRootPath, next);
        return (
          persisted.workspaces.find(
            (scope) => scope.workspaceRootPath === workspaceRootPath,
          )?.chapterRelativePaths ?? []
        );
      });
    },
    [workspaceRootPath],
  );

  const removeWorkspaceEntry = useCallback(
    (path: string, includeDescendants: boolean) => {
      if (!workspaceRootPath) return;
      const relative = workspaceRelativePath({ workspaceRoot: workspaceRootPath, filePath: path });
      if (!relative) return;
      setChapterRelativePaths((current) => {
        const next = removeBookScopePath(current, relative, includeDescendants);
        const persisted = writeBookScope(workspaceRootPath, next);
        return (
          persisted.workspaces.find(
            (scope) => scope.workspaceRootPath === workspaceRootPath,
          )?.chapterRelativePaths ?? []
        );
      });
    },
    [workspaceRootPath],
  );

  return {
    bookScopeChapterRelativePaths: chapterRelativePaths,
    bookScopeChapters: chapters,
    bookScopeResolving: resolving,
    bookScopeUnavailable: unavailable,
    commitBookScopeChapterPaths: commitChapterPaths,
    revalidateBookScope: () => setRevision((current) => current + 1),
    remapBookScopeWorkspaceEntry: remapWorkspaceEntry,
    removeBookScopeWorkspaceEntry: removeWorkspaceEntry,
  };
}
