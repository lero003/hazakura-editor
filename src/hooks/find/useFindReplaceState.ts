import { useCallback, useEffect, useState } from "react";
import type { SearchOptions, TextMatch } from "../../types";
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
  // 置換直後の「次に選ぶ位置」を state で持つ。ref だと source が変わらない
  // 置換（同じ語への置換）で再描画が起きず、消費されないまま残る。
  const [pendingSelectAfterReplace, setPendingSelectAfterReplace] = useState<{
    matchesAtRequest: readonly TextMatch[];
    position: number;
    sourceWillChange: boolean;
  } | null>(null);
  const { findMatches, invalidRegex } = useFindMatches({
    options: searchOptions,
    query: findQuery,
    source,
  });
  const findMatchCount = findMatches.length;

  // 置換すると当該一致は消える（置換語に検索語が残れば残る）。番号を 1 つ進める方式
  // だと、消えた一致のぶん次の一致を飛ばす。置換後の文書で作り直された一致一覧から、
  // 「置換位置より後ろの最初の一致」を選び直す。無ければ先頭へ循環する。
  const selectAfterReplacement = useCallback(
    (matchIndex: number, replacement: string) => {
      const match = findMatches[matchIndex];

      if (!match) {
        return;
      }

      setPendingSelectAfterReplace({
        matchesAtRequest: findMatches,
        position: match.from + replacement.length,
        // 同じ語への置換では source が変わらないので、一致一覧の更新を待たない。
        sourceWillChange: source.slice(match.from, match.to) !== replacement,
      });
    },
    [findMatches, source],
  );

  useEffect(() => {
    if (pendingSelectAfterReplace === null) {
      return;
    }

    if (
      pendingSelectAfterReplace.sourceWillChange &&
      findMatches === pendingSelectAfterReplace.matchesAtRequest
    ) {
      // 置換後の内容で一致一覧がまだ作り直されていない（deferred な更新など）。
      // ここで消費すると、消える前の一覧から次を選んでしまう。
      return;
    }

    setPendingSelectAfterReplace(null);

    if (findMatches.length === 0) {
      return;
    }

    const nextIndex = findMatches.findIndex(
      (match) => match.from >= pendingSelectAfterReplace.position,
    );
    setActiveMatchIndex(nextIndex >= 0 ? nextIndex : 0);
  }, [findMatches, pendingSelectAfterReplace, setActiveMatchIndex]);

  return {
    activeMatchIndex,
    findMatchCount,
    findMatches,
    findQuery,
    findVisible,
    invalidRegex,
    // 置換直後の選択が未処理の間は、件数による範囲補正に上書きさせない。
    pendingSelectAfterReplace,
    replaceQuery,
    searchOptions,
    selectAfterReplacement,
    setActiveMatchIndex,
    setFindQuery,
    setFindVisible,
    setReplaceQuery,
    setSearchOptions,
  };
}
