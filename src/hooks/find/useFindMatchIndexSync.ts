import { useEffect, type Dispatch, type SetStateAction } from "react";
import type { SearchOptions } from "../../types";

type UseFindMatchIndexSyncOptions = {
  activeMatchIndex: number;
  documentKey: string;
  findMatchCount: number;
  findQuery: string;
  searchOptions: SearchOptions;
  setActiveMatchIndex: Dispatch<SetStateAction<number>>;
};

export function useFindMatchIndexSync({
  activeMatchIndex,
  documentKey,
  findMatchCount,
  findQuery,
  searchOptions,
  setActiveMatchIndex,
}: UseFindMatchIndexSyncOptions) {
  useEffect(() => {
    setActiveMatchIndex(0);
  }, [documentKey, findQuery, searchOptions, setActiveMatchIndex]);

  useEffect(() => {
    if (activeMatchIndex >= findMatchCount) {
      setActiveMatchIndex(Math.max(findMatchCount - 1, 0));
    }
  }, [activeMatchIndex, findMatchCount, setActiveMatchIndex]);
}
