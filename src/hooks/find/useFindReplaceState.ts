import { useState } from "react";
import type { SearchOptions } from "../../types";
import { useFindMatches } from "./useFindMatches";

export function useFindReplaceState(source: string) {
  const [findQuery, setFindQuery] = useState("");
  const [replaceQuery, setReplaceQuery] = useState("");
  const [findVisible, setFindVisible] = useState(false);
  const [searchOptions, setSearchOptions] = useState<SearchOptions>({
    caseSensitive: false,
    wholeWord: false,
    regex: false,
  });
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const { findMatches, invalidRegex } = useFindMatches({
    options: searchOptions,
    query: findQuery,
    source,
  });
  const findMatchCount = findMatches.length;

  return {
    activeMatchIndex,
    findMatchCount,
    findMatches,
    findQuery,
    findVisible,
    invalidRegex,
    replaceQuery,
    searchOptions,
    setActiveMatchIndex,
    setFindQuery,
    setFindVisible,
    setReplaceQuery,
    setSearchOptions,
  };
}
