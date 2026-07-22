import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  resolveBookScope,
  type BookScopeChapter,
  type BookScopeUnavailableEntry,
} from "../../lib/tauri/bookScope";
import {
  bookRecipeErrorMessage,
  defaultBookRecipeFileName,
  flattenBookScopeNodes,
  parseBookRecipe,
  readBookScope,
  remapBookScopeNodePathPrefix,
  removeBookScopeNodePath,
  serializeBookRecipe,
  suggestBookScopeFromDiscovery,
  type BookScopeSuggestion,
  type BookScopeSuggestionOptions,
  type BookScopeNode,
  writeBookScope,
} from "../../features/bookScope";
import {
  pickBookRecipeFile,
  pickBookRecipeSavePath,
} from "../../lib/tauri/dialog";
import { openTextFile, saveTextFileAs } from "../../lib/tauri/files";
import { cancelOkfBundleScan, scanOkfBundle } from "../../lib/tauri/okf";
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
  const [nodes, setNodes] = useState<BookScopeNode[]>([]);
  const chapterRelativePaths = useMemo(
    () => flattenBookScopeNodes(nodes),
    [nodes],
  );
  const [chapters, setChapters] = useState<BookScopeChapter[]>([]);
  const [unavailable, setUnavailable] = useState<BookScopeUnavailableEntry[]>([]);
  const [resolving, setResolving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const requestIdRef = useRef(0);
  const suggestionRequestIdRef = useRef(0);
  const suggestionActiveRef = useRef(false);

  useEffect(() => {
    suggestionRequestIdRef.current += 1;
    suggestionActiveRef.current = false;
    setSuggesting(false);
    setSuggestionError(null);
    setNodes(
      workspaceRootPath
        ? (readBookScope(workspaceRootPath)?.nodes ?? [])
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
              ? `本: ${result.unavailable.length}項目を利用できません`
              : `Book: ${result.unavailable.length} item(s) unavailable`,
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
            ? "本の確認に失敗しました"
            : "Book validation failed",
        );
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setResolving(false);
      });
  }, [chapterRelativePaths, menuLanguage, revision, setGlobalError, setStatus, workspaceRootPath]);

  const commitNodes = useCallback(
    (nextNodes: readonly BookScopeNode[]) => {
      if (!workspaceRootPath) return;
      const persisted = writeBookScope(workspaceRootPath, nextNodes);
      const savedScope =
        persisted.workspaces.find(
          (scope) => scope.workspaceRootPath === workspaceRootPath,
        ) ?? null;
      const saved = savedScope?.chapterRelativePaths ?? [];
      setNodes(savedScope?.nodes ?? []);
      setStatus(
        isJapaneseMenuLanguage(menuLanguage)
          ? saved.length
            ? `本を保存しました: ${saved.length}項目`
            : "本の設定を解除しました"
          : saved.length
            ? `Book saved: ${saved.length} item(s)`
            : "Book cleared",
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
      setNodes((current) => {
        const next = remapBookScopeNodePathPrefix(
          current,
          oldRelative,
          newRelative,
        );
        const persisted = writeBookScope(workspaceRootPath, next);
        return (
          persisted.workspaces.find(
            (scope) => scope.workspaceRootPath === workspaceRootPath,
          )?.nodes ?? []
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
      setNodes((current) => {
        const next = removeBookScopeNodePath(
          current,
          relative,
          includeDescendants,
        );
        const persisted = writeBookScope(workspaceRootPath, next);
        return (
          persisted.workspaces.find(
            (scope) => scope.workspaceRootPath === workspaceRootPath,
          )?.nodes ?? []
        );
      });
    },
    [workspaceRootPath],
  );

  const createSuggestion = useCallback(async (
    options: BookScopeSuggestionOptions,
  ): Promise<BookScopeSuggestion | null> => {
    if (!workspaceRootPath || suggestionActiveRef.current) return null;
    const requestId = ++suggestionRequestIdRef.current;
    suggestionActiveRef.current = true;
    setSuggesting(true);
    setSuggestionError(null);
    setStatus(
      isJapaneseMenuLanguage(menuLanguage)
        ? "章候補を探しています…"
        : "Looking for chapter suggestions…",
    );
    try {
      const discovery = await scanOkfBundle(workspaceRootPath, workspaceRootPath);
      if (requestId !== suggestionRequestIdRef.current) return null;
      if (discovery.cancelled) {
        setStatus(
          isJapaneseMenuLanguage(menuLanguage)
            ? "章候補の走査を停止しました"
            : "Chapter suggestion scan stopped",
        );
        return null;
      }
      const suggestion = suggestBookScopeFromDiscovery(discovery, options);
      setStatus(
        isJapaneseMenuLanguage(menuLanguage)
          ? `本の候補を作りました: ${suggestion.chapterRelativePaths.length}件`
          : `Book draft created: ${suggestion.chapterRelativePaths.length} item(s)`,
      );
      return suggestion;
    } catch (error) {
      if (requestId !== suggestionRequestIdRef.current) return null;
      const message = String(error);
      setSuggestionError(message);
      setStatus(
        isJapaneseMenuLanguage(menuLanguage)
          ? "章候補を作れませんでした"
          : "Could not create chapter suggestions",
      );
      return null;
    } finally {
      if (requestId === suggestionRequestIdRef.current) {
        suggestionActiveRef.current = false;
        setSuggesting(false);
      }
    }
  }, [menuLanguage, setStatus, workspaceRootPath]);

  const cancelSuggestion = useCallback(() => {
    void cancelOkfBundleScan().catch((error) => {
      setSuggestionError(String(error));
    });
  }, []);

  const exportBookRecipe = useCallback(async () => {
    if (!workspaceRootPath || chapterRelativePaths.length === 0) {
      setStatus(
        isJapaneseMenuLanguage(menuLanguage)
          ? "書き出す章立てがありません"
          : "No book chapters to export",
      );
      return;
    }
    const label =
      workspaceRootPath.split(/[\\/]/).filter(Boolean).at(-1) ?? null;
    try {
      const destPath = await pickBookRecipeSavePath(
        defaultBookRecipeFileName(label),
      );
      if (!destPath) return;
      await saveTextFileAs(
        destPath,
        serializeBookRecipe(nodes),
        "lf",
        "utf-8",
        workspaceRootPath,
      );
      setStatus(
        isJapaneseMenuLanguage(menuLanguage)
          ? `章立てを書き出しました: ${destPath}`
          : `Book recipe exported: ${destPath}`,
      );
    } catch (error) {
      setGlobalError(String(error));
      setStatus(
        isJapaneseMenuLanguage(menuLanguage)
          ? "章立ての書き出しに失敗しました"
          : "Book recipe export failed",
      );
    }
  }, [
    chapterRelativePaths.length,
    menuLanguage,
    nodes,
    setGlobalError,
    setStatus,
    workspaceRootPath,
  ]);

  /**
   * Loads a portable recipe as an editable draft only.
   * Callers must pass the nodes to the Book panel; nothing is saved until Save.
   */
  const importBookRecipeDraft = useCallback(async (): Promise<{
    nodes: BookScopeNode[];
    chapterRelativePaths: string[];
  } | null> => {
    if (!workspaceRootPath) return null;
    try {
      const sourcePath = await pickBookRecipeFile();
      if (!sourcePath) return null;
      const document = await openTextFile(sourcePath);
      const parsed = parseBookRecipe(document.contents);
      if (!parsed.ok) {
        const message = bookRecipeErrorMessage(
          parsed.error,
          isJapaneseMenuLanguage(menuLanguage) ? "ja" : "en",
        );
        setSuggestionError(message);
        setStatus(message);
        return null;
      }
      setSuggestionError(null);
      setStatus(
        isJapaneseMenuLanguage(menuLanguage)
          ? `章立てを取り込みました（下書き）: ${parsed.chapterRelativePaths.length}件。保存するまで反映しません`
          : `Book recipe loaded as draft: ${parsed.chapterRelativePaths.length} item(s). Save to apply.`,
      );
      return {
        nodes: parsed.nodes,
        chapterRelativePaths: parsed.chapterRelativePaths,
      };
    } catch (error) {
      const message = String(error);
      setSuggestionError(message);
      setStatus(
        isJapaneseMenuLanguage(menuLanguage)
          ? "章立ての取り込みに失敗しました"
          : "Book recipe import failed",
      );
      return null;
    }
  }, [menuLanguage, setStatus, workspaceRootPath]);

  return {
    bookScopeChapterRelativePaths: chapterRelativePaths,
    bookScopeNodes: nodes,
    bookScopeChapters: chapters,
    bookScopeResolving: resolving,
    bookScopeSuggesting: suggesting,
    bookScopeSuggestionError: suggestionError,
    bookScopeUnavailable: unavailable,
    commitBookScopeNodes: commitNodes,
    createBookScopeSuggestion: createSuggestion,
    cancelBookScopeSuggestion: cancelSuggestion,
    exportBookRecipe,
    importBookRecipeDraft,
    revalidateBookScope: () => setRevision((current) => current + 1),
    remapBookScopeWorkspaceEntry: remapWorkspaceEntry,
    removeBookScopeWorkspaceEntry: removeWorkspaceEntry,
  };
}
