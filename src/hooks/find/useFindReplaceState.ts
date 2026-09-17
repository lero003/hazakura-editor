import { useCallback, useEffect, useRef, useState } from "react";
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
  const pendingSelectFromRef = useRef<number | null>(null);
  const { findMatches, invalidRegex } = useFindMatches({
    options: searchOptions,
    query: findQuery,
    source,
  });
  const findMatchCount = findMatches.length;

  // 置換すると当該一致は消える（置換語に検索語が残れば残る）。番号を 1 つ進める方式
  // だと、消えた一致のぶん次の一致を飛ばす。置換後の文書で作り直された一致一覧から、
  // 「置換位置より後ろの最初の一致」を選び直す。無ければ先頭へ循環する。
  const selectMatchAfter = useCallback((position: number) => {
    pendingSelectFromRef.current = position;
  }, []);

  useEffect(() => {
    const from = pendingSelectFromRef.current;

    if (from === null) {
      return;
    }

    pendingSelectFromRef.current = null;

    if (findMatches.length === 0) {
      return;
    }

    const nextIndex = findMatches.findIndex((match) => match.from >= from);
    setActiveMatchIndex(nextIndex >= 0 ? nextIndex : 0);
  }, [findMatches, setActiveMatchIndex]);

  return {
    activeMatchIndex,
    findMatchCount,
    findMatches,
    findQuery,
    findVisible,
    invalidRegex,
    replaceQuery,
    searchOptions,
    selectMatchAfter,
    setActiveMatchIndex,
    setFindQuery,
    setFindVisible,
    setReplaceQuery,
    setSearchOptions,
  };
}
