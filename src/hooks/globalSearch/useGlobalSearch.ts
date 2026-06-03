import { useCallback, useEffect, useRef, useState } from "react";
import {
  searchWorkspaceFiles,
  type WorkspaceSearchResult,
} from "../../lib/tauri/workspace";

// `GlobalSearchRow` is the flattened representation the modal
// renders: one row per (file, match) pair. The flat shape keeps
// keyboard navigation (ArrowUp/ArrowDown/Enter) trivial — it is
// the same trick the command palette uses for its filtered list.
//
// `fileIndex` / `matchIndex` are kept around so a row can be
// re-resolved back to the originating `WorkspaceSearchFileResult`
// without re-walking the array.
export type GlobalSearchRow = {
  fileIndex: number;
  matchIndex: number;
  file: import("../../lib/tauri/workspace").WorkspaceSearchFileResult;
  match: import("../../lib/tauri/workspace").WorkspaceSearchMatch;
};

export type GlobalSearchSummary = {
  totalMatches: number;
  totalFilesScanned: number;
  truncated: boolean;
};

type UseGlobalSearchOptions = {
  workspaceRoot: string | null;
  onOpenMatch: (row: GlobalSearchRow) => void;
};

type UseGlobalSearchResult = {
  activeIndex: number;
  closeGlobalSearch: () => void;
  globalSearchVisible: boolean;
  openGlobalSearch: () => void;
  query: string;
  rows: GlobalSearchRow[];
  searchError: string | null;
  searching: boolean;
  setActiveIndex: (index: number) => void;
  setQuery: (query: string) => void;
  summary: GlobalSearchSummary | null;
};

const SEARCH_DEBOUNCE_MS = 150;

function flattenMatches(result: WorkspaceSearchResult): GlobalSearchRow[] {
  const rows: GlobalSearchRow[] = [];
  result.files.forEach((file, fileIndex) => {
    file.matches.forEach((match, matchIndex) => {
      rows.push({ fileIndex, matchIndex, file, match });
    });
  });
  return rows;
}

function summarize(result: WorkspaceSearchResult): GlobalSearchSummary {
  return {
    totalMatches: result.totalMatches,
    totalFilesScanned: result.totalFilesScanned,
    truncated: result.truncated,
  };
}

export function useGlobalSearch({
  workspaceRoot,
  onOpenMatch,
}: UseGlobalSearchOptions): UseGlobalSearchResult {
  const [globalSearchVisible, setGlobalSearchVisible] = useState(false);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<GlobalSearchRow[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [summary, setSummary] = useState<GlobalSearchSummary | null>(null);

  // `requestSeq` is bumped on every query change / open. Each
  // search response carries the seq it was kicked off with; if
  // the seq no longer matches the latest, the response is stale
  // and we drop it. This avoids the classic "fast typing → old
  // result wins" race that a plain setTimeout cannot prevent.
  const requestSeqRef = useRef(0);
  const latestSeqRef = useRef(0);

  useEffect(() => {
    if (!globalSearchVisible) {
      return;
    }
    if (!workspaceRoot) {
      setRows([]);
      setSummary(null);
      setSearchError("Open a workspace to search its files.");
      return;
    }
    if (!query.trim()) {
      setRows([]);
      setSummary(null);
      setSearchError(null);
      return;
    }

    const seq = ++latestSeqRef.current;
    requestSeqRef.current = seq;
    setSearching(true);
    setSearchError(null);

    const handle = window.setTimeout(() => {
      searchWorkspaceFiles(workspaceRoot, query)
        .then((result) => {
          if (requestSeqRef.current !== seq) {
            return;
          }
          setRows(flattenMatches(result));
          setSummary(summarize(result));
          setSearching(false);
        })
        .catch((error: unknown) => {
          if (requestSeqRef.current !== seq) {
            return;
          }
          // Tauri commands reject with `String` (the `Err` arm of
          // `Result<_, String>`), so the actual Rust error message
          // would be dropped by an `instanceof Error` check. Match
          // the agent workbench helper and stringify directly.
          setSearchError(String(error));
          setRows([]);
          setSummary(null);
          setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(handle);
    };
  }, [globalSearchVisible, query, workspaceRoot]);

  useEffect(() => {
    setActiveIndex(0);
  }, [rows.length, globalSearchVisible]);

  const openGlobalSearch = useCallback(() => {
    setGlobalSearchVisible(true);
    setQuery("");
    setActiveIndex(0);
    setRows([]);
    setSummary(null);
    setSearchError(null);
  }, []);

  const closeGlobalSearch = useCallback(() => {
    setGlobalSearchVisible(false);
    setSearchError(null);
  }, []);

  return {
    activeIndex,
    closeGlobalSearch,
    globalSearchVisible,
    openGlobalSearch,
    query,
    rows,
    searchError,
    searching,
    setActiveIndex,
    setQuery,
    summary,
  };
}
